import { Dataset, DatasetQueryResult } from "@drag-visual/contracts";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "vitest";

import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { AuthService } from "../auth/auth.service.js";
import { safeJsonFastifyOptions } from "../fastify-options.js";
import { DatasetController } from "./dataset.controller.js";
import {
  DATASET_REPOSITORY,
  type DatasetRepository,
} from "./dataset.repository.js";
import { DatasetService } from "./dataset.service.js";
import { DatasetUpstreamError } from "./dataset.errors.js";

const salesDataset = Dataset.parse({
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
  ],
  schemaVersion: "v1",
});

class TestDatasetRepository implements DatasetRepository {
  async list() {
    const { id, name, schemaVersion } = salesDataset;
    return [{ id, name, schemaVersion }];
  }

  async getSchema(id: string) {
    return id === salesDataset.id ? salesDataset : null;
  }

  async query(id: string) {
    if (id !== salesDataset.id) return null;
    return DatasetQueryResult.parse({
      columns: salesDataset.fields,
      rows: [{ month: "1月", businessDate: "2026-01-15", revenue: 120_000, discount: null }],
      total: 1,
      sampledAt: "2026-07-02T08:00:00.000Z",
    });
  }
}

describe("DatasetController", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const bootstrap = async (
    repository: DatasetRepository = new TestDatasetRepository(),
  ) => {
    const module = await Test.createTestingModule({
      controllers: [DatasetController],
      providers: [
        DatasetService,
        { provide: DATASET_REPOSITORY, useValue: repository },
        { provide: SessionAuthGuard, useValue: { canActivate: () => true } },
        { provide: AuthService, useValue: { authenticate: async () => ({ id: "test-user", username: "test", displayName: null, avatarUrl: null }) } },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(safeJsonFastifyOptions),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  };

  it("lists dataset summaries", async () => {
    await bootstrap();

    const response = await app!.inject({ method: "GET", url: "/datasets" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      { id: "sales", name: "销售数据", schemaVersion: "v1" },
    ]);
  });

  it("returns a dataset schema", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "GET",
      url: "/datasets/sales/schema",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "sales",
      name: "销售数据",
      schemaVersion: "v1",
    });
    expect(response.json().fields).toContainEqual({
      key: "revenue",
      label: "收入",
      type: "number",
      nullable: false,
    });
  });

  it("queries dataset rows", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "POST",
      url: "/datasets/sales/query",
      payload: { parameters: { year: 2026, fromDate: "2026-01-01" } },
    });

    expect(response.statusCode).toBe(200);
    const result = DatasetQueryResult.parse(response.json());
    expect(result.total).toBe(1);
    expect(result.rows[0]).toEqual({
      month: "1月",
      businessDate: "2026-01-15",
      revenue: 120_000,
      discount: null,
    });
  });

  it("maps unknown datasets to a stable not-found response", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "GET",
      url: "/datasets/private/schema",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      code: "DATASET_NOT_FOUND",
      message: "Dataset was not found",
    });
  });

  it("maps invalid query bodies to a stable bad request response", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "POST",
      url: "/datasets/sales/query",
      payload: { parameters: { year: 2026 } },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "DATASET_QUERY_INVALID",
      message: "Dataset query is invalid",
    });
  });

  it("maps invalid repository responses to a stable bad gateway response", async () => {
    class InvalidRepository extends TestDatasetRepository {
      override async query() {
        return {
          columns: [
            { key: "revenue", label: "收入", type: "number", nullable: false },
          ],
          rows: [{ revenue: null }],
          total: 1,
          sampledAt: "2026-07-02T08:00:00.000Z",
        } as never;
      }
    }
    await bootstrap(new InvalidRepository());

    const response = await app!.inject({
      method: "POST",
      url: "/datasets/sales/query",
      payload: { parameters: { year: 2026, fromDate: "2026-01-01" } },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      code: "DATASET_INVALID_RESPONSE",
      message: "Dataset response is invalid",
    });
  });

  it("maps upstream dataset failures to a stable bad gateway response", async () => {
    class UpstreamFailureRepository extends TestDatasetRepository {
      override async query() {
        throw new DatasetUpstreamError();
      }
    }
    await bootstrap(new UpstreamFailureRepository());

    const response = await app!.inject({
      method: "POST",
      url: "/datasets/sales/query",
      payload: { parameters: { year: 2026, fromDate: "2026-01-01" } },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      code: "DATASET_UPSTREAM_ERROR",
      message: "Dataset upstream request failed",
    });
  });
});
