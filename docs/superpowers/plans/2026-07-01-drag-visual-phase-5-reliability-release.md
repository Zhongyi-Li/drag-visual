# Drag Visual Phase 5: Reliability and Internal Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MVP resilient, verify the 10k-row performance baseline, automate the core workflow, and prepare an internal release.

**Architecture:** Failures stay local to a component or data source. Automated tests protect contracts and the full user journey; performance measurements use fixed fixtures and documented thresholds.

**Tech Stack:** React Error Boundaries, NestJS filters, Vitest, Testing Library, Playwright, MSW, OpenTelemetry-compatible structured logs.

---

### Task 1: Isolate component and data-source failures

**Files:**
- Create: `apps/editor-web/src/features/canvas/ComponentErrorBoundary.tsx`
- Create: `apps/editor-web/src/features/canvas/ComponentErrorBoundary.test.tsx`
- Create: `apps/editor-web/src/telemetry/report-client-error.ts`
- Create: `apps/editor-web/src/features/data/data-source-state.ts`
- Create: `apps/editor-web/src/features/data/DataSourceStatus.tsx`
- Modify: `apps/editor-web/src/features/canvas/GridCanvas.tsx`

- [ ] **Step 1: Write the failing isolation test**

```tsx
it("keeps sibling components visible when one renderer throws", () => {
  render(<GridCanvas project={projectWithOneBrokenAndOneValidComponent} />);
  expect(screen.getByText("组件渲染失败")).toBeVisible();
  expect(screen.getByTestId("canvas-component-text")).toBeVisible();
});
```

- [ ] **Step 2: Implement local error boundary**

Create `report-client-error.ts`:

```ts
export function reportClientError(event: string, details: Record<string, string>) {
  navigator.sendBeacon("/api/client-events", JSON.stringify({ event, details, occurredAt: new Date().toISOString() }));
}
```

```tsx
interface State { error?: Error }

export class ComponentErrorBoundary extends React.Component<React.PropsWithChildren<{ componentId: string }>, State> {
  state: State = {};
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error) { reportClientError("component_render_failed", { componentId: this.props.componentId, message: error.message }); }
  render() {
    if (this.state.error) return <Alert type="error" message="组件渲染失败" description="请检查字段绑定或重新添加组件" />;
    return this.props.children;
  }
}
```

Wrap each registry render call, not the entire canvas, with this boundary.

- [ ] **Step 3: Implement explicit data-source state**

```ts
export type DataSourceState =
  | { status: "idle" }
  | { status: "loading"; previous?: Dataset }
  | { status: "success"; data: Dataset }
  | { status: "stale"; data: Dataset; reason: string }
  | { status: "error"; code: string; message: string; retryable: boolean };
```

Implement the status message map:

```ts
const DATA_SOURCE_MESSAGES: Record<string, string> = {
  BUSINESS_QUERY_TIMEOUT: "查询超时，请重试",
  BUSINESS_QUERY_FORBIDDEN: "没有该数据的访问权限",
  DATASET_FIELD_MISSING: "数据字段已变化，请重新绑定",
};

export function DataSourceStatus({ state }: { state: DataSourceState }) {
  if (state.status === "loading") return <Spin tip="正在加载数据" />;
  if (state.status === "error") return <Alert type="error" message={DATA_SOURCE_MESSAGES[state.code] ?? state.message} />;
  if (state.status === "stale") return <Alert type="warning" message={state.reason} />;
  return null;
}
```

- [ ] **Step 4: Run tests and commit**

Run `pnpm --filter @drag-visual/editor-web test -- ComponentErrorBoundary`.

Expected: broken renderer test PASS and sibling remains visible.

```bash
git add apps/editor-web/src/features/canvas apps/editor-web/src/features/data
git commit -m "feat: isolate component and data source failures"
```

### Task 2: Add server error envelope and safe logs

