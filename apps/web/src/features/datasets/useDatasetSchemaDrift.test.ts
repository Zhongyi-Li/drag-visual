import { createDefaultRegistry } from "@drag-visual/component-registry";
import { DashboardSchema, Dataset, type Dashboard } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import { detectDatasetSchemaDrift } from "./useDatasetSchemaDrift.js";

const dataset = Dataset.parse({
  id: "sales",
  name: "销售数据",
  schemaVersion: "v2",
  fields: [
    { key: "month", label: "月份", type: "string", nullable: false },
  ],
  parameters: [],
});

const dashboard = (overrides: Partial<Dashboard> = {}): Dashboard => DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "经营看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
  components: [{
    id: "bar-1",
    type: "bar",
    title: "收入柱图",
    props: { color: "#1677ff", showLegend: true },
    binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" } } },
  }],
  datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
  ...overrides,
});

describe("detectDatasetSchemaDrift", () => {
  it("reports changed schema versions and missing bound fields", () => {
    expect(detectDatasetSchemaDrift(dashboard(), new Map([["sales", dataset]]), createDefaultRegistry())).toEqual([
      {
        componentId: "bar-1",
        datasetId: "sales",
        messages: [
          "数据集 sales 已从 v1 更新到 v2",
          "字段 revenue 已不存在",
        ],
      },
    ]);
  });

  it("returns no drift when saved schema and bindings remain valid", () => {
    const current = Dataset.parse({
      ...dataset,
      schemaVersion: "v1",
      fields: [...dataset.fields, { key: "revenue", label: "收入", type: "number" as const, nullable: false }],
    });

    expect(detectDatasetSchemaDrift(dashboard(), new Map([["sales", current]]), createDefaultRegistry())).toEqual([]);
  });
});
