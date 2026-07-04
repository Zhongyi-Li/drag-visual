# Phase 4: Persistence, Publishing, and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe autosave, revision conflict recovery, preview and atomic publishing, shared read-only rendering, schema drift handling, performance safeguards, internal identity integration, critical E2E coverage, and a release gate.

**Architecture:** Drafts use optimistic revisions; published pages read only immutable validated snapshots. Error isolation stays local to each component, and route-level data boundaries distinguish missing, forbidden, stale, and failed upstream data.

**Tech Stack:** React, TanStack Query, Zustand, NestJS, Prisma, PostgreSQL, Zod, ECharts, Vitest, Testing Library, Playwright.

---

## Task 1: Add debounced autosave and revision conflict recovery

**Files:**
- Create: `apps/web/src/features/editor/useAutosave.ts`
- Create: `apps/web/src/features/editor/RevisionConflictModal.tsx`
- Modify: `apps/web/src/features/editor/dashboardQueries.ts`
- Modify: `apps/web/src/features/editor/EditorPage.tsx`
- Test: `apps/web/src/features/editor/useAutosave.test.tsx`

- [ ] **Step 1: Write failing autosave tests with fake timers**

```tsx
import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useAutosave } from "./useAutosave";

beforeEach(() => vi.useFakeTimers());

it("saves once after two seconds of inactivity", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  const dashboard = { id: "d1", revision: 1 } as never;
  renderHook(() => useAutosave({ dashboard, dirty: true, save, delayMs: 2_000 }));
  await act(async () => vi.advanceTimersByTimeAsync(1_999));
  expect(save).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(save).toHaveBeenCalledOnce();
});

it("does not autosave while a previous save is pending", async () => {
  let resolve!: () => void;
  const save = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
  const dashboard = { id: "d1", revision: 1 } as never;
  const { rerender } = renderHook(({ value }) => useAutosave({ dashboard: value, dirty: true, save, delayMs: 2_000 }), { initialProps: { value: dashboard } });
  await act(async () => vi.advanceTimersByTimeAsync(2_000));
  rerender({ value: { ...dashboard, name: "changed" } as never });
  await act(async () => vi.advanceTimersByTimeAsync(2_000));
  expect(save).toHaveBeenCalledOnce();
  resolve();
});
```

- [ ] **Step 2: Implement debounced autosave**

```ts
import { useEffect, useRef } from "react";
import type { Dashboard } from "@drag-visual/contracts";

export function useAutosave(input: {
  dashboard: Dashboard;
  dirty: boolean;
  save(dashboard: Dashboard): Promise<unknown>;
  delayMs?: number;
}) {
  const saving = useRef(false);
  useEffect(() => {
    if (!input.dirty || saving.current) return;
    const timer = window.setTimeout(async () => {
      saving.current = true;
      try { await input.save(input.dashboard); }
      finally { saving.current = false; }
    }, input.delayMs ?? 2_000);
    return () => window.clearTimeout(timer);
  }, [input.dashboard, input.dirty, input.delayMs, input.save]);
}
```

- [ ] **Step 3: Return structured API errors**

Change `requestJson` to throw `ApiError { status, code, message }` parsed from `{ code, message }`. `useSaveDashboard` identifies status 409/code `DASHBOARD_VERSION_CONFLICT` without string matching.

- [ ] **Step 4: Implement conflict choices without silent overwrite**

The conflict modal offers “重新加载服务端版本” and “复制为新看板”. Reload discards local edits only after explicit confirmation. Copy calls `POST /dashboards` with the local name suffixed “副本”, then saves the local schema against the new ID/revision.

- [ ] **Step 5: Run autosave tests and commit**

Run: `pnpm --filter @drag-visual/web test -- useAutosave.test.tsx && pnpm --filter @drag-visual/web typecheck`

Expected: PASS.

```bash
git add apps/web/src/features/editor apps/web/src/api/client.ts
git commit -m "feat: add safe dashboard autosave"
```

## Task 2: Publish validated snapshots atomically

**Files:**
- Create: `apps/api/src/publishing/publishing.repository.ts`
- Create: `apps/api/src/publishing/publishing.service.ts`
- Create: `apps/api/src/publishing/publishing.controller.ts`
- Create: `apps/api/src/publishing/publishing.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Test: `apps/api/src/publishing/publishing.service.test.ts`

- [ ] **Step 1: Write failing publishing service tests**

```ts
import { describe, expect, it } from "vitest";
import { InMemoryPublishingRepository } from "./publishing.repository";
import { PublishingService } from "./publishing.service";

