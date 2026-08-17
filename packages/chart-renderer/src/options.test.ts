import type { ComponentInstance, DatasetField } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import {
  buildBarOption,
  buildBarLineOption,
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
  buildHorizontalBarOption,
  buildKpiBoardModel,
  buildKpiModel,
  buildProgressBarModel,
  buildProgressIndicatorModel,
  buildTargetProgressModel,
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
  it("builds a multi-metric employee progress and score model", () => {
    const fields: readonly DatasetField[] = [
      { key: "employee", label: "员工", type: "string", nullable: false },
      { key: "sales", label: "销售额", type: "number", nullable: false },
      { key: "salesTarget", label: "销售额目标", type: "number", nullable: false },
      { key: "quantity", label: "销量", type: "number", nullable: false },
      { key: "quantityTarget", label: "销量目标", type: "number", nullable: false },
    ];
    const model = buildProgressIndicatorModel(component({
      type: "progressIndicator",
      title: "进度与指标",
      props: {
        aggregation: "sum", decimals: 1, periodLabel: "2026年7月", showEmployeeRanking: true, maxEmployees: 8,
        metricSettings: [
          { measureKey: "sales", targetKey: "salesTarget", label: "销售额", color: "#2f6bff", weight: 60, includeInScore: true },
          { measureKey: "quantity", targetKey: "quantityTarget", label: "销量", color: "#ff7a18", weight: 40, includeInScore: true },
        ],
      },
      binding: {
        datasetId: "sales",
        slots: {
          employeeDimension: { fieldKey: "employee" },
          measure: [{ fieldKey: "sales" }, { fieldKey: "quantity" }],
          target: [{ fieldKey: "salesTarget" }, { fieldKey: "quantityTarget" }],
        },
      },
    }), [
      { employee: "王晨晨", sales: 20, salesTarget: 100, quantity: 40, quantityTarget: 100 },
      { employee: "陈慧慧", sales: 80, salesTarget: 100, quantity: 20, quantityTarget: 100 },
    ], fields);

    expect(model.periodLabel).toBe("2026年7月");
    expect(model.metrics).toHaveLength(2);
    expect(model.employees.map((employee) => employee.label)).toEqual(["陈慧慧", "王晨晨"]);
    expect(model.employees[0]?.score).toBeCloseTo(0.56);
    expect(model.employees[1]?.score).toBeCloseTo(0.28);
    expect(model.weights).toEqual([{ label: "销售额", weight: 60 }, { label: "销量", weight: 40 }]);
  });

  it("builds a sorted horizontal bar chart and a dual-axis bar-line chart", () => {
    const chartFields: readonly DatasetField[] = [
      { key: "product", label: "商品", type: "string", nullable: false },
      { key: "inventoryAmount", label: "库存金额", type: "number", nullable: false },
      { key: "inventoryQuantity", label: "库存数量", type: "number", nullable: false },
    ];
    const chartRows = [
      { product: "K80", inventoryAmount: 1420, inventoryQuantity: 80 },
      { product: "Note 14", inventoryAmount: 1660, inventoryQuantity: 120 },
      { product: "15 Ultra", inventoryAmount: 1074, inventoryQuantity: 36 },
    ];
    const horizontal = buildHorizontalBarOption(component({
      type: "horizontalBar",
      props: { aggregation: "sum", color: "#5b6ff0", maxItems: 10, showValue: true },
      binding: { datasetId: "inventory", slots: { dimension: { fieldKey: "product" }, measure: { fieldKey: "inventoryAmount" } } },
    }), chartRows, chartFields);
    expect(horizontal.yAxis.data).toEqual(["Note 14", "K80", "15 Ultra"]);
    expect(horizontal.series[0]).toMatchObject({ type: "bar", data: [1660, 1420, 1074], label: { show: true, position: "right" } });
    expect(horizontal.title).toMatchObject({ text: "总计 库存金额 0.42万 ¥", right: 72, top: 4 });
    expect(horizontal.grid).toMatchObject({ top: 38, right: 72 });

    const multiMetricHorizontal = buildHorizontalBarOption(component({
      type: "horizontalBar",
      props: { aggregation: "sum", color: "#5b6ff0", maxItems: 10, showValue: true },
      binding: { datasetId: "inventory", slots: { dimension: { fieldKey: "product" }, measure: [{ fieldKey: "inventoryAmount" }, { fieldKey: "inventoryQuantity" }] } },
    }), chartRows, chartFields);
    expect(multiMetricHorizontal.yAxis.data).toEqual(["Note 14", "K80", "15 Ultra"]);
    expect(multiMetricHorizontal.series).toEqual([
      expect.objectContaining({ name: "库存金额", data: [1660, 1420, 1074] }),
      expect.objectContaining({ name: "库存数量", data: [120, 80, 36] }),
    ]);
    expect(multiMetricHorizontal.title).toMatchObject({ text: "总计 库存金额 0.42万 ¥ · 库存数量 236 件" });
    expect(multiMetricHorizontal.legend).toMatchObject({ show: true, top: 28, left: 12 });
    expect(multiMetricHorizontal.grid).toMatchObject({ top: 82, bottom: 28 });
    expect(multiMetricHorizontal.xAxis).toEqual([
      expect.objectContaining({ position: "bottom", name: "库存金额" }),
      expect.objectContaining({ position: "top", name: "库存数量" }),
    ]);
    expect(multiMetricHorizontal.series).toEqual([
      expect.objectContaining({ name: "库存金额", xAxisIndex: 0, data: [1660, 1420, 1074] }),
      expect.objectContaining({ name: "库存数量", xAxisIndex: 1, data: [120, 80, 36] }),
    ]);

    const sharedScaleHorizontal = buildHorizontalBarOption(component({
      type: "horizontalBar",
      props: { aggregation: "sum", color: "#5b6ff0", maxItems: 10, multiMetricScale: "shared", showValue: true },
      binding: { datasetId: "inventory", slots: { dimension: { fieldKey: "product" }, measure: [{ fieldKey: "inventoryAmount" }, { fieldKey: "inventoryQuantity" }] } },
    }), chartRows, chartFields);
    expect(sharedScaleHorizontal.xAxis).toMatchObject({ type: "value" });
    expect(sharedScaleHorizontal.series).toEqual([
      expect.not.objectContaining({ xAxisIndex: expect.anything() }),
      expect.not.objectContaining({ xAxisIndex: expect.anything() }),
    ]);

    const combo = buildBarLineOption(component({
      type: "barLine",
      props: { aggregation: "sum", barColor: "#2f62dc", lineColor: "#ff7417", showLegend: true, smooth: false },
      binding: { datasetId: "inventory", slots: { dimension: { fieldKey: "product" }, barMeasure: { fieldKey: "inventoryAmount" }, lineMeasure: { fieldKey: "inventoryQuantity" } } },
    }), chartRows, chartFields);
    expect(combo.yAxis).toHaveLength(2);
    expect(combo.grid).toMatchObject({ top: 68, left: 64, right: 72, containLabel: true });
    expect(combo.series).toEqual([
      expect.objectContaining({ type: "bar", name: "库存金额", data: [1660, 1420, 1074], label: expect.objectContaining({ show: true, position: "top" }) }),
      expect.objectContaining({ type: "line", name: "库存数量", yAxisIndex: 1, data: [120, 80, 36], label: expect.objectContaining({ show: true, position: "top" }) }),
    ]);
    expect(combo.tooltip.formatter([
      { axisValueLabel: "K80", marker: "●", seriesName: "库存金额", value: 1423 },
      { axisValueLabel: "K80", marker: "●", seriesName: "库存数量", value: 81 },
    ])).toBe("K80<br/>●库存金额：0.14万 ¥<br/>●库存数量：81 件");
    const primaryAxis = combo.yAxis[0] as { readonly axisLabel?: { readonly formatter?: (value: number) => string } } | undefined;
    expect(primaryAxis?.axisLabel?.formatter?.(1_423)).toBe("0.14万 ¥");

    const curveOnly = buildBarLineOption(component({
      type: "barLine",
      props: { aggregation: "sum", barColor: "#2f62dc", lineColor: "#ff7417", showLegend: true, smooth: true },
      binding: { datasetId: "inventory", slots: { dimension: { fieldKey: "product" }, barMeasure: { fieldKey: "inventoryAmount" }, lineMeasure: { fieldKey: "inventoryQuantity" } } },
    }), chartRows, chartFields, false, "line");
    expect(curveOnly.yAxis).toHaveLength(1);
    expect(curveOnly.series).toEqual([expect.objectContaining({ type: "line", yAxisIndex: 0, smooth: true, data: [120, 80, 36] })]);
    expect(curveOnly.grid).toMatchObject({ right: 28 });

    const barOnly = buildBarLineOption(component({
      type: "barLine",
      props: { aggregation: "sum", barColor: "#2f62dc", lineColor: "#ff7417", showLegend: true },
      binding: { datasetId: "inventory", slots: { dimension: { fieldKey: "product" }, barMeasure: { fieldKey: "inventoryAmount" }, lineMeasure: { fieldKey: "inventoryQuantity" } } },
    }), chartRows, chartFields, false, "bar");
    expect(barOnly.yAxis).toHaveLength(1);
    expect(barOnly.series).toEqual([expect.objectContaining({ type: "bar", data: [1660, 1420, 1074] })]);
  });

  it("makes a bar-line comparison legible by dropping empty categories and zooming its line axis", () => {
    const fields: readonly DatasetField[] = [
      { key: "product", label: "商品", type: "string", nullable: false },
      { key: "profit", label: "销售毛利", type: "number", nullable: false },
      { key: "price", label: "价格", type: "number", nullable: false },
    ];
    const option = buildBarLineOption(component({
      type: "barLine",
      props: { aggregation: "sum", barColor: "#2f62dc", hideZeroValues: true, lineColor: "#ff7417", showLegend: true, smartLineScale: true, smooth: false },
      binding: {
        datasetId: "sales",
        limit: 2,
        slots: { dimension: { fieldKey: "product" }, barMeasure: { fieldKey: "profit" }, lineMeasure: { fieldKey: "price" } },
      },
    }), [
      { product: "未分类", profit: 0, price: 0 },
      { product: "基础款", profit: 120_000, price: 140_000 },
      { product: "旗舰款", profit: 350_000, price: 370_000 },
      { product: "入门款", profit: 80_000, price: 100_000 },
    ], fields);

    expect(option.xAxis.data).toEqual(["旗舰款", "基础款"]);
    expect(option.series[0]).toMatchObject({ data: [350_000, 120_000] });
    expect(option.yAxis[0]).toMatchObject({ min: 0 });
    expect(option.yAxis[1].min).toBeGreaterThan(0);
  });

  it("tilts long category labels for bar, line, and bar-line charts", () => {
    const fields: readonly DatasetField[] = [
      { key: "product", label: "商品", type: "string", nullable: false },
      { key: "amount", label: "销售额", type: "number", nullable: false },
      { key: "orders", label: "订单数", type: "number", nullable: false },
    ];
    const rows = [
      { product: "小米电视 A3 32 英寸智能电视", amount: 120, orders: 6 },
      { product: "小米加湿器 2L 大容量静音款", amount: 80, orders: 4 },
    ];
    const bar = buildBarOption(component({
      props: { color: "#1677ff", showLegend: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "product" }, measure: { fieldKey: "amount" } } },
    }), rows, fields);
    const line = buildLineOption(component({
      type: "line",
      props: { color: "#1677ff", showLegend: true, smooth: false, area: false },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "product" }, measures: [{ fieldKey: "orders" }] } },
    }), rows, fields);
    const combo = buildBarLineOption(component({
      type: "barLine",
      props: { aggregation: "sum", barColor: "#2f62dc", hideZeroValues: true, lineColor: "#ff7417", showLegend: true, smartLineScale: true, smooth: false },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "product" }, barMeasure: { fieldKey: "amount" }, lineMeasure: { fieldKey: "orders" } } },
    }), rows, fields);

    expect(bar.xAxis).toMatchObject({ axisLabel: { rotate: 32, interval: 0, hideOverlap: false }, data: [rows[0]!.product, rows[1]!.product] });
    expect(line.xAxis).toMatchObject({ axisLabel: { rotate: 32, interval: 0, hideOverlap: false } });
    expect(combo.xAxis).toMatchObject({ axisLabel: { rotate: 32, interval: 0, hideOverlap: false } });
  });

  it("uses a readable ISO week range everywhere time dimensions are grouped by week", () => {
    const weekComponent = component({
      type: "metricTrend",
      props: { timeGranularity: "week" },
      binding: { datasetId: "sales", slots: { timeDimension: { fieldKey: "orderDate" }, measure: { fieldKey: "revenue" } } },
    });
    const fields: readonly DatasetField[] = [
      { key: "orderDate", label: "订单时间", type: "date", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
    ];

    expect(buildMetricTrendModel(weekComponent, [{ orderDate: "2026-07-21", revenue: 10 }], fields).periods)
      .toEqual(["2026-第30周(07/20~07/26)"]);
    expect(buildTrendModel(component({
      type: "trend",
      props: { timeGranularity: "week" },
      binding: { datasetId: "sales", slots: { timeDimension: { fieldKey: "orderDate" }, measure: { fieldKey: "revenue" } } },
    }), [{ orderDate: "2026-07-21", revenue: 10 }], fields).points)
      .toEqual([{ label: "2026-第30周(07/20~07/26)", value: 10 }]);
    expect(buildMultidimensionalModel(component({
      type: "multidimensional",
      props: { timeGranularity: "week" },
      binding: { datasetId: "sales", slots: { dateDimension: { fieldKey: "orderDate" }, measures: { fieldKey: "revenue" } } },
    }), [{ orderDate: "2026-07-21", revenue: 10 }], fields).rows[0]?.dimensions)
      .toEqual(["2026-第30周(07/20~07/26)"]);
  });

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
    expect(rose.legend).toMatchObject({ show: true, bottom: 0, type: "scroll" });

    const donut = buildPieOption(component({
      type: "donut",
      title: "商品构成",
      props: { color: "#1677ff", showLegend: true },
    }), [
      { month: "1月", revenue: 120_000 },
      { month: "2月", revenue: 80_000 },
    ], lineFields);
    expect(donut.legend).toMatchObject({ show: true, orient: "vertical", left: "58%", top: "center" });
    expect(donut.series[0]).toMatchObject({
      type: "pie",
      radius: ["42%", "68%"],
      center: ["30%", "50%"],
      label: { show: false },
      labelLine: { show: false },
    });

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
    expect(tooltip).toContain("销售额：20万 ¥（80.00%）");
    expect(tooltip).toContain("毛利：2万 ¥");

    const sunburst = buildSunburstOption(component({
      type: "sunburst",
      title: "月度销售构成",
      props: { color: "#1677ff", showLegend: true },
      binding: {
        datasetId: "sales",
        slots: {
          dimension: { fieldKey: "month" },
          measure: [{ fieldKey: "revenue" }, { fieldKey: "profit" }],
          tooltipMeasures: [{ fieldKey: "profit" }],
        },
      },
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
    expect(sunburst.tooltip.formatter({ name: "1月", value: 200_000, marker: "•" })).toContain("毛利：2万");

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

  it("builds a concentric ring bar from one aggregated metric and a descending ranking", () => {
    const chartFields: readonly DatasetField[] = [
      { key: "region", label: "区域", type: "string", nullable: false },
      { key: "actual", label: "实际销售额", type: "number", nullable: false },
      { key: "target", label: "销售目标", type: "number", nullable: false },
      { key: "cost", label: "成本金额", type: "number", nullable: false },
    ];
    const chartRows = [
      { region: "华北", actual: 82, cost: 30 },
      { region: "华北", actual: 8, cost: 3 },
      { region: "华东", actual: 135, cost: 68 },
      { region: "华南", actual: 48, cost: 21 },
    ];
    const ring = buildRingBarOption(component({
      type: "ringBar",
      props: { aggregation: "sum", color: "#1677ff", showLegend: true },
      binding: {
        datasetId: "sales",
        slots: {
          dimension: { fieldKey: "region" },
          measure: { fieldKey: "actual" },
          tooltipMeasures: [{ fieldKey: "cost", aggregation: "sum" }],
        },
      },
    }), chartRows, chartFields);
    expect(ring.series).toHaveLength(6);
    expect(ring.series[0]).toMatchObject({
      type: "pie",
      center: ["53%", "58%"],
      data: [{ name: "华北", value: 100 }],
    });
    expect(ring.series[1]).toMatchObject({
      type: "pie",
      name: "实际销售额",
      center: ["53%", "58%"],
      label: { show: false },
      data: [expect.objectContaining({ name: "华北" }), expect.objectContaining({ value: expect.any(Number) })],
    });
    expect(ring.series[1]?.data?.[1]).not.toHaveProperty("tooltip");
    expect(ring.tooltip).toMatchObject({
      appendToBody: true,
      renderMode: "html",
      extraCssText: expect.stringContaining("z-index:2147483647"),
    });
    expect(ring.tooltip.formatter?.({ seriesIndex: 1 })).toContain("成本金额：33");

    const aggregatedRing = buildRingBarOption(component({
      type: "ringBar",
      props: { aggregation: "sum", color: "#1677ff", showLegend: true },
      binding: {
        datasetId: "sales",
        slots: {
          dimension: { fieldKey: "region" },
          measure: { fieldKey: "actual" },
          tooltipMeasures: [{ fieldKey: "cost", aggregation: "sum" }],
        },
      },
    }), [
      { region: "华北", actual: 90, cost: 33 },
      { region: "华东", actual: 135, cost: 68 },
      { region: "华南", actual: 48, cost: 21 },
    ], chartFields, true);
    expect(aggregatedRing.series[1]).toMatchObject({ data: [expect.objectContaining({ name: "华北" }), expect.anything()] });

    const ranking = buildRankingOption(component({
      type: "ranking",
      props: { color: "#1677ff", maxItems: 3, showValue: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "actual" } } },
    }), chartRows, chartFields);
    expect(ranking.yAxis).toMatchObject({ data: ["1. 华东", "2. 华北", "3. 华南"] });
    expect(ranking.series[0]).toMatchObject({ type: "bar", data: [135, 90, 48] });

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

  it("ranks aggregated dimensions by direct weighted metric results", () => {
    const fields: readonly DatasetField[] = [
      { key: "region", label: "区域", type: "string", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
      { key: "profit", label: "毛利额", type: "number", nullable: false },
      { key: "orders", label: "订单数", type: "number", nullable: false },
      { key: "weight", label: "权重", type: "number", nullable: false },
      { key: "adjustmentFactor", label: "调整系数", type: "number", nullable: false },
    ];
    const rankingComponent = component({
      type: "ranking",
      props: {
        aggregation: "sum",
        color: "#1677ff",
        maxItems: 10,
        metricWeights: { revenue: 20, profit: 50, orders: 30 },
        rankingMode: "weighted",
        showValue: true,
      },
      binding: {
        datasetId: "sales",
        slots: {
          dimension: { fieldKey: "region" },
          measure: [
            { fieldKey: "revenue" }, { fieldKey: "profit" }, { fieldKey: "orders" },
            { fieldKey: "weight" }, { fieldKey: "adjustmentFactor" },
          ],
        },
      },
    });
    const rows = [
      { region: "华东", revenue: 500, profit: 50, orders: 5, weight: 0.2, adjustmentFactor: 1.05 },
      { region: "华东", revenue: 500, profit: 50, orders: 5, weight: 0.2, adjustmentFactor: 1.05 },
      { region: "华北", revenue: 800, profit: 300, orders: 15, weight: 0.3, adjustmentFactor: 1.02 },
      { region: "华南", revenue: 500, profit: 400, orders: 20, weight: 0.5, adjustmentFactor: 0.98 },
    ];

    const model = buildRankingModel(rankingComponent, rows, fields);
    expect(model.rankingMode).toBe("weighted");
    expect(model.measures.map((measure) => measure.key)).toEqual(["revenue", "profit", "orders"]);
    expect(model.items.map((item) => item.label)).toEqual(["华北", "华南", "华东"]);
    expect(model.items[0]).toMatchObject({
      score: 314.5,
      values: [
        { key: "revenue", value: 800 },
        { key: "profit", value: 300 },
        { key: "orders", value: 15 },
      ],
    });

    const option = buildRankingOption(rankingComponent, rows, fields);
    expect(option.yAxis).toMatchObject({ data: ["1. 华北", "2. 华南", "3. 华东"] });
    expect(option.series[0]).toMatchObject({ name: "排名分值", data: [314.5, 306, 253] });
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
      expect.objectContaining({ type: "bar", name: "销售额", data: [120, 150], stack: "total", label: expect.objectContaining({ show: true, position: "inside" }) }),
      expect.objectContaining({ type: "bar", name: "毛利", data: [40, 60], stack: "total", label: expect.objectContaining({ show: true, position: "inside" }) }),
    ]);
    expect(stacked.tooltip).toMatchObject({ trigger: "item" });
    expect(stacked.tooltip.formatter?.({ marker: "●", seriesName: "毛利", value: 60 })).toBe("●毛利<br/>60 ¥");
  });

  it("renders every selected bar metric side by side and keeps legacy single-metric bindings", () => {
    const grouped = buildBarOption(component({
      binding: {
        datasetId: "sales",
        slots: { dimension: { fieldKey: "month" }, measure: [{ fieldKey: "revenue" }, { fieldKey: "profit" }] },
      },
    }), rows, lineFields);

    expect(grouped.series).toEqual([
      expect.objectContaining({ type: "bar", name: "销售额", data: [10], stack: undefined, label: expect.objectContaining({ show: true, position: "top" }) }),
      expect.objectContaining({ type: "bar", name: "毛利", data: [4], stack: undefined, label: expect.objectContaining({ show: true, position: "top" }) }),
    ]);
    expect(buildBarOption(component({}), rows).series).toEqual([
      expect.objectContaining({ name: "月收入", data: [10] }),
    ]);
  });

  it("aggregates repeated bar dimensions with the configured aggregation", () => {
    const aggregated = buildBarOption(component({
      props: { aggregation: "sum", color: "#1677ff", showLegend: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "product" }, measure: { fieldKey: "revenue" } } },
    }), [
      { product: "小米电视 S mini 55", revenue: 120 },
      { product: "小米电视 S mini 55", revenue: 80 },
      { product: "小米电视 A32", revenue: 60 },
    ], [{ key: "product", label: "商品名称", type: "string", nullable: false }, lineFields[1]!]);

    expect(aggregated.xAxis).toMatchObject({ data: ["小米电视 S mini 55", "小米电视 A32"] });
    expect(aggregated.series[0]).toMatchObject({ data: [200, 60] });

    const average = buildBarOption(component({
      props: { aggregation: "avg", color: "#1677ff", showLegend: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "product" }, measure: { fieldKey: "revenue" } } },
    }), [
      { product: "小米电视 S mini 55", revenue: 120 },
      { product: "小米电视 S mini 55", revenue: 80 },
    ], [{ key: "product", label: "商品名称", type: "string", nullable: false }, lineFields[1]!]);

    expect(average.series[0]).toMatchObject({ data: [100] });
  });

  it("keeps every dense categorical bar label visible and compact", () => {
    const option = buildBarOption(component({}), Array.from({ length: 20 }, (_, index) => ({
      month: `超长商品名称-${index + 1}-Xiaomi Humidifier 2 Lite EU`,
      revenue: index + 1,
    })), lineFields);

    expect(option.grid).toMatchObject({ bottom: 60 });
    expect(option.xAxis).toMatchObject({ axisLabel: { interval: 0, rotate: 24, hideOverlap: false } });
    expect(option.xAxis.data).toHaveLength(20);
    expect(option.series[0]).toMatchObject({ barMinHeight: 2, itemStyle: { color: "#1677ff" } });
  });

  it("uses more vertical axis intervals when a bar chart receives a taller container", () => {
    const shortChart = buildBarOption(component({}), rows, lineFields, false, 160);
    const tallChart = buildBarOption(component({}), rows, lineFields, false, 336);

    expect(shortChart.yAxis).toMatchObject({ interval: 5 });
    expect(tallChart.yAxis).toMatchObject({ interval: 2 });
  });

  it("gives short cards more plot area and sparse grouped bars a useful width", () => {
    const sparseRows = [
      { month: "华东", revenue: 120, profit: 70, orders: 40 },
      { month: "华南", revenue: 160, profit: 90, orders: 55 },
    ];
    const fields = [
      lineFields[0]!,
      lineFields[1]!,
      lineFields[2]!,
      { key: "orders", label: "订单数", type: "number" as const, nullable: false },
    ];
    const grouped = buildBarOption(component({
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measure: [{ fieldKey: "revenue" }, { fieldKey: "profit" }, { fieldKey: "orders" }] } },
    }), sparseRows, fields, false, 160);
    const stacked = buildBarOption(component({
      type: "stackedBar",
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measures: [{ fieldKey: "revenue" }, { fieldKey: "profit" }] } },
    }), sparseRows, fields, false, 160);
    const percentage = buildBarOption(component({
      type: "percentBar",
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measures: [{ fieldKey: "revenue" }, { fieldKey: "profit" }] } },
    }), sparseRows, fields, false, 160);

    expect(grouped.grid).toMatchObject({ top: 34, bottom: 32 });
    expect(grouped.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ barMaxWidth: 72, barGap: "12%" }),
    ]));
    expect(stacked.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ barMaxWidth: 112, barGap: "0%" }),
    ]));
    expect(percentage.series).toEqual(expect.arrayContaining([
      expect.objectContaining({ barMaxWidth: 112, barGap: "0%" }),
    ]));
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

  it("keeps bar-chart maxima close enough to preserve visible category differences", () => {
    const option = buildBarOption(component({
      type: "stackedBar",
      props: { aggregation: "sum", color: "#1677ff", showLegend: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measures: [{ fieldKey: "revenue" }] } },
    }), [
      { month: "A", revenue: 650_000 },
      { month: "B", revenue: 120_000 },
      { month: "C", revenue: 30_000 },
    ], lineFields);

    expect(option.yAxis).toMatchObject({ min: 0, max: 750_000, interval: 250_000 });
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
    expect(percentage.tooltip.formatter?.({ dataIndex: 0, marker: "●", seriesId: "revenue", seriesName: "销售额", value: 40 })).toBe("●销售额<br/>40 ¥（40.00%）");
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

  it("uses each percentage-bar metric's selected aggregation before calculating its share", () => {
    const option = buildBarOption(component({
      type: "percentBar",
      props: { aggregation: "sum", color: "#1677ff", showLegend: true, smooth: true, area: true },
      binding: {
        datasetId: "sales",
        slots: {
          dimension: { fieldKey: "month" },
          measures: [
            { fieldKey: "revenue", aggregation: "count" },
            { fieldKey: "profit", aggregation: "sum" },
          ],
        },
      },
    }), [
      { month: "2026-01-01", revenue: 10, profit: 4 },
      { month: "2026-01-01", revenue: 30, profit: 6 },
    ], lineFields);

    expect(option.series).toEqual([
      expect.objectContaining({ name: "毛利", data: [expect.closeTo(83.333333, 4)] }),
      expect.objectContaining({ name: "销售额", data: [expect.closeTo(16.666667, 4)] }),
    ]);
  });

  it("does not aggregate server-aggregated percentage-bar rows a second time", () => {
    const option = buildBarOption(component({
      type: "percentBar",
      props: { aggregation: "sum", color: "#1677ff", showLegend: true, smooth: true, area: true },
      binding: {
        datasetId: "sales",
        slots: {
          dimension: { fieldKey: "warehouse" },
          measures: [
            { fieldKey: "supplyPrice", aggregation: "count" },
            { fieldKey: "productTotal", aggregation: "avg" },
          ],
        },
      },
    }), [{ warehouse: "CK26015", supplyPrice: 226, productTotal: 239.045664 }], [
      { key: "warehouse", label: "实体实体仓编码", type: "string", nullable: true },
      { key: "supplyPrice", label: "供货价", type: "number", nullable: true },
      { key: "productTotal", label: "产品总金额", type: "number", nullable: true },
    ], true);

    expect(option.series).toEqual([
      expect.objectContaining({ name: "产品总金额", data: [expect.closeTo(51.403, 3)] }),
      expect.objectContaining({ name: "供货价", data: [expect.closeTo(48.597, 3)] }),
    ]);
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
        { key: "revenue", label: "revenue", isCurrency: true, value: 150 },
        { key: "orders", label: "orders", isCurrency: false, value: 30 },
      ],
    });
    expect(buildProgressBarModel(progressBar, [
      { revenue: 120, revenueTarget: 200, orders: 30, orderTarget: 60 },
      { revenue: 60, revenueTarget: 100, orders: 20, orderTarget: 40 },
    ])).toEqual({
      items: [
        { key: "revenue", label: "revenue", isCurrency: true, targetIsCurrency: true, value: 180, target: 200, progress: 0.9 },
        { key: "orders", label: "orders", isCurrency: false, targetIsCurrency: false, value: 50, target: 60, progress: 50 / 60 },
      ],
    });
    expect(buildProgressBarModel(component({
      type: "progressBar",
      props: { aggregation: "sum", decimals: 1, showValue: true },
      binding: { datasetId: "sales", slots: { measure: [{ fieldKey: "revenue" }, { fieldKey: "orders" }] } },
    }), [{ revenue: 20, orders: 8 }])).toEqual({
      items: [
        { key: "revenue", label: "revenue", isCurrency: true, targetIsCurrency: false, value: 20, target: 20, progress: 1 },
        { key: "orders", label: "orders", isCurrency: false, targetIsCurrency: false, value: 8, target: 8, progress: 1 },
      ],
    });
    expect(buildProgressBarModel(component({
      type: "progressBar",
      props: {
        aggregation: "sum",
        decimals: 1,
        showValue: true,
        progressPairs: [
          ["revenue", "orderTarget"],
          ["orders", "revenueTarget"],
        ],
      },
      binding: {
        datasetId: "sales",
        slots: {
          measure: [{ fieldKey: "revenue" }, { fieldKey: "orders" }],
          target: [{ fieldKey: "revenueTarget" }, { fieldKey: "orderTarget" }],
        },
      },
    }), [{ revenue: 120, revenueTarget: 200, orders: 30, orderTarget: 60 }])).toEqual({
      items: [
        { key: "revenue", label: "revenue", isCurrency: true, targetIsCurrency: false, value: 120, target: 60, progress: 2 },
        { key: "orders", label: "orders", isCurrency: false, targetIsCurrency: true, value: 30, target: 200, progress: 0.15 },
      ],
    });
    expect(buildProgressBarModel(component({
      type: "progressBar",
      props: { aggregation: "sum", decimals: 1, showValue: true },
      binding: {
        datasetId: "sales",
        slots: {
          measure: [{ fieldKey: "revenue", aggregation: "avg" }],
          target: [{ fieldKey: "revenueTarget", aggregation: "sum" }],
        },
      },
    }), [
      { revenue: 120, revenueTarget: 200 },
      { revenue: 60, revenueTarget: 100 },
    ])).toEqual({
      items: [{ key: "revenue", label: "revenue", isCurrency: true, targetIsCurrency: true, value: 90, target: 300, progress: 0.3 }],
    });
  });

  it("builds completion rows from each dimension's actual and target values", () => {
    const targetProgress = component({
      type: "targetProgress",
      title: "日销售目标完成率",
      props: { aggregation: "sum", color: "#f57c00", decimals: 0, showValue: true, suffix: "" },
      binding: {
        datasetId: "sales",
        slots: {
          dimension: { fieldKey: "product" },
          measure: { fieldKey: "completed" },
          target: { fieldKey: "target" },
        },
      },
    });

    expect(buildTargetProgressModel(targetProgress, [
      { product: "小米加湿器 2", completed: 1, target: 50 },
      { product: "小米加湿器 2", completed: 2, target: 50 },
      { product: "小米电视 A32", completed: 8, target: 150 },
    ], [
      { key: "product", label: "商品", type: "string", nullable: false },
      { key: "completed", label: "完成值", type: "number", nullable: false },
      { key: "target", label: "目标值", type: "number", nullable: false },
    ])).toEqual({
      dimensionLabel: "商品",
      measureLabel: "完成值",
      targetLabel: "目标值",
      measureKey: "completed",
      targetKey: "target",
      measureIsCurrency: false,
      targetIsCurrency: false,
      items: [
        { key: "小米加湿器 2", label: "小米加湿器 2", value: 3, target: 50, progress: 0.06 },
        { key: "小米电视 A32", label: "小米电视 A32", value: 8, target: 150, progress: 8 / 150 },
      ],
    });
  });

  it("honors separately configured aggregations for target-progress actual and target values", () => {
    const targetProgress = component({
      type: "targetProgress",
      title: "日销售目标完成率",
      props: { aggregation: "sum", color: "#f57c00", decimals: 0, showValue: true, suffix: "" },
      binding: {
        datasetId: "sales",
        slots: {
          dimension: { fieldKey: "product" },
          measure: { fieldKey: "completed", aggregation: "avg" },
          target: { fieldKey: "target", aggregation: "sum" },
        },
      },
    });

    expect(buildTargetProgressModel(targetProgress, [
      { product: "小米加湿器 2", completed: 1, target: 50 },
      { product: "小米加湿器 2", completed: 3, target: 50 },
    ])).toMatchObject({
      items: [{ label: "小米加湿器 2", value: 2, target: 100, progress: 0.02 }],
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
      measureKey: "revenue",
      groups: [
        {
          label: "2026-01",
          value: 150,
          metrics: [
            { key: "revenueTarget", label: "revenueTarget", isCurrency: true, value: 180 },
            { key: "priorRevenue", label: "priorRevenue", isCurrency: true, value: 130 },
            { key: "orders", label: "orders", isCurrency: false, value: 15 },
            { key: "orderTarget", label: "orderTarget", isCurrency: false, value: 18 },
          ],
        },
        {
          label: "2026-02",
          value: 200,
          metrics: [
            { key: "revenueTarget", label: "revenueTarget", isCurrency: true, value: 250 },
            { key: "priorRevenue", label: "priorRevenue", isCurrency: true, value: 180 },
            { key: "orders", label: "orders", isCurrency: false, value: 20 },
            { key: "orderTarget", label: "orderTarget", isCurrency: false, value: 25 },
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
      { key: "revenueTarget", label: "revenueTarget", isCurrency: true, value: 120 },
      { key: "priorRevenue", label: "priorRevenue", isCurrency: true, value: 90 },
      { key: "orders", label: "orders", isCurrency: false, value: 10 },
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
          measure: { fieldKey: "revenue", aggregation: "avg" },
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
      { label: "2026-02", value: 75 },
      { label: "2026-03", value: 120 },
    ]);
    expect(model.latest).toEqual({ label: "2026-03", value: 120 });
    expect(model.previous).toEqual({ label: "2026-02", value: 75 });
    expect(model.change).toEqual({ absolute: 45, rate: 0.6 });
    expect(model.peak).toEqual({ label: "2026-03", value: 120 });
    expect(option.xAxis.data).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(option.series[0]).toMatchObject({ type: "line", name: "销售额", data: [80, 75, 120] });
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
          measure: [{ fieldKey: "revenue", aggregation: "avg" }, { fieldKey: "orders", aggregation: "count" }],
        },
      },
    });
    const model = buildMetricTrendModel(metricTrend, [
      { businessDate: "2026-01-01", revenue: 100, orders: 10 },
      { businessDate: "2026-02-01", revenue: 120, orders: 12 },
      { businessDate: "2026-02-01", revenue: 80, orders: 15 },
    ], [
      { key: "businessDate", label: "业务日期", type: "date", nullable: false },
      { key: "revenue", label: "收入", type: "number", nullable: false },
      { key: "orders", label: "订单数", type: "number", nullable: false },
    ]);

    expect(buildMetricTrendOption(metricTrend, model, "orders")).toMatchObject({
      grid: { left: 48, right: 20, top: 16, bottom: 38 },
      tooltip: { trigger: "axis", triggerOn: "mousemove|click" },
      xAxis: { type: "category", data: ["2026-01", "2026-02"] },
      yAxis: { type: "value" },
      series: [
        expect.objectContaining({ type: "line", name: "订单数", data: [1, 2] }),
      ],
    });
    expect(buildMetricTrendOption(metricTrend, model, "orders").series).toHaveLength(1);
    expect(model.isTimeDimension).toBe(true);
    expect(model.measures.map((measure) => measure.label)).toEqual(["收入", "订单数"]);
    expect(model.measures.map((measure) => measure.total)).toEqual([200, 3]);
    expect(model.measures[0]?.latest).toEqual({ label: "2026-02", value: 100 });
  });

  it("keeps ordinary category labels intact when metric trend uses a dimension", () => {
    const metricTrend = component({
      type: "metricTrend",
      props: { aggregation: "sum", showSummary: true, timeGranularity: "day" },
      binding: {
        datasetId: "sales",
        slots: {
          timeDimension: { fieldKey: "productName" },
          measure: [{ fieldKey: "revenue" }],
        },
      },
    });
    const model = buildMetricTrendModel(metricTrend, [
      { productName: "创维 55 寸电视 55MUF7000Z", revenue: 100 },
      { productName: "小米电视 A32（32 寸）", revenue: 120 },
    ], [
      { key: "productName", label: "商品名称", type: "string", nullable: false },
      { key: "revenue", label: "实收金额", type: "number", nullable: false },
    ]);

    expect(model.periods).toEqual(["创维 55 寸电视 55MUF7000Z", "小米电视 A32（32 寸）"]);
    expect(model.measures[0]?.points.map((point) => point.label)).toEqual(model.periods);
    expect(model.isTimeDimension).toBe(false);
  });

  it("renders every dense category label in a metric trend", () => {
    const metricTrend = component({
      type: "metricTrend",
      props: { aggregation: "sum", showSummary: true, timeGranularity: "day" },
      binding: { datasetId: "sales", slots: { timeDimension: { fieldKey: "product" }, measure: [{ fieldKey: "revenue" }] } },
    });
    const model = buildMetricTrendModel(metricTrend, Array.from({ length: 8 }, (_, index) => ({
      product: `商品名称 ${index + 1} - Xiaomi Smart Humidifier`,
      revenue: index + 1,
    })), [
      { key: "product", label: "商品名称", type: "string", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
    ]);
    const option = buildMetricTrendOption(metricTrend, model);

    expect(option.grid).toMatchObject({ bottom: 68 });
    expect(option.xAxis).toMatchObject({ axisLabel: { interval: 0, rotate: 24, hideOverlap: false } });
    expect(option.xAxis.data).toHaveLength(8);
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
      { key: "revenue", label: "销售额", isCurrency: true },
      { key: "orders", label: "订单数", isCurrency: false },
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
