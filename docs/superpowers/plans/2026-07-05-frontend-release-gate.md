# Frontend Release Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a frontend-only release gate with deterministic MSW scenarios, Playwright coverage, CI automation, and honest release documentation while keeping real backend completion as separate `apps/api` work.

**Architecture:** Vite runs the React application with `VITE_USE_MOCKS=true`; MSW implements the same OpenAPI/Zod contract that `apps/api` will provide. Playwright controls only browser-visible frontend behavior, and CI runs without PostgreSQL or the real dataset backend.

**Tech Stack:** React 19, Vite 8, MSW 2, Playwright, Vitest, Zod, pnpm 10, GitHub Actions.

---

## File Map

- `apps/web/src/mocks/scenarios.ts`: test-only scenario state and validation.
- `apps/web/src/mocks/handlers.ts`: contract-faithful normal and failure responses.
- `playwright.config.ts`: Vite/MSW web server and browser-test settings.
- `e2e/frontend-flow.spec.ts`: core frontend workflow.
- `e2e/frontend-failures.spec.ts`: timeout, schema drift, conflict, publish failure, and reload recovery.
- `.github/workflows/ci.yml`: frontend release commands without PostgreSQL or real backend startup.
- `README.md`: exact local frontend commands and real backend integration boundary.
- `docs/release/frontend-mvp-checklist.md`: automated evidence, backend integration items, and pending manual acceptance.

### Task 1: Add Deterministic Browser-Test Mock Controls

**Files:**
- Create: `apps/web/src/mocks/scenarios.ts`
- Create: `apps/web/src/mocks/scenarios.test.ts`
- Modify: `apps/web/src/mocks/handlers.ts`

- [ ] **Step 1: Write failing scenario-state tests**

```ts
import { afterEach, expect, it } from "vitest";
import { getMockScenario, resetMockScenario, setMockScenario } from "./scenarios.js";

afterEach(resetMockScenario);

it("accepts only release-test scenarios and resets to normal", () => {
  expect(getMockScenario()).toBe("normal");
  setMockScenario("dataset-timeout");
  expect(getMockScenario()).toBe("dataset-timeout");
  resetMockScenario();
  expect(getMockScenario()).toBe("normal");
});

it("rejects unknown scenario names", () => {
  expect(() => setMockScenario("secret-mode")).toThrow("MOCK_SCENARIO_INVALID");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `/usr/local/bin/pnpm --dir apps/web exec vitest run src/mocks/scenarios.test.ts`

Expected: FAIL because `scenarios.ts` does not exist.

- [ ] **Step 3: Implement a closed scenario union**

```ts
export type MockScenario =
  | "normal"
  | "dataset-timeout"
  | "schema-v2"
  | "revision-conflict"
  | "publish-failure";

const scenarios = new Set<MockScenario>([
  "normal", "dataset-timeout", "schema-v2", "revision-conflict", "publish-failure",
]);
let current: MockScenario = "normal";

export const getMockScenario = (): MockScenario => current;
export const resetMockScenario = (): void => { current = "normal"; };
export const setMockScenario = (value: string): void => {
  if (!scenarios.has(value as MockScenario)) throw new Error("MOCK_SCENARIO_INVALID");
  current = value as MockScenario;
};
```

- [ ] **Step 4: Add mock-only control and seed routes plus scenario behavior**

Add `POST */__mock/scenario` to parse `{ scenario: string }`, call `setMockScenario`, and return HTTP 204. Read `getMockScenario()` in existing dashboard save, publish, dataset schema, and dataset query handlers. Map scenarios as follows:

```ts
if (scenario === "revision-conflict") return apiError(409, "DASHBOARD_VERSION_CONFLICT");
if (scenario === "publish-failure") return apiError(500, "PUBLISH_FAILED");
if (scenario === "dataset-timeout") return apiError(504, "DATASET_TIMEOUT");
if (scenario === "schema-v2") return HttpResponse.json({ ...dataset, schemaVersion: "v2", fields: dataset.fields.filter((field) => field.key !== "revenue") });
```

Add `POST */__mock/dashboards` for E2E setup. Parse its body with `DashboardSchema`, store a structured clone in the existing private `drafts` map, and return HTTP 201. Invalid bodies return `DASHBOARD_SCHEMA_INVALID`. This route exists only while the MSW worker is enabled and is not added to OpenAPI.

Call `resetMockScenario()` inside `resetMockStore()` so unit tests remain isolated.

- [ ] **Step 5: Verify handler behavior**

Extend `apps/web/src/mocks/handlers.test.ts` to POST the control route, then assert the next matching request returns the stable status/code. Run:

`/usr/local/bin/pnpm --dir apps/web exec vitest run src/mocks/scenarios.test.ts src/mocks/handlers.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit mock controls**

