# Phase 4 Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current Phase 4 working tree from partially verified placeholder behavior into a truthful, testable MVP slice with stable persistence, atomic publishing, real shared rendering, schema-drift isolation, and performance safeguards.

**Architecture:** Draft and published routes use separate endpoints but one editor-free viewer. The viewer resolves saved dataset references, validates bindings through the component registry/data engine, queries rows with saved parameters, and delegates to a focused renderer package; component-local boundaries isolate failures.

**Tech Stack:** React 19, TanStack Query, Ant Design, ECharts, Zod, NestJS, Prisma, Vitest, Testing Library, pnpm workspace.

---

## File Map

- `apps/web/src/features/datasets/DatasetWorkspace.test.tsx`: deterministic dataset-workspace interaction test.
- `apps/web/src/features/editor/EditorRoute.tsx`: autosave, explicit conflict recovery, save-before-preview/publish orchestration.
- `apps/api/src/publishing/*`: validated transactional publication and stable HTTP errors.
- `packages/component-registry/src/definitions/*`: six component definitions, props schemas, layouts, and slot contracts.
- `packages/chart-renderer/*`: pure option/view-model builders and editor-independent React renderers.
- `apps/web/src/features/viewer/DashboardViewer.tsx`: layout, dataset resolution, component query states, drift warnings, and renderer composition.
- `apps/web/src/features/viewer/ComponentErrorBoundary.tsx`: component-local sanitized fallback.
- `docs/performance/baseline.md`: reproducible performance evidence and structural limits.

### Task 1: Stabilize the Dataset Workspace Test

**Files:**
- Modify: `apps/web/src/features/datasets/DatasetWorkspace.test.tsx`
- Test: `apps/web/src/features/datasets/DatasetWorkspace.test.tsx`

- [ ] **Step 1: Reproduce the timeout in isolation**

Run: `/usr/local/bin/pnpm --filter @drag-visual/web test -- DatasetWorkspace.test.tsx --reporter=verbose`

Expected: FAIL at the 5-second test timeout or reveal the exact query/interaction that never settles.

- [ ] **Step 2: Replace brittle Ant Design popup events with user-level interaction**

Use `userEvent` and assert each asynchronous boundary before moving to the next one:

```tsx
const user = userEvent.setup();
render(<AppProviders><DatasetWorkspace /></AppProviders>);

await user.click(await screen.findByRole("combobox", { name: "数据集" }));
await user.click(await screen.findByRole("option", { name: "销售数据" }));
expect(await screen.findByText("收入")).toBeInTheDocument();

await user.clear(screen.getByRole("spinbutton", { name: "年份" }));
await user.type(screen.getByRole("spinbutton", { name: "年份" }), "2026");
await user.type(screen.getByRole("textbox", { name: "开始日期" }), "2026-01-01{enter}");
await user.click(screen.getByRole("button", { name: /查.*询/ }));

expect(await screen.findByText("120000")).toBeInTheDocument();
expect(requestBody).toEqual({ parameters: { year: 2026, fromDate: "2026-01-01" } });
```

- [ ] **Step 3: Run the focused test repeatedly**

Run: `/usr/local/bin/pnpm --filter @drag-visual/web test -- DatasetWorkspace.test.tsx --repeat=5`

Expected: PASS five times without increasing `testTimeout`.

- [ ] **Step 4: Commit the stabilization**

```bash
git add apps/web/src/features/datasets/DatasetWorkspace.test.tsx
git commit -m "test: stabilize dataset workspace interactions"
```

### Task 2: Close Persistence and Publishing Behavior

**Files:**
- Modify: `apps/web/src/features/editor/EditorRoute.test.tsx`
- Modify: `apps/web/src/features/editor/EditorRoute.tsx`
- Modify: `apps/web/src/features/editor/useAutosave.test.tsx`
- Modify: `apps/api/src/publishing/publishing.service.test.ts`
- Modify: `apps/api/src/publishing/prisma-publishing.repository.test.ts`
- Modify: `apps/api/src/publishing/prisma-publishing.repository.ts`
- Test: the files above

- [ ] **Step 1: Add a failing publish-preservation test**

