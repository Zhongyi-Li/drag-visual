# Drag Visual

Drag Visual is a dashboard MVP with a React editor/viewer, shared TypeScript contracts, MSW mock service, and a repository-owned NestJS backend under `apps/api`.

## Requirements

- Node.js 24 for CI parity. Local development requires Node.js `>=22.12`.
- pnpm 10.28.0.
- Chromium installed through Playwright for browser tests.

## Mock Development

Run the web app against MSW mock APIs:

```bash
pnpm dev:mock
```

Run the web app without mocks, using `VITE_API_BASE_URL` for API requests:

```bash
pnpm dev:web
```

## Frontend Verification

Use these commands for the frontend release gate:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm lint:openapi
pnpm test:e2e
```

For the blocking browser gate, run the Playwright scenarios twice:

```bash
pnpm exec playwright test --repeat-each=2
```

## Environment Variables

- `VITE_API_BASE_URL`: API base URL used by `apps/web/src/api/client.ts`. Leave empty for same-origin requests.
- `VITE_USE_MOCKS`: set to `true` to start the browser MSW worker from `apps/web/src/mocks/browser.ts`.

Do not commit credentials, internal service URLs, or environment-specific secrets.

## API Contract

The integration boundary is documented in:

- `openapi/bi-mvp.yaml`
- `packages/contracts`
- `apps/web/src/mocks/handlers.ts`

The MSW mock implements frontend-test behavior for the same route paths, request/response shapes, revision semantics, publish snapshots, dataset schemas, and stable error codes that `apps/api` is expected to provide.

## Browser E2E Coverage

- `e2e/frontend-flow.spec.ts`: create dashboard, add chart, save, publish, and open the read-only published page.
- `e2e/frontend-failures.spec.ts`: dataset timeout, schema drift, revision conflict, publish failure preserving the previous snapshot, and reload recovery.

These tests run with `VITE_USE_MOCKS=true` through `playwright.config.ts`.

## Backend Integration Boundary

The real backend is implemented in `apps/api` with NestJS + Fastify + Prisma + PostgreSQL. The frontend can keep using MSW while backend capabilities are completed.

`apps/api` should implement the routes, fields, and error codes in `openapi/bi-mvp.yaml`. Frontend mock behavior lives in `apps/web/src/mocks/handlers.ts` and is intended for local development, unit tests, and Playwright release-gate scenarios only.

Remaining real-backend integration items are tracked in `docs/release/frontend-mvp-checklist.md` and `docs/backend-self-build/00-roadmap.md`.
