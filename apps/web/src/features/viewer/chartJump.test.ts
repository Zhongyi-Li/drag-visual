import type { ChartJumpRule } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import { chartJumpFilterValues, chartJumpFiltersFromSearch, chartJumpHref, chartJumpTargetFromSearch } from "./chartJump.js";

const rule: ChartJumpRule = {
  id: "jump-store",
  triggerFieldKey: "gmv",
  targetDashboardId: "dashboard-detail",
  openMode: "current",
  parameterMappings: [{ sourceFieldKey: "store", targetFilterId: "target-store" }],
};

describe("chartJump", () => {
  it("maps scalar values from a selected point row", () => {
    expect(chartJumpFilterValues(rule, { store: "华东区", gmv: 12800, ignored: null })).toEqual({ "target-store": "华东区" });
  });

  it("encodes and reads mapped values from a dashboard URL", () => {
    const href = chartJumpHref(rule, { store: "华东区" }, "published");
    expect(href).toContain("/view/dashboard-detail?");
    expect(chartJumpFiltersFromSearch(href.slice(href.indexOf("?")))).toEqual({ "target-store": "华东区" });
  });

  it("adds a component anchor only when the rule targets a chart position", () => {
    const href = chartJumpHref({ ...rule, targetPosition: "component", targetComponentId: "detail-chart" }, { store: "华东区" }, "published");
    expect(chartJumpTargetFromSearch(href.slice(href.indexOf("?")))).toBe("detail-chart");
    expect(chartJumpTargetFromSearch("?jumpTarget=")).toBeUndefined();
    expect(chartJumpTargetFromSearch(chartJumpHref(rule, {}, "published").slice(chartJumpHref(rule, {}, "published").indexOf("?")))).toBeUndefined();
  });

  it("ignores malformed or non-scalar query values", () => {
    expect(chartJumpFiltersFromSearch("?jumpFilters=%7Bbad-json")).toEqual({});
    expect(chartJumpFiltersFromSearch(`?jumpFilters=${encodeURIComponent(JSON.stringify({ valid: "x", skipped: ["x"] }))}`)).toEqual({ valid: "x" });
  });
});
