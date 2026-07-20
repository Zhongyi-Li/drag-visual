import type { ComponentInstance, DatasetField } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import {
  buildBarOption,
  buildKpiValue,
  buildLineOption,
  buildMetricTrendModel,
  buildMetricTrendOption,
  buildMetricBreakdownModel,
  buildMultidimensionalModel,
  buildPieOption,
  buildRadarOption,
  buildSunburstOption,
  buildTreemapOption,
  buildRankingModel,
  buildRankingOption,
  buildRingBarOption,
  buildCrosstabModel,
  buildFlipNumberModel,
  buildGaugeModel,
  buildGaugeModels,
  buildGaugeOption,
  buildLiquidModel,
  buildLiquidModels,
  buildHeatmapModel,
  buildKpiBoardModel,
  buildKpiModel,
  buildProgressBarModel,
  buildTableModel,
  buildTrendModel,
  buildTrendOption,
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
const lineFields: readonly DatasetField[] = [
  { key: "month", label: "月份", type: "string", nullable: false },
  { key: "revenue", label: "销售额", type: "number", nullable: false },
  { key: "profit", label: "毛利", type: "number", nullable: false },
];

describe("component option builders", () => {
  it("maps bar, line, and pie bindings into chart options", () => {
    expect(buildBarOption(component({}), rows).series).toEqual([
      expect.objectContaining({ type: "bar", data: [10] }),
    ]);
    const lineOption = buildLineOption(component({
      type: "line",
      props: { color: "#1677ff", showLegend: true, smooth: false, area: false },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measures: [{ fieldKey: "revenue" }, { fieldKey: "profit" }] } },
    }), rows, lineFields);
    expect(lineOption.series).toHaveLength(2);
    expect(lineOption.legend).toMatchObject({ top: 8, left: 12, orient: "horizontal", icon: "circle" });
    expect(lineOption.grid).toMatchObject({ top: 44, bottom: 48, containLabel: true });
    expect(lineOption.xAxis).toMatchObject({
      boundaryGap: false,
      name: "月份",
      nameLocation: "middle",
      data: ["1月"],
    });
    expect(lineOption.yAxis).toMatchObject({ min: 0, max: 10, interval: 5 });
    expect(lineOption.series[0]).toMatchObject({ type: "line", name: "销售额", areaStyle: undefined, smooth: false, lineStyle: { width: 3 } });
    const areaOption = buildLineOption(component({
      type: "area",
      props: { color: "#1677ff", showLegend: true, smooth: true, area: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measures: [{ fieldKey: "revenue" }] } },
    }), [{ month: "2026-06-01", revenue: 10 }], [
      { key: "month", label: "月份", type: "date", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
    ]);
    expect(areaOption.series[0]).toMatchObject({ type: "line", smooth: true, areaStyle: { opacity: 0.22 } });
    expect(areaOption.xAxis.data).toEqual(["2026-06"]);
    expect(buildPieOption(component({ type: "pie" }), rows).series[0]).toMatchObject({
      type: "pie",
      data: [{ name: "1月", value: 10 }],
    });
    const radar = buildRadarOption(component({
      type: "radar",
      title: "渠道对比",
      props: { color: "#4b7cf5", showLegend: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measure: [{ fieldKey: "revenue" }, { fieldKey: "profit" }] } },
    }), [{ month: "1月", revenue: 120, profit: 40 }, { month: "2月", revenue: 80, profit: 20 }], lineFields);
    expect(radar.radar).toMatchObject({ indicator: [{ name: "1月", max: 200 }, { name: "2月", max: 200 }] });
    expect(radar.series[0]).toMatchObject({ type: "radar", data: [{ name: "销售额", value: [120, 80] }, { name: "毛利", value: [40, 20] }] });

    const treemap = buildTreemapOption(component({
      type: "treemap",
      title: "月度占比",
      props: { color: "#4b7cf5", showLegend: false },
    }), [{ month: "1月", revenue: 120 }, { month: "2月", revenue: 80 }], lineFields);
    expect(treemap.series[0]).toMatchObject({
      type: "treemap",
      data: [
        expect.objectContaining({ name: "1月", value: 120, percent: 60 }),
        expect.objectContaining({ name: "2月", value: 80, percent: 40 }),
      ],
    });
    const rose = buildPieOption(component({
      type: "rose",
      title: "月度销售额",
      props: { color: "#1677ff", showLegend: false },
    }), [
      { month: "1月", revenue: 120_000 },
      { month: "1月", revenue: 80_000 },
      { month: "2月", revenue: 50_000 },
    ], lineFields);
    expect(rose.series[0]).toMatchObject({
      type: "pie",
      roseType: "area",
      data: [{ name: "1月", value: 200_000 }, { name: "2月", value: 50_000 }],
    });
    expect(rose.legend).toMatchObject({ show: false });

    const multiMetricPie = buildPieOption(component({
      type: "pie",
      title: "月度构成",
      props: { color: "#1677ff", showLegend: false },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measure: [{ fieldKey: "revenue" }, { fieldKey: "profit" }] } },
    }), [
      { month: "1月", revenue: 120_000, profit: 12_000 },
      { month: "1月", revenue: 80_000, profit: 8_000 },
      { month: "2月", revenue: 50_000, profit: 5_000 },
    ], lineFields);
    expect(multiMetricPie.series[0]).toMatchObject({
      data: [
        { name: "1月", value: 200_000, metricValues: { revenue: 200_000, profit: 20_000 } },
        { name: "2月", value: 50_000, metricValues: { revenue: 50_000, profit: 5_000 } },
      ],
    });
    const tooltip = multiMetricPie.tooltip.formatter({ name: "1月", value: 200_000, percent: 80, marker: "•" });
    expect(tooltip).toContain("销售额：20万（80.00%）");
    expect(tooltip).toContain("毛利：2万");

    const sunburst = buildSunburstOption(component({
      type: "sunburst",
      title: "月度销售构成",
      props: { color: "#1677ff", showLegend: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measure: [{ fieldKey: "revenue" }, { fieldKey: "profit" }] } },
    }), [
      { month: "1月", revenue: 120_000, profit: 12_000 },
      { month: "1月", revenue: 80_000, profit: 8_000 },
      { month: "2月", revenue: 50_000, profit: 5_000 },
    ], lineFields);
    expect(sunburst.series[0]).toMatchObject({
      type: "sunburst",
      data: [{ name: "1月", value: 200_000 }, { name: "2月", value: 50_000 }],
    });
    expect(sunburst.legend).toMatchObject({
      show: false,
    });

    const profitSunburst = buildSunburstOption(component({
      type: "sunburst",
      props: { color: "#1677ff", showLegend: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measure: [{ fieldKey: "revenue" }, { fieldKey: "profit" }] } },
    }), [
      { month: "1月", revenue: 120_000, profit: 12_000 },
      { month: "1月", revenue: 80_000, profit: 8_000 },
      { month: "2月", revenue: 50_000, profit: 5_000 },
    ], lineFields, "profit");
    expect(profitSunburst.series[0]).toMatchObject({
      data: [{ name: "1月", value: 20_000 }, { name: "2月", value: 5_000 }],
    });
  });

  it("builds a target-based ring bar and a descending ranking", () => {
    const chartFields: readonly DatasetField[] = [
      { key: "region", label: "区域", type: "string", nullable: false },
      { key: "actual", label: "实际销售额", type: "number", nullable: false },
      { key: "target", label: "销售目标", type: "number", nullable: false },
    ];
    const chartRows = [
      { region: "华北", actual: 82, target: 100 },
      { region: "华东", actual: 135, target: 120 },
      { region: "华南", actual: 48, target: 100 },
    ];
    const ring = buildRingBarOption(component({
      type: "ringBar",
      props: { decimals: 1, showValue: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "actual" }, target: { fieldKey: "target" } } },
    }), chartRows, chartFields);
    expect(ring.series).toHaveLength(6);
    expect(ring.series[1]).toMatchObject({ type: "pie", name: "华北" });

    const sixItemRing = buildRingBarOption(component({
      type: "ringBar",
      props: { decimals: 1, showValue: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "actual" }, target: { fieldKey: "target" } } },
    }), [
      { region: "华北", actual: 82, target: 100 },
      { region: "华东", actual: 81, target: 100 },
      { region: "华南", actual: 80, target: 100 },
      { region: "华中", actual: 76, target: 100 },
      { region: "西北", actual: 68, target: 100 },
      { region: "西南", actual: 63, target: 100 },
    ], chartFields);
    expect(sixItemRing.series[0]).toMatchObject({ radius: ["28%", "43%"] });

    const ranking = buildRankingOption(component({
      type: "ranking",
      props: { color: "#1677ff", maxItems: 3, showValue: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "actual" } } },
    }), chartRows, chartFields);
    expect(ranking.yAxis).toMatchObject({ data: ["1. 华东", "2. 华北", "3. 华南"] });
    expect(ranking.series[0]).toMatchObject({ type: "bar", data: [135, 82, 48] });

    const rankingModel = buildRankingModel(component({
      type: "ranking",
      props: { color: "#1677ff", maxItems: 3, showValue: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: [{ fieldKey: "actual" }, { fieldKey: "target" }] } },
    }), chartRows, chartFields);
    expect(rankingModel.measures).toEqual([
      { key: "actual", label: "实际销售额" },
      { key: "target", label: "销售目标" },
    ]);
    expect(rankingModel.items[0]).toMatchObject({ label: "华东", primaryRatio: 1 });
  });

  it("stacks every selected measure by the same category", () => {
    const stacked = buildBarOption(component({
      type: "stackedBar",
      title: "销售构成",
      binding: {
        datasetId: "sales",
        slots: { dimension: { fieldKey: "month" }, measures: [{ fieldKey: "revenue" }, { fieldKey: "profit" }] },
      },
    }), [
      { month: "2026-01-01", revenue: 120, profit: 40 },
      { month: "2026-02-01", revenue: 150, profit: 60 },
    ], [
      { key: "month", label: "月份", type: "date", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
      { key: "profit", label: "毛利", type: "number", nullable: false },
    ]);

    expect(stacked.xAxis).toMatchObject({ boundaryGap: true, name: "月份", data: ["2026-01", "2026-02"] });
    expect(stacked.yAxis).toMatchObject({ min: 0, max: 300, interval: 100 });
    expect(stacked.series).toEqual([
      expect.objectContaining({ type: "bar", name: "销售额", data: [120, 150], stack: "total" }),
      expect.objectContaining({ type: "bar", name: "毛利", data: [40, 60], stack: "total" }),
    ]);
    expect(stacked.tooltip).toMatchObject({ trigger: "item" });
    expect(stacked.tooltip.formatter?.({ marker: "●", seriesName: "毛利", value: 60 })).toBe("●毛利<br/>60");
  });

  it("renders every selected bar metric side by side and keeps legacy single-metric bindings", () => {
    const grouped = buildBarOption(component({
      binding: {
        datasetId: "sales",
        slots: { dimension: { fieldKey: "month" }, measure: [{ fieldKey: "revenue" }, { fieldKey: "profit" }] },
      },
    }), rows, lineFields);

    expect(grouped.series).toEqual([
      expect.objectContaining({ type: "bar", name: "销售额", data: [10], stack: undefined }),
      expect.objectContaining({ type: "bar", name: "毛利", data: [4], stack: undefined }),
    ]);
    expect(buildBarOption(component({}), rows).series).toEqual([
      expect.objectContaining({ name: "月收入", data: [10] }),
    ]);
  });

  it("uses an independent scale for each grouped bar metric when their units differ substantially", () => {
    const option = buildBarOption(component({
      binding: {
        datasetId: "sales",
        slots: {
          dimension: { fieldKey: "month" },
          measure: [
            { fieldKey: "orders" },
            { fieldKey: "refunds" },
            { fieldKey: "revenue" },
            { fieldKey: "unitPrice" },
          ],
        },
      },
    }), [
      { month: "2026-01", orders: 1260, refunds: 18, revenue: 346500, unitPrice: 275 },
      { month: "2026-02", orders: 1385, refunds: 21, revenue: 386100, unitPrice: 279 },
    ], [
      { key: "month", label: "月份", type: "string", nullable: false },
      { key: "orders", label: "订单数", type: "number", nullable: false },
      { key: "refunds", label: "退款订单数", type: "number", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
      { key: "unitPrice", label: "客单价", type: "number", nullable: false },
    ]);

    expect(option.yAxis).toEqual([
      expect.objectContaining({ position: "left", offset: 0, max: 1500 }),
      expect.objectContaining({ position: "right", offset: 0, max: 30 }),
      expect.objectContaining({ position: "left", offset: 44, max: 400000 }),
      expect.objectContaining({ position: "right", offset: 44, max: 300 }),
    ]);
    expect(option.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "订单数", yAxisIndex: 0 }),
      expect.objectContaining({ name: "退款订单数", yAxisIndex: 1 }),
      expect.objectContaining({ name: "销售额", yAxisIndex: 2 }),
      expect.objectContaining({ name: "客单价", yAxisIndex: 3 }),
    ]));
  });

  it("uses wider, stable Y-axis intervals for high-volume line series", () => {
    const option = buildLineOption(component({
      type: "line",
      props: { color: "#1677ff", showLegend: true, smooth: false, area: false },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "date" }, measures: [{ fieldKey: "visitors" }] } },
    }), [
      { date: "2026-06-01", visitors: 12840 },
      { date: "2026-06-14", visitors: 21120 },
    ]);

    expect(option.yAxis).toMatchObject({ min: 0, max: 30000, interval: 10000 });
  });

  it("builds stacked areas, percentage trend lines, and 100% stacked columns from the same multi-metric binding", () => {
    const binding = { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measures: [{ fieldKey: "revenue" }, { fieldKey: "profit" }] } };
    const chartRows = [
      { month: "2026-01-01", revenue: 40, profit: 60 },
      { month: "2026-02-01", revenue: 30, profit: 70 },
    ];
    const stacked = buildLineOption(component({
      type: "stackedArea",
      props: { color: "#1677ff", showLegend: true, smooth: true, area: true },
      binding,
    }), chartRows, lineFields);
    const percentage = buildLineOption(component({
      type: "percentArea",
      props: { color: "#1677ff", showLegend: true, smooth: true, area: true },
      binding,
    }), chartRows, lineFields);
    const percentageBar = buildBarOption(component({
      type: "percentBar",
      props: { color: "#1677ff", showLegend: true, smooth: true, area: true },
      binding,
    }), chartRows, lineFields);

    expect(stacked.series).toEqual([
      expect.objectContaining({ data: [40, 30], stack: "total", areaStyle: expect.objectContaining({ opacity: 0.22 }) }),
      expect.objectContaining({ data: [60, 70], stack: "total", areaStyle: expect.objectContaining({ opacity: 0.22 }) }),
    ]);
    expect(stacked.yAxis).toMatchObject({ min: 0, max: 100, interval: 50 });
    expect(percentage.series).toEqual([
      expect.objectContaining({ type: "line", data: [60, 70], stack: "total", lineStyle: expect.objectContaining({ color: "#36cfc9" }), areaStyle: expect.objectContaining({ opacity: 0.08 }) }),
      expect.objectContaining({ type: "line", data: [40, 30], stack: "total", lineStyle: expect.objectContaining({ color: "#1677ff" }), areaStyle: expect.objectContaining({ opacity: 0.08 }) }),
    ]);
    expect(percentage.xAxis).toMatchObject({ boundaryGap: false });
    expect(percentage.legend.data).toEqual(["销售额", "毛利"]);
    expect(percentage.tooltip.trigger).toBe("item");
    expect(percentage.tooltip.formatter?.({ dataIndex: 0, marker: "●", seriesId: "revenue", seriesName: "销售额", value: 40 })).toBe("●销售额<br/>40（40.00%）");
    expect(percentage.yAxis).toMatchObject({ min: 0, max: 100, interval: 25 });
    expect(percentage.series[0]?.emphasis).toEqual({ focus: "none" });
    expect(percentage.yAxis.axisLabel.formatter?.(25)).toBe("25.00%");
    expect(percentageBar.series).toEqual([
      expect.objectContaining({ type: "bar", data: [60, 70], stack: "total", itemStyle: expect.objectContaining({ borderRadius: [0, 0, 3, 3] }) }),
      expect.objectContaining({ type: "bar", data: [40, 30], stack: "total", itemStyle: expect.objectContaining({ borderRadius: [3, 3, 0, 0] }) }),
    ]);
    expect(percentageBar.xAxis).toMatchObject({ boundaryGap: true });
    expect(percentageBar.yAxis).toMatchObject({ min: 0, max: 100, interval: 25 });
    expect(percentageBar.tooltip.trigger).toBe("item");
  });

  it("aggregates KPI values", () => {
    expect(buildKpiValue([10, 20], "sum")).toBe(30);
    expect(buildKpiValue([10, 20], "avg")).toBe(15);
    expect(buildKpiValue([], "sum")).toBeNull();
  });

  it("builds KPI target and comparison calculations from optional metric slots", () => {
    const kpi = component({
      type: "kpi",
      title: "总收入",
      props: { aggregation: "sum", prefix: "¥", suffix: "", decimals: 0 },
      binding: {
        datasetId: "sales",
        slots: {
          measure: { fieldKey: "revenue" },
          target: { fieldKey: "revenueTarget" },
          comparison: { fieldKey: "priorRevenue" },
        },
      },
    });

    expect(buildKpiModel(kpi, [
      { revenue: 100, revenueTarget: 200, priorRevenue: 80 },
      { revenue: 50, revenueTarget: 100, priorRevenue: 70 },
    ])).toEqual({
      value: 150,
      target: { value: 300, progress: 0.5 },
      comparison: { value: 150, delta: 0, rate: 0 },
    });
  });

  it("keeps KPI optional calculations empty when slots or safe denominators are missing", () => {
    const withoutOptionalSlots = component({
      type: "kpi",
      props: { aggregation: "sum", prefix: "", suffix: "", decimals: 0 },
      binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" } } },
    });
    const zeroComparison = component({
      type: "kpi",
      props: { aggregation: "sum", prefix: "", suffix: "", decimals: 0 },
      binding: {
        datasetId: "sales",
        slots: {
          measure: { fieldKey: "revenue" },
          comparison: { fieldKey: "priorRevenue" },
          target: { fieldKey: "revenueTarget" },
        },
      },
    });

    expect(buildKpiModel(withoutOptionalSlots, [{ revenue: 20 }])).toEqual({
      value: 20,
      target: null,
      comparison: null,
    });
    expect(buildKpiModel(zeroComparison, [{ revenue: 20, priorRevenue: 0, revenueTarget: 0 }])).toEqual({
      value: 20,
      target: { value: 0, progress: null },
      comparison: { value: 0, delta: 20, rate: null },
    });
  });

  it("builds flip number and progress bar metric models", () => {
    const flipNumber = component({
      type: "flipNumber",
      title: "翻牌器",
      props: { aggregation: "sum", prefix: "¥", suffix: "", decimals: 0 },
      binding: { datasetId: "sales", slots: { measure: [{ fieldKey: "revenue" }, { fieldKey: "orders" }] } },
    });
    const progressBar = component({
      type: "progressBar",
      title: "收入目标",
      props: { aggregation: "sum", decimals: 1, showValue: true },
      binding: {
        datasetId: "sales",
        slots: {
          measure: [{ fieldKey: "revenue" }, { fieldKey: "orders" }],
          target: [{ fieldKey: "revenueTarget" }, { fieldKey: "orderTarget" }],
        },
      },
    });

    expect(buildFlipNumberModel(
      flipNumber,
      [{ revenue: 100, orders: 20 }, { revenue: 50, orders: 10 }],
    )).toEqual({
      items: [
        { key: "revenue", label: "revenue", value: 150 },
        { key: "orders", label: "orders", value: 30 },
      ],
    });
    expect(buildProgressBarModel(progressBar, [
      { revenue: 120, revenueTarget: 200, orders: 30, orderTarget: 60 },
      { revenue: 60, revenueTarget: 100, orders: 20, orderTarget: 40 },
    ])).toEqual({
      items: [
        { key: "revenue", label: "revenue", value: 180, target: 300, progress: 0.6 },
        { key: "orders", label: "orders", value: 50, target: 100, progress: 0.5 },
      ],
    });
    expect(buildProgressBarModel(component({
      type: "progressBar",
      props: { aggregation: "sum", decimals: 1, showValue: true },
      binding: { datasetId: "sales", slots: { measure: [{ fieldKey: "revenue" }, { fieldKey: "orders" }] } },
    }), [{ revenue: 20, orders: 8 }])).toEqual({
      items: [
        { key: "revenue", label: "revenue", value: 20, target: 20, progress: 1 },
        { key: "orders", label: "orders", value: 8, target: 8, progress: 1 },
      ],
    });
  });

  it("builds a bounded gauge pointer while retaining the real completion rate", () => {
    const gauge = component({
      type: "gauge",
      title: "销售达成仪表盘",
      props: { aggregation: "sum", decimals: 1 },
      binding: {
        datasetId: "sales",
        slots: { measure: { fieldKey: "revenue" }, target: { fieldKey: "revenueTarget" } },
      },
    });
    const model = buildGaugeModel(gauge, [
      { revenue: 620, revenueTarget: 500 },
      { revenue: 480, revenueTarget: 500 },
    ], [
      { key: "revenue", label: "实际销售额", type: "number", nullable: false },
      { key: "revenueTarget", label: "销售目标", type: "number", nullable: false },
    ]);

    expect(model).toMatchObject({ label: "实际销售额", value: 1100, target: 1000, pointerValue: 100 });
    expect(model.percentage).toBeCloseTo(110, 8);
    expect(buildGaugeOption(gauge, model).series[0]).toMatchObject({
      type: "gauge",
      data: [{ value: 100, name: "实际销售额" }],
    });
  });

  it("builds a bounded liquid level while retaining the real completion rate", () => {
    const liquid = component({
      type: "liquid",
      title: "销售达成水波图",
      props: { aggregation: "sum", decimals: 1 },
      binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" }, target: { fieldKey: "revenueTarget" } } },
    });

    const model = buildLiquidModel(liquid, [
      { revenue: 620, revenueTarget: 500 },
      { revenue: 480, revenueTarget: 500 },
    ], [
      { key: "revenue", label: "实际销售额", type: "number", nullable: false },
      { key: "revenueTarget", label: "销售目标", type: "number", nullable: false },
    ]);

    expect(model).toMatchObject({ label: "实际销售额", value: 1100, target: 1000, fillPercentage: 100 });
    expect(model.percentage).toBeCloseTo(110, 8);
  });

  it("aggregates, sorts, and calculates contribution shares for metric breakdown", () => {
    const breakdown = component({
      type: "metricBreakdown",
      title: "销售额拆解",
      props: { aggregation: "sum", decimals: 1 },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "productLine" }, measure: { fieldKey: "revenue" } } },
    });
    const model = buildMetricBreakdownModel(breakdown, [
      { productLine: "企业版", revenue: 420 },
      { productLine: "标准版", revenue: 240 },
      { productLine: "企业版", revenue: 180 },
      { productLine: "基础版", revenue: 160 },
    ], [
      { key: "productLine", label: "产品线", type: "string", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
    ]);

    expect(model).toMatchObject({ dimensionLabel: "产品线", measureLabel: "销售额", total: 1000, decimals: 1 });
    expect(model.items).toEqual([
      expect.objectContaining({ label: "企业版", value: 600, share: 0.6, barRatio: 1 }),
      expect.objectContaining({ label: "标准版", value: 240, share: 0.24, barRatio: 0.4 }),
      expect.objectContaining({ label: "基础版", value: 160, share: 0.16, barRatio: expect.closeTo(0.2666666667, 8) }),
    ]);
  });

  it("builds one gauge and liquid model for each bound dimension value", () => {
    const metricChart = component({
      type: "gauge",
      props: { aggregation: "sum", decimals: 1 },
      binding: {
        datasetId: "sales",
        slots: {
          dimension: { fieldKey: "month" },
          measure: { fieldKey: "revenue" },
          target: { fieldKey: "revenueTarget" },
        },
      },
    });
    const rows = [
      { month: "2026-04", revenue: 120, revenueTarget: 200 },
      { month: "2026-04", revenue: 80, revenueTarget: 100 },
      { month: "2026-05", revenue: 270, revenueTarget: 300 },
    ];
    const fields = [
      { key: "month", label: "月份", type: "string" as const, nullable: false },
      { key: "revenue", label: "实际销售额", type: "number" as const, nullable: false },
      { key: "revenueTarget", label: "销售目标", type: "number" as const, nullable: false },
    ];

    expect(buildGaugeModels(metricChart, rows, fields)).toMatchObject([
      { key: "2026-04", label: "2026-04", model: { value: 200, target: 300, percentage: 200 / 300 * 100 } },
      { key: "2026-05", label: "2026-05", model: { value: 270, target: 300, percentage: 90 } },
    ]);
    expect(buildLiquidModels({ ...metricChart, type: "liquid" }, rows, fields)).toMatchObject([
      { key: "2026-04", label: "2026-04", model: { value: 200, target: 300 } },
      { key: "2026-05", label: "2026-05", model: { value: 270, target: 300 } },
    ]);
  });

  it("groups KPI metrics by a dimension with multi-selected measures", () => {
    const kpi = component({
      type: "kpi",
      title: "指标看板",
      props: { aggregation: "sum", prefix: "", suffix: "", decimals: 0 },
      binding: {
        datasetId: "sales",
        slots: {
          dimension: { fieldKey: "month" },
          measure: [
            { fieldKey: "revenue" },
            { fieldKey: "revenueTarget" },
            { fieldKey: "priorRevenue" },
            { fieldKey: "orders" },
            { fieldKey: "orderTarget" },
          ],
        },
      },
    });

    expect(buildKpiBoardModel(kpi, [
      { month: "2026-02", revenue: 200, revenueTarget: 250, priorRevenue: 180, orders: 20, orderTarget: 25 },
      { month: "2026-01", revenue: 100, revenueTarget: 120, priorRevenue: 90, orders: 10, orderTarget: 12 },
      { month: "2026-01", revenue: 50, revenueTarget: 60, priorRevenue: 40, orders: 5, orderTarget: 6 },
    ], [
      { key: "month", label: "月份", type: "string", nullable: false },
      { key: "revenue", label: "revenue", type: "number", nullable: false },
      { key: "revenueTarget", label: "revenueTarget", type: "number", nullable: false },
      { key: "priorRevenue", label: "priorRevenue", type: "number", nullable: false },
      { key: "orders", label: "orders", type: "number", nullable: false },
      { key: "orderTarget", label: "orderTarget", type: "number", nullable: false },
    ])).toEqual({
      dimensionLabel: "月份",
      measureLabel: "revenue",
      groups: [
        {
          label: "2026-01",
          value: 150,
          metrics: [
            { key: "revenueTarget", label: "revenueTarget", value: 180 },
            { key: "priorRevenue", label: "priorRevenue", value: 130 },
            { key: "orders", label: "orders", value: 15 },
            { key: "orderTarget", label: "orderTarget", value: 18 },
          ],
        },
        {
          label: "2026-02",
          value: 200,
          metrics: [
            { key: "revenueTarget", label: "revenueTarget", value: 250 },
            { key: "priorRevenue", label: "priorRevenue", value: 180 },
            { key: "orders", label: "orders", value: 20 },
            { key: "orderTarget", label: "orderTarget", value: 25 },
          ],
        },
      ],
    });
  });

  it("keeps legacy KPI target, comparison, and secondary measures as board metrics", () => {
    const kpi = component({
      type: "kpi",
      title: "指标看板",
      props: { aggregation: "sum", prefix: "", suffix: "", decimals: 0 },
      binding: {
        datasetId: "sales",
        slots: {
          dimension: { fieldKey: "month" },
          measure: { fieldKey: "revenue" },
          target: { fieldKey: "revenueTarget" },
          comparison: { fieldKey: "priorRevenue" },
          secondaryMeasures: [{ fieldKey: "orders" }],
        },
      },
    });

    expect(buildKpiBoardModel(kpi, [
      { month: "2026-01", revenue: 100, revenueTarget: 120, priorRevenue: 90, orders: 10 },
    ])?.groups[0]?.metrics).toEqual([
      { key: "revenueTarget", label: "revenueTarget", value: 120 },
      { key: "priorRevenue", label: "priorRevenue", value: 90 },
      { key: "orders", label: "orders", value: 10 },
    ]);
  });

  it("builds a bounded table model from selected fields", () => {
    const table = component({
      type: "table",
      props: { pageSize: 20, striped: false },
      binding: { datasetId: "sales", slots: { columns: [{ fieldKey: "month" }, { fieldKey: "revenue" }] } },
    });
    const model = buildTableModel(table, Array.from({ length: 120 }, () => rows[0]!), [
      { key: "month", label: "月份", type: "string", nullable: false },
      { key: "revenue", label: "收入", type: "number", nullable: false },
    ]);
    expect(model.columns).toEqual([
      { key: "month", label: "月份" },
      { key: "revenue", label: "收入" },
    ]);
    expect(model.rows).toHaveLength(100);
  });

  it("builds a two-dimensional crosstab model with row and column totals", () => {
    const pivot = component({
      type: "crosstab",
      title: "地区品类交叉表",
      props: { aggregation: "sum", showTotals: true },
      binding: {
        datasetId: "sales",
        slots: {
          rowDimension: { fieldKey: "region" },
          columnDimension: { fieldKey: "category" },
          measure: { fieldKey: "revenue" },
        },
      },
    });

    const model = buildCrosstabModel(pivot, [
      { region: "华东", category: "手机", revenue: 1000 },
      { region: "华东", category: "电脑", revenue: 2000 },
      { region: "华南", category: "手机", revenue: 800 },
      { region: "华南", category: "电脑", revenue: 1200 },
      { region: "华南", category: "电脑", revenue: 300 },
    ], [
      { key: "region", label: "地区", type: "string", nullable: false },
      { key: "category", label: "品类", type: "string", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
    ]);

    expect(model.rowHeader).toBe("地区");
    expect(model.columns.map((column) => column.label)).toEqual(["手机", "电脑"]);
    expect(model.rows).toEqual([
      { label: "华东", values: [1000, 2000], total: 3000 },
      { label: "华南", values: [800, 1500], total: 2300 },
    ]);
    expect(model.columnTotals).toEqual([1800, 3500]);
    expect(model.grandTotal).toBe(5300);
  });

  it("builds a heatmap model with row-column metric intensity cells", () => {
    const heatmap = component({
      type: "heatmap",
      title: "访问热力图",
      props: { aggregation: "sum", showValues: true },
      binding: {
        datasetId: "traffic",
        slots: {
          rowDimension: { fieldKey: "weekday" },
          columnDimension: { fieldKey: "hourBucket" },
          measure: { fieldKey: "visitors" },
        },
      },
    });

    const model = buildHeatmapModel(heatmap, [
      { weekday: "周一", hourBucket: "09:00", visitors: 120 },
      { weekday: "周一", hourBucket: "09:00", visitors: 30 },
      { weekday: "周一", hourBucket: "10:00", visitors: 80 },
      { weekday: "周二", hourBucket: "09:00", visitors: 40 },
      { weekday: "周二", hourBucket: "10:00", visitors: 200 },
    ], [
      { key: "weekday", label: "星期", type: "string", nullable: false },
      { key: "hourBucket", label: "时段", type: "string", nullable: false },
      { key: "visitors", label: "访客数", type: "number", nullable: false },
    ]);

    expect(model.rowHeader).toBe("星期");
    expect(model.columnHeader).toBe("时段");
    expect(model.measureLabel).toBe("访客数");
    expect(model.columns.map((column) => column.label)).toEqual(["09:00", "10:00"]);
    expect(model.rows.map((row) => row.label)).toEqual(["周一", "周二"]);
    expect(model.rows[0]?.cells.map((cell) => cell.value)).toEqual([150, 80]);
    expect(model.rows[1]?.cells.map((cell) => cell.value)).toEqual([40, 200]);
    expect(model.minValue).toBe(40);
    expect(model.maxValue).toBe(200);
    expect(model.rows[1]?.cells[1]?.intensity).toBe(1);
    expect(model.showValues).toBe(true);
  });

  it("sorts and aggregates trend analysis data with period summaries", () => {
    const trend = component({
      type: "trend",
      title: "销售趋势分析",
      props: { aggregation: "sum", showSummary: true, timeGranularity: "month" },
      binding: {
        datasetId: "sales",
        slots: {
          timeDimension: { fieldKey: "businessDate" },
          measure: { fieldKey: "revenue" },
        },
      },
    });
    const fields = [
      { key: "businessDate", label: "业务日期", type: "date", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
    ] as const;

    const model = buildTrendModel(trend, [
      { businessDate: "2026-03-01", revenue: 120 },
      { businessDate: "2026-01-01", revenue: 80 },
      { businessDate: "2026-02-01", revenue: 100 },
      { businessDate: "2026-02-01", revenue: 50 },
    ], fields);
    const option = buildTrendOption(trend, model);

    expect(model.timeLabel).toBe("业务日期");
    expect(model.measureLabel).toBe("销售额");
    expect(model.points).toEqual([
      { label: "2026-01", value: 80 },
      { label: "2026-02", value: 150 },
      { label: "2026-03", value: 120 },
    ]);
    expect(model.latest).toEqual({ label: "2026-03", value: 120 });
    expect(model.previous).toEqual({ label: "2026-02", value: 150 });
    expect(model.change).toEqual({ absolute: -30, rate: -0.2 });
    expect(model.peak).toEqual({ label: "2026-02", value: 150 });
    expect(option.xAxis.data).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(option.series[0]).toMatchObject({ type: "line", name: "销售额", data: [80, 150, 120] });
  });

  it("builds a multi-metric trend option with one date dimension", () => {
    const metricTrend = component({
      type: "metricTrend",
      title: "收入趋势",
      props: { aggregation: "sum", showSummary: true, timeGranularity: "month" },
      binding: {
        datasetId: "sales",
        slots: {
          timeDimension: { fieldKey: "businessDate" },
          measure: [{ fieldKey: "revenue" }, { fieldKey: "orders" }],
        },
      },
    });
    const model = buildMetricTrendModel(metricTrend, [
      { businessDate: "2026-01-01", revenue: 100, orders: 10 },
      { businessDate: "2026-02-01", revenue: 120, orders: 12 },
    ], [
      { key: "businessDate", label: "业务日期", type: "date", nullable: false },
      { key: "revenue", label: "收入", type: "number", nullable: false },
      { key: "orders", label: "订单数", type: "number", nullable: false },
    ]);

    expect(buildMetricTrendOption(metricTrend, model, "orders")).toMatchObject({
      grid: { left: 44, right: 18, top: 18, bottom: 30 },
      xAxis: { type: "category", data: ["2026-01", "2026-02"] },
      yAxis: { type: "value" },
      series: [
        expect.objectContaining({ type: "line", name: "订单数", data: [10, 12] }),
      ],
    });
    expect(buildMetricTrendOption(metricTrend, model, "orders").series).toHaveLength(1);
    expect(model.measures.map((measure) => measure.label)).toEqual(["收入", "订单数"]);
    expect(model.measures[0]?.latest).toEqual({ label: "2026-02", value: 120 });
  });

  it("aggregates multidimensional analysis rows by date granularity, dimensions, and measures", () => {
    const multidimensional = component({
      type: "multidimensional",
      title: "多维分析",
      props: { aggregation: "sum", showTotals: true, timeGranularity: "month" },
      binding: {
        datasetId: "sales",
        slots: {
          dateDimension: { fieldKey: "businessDate" },
          dimensions: [{ fieldKey: "region" }, { fieldKey: "category" }],
          measures: [{ fieldKey: "revenue" }, { fieldKey: "orders" }],
        },
      },
    });
    const fields = [
      { key: "businessDate", label: "业务日期", type: "date", nullable: false },
      { key: "region", label: "地区", type: "string", nullable: false },
      { key: "category", label: "品类", type: "string", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
      { key: "orders", label: "订单数", type: "number", nullable: false },
    ] as const;

    const model = buildMultidimensionalModel(multidimensional, [
      { businessDate: "2026-01-01", region: "华东", category: "手机", revenue: 1000, orders: 5 },
      { businessDate: "2026-01-15", region: "华东", category: "手机", revenue: 500, orders: 2 },
      { businessDate: "2026-02-01", region: "华东", category: "电脑", revenue: 2000, orders: 3 },
      { businessDate: "2026-02-03", region: "华南", category: "手机", revenue: 800, orders: 4 },
    ], fields);

    expect(model.dimensions).toEqual([
      { key: "businessDate", label: "业务日期" },
      { key: "region", label: "地区" },
      { key: "category", label: "品类" },
    ]);
    expect(model.measures).toEqual([
      { key: "revenue", label: "销售额" },
      { key: "orders", label: "订单数" },
    ]);
    expect(model.rows).toEqual([
      { key: "2026-01\u0000华东\u0000手机", dimensions: ["2026-01", "华东", "手机"], values: [1500, 7] },
      { key: "2026-02\u0000华东\u0000电脑", dimensions: ["2026-02", "华东", "电脑"], values: [2000, 3] },
      { key: "2026-02\u0000华南\u0000手机", dimensions: ["2026-02", "华南", "手机"], values: [800, 4] },
    ]);
    expect(model.totals).toEqual([4300, 14]);
    expect(model.showTotals).toBe(true);
  });
});
