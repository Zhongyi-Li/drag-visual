# API Dataset Gateway Design

## Context

The backend route is now fixed on `apps/api` with NestJS + Fastify + Prisma + PostgreSQL. Dashboard draft CRUD and publishing already exist. The largest backend gap for the editor is the Dataset Gateway: the frontend can bind fields through MSW today, but the real API does not yet provide dataset list, schema, or query endpoints.

MSW remains useful for frontend development and tests. This phase creates real backend endpoints that match the same contract, using server-side fixtures first and leaving real upstream integration for a later phase.

## Goals

- Add `GET /datasets`.
- Add `GET /datasets/:datasetId/schema`.
- Add `POST /datasets/:datasetId/query`.
- Support fixed allowed datasets: `sales` and `inventory`.
- Keep response shapes, field keys, parameter semantics, and error bodies aligned with `docs/backend-contract/02-dataset-query-gateway.md`.
- Make the implementation easy to replace with a real upstream adapter later.

## Non-Goals

- No arbitrary user-configured data source.
- No SQL editor or direct database query feature.
- No credentials, proxying user-provided URLs, or browser-visible upstream details.
- No persistent dataset management tables.
- No backend preview snapshot persistence.

## Architecture

Add `apps/api/src/datasets` with the same layering style as existing Dashboard and Publishing modules:

- `DatasetController`: HTTP routes, path/body validation, stable HTTP error mapping.
- `DatasetService`: dataset lookup, query parameter validation, row validation, and limit checks.
- `DatasetRepository`: an interface for dataset metadata and query execution.
- `FixtureDatasetRepository`: first implementation backed by in-code fixtures.
- `DatasetModule`: exports the controller/service/repository binding and is imported by `AppModule`.

The repository boundary is intentionally small. Later, `FixtureDatasetRepository` can be replaced by a real upstream adapter without changing the controller or frontend contract.

## Data Contract

The service exposes:

- `DatasetSummary`: `{ id, name, schemaVersion }`.
- `DatasetSchema`: `{ id, name, fields, parameters, schemaVersion }`.
- `DatasetQueryRequest`: `{ parameters }`.
- `DatasetQueryResult`: `{ columns, rows, total, sampledAt }`.

Field types are restricted to:

- `string`
- `number`
- `date`
- `boolean`

`date` values must be strict calendar-valid `YYYY-MM-DD` strings.

## Validation

Dataset IDs are non-empty stable strings and must exist in the repository allowlist.

For query parameters:

- Required parameters must be present and cannot be `null`.
- Optional parameters may be omitted.
- Optional parameters cannot be `null` when present.
- Unknown parameters return `400 DATASET_QUERY_INVALID`.
- Values must match the declared parameter type.
- `date` parameters must be strict calendar-valid `YYYY-MM-DD`.

For query responses:

- Column keys must be unique.
- Rows must be arrays of JSON-compatible plain records.
- Every row value must match the declared column type when not `null`.
- `null` is allowed only when the column has `nullable: true`.
- Result rows are capped at 10000.
- The normalized JSON payload is capped at 5 MiB.

## Errors

All error responses are plain JSON:

```json
{ "code": "DATASET_QUERY_INVALID", "message": "Dataset query is invalid" }
```

The first fixture-backed implementation must return:

- `404 DATASET_NOT_FOUND` when the dataset ID is not allowed.
- `400 DATASET_QUERY_INVALID` for bad parameters.
- `502 DATASET_INVALID_RESPONSE` if fixture/query output violates the response contract.

`DATASET_TIMEOUT` and `DATASET_UPSTREAM_ERROR` remain documented for the real upstream adapter phase. The fixture-backed repository does not naturally trigger them.

## Fixtures

Use fixed backend fixtures for:

- `sales`
- `inventory`

Fixtures should align with the frontend mock data enough for the editor to list datasets, display fields, submit required parameters, and render preview/query results. The exact row count can stay small for backend tests, as long as validation and limit behavior are covered.

## Testing

Add API tests for:

- Dataset list returns summaries.
- Schema returns fields and parameters.
- Query returns columns, rows, total, and sampledAt.
- Unknown dataset returns `DATASET_NOT_FOUND`.
- Missing required parameter returns `DATASET_QUERY_INVALID`.
- Unknown parameter returns `DATASET_QUERY_INVALID`.
- Invalid date returns `DATASET_QUERY_INVALID`.
- `null` in a non-nullable output column maps to `DATASET_INVALID_RESPONSE`.

Run:

```bash
corepack pnpm --filter @drag-visual/api test
corepack pnpm --filter @drag-visual/api typecheck
```

## Documentation

Add `docs/backend-self-build/03-dataset-gateway.md` with:

- Implemented endpoints.
- Fixture-backed scope.
- Error semantics.
- Local verification commands.
- Follow-up notes for real upstream integration.
