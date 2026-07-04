import type { Dataset, DatasetQueryResult, DatasetSummary } from "@drag-visual/contracts";

export const datasetFixtures: readonly Dataset[] = [
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
];

export const datasetSummaryFixtures: readonly DatasetSummary[] = datasetFixtures.map(
  ({ id, name, schemaVersion }) => ({ id, name, schemaVersion }),
);

export const salesQueryResultFixture: DatasetQueryResult = {
  columns: datasetFixtures[0]!.fields,
  rows: [
    { month: "1月", businessDate: "2026-01-15", revenue: 120_000, discount: null },
  ],
  total: 1,
  sampledAt: "2026-07-02T08:00:00.000Z",
};

const twoDigits = (value: number): string => String(value).padStart(2, "0");

export const salesRowsFixture: DatasetQueryResult["rows"] = Array.from(
  { length: 1_000 },
  (_, index) => {
    if (index === 0) return structuredClone(salesQueryResultFixture.rows[0]!);
    const month = (index % 12) + 1;
    const day = (index % 28) + 1;
    return {
      month: `${month}月`,
      businessDate: `2026-${twoDigits(month)}-${twoDigits(day)}`,
      revenue: 120_000 + index,
      discount: index % 10 === 0 ? null : index % 20,
    };
  },
);