```ts
it("preserves the previous snapshot when the next draft is invalid", async () => {
  const repository = new InMemoryPublishingRepository();
  repository.seed({ id: dashboard.id, draftSchema: { ...dashboard, schemaVersion: 2 }, publishedSchema: dashboard });
  await expect(new PublishingService(repository).publish(dashboard.id))
    .rejects.toBeInstanceOf(InvalidDraftSchemaError);
  await expect(repository.getPublished(dashboard.id)).resolves.toEqual(dashboard);
});
```

- [ ] **Step 2: Run the test and verify it fails if publication mutates first**

Run: `/usr/local/bin/pnpm --filter @drag-visual/api test -- publishing.service.test.ts`

Expected: the new test fails only if validation and replacement are not atomic; otherwise it documents the already-correct behavior.

- [ ] **Step 3: Keep validation inside the transaction callback**

```ts
async publish(id: string): Promise<Dashboard> {
  const published = await this.repository.publishDraft(id, (draft) => {
    try { return migrateDashboard(draft); }
    catch { throw new InvalidDraftSchemaError(id); }
  });
  if (published === null) throw new DashboardNotFoundForPublishingError(id);
  return published;
}
```

- [ ] **Step 4: Add editor assertions for save-before-navigation**

```tsx
await user.click(screen.getByRole("button", { name: "预览" }));
await waitFor(() => expect(saveRequest).toHaveBeenCalledOnce());
expect(openSpy).toHaveBeenCalledWith(`/preview/${dashboard.id}`, "_blank", "noopener,noreferrer");

await user.click(screen.getByRole("button", { name: "发布" }));
await waitFor(() => expect(publishRequest).toHaveBeenCalledWith(dashboard.id));
```

Also assert a rejected save prevents both `window.open` and `publishRequest`.

- [ ] **Step 5: Run persistence and publishing checks**

Run: `/usr/local/bin/pnpm --filter @drag-visual/web test -- useAutosave.test.tsx EditorRoute.test.tsx && /usr/local/bin/pnpm --filter @drag-visual/api test -- publishing`

Expected: PASS.

- [ ] **Step 6: Commit the completed slice**

```bash
git add apps/web/src/features/editor apps/web/src/features/dashboards apps/api/src/publishing apps/api/src/app.module.ts apps/api/src/dashboards/prisma-dashboard.repository.ts packages/contracts/src
git commit -m "feat: stabilize dashboard save and publishing"
```

### Task 3: Implement the Six-Component Registry and Renderer Package

**Files:**
- Create: `packages/component-registry/src/definitions/line.ts`
- Create: `packages/component-registry/src/definitions/pie.ts`
- Create: `packages/component-registry/src/definitions/kpi.ts`
- Create: `packages/component-registry/src/definitions/table.ts`
- Create: `packages/component-registry/src/definitions/text.ts`
- Modify: `packages/component-registry/src/index.ts`
- Create: `packages/chart-renderer/package.json`
- Create: `packages/chart-renderer/tsconfig.json`
- Create: `packages/chart-renderer/tsconfig.build.json`
- Create: `packages/chart-renderer/vitest.config.ts`
- Create: `packages/chart-renderer/src/index.ts`
- Create: `packages/chart-renderer/src/options.ts`
- Create: `packages/chart-renderer/src/DashboardComponentRenderer.tsx`
- Test: `packages/component-registry/src/registry.test.ts`
- Test: `packages/chart-renderer/src/DashboardComponentRenderer.test.tsx`
- Test: `packages/chart-renderer/src/options.test.ts`

- [ ] **Step 1: Write failing registry coverage**

```ts
it("registers all six MVP component types", () => {
  expect(createDefaultRegistry().list().map((item) => item.type).sort())
    .toEqual(["bar", "kpi", "line", "pie", "table", "text"]);
});
```

- [ ] **Step 2: Define exact slot contracts and defaults**

Implement definitions with these contracts:

```ts
// line: dimension(string|date, one), measures(number, many)
// pie: dimension(string|date, one), measure(number, one)
// kpi: measure(number, one), aggregation first|sum|avg|max|min
// table: columns(string|number|date|boolean, many)
// text: no binding, plain content only
```

Register all definitions in `createDefaultRegistry()` and keep their props schemas strict.

