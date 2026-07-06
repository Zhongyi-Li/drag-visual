# Editor Data Binding Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let editor users bind selected chart components to datasets and fields from the right inspector panel.

**Architecture:** Reuse existing contracts, MSW dataset APIs, registry `dataSlots`, and the existing `component.binding.update` command. Add one small editor-core command for registering dashboard datasets, then implement the inspector form as a focused component called by `InspectorPanel`.

**Tech Stack:** React 19, Ant Design, TanStack Query, Zustand, Vitest, Testing Library, MSW, Zod contracts.

---

## File Map

- `packages/editor-core/src/commands.ts`: add `dashboard.dataset.upsert`.
- `packages/editor-core/src/reducer.ts`: validate and apply dataset registration.
- `packages/editor-core/src/reducer.test.ts`: cover valid upsert and duplicate replacement.
- `apps/web/src/features/editor/ComponentBindingPanel.tsx`: new dataset/field binding UI.
- `apps/web/src/features/editor/ComponentBindingPanel.test.tsx`: focused UI tests using MSW fixtures.
- `apps/web/src/features/editor/InspectorPanel.tsx`: delegate selected component configuration to `ComponentBindingPanel`.
- `apps/web/src/features/editor/EditorShell.tsx`: pass registry into `InspectorPanel`.
- `apps/web/src/features/editor/EditorShell.test.tsx`: update selected-component expectation from placeholder to binding UI.

## Task 1: Add Dashboard Dataset Upsert Command

**Files:**
- Modify: `packages/editor-core/src/commands.ts`
- Modify: `packages/editor-core/src/reducer.ts`
- Modify: `packages/editor-core/src/reducer.test.ts`

- [ ] **Step 1: Write failing reducer tests**

Add tests covering:

```ts
it("upserts a dashboard dataset reference", () => {
  const updated = applyCommand(initialDashboard, {
    type: "dashboard.dataset.upsert",
    dataset: {
      datasetId: "sales",
      schemaVersion: "v1",
      parameters: { year: 0, fromDate: "2026-01-01" },
    },
  });
  expect(updated.datasets).toContainEqual({
    datasetId: "sales",
    schemaVersion: "v1",
    parameters: { year: 0, fromDate: "2026-01-01" },
  });
});

it("replaces an existing dashboard dataset reference", () => {
  const withDataset = {
    ...initialDashboard,
    datasets: [{ datasetId: "sales", schemaVersion: "old", parameters: {} }],
  };
  const updated = applyCommand(withDataset, {
    type: "dashboard.dataset.upsert",
    dataset: {
      datasetId: "sales",
      schemaVersion: "v1",
      parameters: { year: 0 },
    },
  });
  expect(updated.datasets).toEqual([
    { datasetId: "sales", schemaVersion: "v1", parameters: { year: 0 } },
  ]);
});
```

- [ ] **Step 2: Run reducer tests and verify RED**

Run: `corepack pnpm --filter @drag-visual/editor-core exec vitest run src/reducer.test.ts`

Expected: FAIL because `dashboard.dataset.upsert` is not part of `EditorCommand`.

- [ ] **Step 3: Implement the command type and reducer branch**

Add this command:

```ts
export interface DashboardDatasetUpsertCommand {
  readonly type: "dashboard.dataset.upsert";
  readonly dataset: Dashboard["datasets"][number];
}
```

Include it in `EditorCommand`, then add a reducer branch that replaces an existing dataset with the same `datasetId` or appends it.

- [ ] **Step 4: Run reducer tests and verify GREEN**

Run: `corepack pnpm --filter @drag-visual/editor-core exec vitest run src/reducer.test.ts`

Expected: PASS.

## Task 2: Build The Component Binding Panel

**Files:**
- Create: `apps/web/src/features/editor/ComponentBindingPanel.tsx`
- Create: `apps/web/src/features/editor/ComponentBindingPanel.test.tsx`
- Modify: `apps/web/src/features/editor/InspectorPanel.tsx`
- Modify: `apps/web/src/features/editor/EditorShell.tsx`
- Modify: `apps/web/src/features/editor/EditorShell.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Create tests that render an editor store with a selected bar component and assert:

```ts
expect(await screen.findByRole("combobox", { name: "数据集" })).toBeInTheDocument();
expect(screen.getByLabelText("分类字段")).toBeInTheDocument();
expect(screen.getByLabelText("数值字段")).toBeInTheDocument();
```

Then select `销售数据`, bind `月份` to the category slot and `收入` to the value slot, and assert the store contains:

```ts
expect(component.binding).toEqual({
  datasetId: "sales",
  slots: {
    dimension: { fieldKey: "month" },
    measure: { fieldKey: "revenue" },
  },
});
expect(store.getState().history.present.datasets).toContainEqual({
  datasetId: "sales",
  schemaVersion: "v1",
  parameters: {
    year: 0,
    fromDate: "2026-01-01",
  },
});
```

- [ ] **Step 2: Run UI tests and verify RED**

Run: `corepack pnpm --dir apps/web exec vitest run src/features/editor/ComponentBindingPanel.test.tsx src/features/editor/EditorShell.test.tsx`

Expected: FAIL because `ComponentBindingPanel.tsx` does not exist and `InspectorPanel` still renders placeholder text.

- [ ] **Step 3: Implement minimal binding panel**

Implement `ComponentBindingPanel` with:

- `useQuery({ queryKey: ["datasets"], queryFn: listDatasets })`;
- selected dataset schema query via `getDataset(datasetId)`;
- Ant Design `Select` for dataset and each slot;
- deterministic required-parameter defaults;
- `dashboard.dataset.upsert` dispatch before `component.binding.update`;
- field filtering by slot `acceptedTypes`;
- clear action dispatching `component.binding.update` with `undefined`.

- [ ] **Step 4: Wire the panel into the inspector**

Pass `registry` from `EditorShell` to `InspectorPanel`. In `InspectorPanel`, use `registry.get(selected.type)` and render `ComponentBindingPanel` for non-text selected components. Keep the current empty state when no component is selected and render a simple no-data message for text components.

- [ ] **Step 5: Run focused UI tests and verify GREEN**

Run: `corepack pnpm --dir apps/web exec vitest run src/features/editor/ComponentBindingPanel.test.tsx src/features/editor/EditorShell.test.tsx`

Expected: PASS.

## Task 3: Verify Integrated Frontend Behavior

**Files:**
- Modify only files touched by Tasks 1 and 2 if verification exposes failures.

- [ ] **Step 1: Run editor-core and web focused suites**

Run:

```bash
corepack pnpm --filter @drag-visual/editor-core exec vitest run src/reducer.test.ts
corepack pnpm --dir apps/web exec vitest run src/features/editor/ComponentBindingPanel.test.tsx src/features/editor/EditorShell.test.tsx src/features/viewer/DashboardViewer.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run: `corepack pnpm typecheck`

Expected: PASS.

- [ ] **Step 3: Check workspace hygiene**

Run: `git diff --check && git status --short --untracked-files=all`

Expected: no whitespace errors. Untracked `.pnpm-store/v11/` may still be present from the earlier local dev-server run and should be handled separately before commit.
