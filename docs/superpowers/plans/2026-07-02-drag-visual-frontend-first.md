# Drag Visual Frontend-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the complete React BI dashboard MVP against an executable MSW contract, while freezing the existing NestJS/Prisma code as a non-production reference and enabling a separate Spring Boot team to implement the same OpenAPI.

**Architecture:** `apps/web` owns editor, preview, viewer, typed API client, and MSW handlers. Shared domain rules stay in dependency-light packages; `openapi/bi-mvp.yaml` is the cross-language contract. Production integration changes only `VITE_API_BASE_URL`, never editor or chart logic.

**Tech Stack:** React, Vite, TypeScript, Ant Design, MSW, React Router, TanStack Query, Zustand, Immer, react-grid-layout, dnd-kit, Apache ECharts, React Hook Form, Zod, Vitest, Testing Library, Playwright.

---

## Locked scope

- Do not add login, users, JWT, Session, RBAC, audit, CSV/Excel, database direct-connect, arbitrary REST configuration, SQL editor, joins, formulas, collaboration, or version history.
- Before freezing `apps/api`, align its public boundary to top-level `schemaVersion: 1` and ensure every stable error is `{code,message}`; then do not extend NestJS or Prisma further.
- Every network feature must work with MSW before Java integration.
- Every phase updates the applicable file under `docs/backend-handoff/` and the OpenAPI contract.

## File map

```text
openapi/bi-mvp.yaml                     cross-language API contract
apps/web/src/api/                       fetch client, ApiError, endpoint functions
apps/web/src/mocks/                     MSW browser/server, handlers, fixture store
apps/web/src/features/dashboards/       create/load/save/autosave/publish queries
apps/web/src/features/editor/           shell, palette, canvas, toolbar, store
apps/web/src/features/datasets/         dataset selector, parameters, preview
apps/web/src/features/inspector/        binding/style/theme panels
apps/web/src/features/viewer/           preview and published routes
packages/editor-core/                   pure commands and bounded history
packages/data-engine/                   binding validation, sorting, Top N
packages/component-registry/            six component definitions and schemas
packages/chart-renderer/                ECharts option builders and renderers
e2e/                                    critical Playwright flows
```

## Task 1: Freeze backend reference and establish OpenAPI/MSW contract

**Files:**
- Create: `openapi/bi-mvp.yaml`
- Create: `.redocly.yaml`
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/api/ApiError.ts`
- Create: `apps/web/src/api/client.ts`
- Create: `apps/web/src/mocks/fixtures.ts`
- Create: `apps/web/src/mocks/handlers.ts`
- Create: `apps/web/src/mocks/browser.ts`
- Create: `apps/web/src/mocks/server.ts`
- Create: `apps/web/src/test/setup.ts`
- Test: `apps/web/src/api/client.test.ts`
- Test: `apps/web/src/api/openapi.test.ts`
- Create: `packages/contracts/src/safe-record.ts`
- Modify: `packages/contracts/src/dashboard.ts`
- Modify: `packages/contracts/src/dashboard.test.ts`
- Modify: `packages/contracts/src/dataset.ts`
- Modify: `packages/contracts/src/dataset.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `package.json`

- [ ] **Step 1: Write failing API client tests**

Test that a successful dashboard response is parsed with `DashboardSchema`, and that `{code,message}` with HTTP 409 becomes `ApiError` preserving status/code/message. Add focused contract tests for UUID Dashboard IDs plus strict `DatasetSummary`, `DatasetQueryRequest`, `DatasetQueryResult`, and `ErrorResponse`; cover unknown fixed fields, invalid open-map containers, 10,000/10,001 rows, and safe own keys `__proto__`, `constructor`, `prototype` in query parameters and every result row. Start/stop the MSW server in test setup. Run the tests and observe the expected failures before implementation.

- [ ] **Step 2: Implement the error and request boundary**