const validDashboard = {
  schemaVersion: 1 as const,
  id: "d1",
  name: "销售看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [],
  components: [],
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-01T00:00:00.000Z",
};

describe("PublishingService", () => {
  it("copies a validated draft into the published snapshot", async () => {
    const repository = new InMemoryPublishingRepository();
    repository.seed({ id: "d1", draftSchema: validDashboard, publishedSchema: null });
    const published = await new PublishingService(repository).publish("d1");
    expect(published).toEqual(validDashboard);
    expect(await repository.getPublished("d1")).toEqual(validDashboard);
  });

  it("leaves the previous snapshot intact when validation fails", async () => {
    const repository = new InMemoryPublishingRepository();
    repository.seed({ id: "d1", draftSchema: { bad: true }, publishedSchema: validDashboard });
    await expect(new PublishingService(repository).publish("d1")).rejects.toThrow("INVALID_DRAFT_SCHEMA");
    expect(await repository.getPublished("d1")).toEqual(validDashboard);
  });
});
```

- [ ] **Step 2: Implement transactional publishing**

```ts
import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";

export interface PublishingRepository {
  getDraft(id: string): Promise<unknown | null>;
  replacePublished(id: string, snapshot: Dashboard): Promise<void>;
  getPublished(id: string): Promise<unknown | null>;
}

export class InMemoryPublishingRepository implements PublishingRepository {
  private records = new Map<string, { draftSchema: unknown; publishedSchema: unknown | null }>();
  seed(value: { id: string; draftSchema: unknown; publishedSchema: unknown | null }) {
    this.records.set(value.id, { draftSchema: value.draftSchema, publishedSchema: value.publishedSchema });
  }
  async getDraft(id: string) { return this.records.get(id)?.draftSchema ?? null; }
  async replacePublished(id: string, snapshot: Dashboard) {
    const current = this.records.get(id);
    if (!current) throw new Error("DASHBOARD_NOT_FOUND");
    this.records.set(id, { ...current, publishedSchema: structuredClone(snapshot) });
  }
  async getPublished(id: string) { return this.records.get(id)?.publishedSchema ?? null; }
}