- [ ] **Step 3: Run registry tests**

Run: `/usr/local/bin/pnpm --filter @drag-visual/component-registry test`

Expected: PASS with exactly six registered types.

- [ ] **Step 4: Scaffold the renderer workspace package and install ECharts**

`packages/chart-renderer/package.json` must expose `dist/index.js`, depend on contracts/component-registry, and peer-depend on React. Add `echarts` to the package with:

Run: `/usr/local/bin/pnpm --filter @drag-visual/chart-renderer add echarts`

Expected: `packages/chart-renderer/package.json` and `pnpm-lock.yaml` contain the pinned dependency.

- [ ] **Step 5: Write failing pure-builder tests**

```ts
expect(buildBarOption(component, rows).series[0]).toMatchObject({ type: "bar" });
expect(buildKpiValue([10, 20], "sum")).toBe(30);
expect(buildTableModel(component, rows).columns.map((column) => column.key))
  .toEqual(["month", "revenue"]);
```

- [ ] **Step 6: Implement renderer dispatch**

```tsx
export function DashboardComponentRenderer({ component, rows }: Props) {
  switch (component.type) {
    case "bar": return <EChart option={buildBarOption(component, rows)} />;
    case "line": return <EChart option={buildLineOption(component, rows)} />;
    case "pie": return <EChart option={buildPieOption(component, rows)} />;
    case "kpi": return <KpiRenderer component={component} rows={rows} />;
    case "table": return <TableRenderer component={component} rows={rows.slice(0, 100)} />;
    case "text": return <TextRenderer component={component} />;
  }
}
```

`TextRenderer` renders text nodes only. `EChart` initializes once, calls `setOption` only when `option` changes, observes size, and disposes on unmount.

- [ ] **Step 7: Run renderer tests and typechecks**

Run: `/usr/local/bin/pnpm --filter @drag-visual/chart-renderer test && /usr/local/bin/pnpm --filter @drag-visual/chart-renderer typecheck`

Expected: PASS.

- [ ] **Step 8: Commit the renderer vertical slice**

```bash
git add packages/component-registry packages/chart-renderer pnpm-lock.yaml
git commit -m "feat: add six-component dashboard renderer"
```

### Task 4: Integrate Dataset Resolution into the Shared Viewer

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/features/viewer/ViewerComponent.tsx`
- Modify: `apps/web/src/features/viewer/DashboardViewer.tsx`
- Modify: `apps/web/src/features/viewer/DashboardViewer.test.tsx`
- Modify: `apps/web/src/features/preview/PreviewRoute.tsx`
- Modify: `apps/web/src/features/view/ViewRoute.tsx`

- [ ] **Step 1: Add failing real-output and endpoint tests**

```tsx
render(<DashboardViewer dashboard={boundBarDashboard} />);
expect(await screen.findByLabelText("月收入图表")).toBeInTheDocument();
expect(screen.queryByText("组件类型：bar")).not.toBeInTheDocument();
```

Use MSW to assert preview calls `GET /dashboards/:id`, published calls `GET /published-dashboards/:id`, and both query `POST /datasets/sales/query` with saved parameters.

- [ ] **Step 2: Add renderer dependency to Web**

Run: `/usr/local/bin/pnpm --filter @drag-visual/web add @drag-visual/chart-renderer@workspace:*`

Expected: Web package and lockfile include the workspace dependency.

- [ ] **Step 3: Implement one query-owning component wrapper**

```tsx
const savedDataset = dashboard.datasets.find((item) => item.datasetId === component.binding?.datasetId);
const schema = useQuery({
  queryKey: ["dataset-schema", component.binding?.datasetId],
  queryFn: () => getDataset(component.binding!.datasetId),
  enabled: component.binding !== undefined,
});
const data = useQuery({
  queryKey: ["dataset-query", component.binding?.datasetId, savedDataset?.parameters],
  queryFn: () => queryDataset(component.binding!.datasetId, savedDataset?.parameters ?? {}),
  enabled: component.binding !== undefined && schema.data !== undefined,
});
```

For text, skip dataset queries. For bound components, validate slots before rendering and apply `sort`/`limit` with `applyTransforms`.

- [ ] **Step 4: Replace placeholder body with the renderer package**

Compose each card as `ComponentErrorBoundary -> ViewerComponent -> DashboardComponentRenderer`. Preserve grid ordering, read-only layout, route-level retries, and published sanitization.

- [ ] **Step 5: Run viewer and route tests**

Run: `/usr/local/bin/pnpm --filter @drag-visual/web test -- DashboardViewer.test.tsx router.test.tsx`

Expected: PASS with real component output and no editor controls.

- [ ] **Step 6: Commit shared rendering integration**

```bash
git add apps/web/package.json apps/web/src/features/viewer apps/web/src/features/preview apps/web/src/features/view apps/web/src/app pnpm-lock.yaml
git commit -m "feat: render queried data in preview and published views"
```

### Task 5: Finish Drift, Isolation, and Performance Safeguards

**Files:**
- Modify: `apps/web/src/features/datasets/useDatasetSchemaDrift.ts`
- Modify: `apps/web/src/features/viewer/ComponentErrorBoundary.tsx`
- Move/Modify: `apps/web/src/features/viewer/chartOptions.test.ts` to `packages/chart-renderer/src/performance.test.ts`
- Modify: `apps/web/src/features/datasets/DataPreview.test.tsx`
- Modify: `docs/performance/baseline.md`

- [ ] **Step 1: Add deterministic drift and row-limit assertions**

```ts
expect(detectDatasetSchemaDrift(dashboard, datasets, registry)[0]?.messages)
  .toContain("字段 revenue 已不存在");