```ts
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body != null && !headers.has("content-type")) headers.set("content-type", "application/json");
  const normalizedPath = `/${path.replace(/^\/+/, "")}`;
  const response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
    ...init,
    headers,
  });
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  let body: unknown = null;
  if (text !== "" && contentType.includes("application/json")) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      throw new ApiError(response.status, "INTERNAL_ERROR", "Response was not valid JSON");
    }
  } else if (response.ok && text !== "") {
    throw new ApiError(response.status, "INTERNAL_ERROR", "Response was not JSON");
  }
  if (!response.ok) {
    const error = typeof body === "object" && body !== null ? body as { code?: unknown; message?: unknown } : {};
    throw new ApiError(
      response.status,
      typeof error.code === "string" ? error.code : "INTERNAL_ERROR",
      typeof error.message === "string" ? error.message : "Request failed",
    );
  }
  return body as T;
}
```

Tests cover empty/non-empty base URLs, any number of trailing/leading slashes without introducing `//`, preserved caller headers, `Accept`, body-sensitive `Content-Type`, malformed/non-JSON success and error bodies normalized to `ApiError` (never leaked `SyntaxError`), and every valid server error retaining `{code,message}`.

- [ ] **Step 3: Implement stateful MSW dashboard fixtures**

Keep an in-memory `Map<string, Dashboard>` and published map. Implement POST/GET/PUT dashboard handlers, atomic revision checks, publish, and published GET with exact documented codes. Create accepts `{}`, `{name:null}`, and blank names as `未命名看板`. Reject malformed Dashboard route UUIDs as exact `400 DASHBOARD_SCHEMA_INVALID` before mismatch/store access; keep a valid route/body UUID mismatch as 409. A corrupt persisted draft on publish maps to `500 INTERNAL_ERROR` and retains the old snapshot; only transaction/persistence failure maps to `500 PUBLISH_FAILED`. Enforce 2 MiB (2,097,152 UTF-8 bytes) Dashboard bodies, at most 100 components/layout items, and at most 20 datasets. Test every boundary and its first rejected value. Expose `resetMockStore()` for tests; never import the store from production feature code.

- [ ] **Step 4: Write the complete OpenAPI paths and schemas**

Include all eight endpoints from `docs/backend-handoff/00-overview-and-contract.md`, Dashboard v1 (`schemaVersion: 1`), `DatasetSummary[]`, Dataset schema/result/request, and ErrorResponse. Dashboard IDs are UUIDs; malformed Dashboard path UUID examples return exact 400 `DASHBOARD_SCHEMA_INVALID`. Component/dataset/field/parameter IDs are non-empty stable strings. Create `name` is optional and nullable. Fixed objects reject unknown properties. Open JSON maps `props`, dashboard/dataset query `parameters`, and row objects preserve arbitrary own string keys with recursively JSON-only values; `slots` preserves arbitrary own keys but each value remains a strict `FieldBinding | FieldBinding[]`. Declare the 2 MiB/100 component/100 layout/20 dataset limits.

Add request, success-response, and applicable error examples for every operation: 400, both 404 variants, both 409 variants, 500 `PUBLISH_FAILED`/`INTERNAL_ERROR`, 502 variants, and 504. Publish documents `INTERNAL_ERROR` for a corrupt persisted draft and `PUBLISH_FAILED` only for transaction/persistence failure; both retain the old snapshot. The publish operation explicitly has no `requestBody` and its example call sends an empty body. Every error example is exactly `{code,message}`.

