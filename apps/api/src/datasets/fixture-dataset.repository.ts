import {
  Dataset,
  DatasetQueryResult,
  type DatasetQueryRequest,
  type DatasetSummary,
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
    return {
      month: "1月",
      businessDate: "2026-01-15",
      revenue: 120_000,
      discount: null,
    };
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
    return datasetFixtures.map(({ id, name, schemaVersion }) => ({
      id,
      name,
      schemaVersion,
    }));
  }

  async getSchema(id: string): Promise<Dataset | null> {
    const dataset = datasetFixtures.find((entry) => entry.id === id);
    return dataset ? clone(Dataset.parse(dataset)) : null;
  }

  async query(
    id: string,
    _request: DatasetQueryRequest,
  ): Promise<DatasetQueryResult | null> {
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