export class PublishingService {
  constructor(private readonly repository: PublishingRepository) {}
  async publish(id: string) {
    const draft = await this.repository.getDraft(id);
    if (!draft) throw new Error("DASHBOARD_NOT_FOUND");
    const parsed = DashboardSchema.safeParse(draft);
    if (!parsed.success) throw new Error("INVALID_DRAFT_SCHEMA");
    await this.repository.replacePublished(id, structuredClone(parsed.data));
    return parsed.data;
  }
  async getPublished(id: string) {
    const snapshot = await this.repository.getPublished(id);
    if (!snapshot) throw new Error("PUBLISHED_DASHBOARD_NOT_FOUND");
    return DashboardSchema.parse(snapshot);
  }
}
```

- [ ] **Step 3: Implement Prisma transaction and routes**

```ts
// PrismaPublishingRepository core methods
async getDraft(id: string) {
  return (await this.prisma.dashboardRecord.findUnique({ where: { id }, select: { draftSchema: true } }))?.draftSchema ?? null;
}
async replacePublished(id: string, snapshot: Dashboard) {
  await this.prisma.$transaction(async (transaction) => {
    const current = await transaction.dashboardRecord.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new Error("DASHBOARD_NOT_FOUND");
    await transaction.dashboardRecord.update({ where: { id }, data: { publishedSchema: snapshot } });
  });
}
async getPublished(id: string) {
  return (await this.prisma.dashboardRecord.findUnique({ where: { id }, select: { publishedSchema: true } }))?.publishedSchema ?? null;
}
```

```ts
@Controller()
export class PublishingController {
  constructor(private readonly service: PublishingService) {}
  @Post("dashboards/:id/publish")
  publish(@Param("id") id: string) { return this.service.publish(id); }
  @Get("published-dashboards/:id")
  getPublished(@Param("id") id: string) { return this.service.getPublished(id); }
}
```

Register `PrismaPublishingRepository` behind the `PublishingRepository` token. Map `DASHBOARD_NOT_FOUND` and `PUBLISHED_DASHBOARD_NOT_FOUND` to 404; map `INVALID_DRAFT_SCHEMA` to 500 with a stable error body and no validation internals.

- [ ] **Step 4: Run publishing tests and commit**

Run: `pnpm --filter @drag-visual/api test -- publishing.service.test.ts && pnpm --filter @drag-visual/api typecheck`

Expected: PASS.

```bash
git add apps/api/src/publishing apps/api/src/app.module.ts
git commit -m "feat: publish atomic dashboard snapshots"
```

## Task 3: Build shared preview and published rendering routes

**Files:**
- Create: `apps/web/src/features/viewer/DashboardViewer.tsx`
- Create: `apps/web/src/features/viewer/PreviewPage.tsx`
- Create: `apps/web/src/features/viewer/PublishedPage.tsx`
- Create: `apps/web/src/features/viewer/viewerQueries.ts`
- Modify: `apps/web/src/features/editor/EditorPage.tsx`
- Modify: `apps/web/src/app/router.tsx`
- Test: `apps/web/src/features/viewer/DashboardViewer.test.tsx`

- [ ] **Step 1: Write a failing shared-renderer test**

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { DashboardViewer } from "./DashboardViewer";

it("renders the same component titles without editor controls", () => {
  render(<DashboardViewer dashboard={dashboardWithBar} datasets={new Map()} />);
  expect(screen.getByText("月收入")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /删除/ })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Implement the read-only dashboard viewer**

Render the same grid positions with dragging and resizing disabled. For each component, query its dataset using the saved parameters, then pass normalized rows to `DashboardComponentRenderer`. Do not import `EditorPage`, editor store, dnd-kit, or inspector modules.

- [ ] **Step 3: Implement distinct preview and published data sources**

- `/preview/:id` calls `GET /dashboards/:id` and requires edit access.
- `/view/:id` calls `GET /published-dashboards/:id` and never falls back to the draft.
- Both routes use `DashboardViewer` and the same component registry/renderer.

- [ ] **Step 4: Wire toolbar preview and publish actions**

Preview opens `/preview/:id` in a new tab after a successful manual save. Publish first saves when dirty, then calls publish; show success with the `/view/:id` link. A failed save prevents publishing.

- [ ] **Step 5: Run viewer tests and commit**

Run: `pnpm --filter @drag-visual/web test -- DashboardViewer.test.tsx && pnpm --filter @drag-visual/web build`

Expected: PASS; published route chunk does not contain editor module names in the Vite bundle report.

```bash
git add apps/web/src/features/viewer apps/web/src/features/editor apps/web/src/app/router.tsx
git commit -m "feat: add preview and published dashboard routes"
```

## Task 4: Isolate component failures and detect dataset schema drift

**Files:**
- Create: `packages/contracts/src/migrateDashboard.ts`
- Test: `packages/contracts/src/migrateDashboard.test.ts`
- Create: `packages/chart-renderer/src/ComponentErrorBoundary.tsx`
- Create: `apps/web/src/features/datasets/useDatasetSchemaDrift.ts`
- Modify: `packages/chart-renderer/src/DashboardComponentRenderer.tsx`
- Modify: `apps/web/src/features/inspector/DataBindingPanel.tsx`
- Test: `packages/chart-renderer/src/ComponentErrorBoundary.test.tsx`
- Test: `apps/web/src/features/datasets/useDatasetSchemaDrift.test.tsx`

- [ ] **Step 1: Add the explicit Dashboard Schema migration entry point**

```ts
import { DashboardSchema, type Dashboard } from "./dashboard";

export function migrateDashboard(input: unknown): Dashboard {
  if (typeof input !== "object" || input === null || !("schemaVersion" in input)) {
    throw new Error("DASHBOARD_SCHEMA_VERSION_MISSING");
  }
  if ((input as { schemaVersion: unknown }).schemaVersion !== 1) {
    throw new Error(`DASHBOARD_SCHEMA_VERSION_UNSUPPORTED:${String((input as { schemaVersion: unknown }).schemaVersion)}`);
  }
  return DashboardSchema.parse(input);
}
```

Test valid v1 input, missing version, and unsupported version. Replace direct persisted `DashboardSchema.parse` calls in repositories/viewer queries with `migrateDashboard`.

- [ ] **Step 2: Write a failing error-boundary test**

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ComponentErrorBoundary } from "./ComponentErrorBoundary";

it("isolates one failed component", () => {
  const Broken = () => { throw new Error("boom"); };
  render(<><ComponentErrorBoundary title="坏图表"><Broken /></ComponentErrorBoundary><div>正常图表</div></>);
  expect(screen.getByText("坏图表渲染失败")).toBeInTheDocument();
  expect(screen.getByText("正常图表")).toBeInTheDocument();
});
```

- [ ] **Step 3: Implement a local resettable boundary**

Use a class error boundary keyed by component ID and configuration hash. Show a concise fallback with “重试” in editor/preview; published view shows “组件暂不可用” without stack details. Log only component ID/type and the sanitized error code.

- [ ] **Step 4: Write schema drift tests**

