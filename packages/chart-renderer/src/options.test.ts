import type { ComponentInstance } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import {
  buildBarOption,
  buildKpiValue,
  buildLineOption,
  buildPieOption,
  buildTableModel,
} from "./options.js";

const component = (overrides: Partial<ComponentInstance>): ComponentInstance => ({
  id: "component-1",
  type: "bar",
  title: "月收入",
  props: { color: "#1677ff", showLegend: true },
  binding: {
    datasetId: "sales",
    slots: {
      dimension: { fieldKey: "month" },
      measure: { fieldKey: "revenue" },
    },
  },
  ...overrides,
});

const rows = [{ month: "1月", revenue: 10, profit: 4 }];

describe("component option builders", () => {
  it("maps bar, line, and pie bindings into chart options", () => {
    expect(buildBarOption(component({}), rows).series).toEqual([
      expect.objectContaining({ type: "bar", data: [10] }),
    ]);
    expect(buildLineOption(component({
      type: "line",
      props: { color: "#1677ff", showLegend: true, area: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measures: [{ fieldKey: "revenue" }, { fieldKey: "profit" }] } },
    }), rows).series).toHaveLength(2);
    expect(buildPieOption(component({ type: "pie" }), rows).series[0]).toMatchObject({
      type: "pie",
      data: [{ name: "1月", value: 10 }],
    });
  });

  it("aggregates KPI values", () => {
    expect(buildKpiValue([10, 20], "sum")).toBe(30);
    expect(buildKpiValue([10, 20], "avg")).toBe(15);
    expect(buildKpiValue([], "sum")).toBeNull();
  });

  it("builds a bounded table model from selected fields", () => {
    const table = component({
      type: "table",
      props: { pageSize: 20, striped: false },
      binding: { datasetId: "sales", slots: { columns: [{ fieldKey: "month" }, { fieldKey: "revenue" }] } },
    });
    const model = buildTableModel(table, Array.from({ length: 120 }, () => rows[0]!));
    expect(model.columns).toEqual(["month", "revenue"]);
    expect(model.rows).toHaveLength(100);
  });
});
