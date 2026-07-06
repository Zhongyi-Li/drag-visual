# API Dataset Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real `apps/api` dataset list, schema, and query endpoints backed by fixed server-side fixtures.

**Architecture:** Follow the existing NestJS module pattern used by Dashboard and Publishing. The controller maps HTTP validation and stable API errors, the service owns query/response validation, and a repository interface isolates fixture data from future real upstream adapters.

**Tech Stack:** NestJS 11, Fastify, TypeScript, Zod, Vitest, `@drag-visual/contracts`.

---

## File Map

- Create: `apps/api/src/datasets/dataset.repository.ts`
- Create: `apps/api/src/datasets/fixture-dataset.repository.ts`
- Create: `apps/api/src/datasets/dataset.service.ts`
- Create: `apps/api/src/datasets/dataset.controller.ts`
- Create: `apps/api/src/datasets/dataset.module.ts`
- Create: `apps/api/src/datasets/dataset.service.test.ts`
- Create: `apps/api/src/datasets/dataset.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `docs/backend-self-build/03-dataset-gateway.md`

## Task 1: Repository And Fixtures

**Files:**
- Create: `apps/api/src/datasets/dataset.repository.ts`
- Create: `apps/api/src/datasets/fixture-dataset.repository.ts`

- [ ] **Step 1: Define repository interface**

Create `apps/api/src/datasets/dataset.repository.ts`:

```ts
import type { Dataset, DatasetQueryRequest, DatasetQueryResult, DatasetSummary } from "@drag-visual/contracts";

export const DATASET_REPOSITORY = Symbol("DATASET_REPOSITORY");

export interface DatasetRepository {
  list(): Promise<readonly DatasetSummary[]>;
  getSchema(id: string): Promise<Dataset | null>;
  query(id: string, request: DatasetQueryRequest): Promise<DatasetQueryResult | null>;
}
```

- [ ] **Step 2: Add fixture repository**

Create `apps/api/src/datasets/fixture-dataset.repository.ts`:

```ts
import {
  Dataset,
  DatasetQueryResult,
  DatasetSummary,
  type DatasetQueryRequest,
} from "@drag-visual/contracts";
import { Injectable } from "@nestjs/common";

import type { DatasetRepository } from "./dataset.repository.js";

const datasetFixtures = [
  {
    id: "sales",
    name: "销售数据",
    fields: [
      { key: "month", label: "月份", type: "string", nullable: false },
      { key: "businessDate", label: "业务日期", type: "date", nullable: false },
      { key: "revenue", label: "收入", type: "number", nullable: false },
      { key: "discount", label: "折扣", type: "number", nullable: true },
    ],
    parameters: [
      { key: "year", label: "年份", type: "number", required: true },
      { key: "fromDate", label: "开始日期", type: "date", required: true },
      { key: "region", label: "区域", type: "string", required: false },
    ],
    schemaVersion: "v1",
  },
  {
    id: "inventory",
    name: "库存数据",
    fields: [
      { key: "sku", label: "SKU", type: "string", nullable: false },
      { key: "quantity", label: "库存", type: "number", nullable: false },
    ],
    parameters: [],
    schemaVersion: "v3",
  },
] satisfies Dataset[];

const twoDigits = (value: number): string => String(value).padStart(2, "0");

const salesRows = Array.from({ length: 1000 }, (_, index) => {
  if (index === 0) {
    return { month: "1月", businessDate: "2026-01-15", revenue: 120_000, discount: null };
  }
  const month = (index % 12) + 1;
  const day = (index % 28) + 1;
  return {
    month: `${month}月`,
    businessDate: `2026-${twoDigits(month)}-${twoDigits(day)}`,
    revenue: 120_000 + index,
    discount: index % 10 === 0 ? null : index % 20,
  };
});

const sampledAt = "2026-07-02T08:00:00.000Z";

const clone = <Value>(value: Value): Value => structuredClone(value);

@Injectable()
export class FixtureDatasetRepository implements DatasetRepository {
  async list(): Promise<readonly DatasetSummary[]> {
    return datasetFixtures.map(({ id, name, schemaVersion }) => ({ id, name, schemaVersion }));
  }

  async getSchema(id: string): Promise<Dataset | null> {
    const dataset = datasetFixtures.find((entry) => entry.id === id);
    return dataset ? clone(Dataset.parse(dataset)) : null;
  }

