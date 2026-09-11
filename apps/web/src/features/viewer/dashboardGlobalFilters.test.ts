import type { ComponentInstance, DatasetFilter } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import { analysisGroupQueryFilters, componentQueryFilterControls, componentQueryFilters, filterRowsByDashboardFilters, filterRowsByDimensionFilters, filtersForComponent, hasDashboardGlobalDateTarget } from "./dashboardGlobalFilters.js";

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
      { kind: "fieldText", fieldKey: "orderNo", operator: "contains", value: "001" },
    ])).toEqual([{ orderDate: "2026-08-05", store: "旗舰店", orderNo: "A-001" }]);
  });

  it("evaluates explicitly zoned timestamps in the configured business timezone", () => {
    expect(filterRowsByDashboardFilters([
      { orderTime: "2026-08-31T16:03:00.000Z", id: "shanghai-september-first" },
      { orderTime: "2026-08-31T15:59:00.000Z", id: "shanghai-august-last" },
    ], [{ kind: "dateRange", fieldKey: "orderTime", start: "2026-09-01", end: "2026-09-01", timezone: "Asia/Shanghai" }]))
      .toEqual([{ orderTime: "2026-08-31T16:03:00.000Z", id: "shanghai-september-first" }]);
  });

  it("applies numeric comparison conditions for uploaded datasets", () => {
    expect(filterRowsByDashboardFilters([
      { product: "A", amount: 99 },
      { product: "B", amount: 100 },
      { product: "C", amount: 101 },
    ], [{ kind: "numberComparison", fieldKey: "amount", operator: "gte", value: 100 }]))
      .toEqual([{ product: "B", amount: 100 }, { product: "C", amount: 101 }]);
  });

  it("keeps only selected values when a filter targets the chart dimension", () => {
    const rows = [
      { orderTime: "2026-09-01 00:03:00", store: "旗舰店", amount: 10 },
      { orderTime: "2026-09-02 09:00:00", store: "直营网", amount: 20 },
    ];
    const filters: DatasetFilter[] = [
      { kind: "dateRange" as const, fieldKey: "orderTime", start: "2026-09-01", end: "2026-09-01", timezone: "Asia/Shanghai" },
      { kind: "fieldValue" as const, fieldKey: "store", values: ["旗舰店"] },
    ];

    expect(filterRowsByDimensionFilters(rows, filters, ["orderTime"])).toEqual([rows[0]]);
    expect(filterRowsByDimensionFilters(rows, filters, ["store"])).toEqual([rows[0]]);
    expect(filterRowsByDimensionFilters(rows, filters, ["amount"])).toBe(rows);
  });

  it("maps and applies a non-containing text condition", () => {
    const filters = [{
      id: "product-exclude",
      fieldKey: "product",
      label: "商品名称",
      controlType: "input" as const,
      operator: "notContains" as const,
      targets: [{ componentId: "chart-1", fieldKey: "product" }],
    }];
    expect(filtersForComponent(chart, filters, { "product-exclude": "小米" })).toEqual([
      { kind: "fieldText", fieldKey: "product", operator: "notContains", value: "小米" },
    ]);
    expect(filterRowsByDashboardFilters([
      { product: "小米电视" }, { product: "创维电视" }, { product: null },
    ], [{ kind: "fieldText", fieldKey: "product", operator: "notContains", value: "小米" }])).toEqual([{ product: "创维电视" }]);
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

  it("combines a global date range and an analysis-group date range with AND", () => {
    expect(filterRowsByDashboardFilters([
      { globalTime: "2026-08-03", businessTime: "2026-08-03", id: "kept" },
      { globalTime: "2026-08-03", businessTime: "2026-08-10", id: "outside-group" },
      { globalTime: "2026-08-10", businessTime: "2026-08-03", id: "outside-global" },
    ], [
      { kind: "dateRange", fieldKey: "globalTime", start: "2026-08-01", end: "2026-08-05", timezone: "Asia/Shanghai" },
      { kind: "dateRange", fieldKey: "businessTime", start: "2026-08-02", end: "2026-08-04", timezone: "Asia/Shanghai" },
    ])).toEqual([{ globalTime: "2026-08-03", businessTime: "2026-08-03", id: "kept" }]);
  });

  it("reads saved single-chart and analysis-group query conditions", () => {
    const queryFilters = [{ kind: "fieldText" as const, fieldKey: "product", operator: "contains" as const, value: "小米" }];
    expect(componentQueryFilters({ props: { queryFilters } })).toEqual(queryFilters);
    expect(analysisGroupQueryFilters({ props: { queryFilters } })).toEqual(queryFilters);
    const emptyControl = { kind: "fieldText", fieldKey: "product", operator: "contains", value: "" };
    expect(componentQueryFilterControls({ props: { queryFilters: [emptyControl] } })).toEqual([emptyControl]);
    expect(componentQueryFilters({ props: { queryFilters: [emptyControl] } })).toEqual([]);
  });

  it("applies empty and non-empty conditions without a viewer value", () => {
    const filters = [{
      id: "warehouse-empty",
      fieldKey: "warehouse",
      label: "仓库",
      controlType: "select" as const,
      operator: "isEmpty" as const,
      targets: [{ componentId: "chart-1", fieldKey: "warehouse" }],
    }];
    expect(filtersForComponent({ id: "chart-1" }, filters, {})).toEqual([
      { kind: "fieldNull", fieldKey: "warehouse", operator: "isEmpty" },
    ]);
    expect(filterRowsByDashboardFilters([
      { warehouse: "" }, { warehouse: null }, { warehouse: "华东仓" }, {},
    ], [{ kind: "fieldNull", fieldKey: "warehouse", operator: "isEmpty" }])).toHaveLength(3);
    expect(filterRowsByDashboardFilters([
      { warehouse: "" }, { warehouse: null }, { warehouse: "华东仓" }, {},
    ], [{ kind: "fieldNull", fieldKey: "warehouse", operator: "isNotEmpty" }])).toEqual([{ warehouse: "华东仓" }]);
  });
});