**Files:**
- Create: `apps/api-server/src/common/api-exception.filter.ts`
- Create: `apps/api-server/src/common/api-exception.filter.spec.ts`
- Create: `apps/api-server/src/common/request-logger.interceptor.ts`
- Modify: `apps/api-server/src/main.ts`

- [ ] **Step 1: Write the failing error-envelope test**

```ts
it("returns a stable envelope without a stack trace", async () => {
  const response = await request(app.getHttpServer()).post("/data-sources/business-query").send({ queryId: "unknown", params: {} });
  expect(response.status).toBe(400);
  expect(response.body).toEqual({ code: "QUERY_NOT_ALLOWED", message: "请求的数据查询未开放", requestId: expect.any(String) });
  expect(JSON.stringify(response.body)).not.toContain("stack");
});
```

- [ ] **Step 2: Implement global exception mapping**

```ts
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const request = host.switchToHttp().getRequest<FastifyRequest>();
    const mapped = mapException(exception);
    response.status(mapped.status).send({ code: mapped.code, message: mapped.message, requestId: request.id });
  }
}
```

`mapException` must explicitly cover `FILE_TOO_LARGE`, `EMPTY_DATASET`, `QUERY_NOT_ALLOWED`, `BUSINESS_QUERY_TIMEOUT`, `BUSINESS_QUERY_FORBIDDEN`, `PROJECT_VERSION_CONFLICT`, and default to status 500/code `INTERNAL_ERROR`.

- [ ] **Step 3: Add redacted structured logging**

```ts
const safeHeaders = { "user-agent": request.headers["user-agent"], "x-request-id": request.id };
logger.log({ event: "request_completed", method: request.method, url: request.url, statusCode: reply.statusCode, durationMs, headers: safeHeaders });
```

Do not log `authorization`, cookies, uploaded file bytes, request bodies for business queries, or response rows.

- [ ] **Step 4: Run tests and commit**

Run `pnpm --filter @drag-visual/api-server test -- common`.

Expected: envelope and redaction tests PASS.

```bash
git add apps/api-server/src/common apps/api-server/src/main.ts
git commit -m "feat: standardize safe API errors and logs"
```

### Task 3: Establish and enforce the 10k-row performance baseline

**Files:**
- Create: `packages/data-engine/src/fixtures/ten-thousand-rows.ts`
- Create: `packages/data-engine/src/performance.test.ts`
- Create: `apps/editor-web/src/features/canvas/useChartResize.ts`
- Modify: `apps/editor-web/src/features/canvas/GridCanvas.tsx`

- [ ] **Step 1: Create deterministic fixture and failing budget test**

```ts
export const tenThousandRows = Array.from({ length: 10_000 }, (_, index) => ({
  region: `Region ${index % 20}`,
  amount: index % 1000,
  day: `2026-06-${String((index % 28) + 1).padStart(2, "0")}`,
}));

it("groups and sums 10k rows within 100ms on the test runner", () => {
  const start = performance.now();
  const result = groupAndAggregate(tenThousandRows, "region", "amount", "sum");
  expect(performance.now() - start).toBeLessThan(100);
  expect(result).toHaveLength(20);
});
```

- [ ] **Step 2: Implement a single-pass aggregation**

```ts
export function groupAndAggregate(rows: Record<string, unknown>[], dimension: string, measure: string, aggregate: "sum") {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const key = String(row[dimension] ?? "");
    totals.set(key, (totals.get(key) ?? 0) + Number(row[measure] ?? 0));
  }
  return [...totals].map(([key, value]) => ({ key, value }));
}
```

- [ ] **Step 3: Defer chart resize until grid interaction ends**

```ts
export function useChartResize() {
  const [isInteracting, setInteracting] = useState(false);
  return {
    isInteracting,
    onDragStart: () => setInteracting(true),
    onResizeStart: () => setInteracting(true),
    onDragStop: () => setInteracting(false),
    onResizeStop: () => setInteracting(false),
  };
}
```