Validate with an OpenAPI-aware parser such as `@readme/openapi-parser` (not YAML parsing alone), fail on unresolved `$ref` or invalid examples, assert OpenAPI 3.1, all eight paths/operations and all stable error codes, then run `pnpm exec redocly lint openapi/bi-mvp.yaml` with a checked-in rules file. Contract tests must parse every Dashboard, DatasetSummary, Dataset, DatasetQueryRequest, DatasetQueryResult, and ErrorResponse example through the corresponding exported Zod schema.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @drag-visual/web test && pnpm --filter @drag-visual/web typecheck && pnpm test && pnpm build && pnpm test:api-start && git diff --check`. The backend reference is not frozen until the production build and deterministic start smoke both pass from fresh contract output.

Commit: `feat: add frontend API contract and MSW foundation`

## Task 2: Create React shell, routing, and dashboard home

**Files:**
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/app/AppProviders.tsx`
- Create: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/features/dashboards/dashboardApi.ts`
- Create: `apps/web/src/features/dashboards/DashboardHome.tsx`
- Test: `apps/web/src/features/dashboards/DashboardHome.test.tsx`

- [ ] **Step 1: Write failing home behavior tests**

Verify “新建看板” creates `未命名看板`, navigates to `/editor/{id}`, shows pending state, and renders a retry action for an MSW 500 response.

- [ ] **Step 2: Implement typed endpoint functions**

```ts
export async function createDashboard(name?: string | null) {
  return DashboardSchema.parse(await requestJson("/dashboards", {
    method: "POST",
    body: JSON.stringify(name === undefined ? {} : { name }),
  }));
}

