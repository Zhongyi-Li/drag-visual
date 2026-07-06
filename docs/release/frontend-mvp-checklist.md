# Frontend MVP Release Checklist

## Automated Frontend Gates

| Gate | Command | Date | Result |
| --- | --- | --- | --- |
| Dependency install | `CI=true pnpm install --frozen-lockfile` | 2026-07-06 | Pass: lockfile up to date, 474 packages restored |
| TypeScript | `pnpm typecheck` | 2026-07-06 | Pass: all workspace typechecks exited 0 |
| Unit tests | `pnpm test` | 2026-07-06 | Pass: 47 files, 370 tests |
| Production build | `pnpm build` | 2026-07-06 | Pass: all workspace builds exited 0 |
| OpenAPI lint | `pnpm lint:openapi` | 2026-07-06 | Pass: `openapi/bi-mvp.yaml` valid |
| Playwright browser gate | `pnpm exec playwright test --repeat-each=2` | 2026-07-06 | Pass: 12 Chromium tests |
| Viewer bundle isolation | `viewer_chunk=$(find apps/web/dist/assets -name 'viewerQueries-*.js' -print -quit); ! rg "EditorShell|InspectorPanel|dnd-kit|react-grid-layout" "$viewer_chunk"` | 2026-07-06 | Pass: no editor-only strings found in viewer chunk |
| Repository hygiene | `git diff --check && git status --short --untracked-files=all` | 2026-07-06 | Pass: whitespace clean; status contained only CI, README, and release checklist files before commit |

## Real Backend Integration

These items remain unchecked until the repository-owned NestJS backend has real integration evidence.

- [ ] Implement contract-conformant dashboard draft, publish, and published-view routes from `openapi/bi-mvp.yaml`.
- [ ] Implement contract-conformant dataset list, schema, and query routes from `openapi/bi-mvp.yaml`.
- [ ] Wire internal identity and authorization according to the target deployment environment.
- [ ] Map real dataset gateway timeout, upstream, invalid-response, and not-found failures to the documented stable error codes.
- [ ] Configure environment-specific proxy, base URL, CORS, and deployment settings without committing secrets.
- [ ] Run frontend E2E against `apps/api` and record defects or contract gaps.

## Manual Acceptance Evidence

Manual product acceptance is pending and must be filled by a named reviewer before any organization-wide release claim.

| Field | Evidence |
| --- | --- |
| Reviewer | Pending |
| Date | Pending |
| Browser and version | Pending |
| Dashboard ID | Pending |
| Scenario elapsed time | Pending |
| Defects found | Pending |
| P0/P1 count | Pending |
| Approval decision | Pending |

## Integration Notes

- Frontend mock routes are test-only and are enabled by `VITE_USE_MOCKS=true`.
- Real backend completion is tracked through `apps/api` and remains outside the frontend-only release gate.
- A completed frontend gate does not mean real backend integration or organization-wide release approval is complete.
