import type { ComponentInstance } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import { analysisGroupQueryFilters, componentQueryFilterControls, componentQueryFilters, filterRowsByDashboardFilters, filtersForComponent, hasDashboardGlobalDateTarget } from "./dashboardGlobalFilters.js";

const chart = { id: "chart-1", type: "bar", props: {}, binding: { datasetId: "sales", slots: {} } } as ComponentInstance;

describe("dashboardGlobalFilters", () => {
  it("only creates conditions for the charts explicitly linked to a filter", () => {
    const filters = [{ id: "store", fieldKey: "store", label: "店铺", controlType: "select" as const, targets: [{ componentId: "chart-1", fieldKey: "store" }] }];
    expect(filtersForComponent(chart, filters, { store: "旗舰店" })).toEqual([{ kind: "fieldValue", fieldKey: "store", values: ["旗舰店"] }]);
    expect(filtersForComponent({ ...chart, id: "chart-2" }, filters, { store: "旗舰店" })).toEqual([]);
  });

  it("applies date, select, and input conditions together for uploaded datasets", () => {
    expect(filterRowsByDashboardFilters([
      { orderDate: "2026-08-05", store: "旗舰店", orderNo: "A-001" },
      { orderDate: "2026-08-06", store: "旗舰店", orderNo: "A-002" },
      { orderDate: "2026-08-05", store: "直营网", orderNo: "A-003" },
    ], [
      { kind: "dateRange", fieldKey: "orderDate", start: "2026-08-05", end: "2026-08-05", timezone: "Asia/Shanghai" },
      { kind: "fieldValue", fieldKey: "store", values: ["旗舰店"] },
      { kind: "fieldText", fieldKey: "orderNo", value: "001" },
    ])).toEqual([{ orderDate: "2026-08-05", store: "旗舰店", orderNo: "A-001" }]);
  });

  it("applies numeric comparison conditions for uploaded datasets", () => {
    expect(filterRowsByDashboardFilters([
      { product: "A", amount: 99 },
      { product: "B", amount: 100 },
      { product: "C", amount: 101 },
    ], [{ kind: "numberComparison", fieldKey: "amount", operator: "gte", value: 100 }]))
      .toEqual([{ product: "B", amount: 100 }, { product: "C", amount: 101 }]);
  });

  it("maps one global date range to the date field selected for each chart", () => {
    const dateFilter = [{
      id: "period",
      fieldKey: "orderTime",
      label: "统计周期",
      controlType: "dateRange" as const,
      targets: [
        { componentId: "orders", fieldKey: "orderTime" },
        { componentId: "payments", fieldKey: "paymentTime" },
        { componentId: "contracts", fieldKey: "signedTime" },
      ],
    }];
    const value = { period: { start: "2026-08-01", end: "2026-08-05" } };

    expect(filtersForComponent({ ...chart, id: "orders" }, dateFilter, value)).toEqual([
      { kind: "dateRange", fieldKey: "orderTime", start: "2026-08-01", end: "2026-08-05", timezone: "Asia/Shanghai" },
    ]);
    expect(filtersForComponent({ ...chart, id: "payments" }, dateFilter, value)).toEqual([
      { kind: "dateRange", fieldKey: "paymentTime", start: "2026-08-01", end: "2026-08-05", timezone: "Asia/Shanghai" },
    ]);
    expect(filtersForComponent({ ...chart, id: "contracts" }, dateFilter, value)).toEqual([
      { kind: "dateRange", fieldKey: "signedTime", start: "2026-08-01", end: "2026-08-05", timezone: "Asia/Shanghai" },
    ]);
    expect(hasDashboardGlobalDateTarget({ ...chart, id: "payments" }, dateFilter)).toBe(true);
    expect(hasDashboardGlobalDateTarget(chart, dateFilter)).toBe(false);
  });

  it("reads saved single-chart and analysis-group query conditions", () => {
    const queryFilters = [{ kind: "fieldText" as const, fieldKey: "product", value: "小米" }];
    expect(componentQueryFilters({ props: { queryFilters } })).toEqual(queryFilters);
    expect(analysisGroupQueryFilters({ props: { queryFilters } })).toEqual(queryFilters);
    const emptyControl = { kind: "fieldText", fieldKey: "product", value: "" };
    expect(componentQueryFilterControls({ props: { queryFilters: [emptyControl] } })).toEqual([emptyControl]);
    expect(componentQueryFilters({ props: { queryFilters: [emptyControl] } })).toEqual([]);
  });
});
