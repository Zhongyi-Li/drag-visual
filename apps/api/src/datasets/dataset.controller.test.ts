import { DatasetQueryResult } from "@drag-visual/contracts";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "vitest";

import { safeJsonFastifyOptions } from "../fastify-options.js";
import { DatasetController } from "./dataset.controller.js";
import {
  DATASET_REPOSITORY,
  type DatasetRepository,
} from "./dataset.repository.js";
import { DatasetService } from "./dataset.service.js";
import { FixtureDatasetRepository } from "./fixture-dataset.repository.js";

describe("DatasetController", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const bootstrap = async (
    repository: DatasetRepository = new FixtureDatasetRepository(),
  ) => {
    const module = await Test.createTestingModule({
      controllers: [DatasetController],
      providers: [
        DatasetService,
        { provide: DATASET_REPOSITORY, useValue: repository },
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
      { id: "inventory", name: "库存数据", schemaVersion: "v3" },
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
    expect(result.total).toBe(1000);
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
    class InvalidRepository extends FixtureDatasetRepository {
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
});