Given saved dataset ref `{ datasetId: "sales", schemaVersion: "v1" }` and current schema `v2` missing `revenue`, assert the hook returns the affected component ID and message `字段 revenue 已不存在`.

- [ ] **Step 5: Implement drift revalidation**

On dataset schema fetch, compare saved and current schema versions. Re-run every component binding through `validateBinding`; display errors in frames and inspector. Update the stored dataset schema version only after the user fixes all affected bindings and saves.

- [ ] **Step 6: Run migration, failure, and drift tests and commit**

Run: `pnpm --filter @drag-visual/contracts test -- migrateDashboard.test.ts && pnpm --filter @drag-visual/chart-renderer test -- ComponentErrorBoundary.test.tsx && pnpm --filter @drag-visual/web test -- useDatasetSchemaDrift.test.tsx`

Expected: PASS.

```bash
git add packages/contracts packages/chart-renderer apps/web/src/features/datasets apps/web/src/features/inspector
git commit -m "feat: isolate renderer errors and detect schema drift"
```

## Task 5: Add performance safeguards and a 10k-row baseline

**Files:**
- Create: `packages/chart-renderer/src/performance/renderBenchmark.test.ts`
- Modify: `packages/chart-renderer/src/EChart.tsx`
- Modify: `apps/web/src/features/datasets/DataPreview.tsx`
- Create: `docs/performance/baseline.md`

- [ ] **Step 1: Add a deterministic option-build benchmark**

```ts
import { expect, it } from "vitest";
import { buildBarOption } from "../options/bar";

it("builds a 10k-row bar option within the agreed baseline", () => {
  const rows = Array.from({ length: 10_000 }, (_, index) => ({ category: `C${index}`, value: index }));
  const started = performance.now();
  buildBarOption({ rows, dimension: "category", measure: "value", props: { title: "基准", color: "#1677ff", showLegend: false } });
  expect(performance.now() - started).toBeLessThan(100);
});
```

- [ ] **Step 2: Prevent unnecessary chart work**

Memoize pure option inputs, do not call `setOption` when rows/binding/props are referentially unchanged, and suspend `ResizeObserver` updates while the editor frame is actively dragging. Trigger one resize after drag/resize stop.

- [ ] **Step 3: Keep table preview bounded**

Always slice preview rows to 100 before passing data to Ant Design Table. Published table components use backend pagination when `total` exceeds the received page; they never mount 10,000 DOM rows.

- [ ] **Step 4: Record reproducible baseline details**

Document machine, browser, Node version, fixture generator, median of five runs, and pass threshold. Treat timing tests as a local/release signal; CI must also assert structural limits such as 100 preview rows.

- [ ] **Step 5: Run performance checks and commit**

Run: `pnpm --filter @drag-visual/chart-renderer test -- renderBenchmark.test.ts && pnpm test`

Expected: PASS.

```bash
git add packages/chart-renderer apps/web/src/features/datasets docs/performance
git commit -m "perf: add dashboard rendering safeguards"
```

## Task 6: Add the internal identity seam and security defaults

**Files:**
- Create: `apps/api/src/auth/internal-user.ts`
- Create: `apps/api/src/auth/internal-auth.guard.ts`
- Create: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/datasets/business-api.client.ts`
- Test: `apps/api/src/auth/internal-auth.guard.test.ts`

- [ ] **Step 1: Write failing guard tests**

```ts
import { expect, it } from "vitest";
import { InternalAuthGuard } from "./internal-auth.guard";

it("rejects a request without trusted proxy identity", () => {
  const guard = new InternalAuthGuard("x-internal-user");
  expect(() => guard.extractUser({ headers: {} })).toThrow("INTERNAL_IDENTITY_REQUIRED");
});

it("accepts and normalizes trusted identity", () => {
  const guard = new InternalAuthGuard("x-internal-user");
  expect(guard.extractUser({ headers: { "x-internal-user": "u-123" } })).toEqual({ id: "u-123" });
});
```

- [ ] **Step 2: Implement proxy-header identity behind a configurable trust boundary**

In production, only accept the identity header from the trusted reverse proxy/network. In development, a documented local user may be injected. Attach `{ id }` to the request and apply the guard globally except `/health`.

- [ ] **Step 3: Forward identity without exposing service credentials**

Dataset Gateway forwards the internal user ID using the company-approved header/token exchange. Service credentials remain server-side environment variables and are redacted from logs.

- [ ] **Step 4: Add Fastify limits and security headers**

Set body limit to 1 MB for dashboard/query requests, enable a strict CORS allowlist for the internal Web origin, and add `helmet` headers. Do not log request bodies for dataset queries.

- [ ] **Step 5: Run auth tests and commit**

Run: `pnpm --filter @drag-visual/api test -- internal-auth.guard.test.ts && pnpm --filter @drag-visual/api typecheck`

Expected: PASS.

```bash
git add apps/api/src/auth apps/api/src/app.module.ts apps/api/src/datasets
git commit -m "feat: add internal identity and API security defaults"
```

## Task 7: Add critical Playwright E2E coverage

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/fixtures/business-api.ts`
- Create: `e2e/dashboard-flow.spec.ts`
- Modify: `package.json`