```bash
git add apps/web/src/mocks
git commit -m "test: add deterministic frontend mock scenarios"
```

### Task 2: Add the Playwright Core Frontend Flow

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/helpers.ts`
- Create: `e2e/frontend-flow.spec.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install Playwright test tooling**

Run: `/usr/local/bin/pnpm add -D @playwright/test`

Expected: root `package.json` and `pnpm-lock.yaml` include `@playwright/test`.

- [ ] **Step 2: Configure a single MSW-backed Web server**

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: {
    command: "/usr/local/bin/pnpm run dev:mock -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
```

Add root scripts:

```json
"dev:web": "pnpm --dir apps/web exec vite",
"dev:mock": "VITE_USE_MOCKS=true pnpm --dir apps/web exec vite",
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 3: Create a browser-side scenario helper**

```ts
import type { Page } from "@playwright/test";

export const setScenario = async (page: Page, scenario: string): Promise<void> => {
  await page.evaluate(async (selected) => {
    const response = await fetch("/__mock/scenario", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario: selected }),
    });
    if (!response.ok) throw new Error(`SCENARIO_SETUP_FAILED:${response.status}`);
  }, scenario);
};

export const seedDashboard = async (page: Page, dashboard: unknown): Promise<void> => {
  await page.evaluate(async (value) => {
    const response = await fetch("/__mock/dashboards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
    if (!response.ok) throw new Error(`DASHBOARD_SEED_FAILED:${response.status}`);
  }, dashboard);
};
```

- [ ] **Step 4: Write the failing core-flow E2E**

```ts
import { expect, test } from "@playwright/test";

test("create, add, save, publish, and open a read-only dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "新建看板" }).click();
  await page.getByRole("button", { name: "添加柱图" }).click();
  await expect(page.getByText("已添加 1 个组件")).toBeVisible();
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("status", { name: "保存状态" })).toContainText("已保存");
  await page.getByRole("button", { name: "发布" }).click();
  const link = page.getByRole("link", { name: "打开发布页" });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page.getByRole("heading", { name: "未命名看板" })).toBeVisible();
  await expect(page.getByRole("button", { name: "删除" })).toHaveCount(0);
});
```

- [ ] **Step 5: Run RED, then adjust only stable selectors or missing frontend behavior**

Run: `/usr/local/bin/pnpm test:e2e -- e2e/frontend-flow.spec.ts`

Expected initially: FAIL until Playwright Chromium is installed or a selector exposes a real accessibility gap. Install Chromium with `/usr/local/bin/pnpm exec playwright install chromium`, then fix product accessibility only when the DOM proves it is missing.

- [ ] **Step 6: Run the core flow twice**

Run: `/usr/local/bin/pnpm test:e2e -- e2e/frontend-flow.spec.ts --repeat-each=2`

Expected: 2 passed, 0 retries.

- [ ] **Step 7: Commit core E2E**

```bash
git add playwright.config.ts e2e/helpers.ts e2e/frontend-flow.spec.ts package.json pnpm-lock.yaml
git commit -m "test: cover frontend publish workflow"
```

### Task 3: Add Frontend Failure-Path E2E

**Files:**
- Create: `e2e/frontend-failures.spec.ts`
- Modify: `apps/web/src/features/viewer/ViewerComponent.tsx`
- Modify: `apps/web/src/features/editor/EditorRoute.tsx`

- [ ] **Step 1: Write timeout and conflict scenarios**

Use `seedDashboard` with a `DashboardSchema`-valid KPI bound to the `sales.revenue` field, then call `setScenario(page, "dataset-timeout")`, open `/preview/:id`, and assert `查询组件数据失败` is visible while the page heading remains. Use `revision-conflict` after adding a component, click Save, and assert the `保存冲突` dialog and `保存失败` status remain visible.

- [ ] **Step 2: Write schema-drift and publish-preservation scenarios**

Use `seedDashboard` to create a contract-valid dashboard, publish it through the editor, set `publish-failure`, change and save the draft, then assert publication fails and the previously published URL still loads. Seed the same bound dashboard, set `schema-v2`, open `/preview/:id`, and assert `数据绑定需要检查` plus `字段 revenue 已不存在`.

- [ ] **Step 3: Write reload recovery**

```ts
await page.getByRole("button", { name: "添加柱图" }).click();
await page.getByRole("button", { name: "保存" }).click();
await expect(page.getByRole("status", { name: "保存状态" })).toContainText("已保存");
await page.reload();
await expect(page.getByText("已添加 1 个组件")).toBeVisible();
```

- [ ] **Step 4: Run failures and implement only observable missing states**

Run: `/usr/local/bin/pnpm test:e2e -- e2e/frontend-failures.spec.ts`

Expected: each scenario either passes against existing UI or fails on a specific missing user-visible state. Add concise Ant Design alerts for save/publish/query failures; never expose raw error bodies.

- [ ] **Step 5: Run all browser scenarios twice**

Run: `/usr/local/bin/pnpm test:e2e -- --repeat-each=2`

Expected: all scenarios pass twice with retries disabled.

- [ ] **Step 6: Commit failure coverage**

```bash
git add e2e apps/web/src/features/editor/EditorRoute.tsx apps/web/src/features/viewer/ViewerComponent.tsx
git commit -m "test: cover frontend failure recovery"
```

### Task 4: Add Frontend CI and Release Documentation

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `README.md`
- Create: `docs/release/frontend-mvp-checklist.md`

- [ ] **Step 1: Add CI without PostgreSQL or real backend startup**

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  frontend-release-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.28.0
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
      - run: pnpm lint:openapi
      - run: pnpm test:e2e -- --repeat-each=2
```

- [ ] **Step 2: Document exact frontend commands**

README sections must include:

```md
## Mock development
pnpm dev:mock

## Frontend verification
pnpm typecheck
pnpm test
pnpm build
pnpm lint:openapi
pnpm test:e2e

## Backend integration boundary
The real backend is implemented in `apps/api`. Implement the routes and fields in `openapi/bi-mvp.yaml`; frontend mock behavior lives in `apps/web/src/mocks/handlers.ts`.
```

Document `VITE_API_BASE_URL` and `VITE_USE_MOCKS`; do not include credentials or internal URLs.

- [ ] **Step 3: Create an honest release checklist**

The checklist contains three sections:

1. Automated frontend gates with command, date, and result fields.
2. Real backend integration items: contract conformance, internal identity, real dataset timeout/error mapping, and environment configuration, all initially unchecked.
3. Manual acceptance evidence: reviewer, browser, elapsed time, dashboard ID, defects, P0/P1 count, and approval, initially marked pending.

- [ ] **Step 4: Run the complete frontend gate**

Run:

```bash
/usr/local/bin/pnpm install --frozen-lockfile
/usr/local/bin/pnpm typecheck
/usr/local/bin/pnpm test
/usr/local/bin/pnpm build
/usr/local/bin/pnpm lint:openapi
/usr/local/bin/pnpm test:e2e -- --repeat-each=2
```

Expected: every command exits 0. Update only the automated section with real evidence; leave real backend integration and manual acceptance pending.

- [ ] **Step 5: Commit CI and documentation**

```bash
git add .github/workflows/ci.yml README.md docs/release/frontend-mvp-checklist.md
git commit -m "chore: add frontend MVP release gate"
```

### Task 5: Final Hygiene and Handoff

**Files:**
- Modify only the owning task's files when a final command exposes a failure.

- [ ] **Step 1: Confirm the browser bundle excludes editor modules from published chunks**

Run: `viewer_chunk=$(find apps/web/dist/assets -name 'viewerQueries-*.js' -print -quit); ! rg "EditorShell|InspectorPanel|dnd-kit|react-grid-layout" "$viewer_chunk"`

Expected: exit 0.

- [ ] **Step 2: Confirm repository hygiene**

Run: `git diff --check && git status --short`

Expected: no whitespace errors, browser traces, screenshots, test reports, or dependency caches are untracked.

- [ ] **Step 3: Report the actual boundary**

Report frontend automated gate results, link the OpenAPI and mock handler files, and state that real backend integration and named manual acceptance remain pending. Do not label the organization-wide release complete.