expect(screen.getAllByRole("row")).toHaveLength(101); // header + 100 data rows
```

- [ ] **Step 2: Reset boundaries when component configuration changes**

Pass a stable `resetKey` composed from component ID, props, binding, and dataset schema version. In `componentDidUpdate`, clear the captured error when the key changes.

- [ ] **Step 3: Move the 10k benchmark beside the actual option builder**

```ts
const durations = Array.from({ length: 5 }, () => {
  const started = performance.now();
  buildBarOption(component, rows10k);
  return performance.now() - started;
}).sort((a, b) => a - b);
expect(durations[2]).toBeLessThan(100);
```

Document Node version, machine, fixture, five-run median, threshold, and the deterministic 100-row DOM limit.

- [ ] **Step 4: Run reliability and performance tests**

Run: `/usr/local/bin/pnpm --filter @drag-visual/web test -- useDatasetSchemaDrift.test.ts DataPreview.test.tsx ComponentErrorBoundary.test.tsx && /usr/local/bin/pnpm --filter @drag-visual/chart-renderer test -- performance.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit safeguards**

```bash
git add apps/web/src/features/datasets apps/web/src/features/viewer packages/chart-renderer docs/performance
git commit -m "perf: close viewer reliability safeguards"
```

### Task 6: Run the Stabilization Gate

**Files:**
- Modify only files required by failures exposed by the commands below.

- [ ] **Step 1: Run typechecking**

Run: `/usr/local/bin/pnpm typecheck`

Expected: all workspace projects PASS.

- [ ] **Step 2: Run the full unit suite**

Run: `/usr/local/bin/pnpm test`

Expected: all test files and tests PASS; no timeout failures.

- [ ] **Step 3: Run the production build**

Run: `/usr/local/bin/pnpm build`

Expected: API, Web, and all packages build successfully; the published route uses the shared renderer and does not statically import editor modules.

- [ ] **Step 4: Check repository hygiene**

Run: `git diff --check && git status --short`

Expected: no whitespace errors, generated dependency caches, or unrelated files. Remaining changes belong only to the stabilization work.

- [ ] **Step 5: Route any gate failure back to its owning task**

Do not create an undifferentiated cleanup commit. A persistence failure returns to Task 2, registry/renderer failures to Task 3, viewer failures to Task 4, and drift/performance failures to Task 5; rerun that task's focused command and amend only its scoped commit before repeating Steps 1–4.

- [ ] **Step 6: Record the continuation boundary**

Report that identity/security, Playwright E2E, CI, release checklist, and manual acceptance remain the next Phase 4 continuation slice. Do not mark the entire Phase 4 release complete at this point.