  async query(id: string, _request: DatasetQueryRequest): Promise<DatasetQueryResult | null> {
    const dataset = datasetFixtures.find((entry) => entry.id === id);
    if (!dataset) return null;
    if (dataset.id === "sales") {
      return DatasetQueryResult.parse({
        columns: clone(dataset.fields),
        rows: clone(salesRows),
        total: salesRows.length,
        sampledAt,
      });
    }
    return DatasetQueryResult.parse({
      columns: clone(dataset.fields),
      rows: [{ sku: "SKU-001", quantity: 42 }],
      total: 1,
      sampledAt,
    });
  }
}
```

- [ ] **Step 3: Verify types**

Run:

```bash
corepack pnpm --filter @drag-visual/api typecheck
```

Expected: it may fail because the service/controller are not wired yet, but fixture TypeScript errors should be fixed before moving on.

## Task 2: Service Validation

**Files:**
- Create: `apps/api/src/datasets/dataset.service.ts`
- Create: `apps/api/src/datasets/dataset.service.test.ts`

- [ ] **Step 1: Add failing service tests**

Create `apps/api/src/datasets/dataset.service.test.ts` with tests for list/schema/query and invalid parameter/response cases. Use an inline fake repository so invalid fixture output can be tested without special production-only switches.

- [ ] **Step 2: Implement service**

Create `apps/api/src/datasets/dataset.service.ts` with:

```ts
import {
  Dataset,
  DatasetQueryRequest,
  DatasetQueryResult,
  type DatasetField,
  type QueryParameter,
} from "@drag-visual/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { DATASET_REPOSITORY, type DatasetRepository } from "./dataset.repository.js";

export class DatasetNotFoundError extends Error {}
export class DatasetQueryInvalidError extends Error {}
export class DatasetInvalidResponseError extends Error {}

const DATASET_BODY_LIMIT = 5 * 1024 * 1024;

const calendarDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const valueMatchesType = (value: unknown, type: DatasetField["type"]): boolean => {
  if (type === "date") return typeof value === "string" && calendarDate(value);
  return typeof value === type;
};

@Injectable()
export class DatasetService {
  constructor(
    @Inject(DATASET_REPOSITORY)
    private readonly repository: DatasetRepository,
  ) {}

  async list() {
    return this.repository.list();
  }

  async getSchema(id: string) {
    const dataset = await this.repository.getSchema(id);
    if (!dataset) throw new DatasetNotFoundError();
    return Dataset.parse(dataset);
  }

  async query(id: string, request: DatasetQueryRequest) {
    const dataset = await this.getSchema(id);
    this.validateParameters(dataset.parameters, request.parameters);
    const result = await this.repository.query(id, request);
    if (!result) throw new DatasetNotFoundError();
    return this.validateResult(result);
  }

  private validateParameters(parameters: readonly QueryParameter[], values: Record<string, unknown>): void {
    const known = new Map(parameters.map((parameter) => [parameter.key, parameter]));
    for (const [key, value] of Object.entries(values)) {
      const parameter = known.get(key);
      if (!parameter || value === null || !valueMatchesType(value, parameter.type)) {
        throw new DatasetQueryInvalidError();
      }
    }
    for (const parameter of parameters) {
      if (parameter.required && (!Object.hasOwn(values, parameter.key) || values[parameter.key] === null)) {
        throw new DatasetQueryInvalidError();
      }
    }
  }

  private validateResult(result: unknown) {
    const parsed = DatasetQueryResult.safeParse(result);
    if (!parsed.success) throw new DatasetInvalidResponseError();
    const normalized = parsed.data;
    if (new TextEncoder().encode(JSON.stringify(normalized)).byteLength > DATASET_BODY_LIMIT) {
      throw new DatasetInvalidResponseError();
    }
    for (const row of normalized.rows) {
      for (const column of normalized.columns) {
        const cell = row[column.key];
        if (cell === null) {
          if (!column.nullable) throw new DatasetInvalidResponseError();
          continue;
        }
        if (!valueMatchesType(cell, column.type)) throw new DatasetInvalidResponseError();
      }
    }
    return normalized;
  }
}
```

- [ ] **Step 3: Run service tests**

Run:

```bash
corepack pnpm --filter @drag-visual/api exec vitest run src/datasets/dataset.service.test.ts
```

Expected: all service tests pass.

## Task 3: Controller And Module

**Files:**
- Create: `apps/api/src/datasets/dataset.controller.ts`
- Create: `apps/api/src/datasets/dataset.controller.test.ts`
- Create: `apps/api/src/datasets/dataset.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Add controller tests**

Cover:

- `GET /datasets` returns summaries.
- `GET /datasets/sales/schema` returns schema.
- `POST /datasets/sales/query` returns rows.
- Unknown dataset returns `404 DATASET_NOT_FOUND`.
- Bad query body returns `400 DATASET_QUERY_INVALID`.