export async function getDashboard(id: string) {
  return DashboardSchema.parse(await requestJson(`/dashboards/${encodeURIComponent(id)}`));
}
```

- [ ] **Step 3: Implement providers and routes**

Create one QueryClient with retries disabled for 4xx and one retry for 5xx. Routes: `/`, `/editor/:id`, `/preview/:id`, `/view/:id`. Lazy-load the three dashboard routes. Start the MSW worker only when `VITE_USE_MOCKS=true`.

- [ ] **Step 4: Verify and commit**

Run Web tests, typecheck, build, then commit `feat: add dashboard web shell`.

## Task 3: Implement pure editor commands and history

**Files:**
- Create: `packages/editor-core/package.json`
- Create: `packages/editor-core/tsconfig.json`
- Create: `packages/editor-core/vitest.config.ts`
- Create: `packages/editor-core/src/commands.ts`
- Create: `packages/editor-core/src/reducer.ts`
- Create: `packages/editor-core/src/history.ts`
- Create: `packages/editor-core/src/index.ts`
- Test: `packages/editor-core/src/reducer.test.ts`
- Test: `packages/editor-core/src/history.test.ts`

- [ ] **Step 1: Write failing tests**

Cover add/remove/duplicate, move-resize, props, binding, theme, undo, redo, redo invalidation, and 100-entry history bound. Every resulting Dashboard must pass `DashboardSchema`.

- [ ] **Step 2: Implement discriminated commands**

Commands: `component.add`, `component.remove`, `component.duplicate`, `layout.change`, `component.props.update`, `component.binding.update`, `dashboard.theme.update`.

- [ ] **Step 3: Implement bounded immutable history**

`execute` pushes one logical state, limits past to 100, and clears future. Dragging code may call it only on drag/resize stop.

- [ ] **Step 4: Verify and commit**

Run package tests/typecheck plus root tests; commit `feat: add editor command core`.

## Task 4: Build registry, Zustand editor store, and three-column shell

**Files:**
- Create: `packages/component-registry/package.json`
- Create: `packages/component-registry/tsconfig.json`
- Create: `packages/component-registry/vitest.config.ts`
- Create: `packages/component-registry/src/types.ts`
- Create: `packages/component-registry/src/registry.ts`
- Create: `packages/component-registry/src/definitions/bar.ts`
- Create: `packages/component-registry/src/index.ts`
- Create: `apps/web/src/features/editor/store/editorStore.ts`
- Create: `apps/web/src/features/editor/EditorShell.tsx`
- Create: `apps/web/src/features/editor/ComponentPalette.tsx`
- Create: `apps/web/src/features/editor/EditorToolbar.tsx`
- Create: `apps/web/src/features/editor/editor.css`
- Test: corresponding `*.test.ts(x)` files

- [ ] **Step 1: Test registry and store boundaries**

Assert bar defaults, missing definition error, selection excluded from persisted schema, dirty flag, dispatch/undo/redo, and markSaved revision replacement.

First scaffold the workspace package with build/typecheck/test scripts, project references and public exports. Verify the root workspace discovers it before writing implementation tests.

- [ ] **Step 2: Implement the registry protocol**

Each definition owns type/title/default layout/default props/data slots/props schema/binding validation metadata. Editor code may not switch on component type.

- [ ] **Step 3: Implement the shell**

Use CSS grid `240px minmax(720px,1fr) 320px`; palette and inspector scroll independently. Toolbar exposes undo/redo/save/preview/publish and dirty status.

- [ ] **Step 4: Verify and commit**

Run tests/build; commit `feat: add editor shell and state`.

## Task 5: Add grid canvas and palette drag/drop

**Files:**
- Create: `apps/web/src/features/editor/GridCanvas.tsx`
- Create: `apps/web/src/features/editor/ComponentFrame.tsx`
- Modify: `apps/web/src/features/editor/ComponentPalette.tsx`
- Create: `apps/web/src/features/editor/EditorPage.tsx`
- Test: canvas/frame/editor tests

- [ ] **Step 1: Test component frame interactions**

Verify select, copy, delete, keyboard accessibility, and toolbar propagation. Test only one history command occurs on drag/resize completion.

- [ ] **Step 2: Implement controlled 12-column grid**

Use react-grid-layout v2, rowHeight 44, 12px margin/padding, drag handle, southeast resize. Pause chart redraw while dragging; Phase 3 placeholder renderer is sufficient here.

- [ ] **Step 3: Implement dnd-kit palette drop**

Keep click-to-add accessible path. Convert pointer position to grid cell, clamp default width, generate a non-empty stable opaque component ID (UUID is allowed but not required by the contract), dispatch add, select new component.

- [ ] **Step 4: Add shortcuts**

Ctrl/Meta+Z undo, Ctrl/Meta+Shift+Z redo, Ctrl/Meta+S save, Delete removes selection only when focus is not editable.

- [ ] **Step 5: Verify and commit**

Commit `feat: add draggable dashboard canvas`.

## Task 6: Implement datasets, parameters, preview, and binding validation

**Files:**
- Create: `packages/data-engine/package.json`
- Create: `packages/data-engine/tsconfig.json`
- Create: `packages/data-engine/vitest.config.ts`
- Create: `packages/data-engine/src/validateBinding.ts`
- Create: `packages/data-engine/src/applyTransforms.ts`
- Create: `packages/data-engine/src/index.ts`
- Create: `apps/web/src/features/datasets/datasetApi.ts`
- Create: `apps/web/src/features/datasets/DatasetWorkspace.tsx`
- Create: `apps/web/src/features/datasets/ParameterForm.tsx`
- Create: `apps/web/src/features/datasets/DataPreview.tsx`
- Extend: `apps/web/src/mocks/handlers.ts`, `fixtures.ts`
- Test: data-engine and Web dataset tests

- [ ] **Step 1: Test binding and transform rules**

Cover required/multiple/type mismatch/missing field, stable errors, non-mutating sort, numeric/string ordering, and Top N.

First scaffold the workspace package with build/typecheck/test scripts, project references and a public `src/index.ts`; prove root tests and typecheck include it.

- [ ] **Step 2: Add dataset MSW scenarios**

Fixtures: the exact `DatasetSummary[]` and `sales` examples from the handoff, with string/number/date/null, required year and required date parameters, an optional parameter, and 1000 deterministic rows. Every date parameter and date row value is a calendar-valid `YYYY-MM-DD` string. Required parameters reject missing and `null`; optional parameters may be omitted but reject `null` when present. A row may contain `null` only for a column whose `nullable` is true. Scenario overrides: empty, timeout, upstream error, malformed response, 10001 rows, over 5 MiB, and schema v2 removing a bound field. The 10001-row and over-5-MiB cases return `502 DATASET_INVALID_RESPONSE`; all errors are exactly `{code,message}`.

- [ ] **Step 3: Implement query UI**

Generate Input/InputNumber/DatePicker/Switch from QueryParameter. DatePicker serializes a strict calendar-valid `YYYY-MM-DD`; required controls block missing/`null`, while blank optional controls are omitted rather than submitted as `null`. Unknown parameters never submit. Preview slices to 100 rows and labels truncation, and treats a row `null` as valid only when the matching column declares `nullable: true`.

- [ ] **Step 4: Update backend handoff and verify**

Ensure `02-dataset-query-gateway.md` examples equal MSW fixtures. Run tests/typecheck; commit `feat: add dataset workspace and binding engine`.

## Task 7: Implement six components and shared renderer

**Files:**
- Create: definitions for `line`, `pie`, `kpi`, `table`, `text`
- Create: `packages/chart-renderer/package.json`
- Create: `packages/chart-renderer/tsconfig.json`
- Create: `packages/chart-renderer/vitest.config.ts`
- Create: `packages/chart-renderer/src/index.ts`
- Create: `packages/chart-renderer/src/EChart.tsx`
- Create: option builders `bar.ts`, `line.ts`, `pie.ts`
- Create: KPI/Table/Text renderers
- Create: `DashboardComponentRenderer.tsx`
- Create: `apps/web/src/features/runtime/queryKey.ts`
- Create: `apps/web/src/features/runtime/useDashboardData.ts`
- Create: `apps/web/src/features/runtime/DashboardRuntime.tsx`
- Test: option/view-model builders and renderer states

- [ ] **Step 1: Test six registry definitions**

Exact types: bar, line, pie, kpi, table, text. Test slots, defaults, and props schemas.

First scaffold `chart-renderer` with build/typecheck/test scripts, React peer dependencies, project references and public exports; prove the root workspace commands include it.

- [ ] **Step 2: Test pure builders before ECharts wrapper**

Bar uses dataset/encode. Line supports multiple measures and area boolean. Pie maps dimension/value. KPI supports first/sum/avg/max/min. Table selects configured fields. Text accepts plain text only.

- [ ] **Step 3: Implement lifecycle-safe ECharts wrapper**

One instance per container; setOption on semantic input changes; ResizeObserver; dispose on unmount. Local error boundary prevents one chart from taking down the page.

- [ ] **Step 4: Implement shared runtime query orchestration**

Build a canonical query key from `datasetId`, `schemaVersion`, and a recursively key-sorted copy of parameters. Group all bound components by that key and issue exactly one TanStack Query request per group; never query unbound/text components. Reuse cached results across editor, preview, and published viewer, cancel obsolete requests when bindings change, and keep previous data only when the query key is unchanged.

`DashboardRuntime` passes each `DashboardComponentRenderer` the group's live `{data, isLoading, error, refetch}` state. The renderer handles loading, empty, schema/binding error, upstream error, and success without fetching for itself. One failed group affects only its dependent components. Tests prove two charts sharing a dataset/parameters trigger one request, differing parameters trigger two, cache reuse works, and editor/viewer use the same orchestration and renderer path.

- [ ] **Step 5: Verify and commit**

Commit `feat: add six dashboard component renderers`.

## Task 8: Build data/style inspector and dashboard theme

**Files:**
- Create: `Inspector.tsx`, `DataBindingPanel.tsx`, `FieldPicker.tsx`, `StylePanel.tsx`, `DashboardStylePanel.tsx`
- Modify: `EditorPage.tsx`
- Test: inspector behavior

- [ ] **Step 1: Test field filtering and updates**

Only compatible fields appear; required slots show errors; missing fields remain visible as invalid instead of silently changing.

- [ ] **Step 2: Implement React Hook Form + Zod style forms**

Controls cover string/boolean/color/enum/number. Dispatch one command on committed changes, not every color-picker movement.

- [ ] **Step 3: Implement theme panel**

When nothing is selected, edit primary/background colors. Apply immediately to editor and shared viewer.

- [ ] **Step 4: Verify and commit**

Commit `feat: add dashboard inspector and theme controls`.

## Task 9: Add save, autosave, conflict recovery, preview, and publish

**Files:**
- Create: dashboard query hooks, `useAutosave.ts`, `RevisionConflictModal.tsx`
- Create: `DashboardViewer.tsx`, `PreviewPage.tsx`, `PublishedPage.tsx`
- Extend: MSW conflict/publish scenarios
- Test: fake-timer autosave, conflict choices, viewer parity

- [ ] **Step 1: Test manual save and debounced autosave**

Two seconds idle; one in-flight save; returned revision becomes new base; failure preserves dirty state.

- [ ] **Step 2: Test 409 choices**

Reload requires explicit confirmation. Copy creates a new dashboard and saves local state against its new revision. Never force overwrite.

- [ ] **Step 3: Test shared viewer**

Preview reads draft, view reads published snapshot only, both mount `DashboardRuntime` and use the same query grouping/cache and renderer as the editor; neither includes editor controls. Published configuration stays fixed until republish, while live Dataset Gateway results may change between visits.

- [ ] **Step 4: Update handoff and verify**

Check `01-dashboard-crud.md` and `03-publish-and-preview.md` against handlers; commit `feat: add dashboard persistence and publishing UX`.

## Task 10: Reliability, performance, and MSW release E2E

**Files:**
- Create: schema migration entry point and tests
- Create: component error boundary and schema-drift hook/tests
- Create: `playwright.config.ts`, `e2e/dashboard-flow.spec.ts`
- Create: `docs/performance/baseline.md`

- [ ] **Step 1: Add failure isolation and schema drift**

Missing fields produce actionable errors; `schemaVersion` changes revalidate bindings; published fallback hides technical details.

- [ ] **Step 2: Establish performance limits**

10k-row option building under recorded baseline; preview DOM <=100 rows; drag does not redraw charts continuously; published route excludes editor dependencies.

- [ ] **Step 3: Add Playwright flows**

Core: create → dataset → chart → bind → style → save → publish → view. Failures: timeout, field removal, revision conflict, publish failure preserving old snapshot, refresh recovery.

- [ ] **Step 4: Prove the frontend release gate with MSW**

Run the complete core and failure E2E suite with `VITE_USE_MOCKS=true`. This MSW run, together with unit/type/build checks, is the blocking frontend MVP release gate; Java availability is not required.

- [ ] **Step 5: Final verification and commit**

Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `VITE_USE_MOCKS=true pnpm test:e2e`, then commit `test: complete frontend MVP release gates`.

## Task 11: Non-blocking Java integration gate (after Java is ready)

**Files:**
- Update: `docs/backend-handoff/04-integration-acceptance.md`
- Add integration evidence under the backend handoff directory

- [ ] **Step 1: Receive the Java test base URL and backend evidence**

Do not start this gate until the Java team marks its staged checklist ready. Task 10 remains the definition of frontend MVP completion.

- [ ] **Step 2: Run the same E2E against Java**

Run the Task 10 E2E with `VITE_USE_MOCKS=false` and the Java base URL. No feature code, fixture-specific branch, or DTO mapping may change between MSW and Java runs.

- [ ] **Step 3: Record integration gaps without reopening frontend completion**

Track contract deviations in `docs/backend-handoff/04-integration-acceptance.md`; fix the owning side, rerun the affected test, and attach evidence. This is a production-integration follow-up gate, not a blocker for the MSW-backed frontend MVP commit.

## Execution order and gates

1. Tasks 1–2: front-end/API contract foundation.
2. Tasks 3–5: editor usable without real charts.
3. Tasks 6–8: data-to-chart configuration loop.
4. Tasks 9–10: persistence, publishing, reliability, and the MSW-backed frontend MVP release.
5. Task 11: Java integration after its environment is available; non-blocking for frontend MVP completion.

After every task: implementer self-review → spec compliance review → code quality review. Do not advance with open Critical or Important findings.
