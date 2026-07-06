import type {
  Dataset,
  DatasetQueryRequest,
  DatasetQueryResult,
  DatasetSummary,
} from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import type { DatasetRepository } from "./dataset.repository.js";
import {
  DatasetInvalidResponseError,
  DatasetNotFoundError,
  DatasetQueryInvalidError,
  DatasetService,
} from "./dataset.service.js";

const salesDataset: Dataset = {
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
};

const salesResult: DatasetQueryResult = {
  columns: salesDataset.fields,
  rows: [
    {
      month: "1月",
      businessDate: "2026-01-15",
      revenue: 120_000,
      discount: null,
    },
  ],
  total: 1,
  sampledAt: "2026-07-02T08:00:00.000Z",
};

class FakeDatasetRepository implements DatasetRepository {
  constructor(
    private readonly dataset: Dataset | null = salesDataset,
    private readonly result: DatasetQueryResult | unknown = salesResult,
  ) {}

  async list(): Promise<readonly DatasetSummary[]> {
    return this.dataset
      ? [
          {
            id: this.dataset.id,
            name: this.dataset.name,
            schemaVersion: this.dataset.schemaVersion,
          },
        ]
      : [];
  }

  async getSchema(id: string): Promise<Dataset | null> {
    return this.dataset?.id === id ? structuredClone(this.dataset) : null;
  }

  async query(
    id: string,
    _request: DatasetQueryRequest,
  ): Promise<DatasetQueryResult | null> {
    return this.dataset?.id === id
      ? (structuredClone(this.result) as DatasetQueryResult)
      : null;
  }
}

const validRequest = (): DatasetQueryRequest => ({
  parameters: { year: 2026, fromDate: "2026-01-01" },
});

describe("DatasetService", () => {
  it("lists dataset summaries", async () => {
    const service = new DatasetService(new FakeDatasetRepository());

    await expect(service.list()).resolves.toEqual([
      { id: "sales", name: "销售数据", schemaVersion: "v1" },
    ]);
  });

  it("gets a dataset schema", async () => {
    const service = new DatasetService(new FakeDatasetRepository());

    await expect(service.getSchema("sales")).resolves.toEqual(salesDataset);
  });

  it("reports missing datasets", async () => {
    const service = new DatasetService(new FakeDatasetRepository(null));

    await expect(service.getSchema("private")).rejects.toBeInstanceOf(
      DatasetNotFoundError,
    );
  });

  it("queries a dataset with valid parameters", async () => {
    const service = new DatasetService(new FakeDatasetRepository());

    await expect(service.query("sales", validRequest())).resolves.toEqual(
      salesResult,
    );
  });

  it.each([
    ["missing required", { parameters: { year: 2026 } }],
    ["unknown parameter", { parameters: { year: 2026, fromDate: "2026-01-01", bad: true } }],
    ["null optional parameter", { parameters: { year: 2026, fromDate: "2026-01-01", region: null } }],
    ["invalid date", { parameters: { year: 2026, fromDate: "2026-02-29" } }],
    ["wrong type", { parameters: { year: "2026", fromDate: "2026-01-01" } }],
  ] satisfies Array<[string, DatasetQueryRequest]>)(
    "rejects %s",
    async (_name, request) => {
      const service = new DatasetService(new FakeDatasetRepository());

      await expect(service.query("sales", request)).rejects.toBeInstanceOf(
        DatasetQueryInvalidError,
      );
    },
  );

  it("rejects null in a non-nullable result column", async () => {
    const result = {
      ...salesResult,
      rows: [{ ...salesResult.rows[0], revenue: null }],
    };
    const service = new DatasetService(
      new FakeDatasetRepository(salesDataset, result),
    );

    await expect(service.query("sales", validRequest())).rejects.toBeInstanceOf(
      DatasetInvalidResponseError,
    );
  });

  it("rejects invalid date values in result rows", async () => {
    const result = {
      ...salesResult,
      rows: [{ ...salesResult.rows[0], businessDate: "2026-02-29" }],
    };
    const service = new DatasetService(
      new FakeDatasetRepository(salesDataset, result),
    );

    await expect(service.query("sales", validRequest())).rejects.toBeInstanceOf(
      DatasetInvalidResponseError,
    );
  });
});
