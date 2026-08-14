import type { DataBinding } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import { activeCalculatedMetricReferences, aggregateLocalRows, applyCalculatedMetrics, calculatedMetricFields } from "./calculatedMetrics.js";

const binding: DataBinding = {
  datasetId: "sales",
  slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "calculated-margin" } },
  calculatedMetrics: [{
    id: "calculated-margin",
    name: "毛利率",
    format: "percent",
    decimals: 2,
    divideByZero: "dash",
    tokens: [
      { kind: "metric", reference: { fieldKey: "profit", aggregation: "sum" } },
      { kind: "operator", value: "/" },
      { kind: "metric", reference: { fieldKey: "sales", aggregation: "sum" } },
    ],
  }],
};

describe("calculated metrics", () => {
  it("requests formula dependencies and adds calculated fields", () => {
    expect(activeCalculatedMetricReferences(binding)).toEqual([
      { fieldKey: "profit", aggregation: "sum" },
      { fieldKey: "sales", aggregation: "sum" },
    ]);
    expect(calculatedMetricFields([{ key: "sales", label: "销售额", type: "number", nullable: false }], binding)).toContainEqual({
      key: "calculated-margin", label: "毛利率", type: "number", nullable: true,
    });
  });

  it("calculates only after the source values have been aggregated", () => {
    const grouped = aggregateLocalRows([
      { region: "华东", profit: 10, sales: 100 },
      { region: "华东", profit: 30, sales: 100 },
      { region: "华南", profit: 5, sales: 0 },
    ], {
      groupBy: ["region"],
      measures: [{ fieldKey: "profit", aggregation: "sum" }, { fieldKey: "sales", aggregation: "sum" }],
    });
    expect(applyCalculatedMetrics(grouped, binding)).toEqual([
      { region: "华东", profit: 40, sales: 200, "calculated-margin": 20 },
      { region: "华南", profit: 5, sales: 0, "calculated-margin": null },
    ]);
  });
});
