import type { ComponentInstance, DataBinding } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import { supportsChartResultLimit } from "./chartCategoryLimit.js";

const component = (
  type: ComponentInstance["type"],
  slots?: DataBinding["slots"],
): ComponentInstance => ({
  id: `${type}-1`,
  type,
  props: {},
  ...(slots === undefined ? {} : { binding: { datasetId: "sales", slots } }),
});

describe("supportsChartResultLimit", () => {
  it("keeps the control only for pie categories and record tables", () => {
    expect(supportsChartResultLimit(component("pie", { dimension: { fieldKey: "store" }, measure: { fieldKey: "revenue" } }))).toBe(true);
    expect(supportsChartResultLimit(component("donut", { dimension: { fieldKey: "store" }, measure: { fieldKey: "revenue" } }))).toBe(true);
    expect(supportsChartResultLimit(component("table", { columns: [{ fieldKey: "orderNo" }] }))).toBe(false);
  });

  it("removes the redundant control from ordinary and fixed metric charts", () => {
    expect(supportsChartResultLimit(component("bar", { dimension: { fieldKey: "month" }, measure: { fieldKey: "revenue" } }))).toBe(false);
    expect(supportsChartResultLimit(component("flipNumber", { measure: [{ fieldKey: "revenue" }] }))).toBe(false);
    expect(supportsChartResultLimit(component("progressBar", { measure: { fieldKey: "revenue" }, target: { fieldKey: "target" } }))).toBe(false);
    expect(supportsChartResultLimit(component("kpi", { measure: { fieldKey: "revenue" } }))).toBe(false);
  });

  it("does not restore the redundant control when a metric component binds a dimension", () => {
    expect(supportsChartResultLimit(component("kpi", { dimension: { fieldKey: "store" }, measure: { fieldKey: "revenue" } }))).toBe(false);
    expect(supportsChartResultLimit(component("gauge", { dimension: { fieldKey: "store" }, measure: { fieldKey: "revenue" } }))).toBe(false);
    expect(supportsChartResultLimit(component("liquid", { dimension: { fieldKey: "store" }, measure: { fieldKey: "revenue" } }))).toBe(false);
  });
});
