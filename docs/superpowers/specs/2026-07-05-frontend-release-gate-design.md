# Frontend Release Gate Design

## Goal

Complete the frontend MVP release gate without depending on the real backend being finished. The frontend must be independently demonstrable with MSW data, protect its API contract with runtime schemas and tests, and remain ready for `apps/api` to implement the documented endpoints.

## Ownership Boundary

This frontend release-gate work includes the React application, shared TypeScript contracts, mock API scenarios, browser end-to-end tests, frontend CI, and operational documentation for frontend contributors.

The real Dataset Gateway, database deployment, and organization-specific proxy configuration are not implementation requirements for this frontend release gate. They are tracked as `apps/api` backend work in the same repository.

## API Contract and Mock Strategy

The existing Zod contracts and OpenAPI document remain the integration boundary. MSW handlers must implement the same route paths, request bodies, response schemas, revision behavior, publish snapshot semantics, dataset fields, and stable error codes expected from `apps/api`.

The browser test server starts the Web application with `VITE_USE_MOCKS=true`. Mock state is reset between tests. Deterministic scenarios cover normal data plus timeout, upstream failure, schema-version change, removed fields, stale revision, failed publication, and empty results. Scenario controls remain test-only and must not leak into production request bodies.

## Browser End-to-End Coverage

Playwright validates the frontend as a user sees it. The blocking core flow is:

1. Create a dashboard.
2. Add supported components.
3. Save the draft.
4. Publish the saved snapshot.
5. Open the published route and confirm editor controls are absent.

Failure-path coverage proves that upstream timeout is local and actionable, schema drift identifies affected bindings, a revision conflict preserves local edits, failed publication leaves the previous snapshot accessible, and browser reload restores the saved draft.

The current editor does not yet expose the complete dataset-binding inspector described in the original MVP plan. E2E assertions must test real implemented UI behavior and may seed contract-valid dashboards through MSW helper routes or browser-visible setup only when necessary. Tests must not claim unsupported binding UI exists.

## CI and Documentation

CI installs with the frozen pnpm lockfile and runs frontend-relevant blocking commands: typecheck, unit tests, production build, OpenAPI lint, and MSW-backed Playwright tests. It does not provision PostgreSQL or start the real backend.

The README documents exact mock-development, build, unit-test, and E2E commands; the API/OpenAPI locations; environment variables; performance baseline; and the real backend integration boundary. A frontend release checklist separates:

- automated frontend gates that this repository can close;
- real backend integration gates tracked under `apps/api`;
- manual product acceptance that requires a named person and real evidence.

## Acceptance

The frontend release gate is complete when:

- Playwright core and failure scenarios pass twice without retries;
- typecheck, unit tests, production build, and OpenAPI lint pass;
- CI encodes the same commands;
- the README and release checklist contain no secret values and no claim that real backend work was completed by the frontend gate;
- the manual acceptance section remains explicitly pending until a real reviewer records browser, dashboard ID, elapsed time, defects, and approval.

Completing this gate does not mean real backend integration or organizational release is complete.