- [ ] **Step 2: Implement controller**

Create `apps/api/src/datasets/dataset.controller.ts`:

```ts
import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  UseFilters,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import {
  DatasetInvalidResponseError,
  DatasetNotFoundError,
  DatasetQueryInvalidError,
  DatasetService,
} from "./dataset.service.js";
import { DatasetQueryRequest } from "@drag-visual/contracts";

const API_ERRORS = {
  notFound: { code: "DATASET_NOT_FOUND", message: "Dataset was not found" },
  queryInvalid: { code: "DATASET_QUERY_INVALID", message: "Dataset query is invalid" },
  invalidResponse: { code: "DATASET_INVALID_RESPONSE", message: "Dataset response is invalid" },
  internal: { code: "INTERNAL_ERROR", message: "Internal server error" },
} as const;

class DatasetHttpException extends HttpException {}

const apiException = (
  status: HttpStatus,
  body: (typeof API_ERRORS)[keyof typeof API_ERRORS],
): DatasetHttpException => new DatasetHttpException(body, status);

const parseBody = (body: unknown) => {
  try {
    return DatasetQueryRequest.parse(body);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw apiException(HttpStatus.BAD_REQUEST, API_ERRORS.queryInvalid);
    }
    throw error;
  }
};

const httpError = (error: unknown): never => {
  if (error instanceof HttpException) throw error;
  if (error instanceof DatasetNotFoundError) throw apiException(HttpStatus.NOT_FOUND, API_ERRORS.notFound);
  if (error instanceof DatasetQueryInvalidError) throw apiException(HttpStatus.BAD_REQUEST, API_ERRORS.queryInvalid);
  if (error instanceof DatasetInvalidResponseError) throw apiException(HttpStatus.BAD_GATEWAY, API_ERRORS.invalidResponse);
  throw error;
};

@Catch()
export class DatasetExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatasetExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    if (exception instanceof DatasetHttpException) {
      const response = exception.getResponse();
      if (typeof response === "object" && response !== null && "code" in response && "message" in response) {
        reply.status(exception.getStatus()).send(response);
        return;
      }
    }
    const request = http.getRequest<FastifyRequest>();
    this.logger.error({
      message: "Unexpected dataset request failure",
      method: request.method,
      route: request.url.split("?", 1)[0],
      errorType: exception instanceof Error ? exception.name : "Unknown",
    });
    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send(API_ERRORS.internal);
  }
}

@Controller("datasets")
@UseFilters(DatasetExceptionFilter)
export class DatasetController {
  constructor(private readonly datasets: DatasetService) {}

  @Get()
  async list() {
    return this.datasets.list();
  }

  @Get(":datasetId/schema")
  async schema(@Param("datasetId") datasetId: string) {
    try {
      return await this.datasets.getSchema(datasetId);
    } catch (error: unknown) {
      return httpError(error);
    }
  }

  @Post(":datasetId/query")
  async query(@Param("datasetId") datasetId: string, @Body() body: unknown) {
    const request = parseBody(body);
    try {
      return await this.datasets.query(datasetId, request);
    } catch (error: unknown) {
      return httpError(error);
    }
  }
}
```

- [ ] **Step 3: Wire module**

Create `apps/api/src/datasets/dataset.module.ts` and import it from `apps/api/src/app.module.ts`.

- [ ] **Step 4: Run controller tests**

Run:

```bash
corepack pnpm --filter @drag-visual/api exec vitest run src/datasets/dataset.controller.test.ts
```

Expected: all controller tests pass.

## Task 4: Docs And Verification

**Files:**
- Create: `docs/backend-self-build/03-dataset-gateway.md`

- [ ] **Step 1: Document implemented gateway**

Create `docs/backend-self-build/03-dataset-gateway.md` with endpoints, fixture-backed scope, error semantics, and verification commands.

- [ ] **Step 2: Run focused verification**

Run:

```bash
corepack pnpm --filter @drag-visual/api exec vitest run src/datasets/dataset.service.test.ts src/datasets/dataset.controller.test.ts
corepack pnpm --filter @drag-visual/api test
corepack pnpm --filter @drag-visual/api typecheck
```

Expected: all commands exit 0.

- [ ] **Step 3: Review diff**

Run:

```bash
git diff -- apps/api/src/app.module.ts apps/api/src/datasets docs/backend-self-build/03-dataset-gateway.md
```

Expected: only Dataset Gateway implementation, tests, module wiring, and docs are present.
