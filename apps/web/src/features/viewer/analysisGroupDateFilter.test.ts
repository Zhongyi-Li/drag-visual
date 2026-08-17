import { describe, expect, it } from "vitest";

import { analysisGroupDateFiltersForChildren, defaultAnalysisGroupDateSelection } from "./analysisGroupDateFilter.js";

describe("analysisGroupDateFilter", () => {
  const control = {
    defaultPreset: "all" as const,
    defaultRange: null,
    allowCustom: true,
    timezone: "Asia/Shanghai" as const,
    targets: [
      { componentId: "orders", fieldKey: "orderTime" },
      { componentId: "payments", fieldKey: "paymentTime" },
    ],
  };

  it("keeps the default all-data selection empty", () => {
    expect(defaultAnalysisGroupDateSelection(control)).toBeUndefined();
  });

  it("maps one selected range to each child chart's manually associated time field", () => {
    expect(analysisGroupDateFiltersForChildren(control, { start: "2026-08-01", end: "2026-08-14" })).toEqual({
      orders: { kind: "dateRange", fieldKey: "orderTime", start: "2026-08-01", end: "2026-08-14", timezone: "Asia/Shanghai" },
      payments: { kind: "dateRange", fieldKey: "paymentTime", start: "2026-08-01", end: "2026-08-14", timezone: "Asia/Shanghai" },
    });
  });
});
