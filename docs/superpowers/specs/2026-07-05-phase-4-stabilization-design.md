# Phase 4 Stabilization Design

## Goal

Stabilize and truthfully close the existing Phase 4 work before adding authentication, end-to-end automation, CI, or release operations. Completion means the implemented draft-save, publish, preview, schema-drift, renderer-isolation, and performance behavior matches the MVP architecture and passes the repository quality gates.

## Current State

The working tree contains uncommitted implementations for autosave and revision-conflict recovery, atomic publishing, preview and published routes, dashboard schema migration, dataset schema-drift detection, component error isolation, and a lightweight 10,000-row option benchmark.

The workspace typecheck passes. The unit suite currently has one timeout in `DatasetWorkspace.test.tsx`. More importantly, the current `DashboardViewer` renders placeholder component-type text rather than querying bound datasets and rendering actual dashboard components. The planned `packages/chart-renderer` package is not implemented, so preview and published rendering cannot yet be considered complete.

## Scope

### Included

- Stabilize the existing dataset workspace test without hiding a product defect behind a longer timeout.
- Review and finish Phase 4 Tasks 1–5 against observable behavior rather than file presence.
- Preserve and verify safe autosave, explicit revision-conflict choices, and save-before-preview/publish behavior.
- Preserve atomic publication of a validated draft and ensure published reads never fall back to a draft.
- Implement a shared read-only component renderer used by preview and published routes.
- Query data for saved dataset bindings and render supported components with their saved layout and presentation properties.
- Isolate renderer failures per component and keep published error details sanitized.
- Detect dataset schema drift and show actionable messages next to affected components.
- Keep data preview bounded to 100 rows and retain a reproducible 10,000-row option-build baseline.
- Run typecheck, unit tests, and production build before declaring stabilization complete.
- Commit completed work in coherent functional slices.

### Excluded

- Internal identity and proxy trust configuration.
- API security-header and CORS hardening.
- Playwright end-to-end coverage.
- CI workflows and internal release checklists.
- Manual internal-user acceptance evidence.

These remain Phase 4 continuation work after stabilization.

## Architecture

The dashboard schema remains the single persisted contract. Draft and published routes share a read-only rendering pipeline but use distinct data sources:

1. Preview loads the current saved draft from `GET /dashboards/:id`.
2. Published view loads only the immutable configuration snapshot from `GET /published-dashboards/:id`.
3. The shared viewer resolves each component's saved dataset reference and parameters.
4. Dataset query results are normalized and passed with the component definition to a renderer selected by component type.
5. Each renderer is wrapped in a component-local error boundary.

The renderer layer must not import editor state, drag-and-drop behavior, inspector code, or editor controls. Renderer-specific option construction stays pure and independently testable. Application routes own loading and route-level errors; individual components own query, drift, empty-data, and rendering states.

## Components and Responsibilities

### Editor persistence integration

The editor keeps one in-flight save promise, debounces autosave, and marks saved revisions from the server response. Manual preview and publish wait for a dirty draft to save successfully. A revision conflict offers explicit reload or copy-as-new choices and never silently overwrites server state.

### Publishing API

Publishing reads and validates the draft inside the transactional publication path, then replaces the published snapshot atomically. Invalid drafts and missing records return stable, sanitized API errors. Published reads migrate and validate persisted schema versions before returning data.

### Shared dashboard viewer

The viewer maps saved layout entries to components and delegates content rendering to a renderer registry. It displays real KPI, chart, text, image, and table output for the component types supported by the MVP contract. Unsupported component types fail locally through the same boundary rather than degrading the whole page.

### Dataset resolution and drift

For every bound component, the viewer loads the current dataset schema, compares it with the saved schema version, validates slot bindings, and queries rows with saved parameters. Missing fields, incompatible slots, upstream failures, and empty results are distinct UI states. A drift warning identifies the dataset or missing field and remains visible until the binding is corrected and saved.

### Performance safeguards

Pure chart-option builders process the 10,000-row fixture within the documented local threshold. Dataset preview passes at most 100 rows to the table. Rendering avoids recomputing options when rows, bindings, and props are unchanged. Timing assertions remain a release signal; deterministic structural assertions are the blocking safeguard.

## Error Handling

- Route-level loading failures provide retry actions and distinguish missing published pages from generic failures.
- Save failures leave the editor dirty; publish and preview do not continue after a failed save.
- Revision conflicts require an explicit user choice.
- Dataset query and binding failures affect only their component.
- Preview may offer component retry; published output exposes no stack, raw upstream payload, or sensitive error detail.
- Publishing failure preserves the last valid published snapshot.

## Testing and Acceptance

Stabilization is complete only when all of the following are true:

- Autosave debounce, in-flight save exclusion, conflict recovery, save-before-preview, and save-before-publish tests pass.
- Publishing service, controller, and repository tests prove validation, atomic replacement, and preservation of the previous snapshot after failure.
- Preview and published route tests prove their distinct endpoints and shared renderer usage.
- Renderer tests exercise actual component output, local failure isolation, empty data, and schema drift.
- The dataset workspace test passes reliably without increasing its timeout as the primary fix.
- Preview row limits and the 10,000-row option baseline pass.
- `/usr/local/bin/pnpm typecheck`, `/usr/local/bin/pnpm test`, and `/usr/local/bin/pnpm build` exit successfully.

## Delivery Sequence

1. Diagnose and fix the dataset workspace timeout.
2. Audit and finish persistence and publishing behavior.
3. Implement and integrate the shared real renderer and dataset-query flow.
4. Finish drift, isolation, and performance safeguards.
5. Run the complete stabilization gate and split commits by functional boundary.
6. Start a separate continuation cycle for identity, E2E, CI, and release acceptance.