Pass `isInteracting` to chart frames so they suspend resize observers during grid interaction and call `chart.resize()` once when it returns to false.

- [ ] **Step 4: Run tests and commit**

Run `pnpm --filter @drag-visual/data-engine test -- performance` three times.

Expected: each run PASS under the 100ms test-runner budget.

```bash
git add packages/data-engine apps/editor-web/src/features/canvas
git commit -m "perf: establish 10k row editing baseline"
```

### Task 4: Automate the core user journey

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/fixtures/sales.csv`
- Create: `e2e/dashboard-editor.spec.ts`
- Create: `e2e/project-conflict.spec.ts`

- [ ] **Step 1: Create the CSV fixture**

```csv
region,amount
East,120
West,95
North,80
```

- [ ] **Step 2: Write the core E2E**

```ts
test("imports data, builds a chart, saves, and previews", async ({ page }) => {
  await page.goto("/projects/new");
  await page.getByLabel("导入文件").setInputFiles("e2e/fixtures/sales.csv");
  await page.getByRole("button", { name: "添加柱状图" }).click();
  await drag(page, "Region", "维度");
  await drag(page, "Amount", "指标");
  await page.getByRole("tab", { name: "样式" }).click();
  await page.getByLabel("标题").fill("区域销售额");
  await expect(page.getByText("已保存")).toBeVisible();
  const preview = await page.waitForEvent("popup", () => page.getByRole("link", { name: "预览" }).click());
  await expect(preview.getByText("区域销售额")).toBeVisible();
  await expect(preview.locator("canvas")).toBeVisible();
});
```

- [ ] **Step 3: Write conflict and recovery E2E**

```ts
test("keeps local changes when auto-save conflicts", async ({ page }) => {
  await page.route("**/api/projects/*", async (route) => {
    if (route.request().method() === "PUT") await route.fulfill({ status: 409, json: { code: "PROJECT_VERSION_CONFLICT", message: "项目已被更新", requestId: "test" } });
    else await route.continue();
  });
  await page.goto("/projects/p1");
  await page.getByLabel("项目名称").fill("本地未保存名称");
  await expect(page.getByText("检测到版本冲突")).toBeVisible();
  await expect(page.getByLabel("项目名称")).toHaveValue("本地未保存名称");
});
```

- [ ] **Step 4: Run E2E and commit**

Run:

```bash
pnpm exec playwright test
```

Expected: core workflow and conflict recovery tests PASS.

```bash
git add playwright.config.ts e2e
git commit -m "test: cover dashboard editor critical paths"
```

### Task 5: Run internal release gate

**Files:**
- Create: `docs/release/internal-mvp-checklist.md`
- Create: `.env.example`

- [ ] **Step 1: Document required environment variables**

```dotenv
DATABASE_URL=postgresql://drag_visual:drag_visual@localhost:5432/drag_visual
BUSINESS_API_BASE_URL=https://business-api.internal.example
PORT=3000
```

- [ ] **Step 2: Create the release checklist**

```markdown
# Internal MVP Release Checklist

- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm exec playwright test` passes.
- [ ] Database migration applies on an empty database.
- [ ] CSV, XLS, and XLSX each import successfully.
- [ ] Approved business query succeeds; unknown query is rejected.
- [ ] All eight components render in editor and preview.
- [ ] 10k-row performance test meets its budget.
- [ ] Auto-save conflict preserves local changes.
- [ ] Authorization, cookies, file bytes, and dataset rows are absent from logs.
- [ ] P0 and P1 defects are zero.
```

- [ ] **Step 3: Execute the complete gate**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright test
```

Expected: all commands exit 0.

- [ ] **Step 4: Tag the internal release**

```bash
git add docs/release/internal-mvp-checklist.md .env.example
git commit -m "docs: add internal MVP release gate"
git tag drag-visual-mvp-internal-1
```