- [ ] **Step 1: Configure isolated E2E services**

Use a dedicated test database, start the business API fixture on port 4010, API on 3000, and Web on 5173. Add root scripts `test:e2e: pnpm exec playwright test` and `test:e2e:ui: pnpm exec playwright test --ui`.

- [ ] **Step 2: Write the critical user workflow**

```ts
import { expect, test } from "@playwright/test";

test("create, bind, save, publish, and view a dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新建看板" }).click();
  await page.getByLabel("数据集").click();
  await page.getByRole("option", { name: "销售" }).click();
  await page.getByRole("button", { name: "查询数据" }).click();
  await page.getByRole("button", { name: "添加柱状图" }).click();
  await page.getByLabel("维度").selectOption("month");
  await page.getByLabel("指标").selectOption("revenue");
  await expect(page.getByText("1月")).toBeVisible();
  await page.getByRole("button", { name: "保存" }).click();
  await page.getByRole("button", { name: "发布" }).click();
  const viewLink = page.getByRole("link", { name: "打开发布页" });
  await expect(viewLink).toBeVisible();
  await viewLink.click();
  await expect(page.getByText("月收入")).toBeVisible();
  await expect(page.getByRole("button", { name: /删除/ })).toHaveCount(0);
});
```

- [ ] **Step 3: Add failure-path E2E tests**

Cover upstream timeout, removed field/schema drift, stale revision conflict, failed publish preserving the old snapshot, and page reload restoring the last saved draft.

- [ ] **Step 4: Run E2E twice for flake detection**

Run: `pnpm test:e2e --repeat-each=2`

Expected: all scenarios pass twice without retries.

- [ ] **Step 5: Commit E2E coverage**

```bash
git add playwright.config.ts e2e package.json pnpm-lock.yaml
git commit -m "test: cover critical dashboard workflow"
```

## Task 8: Create CI and the internal release gate

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `docs/release/internal-mvp-checklist.md`
- Modify: `README.md`

- [ ] **Step 1: Add CI quality gates**

CI installs with `pnpm install --frozen-lockfile`, generates Prisma client, runs `pnpm typecheck`, `pnpm test`, `pnpm build`, provisions PostgreSQL, migrates the test database, and runs `pnpm test:e2e`.

- [ ] **Step 2: Write the internal release checklist**

The checklist requires: database backup/migration rehearsal, environment validation, trusted proxy identity test, six-component smoke test, 10k-row baseline, timeout/error checks, published snapshot check, P0/P1 count of zero, rollback command, and named product/data approvers.

- [ ] **Step 3: Document operational commands**

README links to local development, performance baseline, API/OpenAPI location, database migration, release checklist, and the `/health` endpoint. Include exact build/start commands and required environment variables without secrets.

- [ ] **Step 4: Run final verification from a clean install**

Run:

```bash
pnpm install --frozen-lockfile
pnpm exec prisma generate
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Expected: every command exits 0; the E2E report shows the critical flow and failure paths passing.

- [ ] **Step 5: Commit release automation**

```bash
git add .github/workflows/ci.yml docs/release README.md
git commit -m "chore: add MVP release gates"
```

## Task 9: Verify the complete MVP gate

**Files:**
- Modify: `docs/release/internal-mvp-checklist.md`

- [ ] **Step 1: Run the 10-minute acceptance scenario with an internal user**

The user creates a dashboard containing KPI, line/area, and table components; binds real fields; adjusts title/color; saves; publishes; and opens the published URL without developer help.

- [ ] **Step 2: Record acceptance evidence**

Record elapsed time, browser, dataset ID, dashboard ID, defects found, and whether editor/published rendering matched. Do not store sensitive row data in the document.

- [ ] **Step 3: Close only with zero P0/P1 defects**

P0: data exposure, unrecoverable data loss, or platform unavailable. P1: core create/bind/save/publish path blocked or published output materially wrong. Any P0/P1 keeps the release gate open.

- [ ] **Step 4: Commit the completed release record**

```bash
git add docs/release/internal-mvp-checklist.md
git commit -m "docs: record internal MVP acceptance"
```
