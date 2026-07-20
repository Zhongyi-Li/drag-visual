import { describe, expect, it } from "vitest";

import {
  ComponentRegistry,
  ComponentRegistryError,
  areaDefinition,
  barDefinition,
  crosstabDefinition,
  createDefaultRegistry,
  flipNumberDefinition,
  gaugeDefinition,
  heatmapDefinition,
  kpiDefinition,
  liquidDefinition,
  metricBreakdownDefinition,
  metricTrendDefinition,
  multidimensionalDefinition,
  progressBarDefinition,
  rankingDefinition,
  radarDefinition,
  ringBarDefinition,
  roseDefinition,
  percentAreaDefinition,
  percentBarDefinition,
  stackedAreaDefinition,
  stackedBarDefinition,
  sunburstDefinition,
  trendDefinition,
  treemapDefinition,
} from "./index.js";

describe("component registry", () => {
  it("registers all component types", () => {
    expect(createDefaultRegistry().list().map((definition) => definition.type).sort()).toEqual([
      "area",
      "bar",
      "crosstab",
      "flipNumber",
      "gauge",
      "heatmap",
      "kpi",
      "line",
      "liquid",
      "metricBreakdown",
      "metricTrend",
      "multidimensional",
      "percentArea",
      "percentBar",
      "pie",
      "progressBar",
      "radar",
      "ranking",
      "ringBar",
      "rose",
      "stackedArea",
      "stackedBar",
      "sunburst",
      "table",
      "text",
      "treemap",
      "trend",
    ]);
  });

  it("defines a first-class rose chart so its polar-area encoding survives renaming", () => {
    expect(roseDefinition.type).toBe("rose");
    expect(roseDefinition.title).toBe("玫瑰图");
    expect(roseDefinition.createDefaults()).toEqual({ color: "#1677ff", showLegend: false });
    expect(roseDefinition.dataSlots).toEqual(createDefaultRegistry().get("pie").dataSlots);
  });

  it("defines a sunburst chart with a multi-select metric slot", () => {
    const sunburst = createDefaultRegistry().get("sunburst");

    expect(sunburstDefinition.title).toBe("旭日图");
    expect(sunburst.defaultLayout).toEqual({ w: 7, h: 6 });
    expect(sunburst.createDefaults()).toEqual({ color: "#1677ff", showLegend: true });
    expect(sunburst.dataSlots).toEqual([
      expect.objectContaining({ key: "dimension", required: true, multiple: false }),
      expect.objectContaining({ key: "measure", required: true, multiple: true }),
    ]);
  });

  it("defines radar and treemap charts with their intended data shapes", () => {
    const registry = createDefaultRegistry();
    const radar = registry.get("radar");
    const treemap = registry.get("treemap");

    expect(radarDefinition.createDefaults()).toEqual({ color: "#4b7cf5", showLegend: true });
    expect(radar.defaultLayout).toEqual({ w: 6, h: 6 });
    expect(radar.dataSlots).toEqual([
      expect.objectContaining({ key: "dimension", required: true, multiple: false }),
      expect.objectContaining({ key: "measure", required: true, multiple: true }),
    ]);
    expect(treemapDefinition.createDefaults()).toEqual({ color: "#4b7cf5", showLegend: false });
    expect(treemap.defaultLayout).toEqual({ w: 6, h: 6 });
    expect(treemap.dataSlots).toEqual([
      expect.objectContaining({ key: "dimension", required: true, multiple: false }),
      expect.objectContaining({ key: "measure", required: true, multiple: true }),
    ]);
  });

  it("defines line and area charts with separate default rendering modes", () => {
    const registry = createDefaultRegistry();
    const line = registry.get("line");
    const area = registry.get("area");

    expect(line.title).toBe("折线图");
    expect(line.createDefaults()).toEqual({ color: "#1677ff", showLegend: true, smooth: false, area: false });
    expect(areaDefinition.title).toBe("面积图");
    expect(area.createDefaults()).toEqual({ color: "#1677ff", showLegend: true, smooth: true, area: true });
    expect(area.dataSlots).toEqual(line.dataSlots);
    expect(line.validateBinding?.({ datasetId: "sales", slots: { measures: [{ fieldKey: "revenue" }] } })).toEqual({
      valid: false,
      messages: ["请选择一个维度字段"],
    });
  });

  it("defines percentage line and bar charts as separate first-class components", () => {
    const registry = createDefaultRegistry();
    const stacked = registry.get("stackedArea");
    const percent = registry.get("percentArea");
    const percentBar = registry.get("percentBar");

    expect(stackedAreaDefinition.title).toBe("堆积面积图");
    expect(percentAreaDefinition.title).toBe("百分比堆积面积图");
    expect(percentBarDefinition.title).toBe("百分比堆积柱图");
    expect(percentBarDefinition.category).toBe("柱/条图");
    expect(stacked.createDefaults()).toEqual({ color: "#1677ff", showLegend: true, smooth: true, area: true });
    expect(percent.createDefaults()).toEqual({ color: "#1677ff", showLegend: true, smooth: true, area: true });
    expect(percentBar.createDefaults()).toEqual({ color: "#1677ff", showLegend: true, smooth: true, area: true });
    expect(stacked.dataSlots).toEqual(percent.dataSlots);
    expect(percent.dataSlots).toEqual(percentBar.dataSlots);
  });

  it("defines a stacked bar with one dimension and multiple measures", () => {
    const stacked = createDefaultRegistry().get("stackedBar");

    expect(stackedBarDefinition.title).toBe("堆积柱图");
    expect(stacked.createDefaults()).toEqual({ color: "#1677ff", showLegend: true });
    expect(stacked.dataSlots).toEqual([
      expect.objectContaining({ key: "dimension", required: true, multiple: false }),
      expect.objectContaining({ key: "measures", required: true, multiple: true }),
    ]);
    expect(stacked.validateBinding?.({
      datasetId: "sales",
      slots: { dimension: { fieldKey: "month" }, measures: [{ fieldKey: "east" }, { fieldKey: "south" }] },
    })).toEqual({ valid: true, messages: [] });
  });

  it("defines dedicated ring bar and ranking components", () => {
    const registry = createDefaultRegistry();
    const ringBar = registry.get("ringBar");
    const ranking = registry.get("ranking");

    expect(ringBarDefinition.title).toBe("环形柱图");
    expect(ringBar.defaultLayout).toEqual({ w: 7, h: 4 });
    expect(ringBar.createDefaults()).toEqual({ decimals: 1, showValue: true });
    expect(ringBar.dataSlots).toEqual([
      expect.objectContaining({ key: "dimension", required: true }),
      expect.objectContaining({ key: "measure", title: "实际值", required: true }),
      expect.objectContaining({ key: "target", title: "目标值", required: true }),
    ]);
    expect(ringBar.validateBinding?.({
      datasetId: "sales",
      slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "actual" }, target: { fieldKey: "target" } },
    })).toEqual({ valid: true, messages: [] });

    expect(rankingDefinition.title).toBe("排行榜");
    expect(ranking.defaultLayout).toEqual({ w: 7, h: 5 });
    expect(ranking.createDefaults()).toEqual({ color: "#1677ff", maxItems: 10, showValue: true });
    expect(ranking.dataSlots).toEqual([
      expect.objectContaining({ key: "dimension", title: "排名维度", required: true }),
      expect.objectContaining({ key: "measure", title: "排名指标", required: true, multiple: true }),
    ]);
    expect(ranking.validateBinding?.({
      datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "revenue" } },
    })).toEqual({ valid: true, messages: [] });
  });

  it("exposes a multi-metric Chinese bar definition and validates its props", () => {
    expect(barDefinition.type).toBe("bar");
    expect(barDefinition.title).toBe("柱图");
    expect(barDefinition.category).toBe("柱/条图");
    expect(barDefinition.defaultLayout).toEqual({ w: 6, h: 5 });
    expect(barDefinition.dataSlots).toEqual([
      expect.objectContaining({ key: "dimension", acceptedTypes: ["string", "date"], required: false }),
      expect.objectContaining({ key: "measure", acceptedTypes: ["number"], required: true, multiple: true }),
    ]);
    expect(barDefinition.propsSchema.parse({ color: "#1677ff", showLegend: true })).toEqual({
      color: "#1677ff",
      showLegend: true,
    });
    expect(barDefinition.propsSchema.safeParse({ color: "blue", showLegend: true }).success).toBe(false);
    expect(barDefinition.validateBinding?.({
      datasetId: "sales",
      slots: { measure: [{ fieldKey: "orders" }, { fieldKey: "refunds" }] },
    })).toEqual({ valid: true, messages: [] });
    expect(barDefinition.validateBinding?.({ datasetId: "sales", slots: {} })).toEqual({
      valid: false,
      messages: ["请选择至少一个指标字段"],
    });
  });

  it("keeps table entries wide without occupying the full row", () => {
    const tableDefinition = createDefaultRegistry().get("table");
    expect(tableDefinition.defaultLayout).toEqual({ w: 9, h: 6 });
  });

  it("defines KPI slots with one multi-select metric control and legacy optional metric slots", () => {
    expect(kpiDefinition.type).toBe("kpi");
    expect(kpiDefinition.title).toBe("指标卡");
    expect(kpiDefinition.category).toBe("指标");
    expect(kpiDefinition.dataSlots).toEqual([
      expect.objectContaining({ key: "dimension", title: "分组维度", acceptedTypes: ["string", "date"], required: false, multiple: false }),
      expect.objectContaining({ key: "measure", title: "指标/容量", acceptedTypes: ["number"], required: true, multiple: true }),
      expect.objectContaining({ key: "target", title: "目标值", acceptedTypes: ["number"], required: false, multiple: false }),
      expect.objectContaining({ key: "comparison", title: "对比值", acceptedTypes: ["number"], required: false, multiple: false }),
      expect.objectContaining({ key: "secondaryMeasures", title: "辅助指标", acceptedTypes: ["number"], required: false, multiple: true }),
    ]);
    expect(kpiDefinition.validateBinding?.({
      datasetId: "sales",
      slots: {
        measure: { fieldKey: "revenue" },
        target: { fieldKey: "revenueTarget" },
        comparison: { fieldKey: "priorRevenue" },
      },
    }).valid).toBe(true);
    expect(kpiDefinition.validateBinding?.({
      datasetId: "sales",
      slots: {
        measure: [{ fieldKey: "revenue" }, { fieldKey: "orders" }],
      },
    }).valid).toBe(true);
  });

  it("defines flip number as a multi metric rolling display", () => {
    expect(flipNumberDefinition.type).toBe("flipNumber");
    expect(flipNumberDefinition.title).toBe("翻牌器");
    expect(flipNumberDefinition.category).toBe("指标");
    expect(flipNumberDefinition.defaultLayout).toEqual({ w: 4, h: 2 });
    expect(flipNumberDefinition.dataSlots).toEqual([
      expect.objectContaining({ key: "measure", title: "指标/度量", acceptedTypes: ["number"], required: true, multiple: true }),
    ]);
    expect(flipNumberDefinition.propsSchema.parse({ aggregation: "sum", prefix: "¥", suffix: "", decimals: 0 })).toEqual({
      aggregation: "sum",
      prefix: "¥",
      suffix: "",
      decimals: 0,
    });
    expect(flipNumberDefinition.validateBinding?.({
      datasetId: "sales",
      slots: { measure: [{ fieldKey: "revenue" }, { fieldKey: "orders" }] },
    }).valid).toBe(true);
  });

  it("defines progress bar slots for multiple metric progress rows", () => {
    expect(progressBarDefinition.type).toBe("progressBar");
    expect(progressBarDefinition.title).toBe("进度条");
    expect(progressBarDefinition.category).toBe("指标");
    expect(progressBarDefinition.defaultLayout).toEqual({ w: 6, h: 3 });
    expect(progressBarDefinition.dataSlots).toEqual([
      expect.objectContaining({ key: "measure", title: "指标/度量", acceptedTypes: ["number"], required: true, multiple: true }),
      expect.objectContaining({ key: "target", title: "目标值", acceptedTypes: ["number"], required: false, multiple: true }),
    ]);
    expect(progressBarDefinition.propsSchema.parse({ aggregation: "sum", decimals: 1, showValue: true })).toEqual({
      aggregation: "sum",
      decimals: 1,
      showValue: true,
    });
    expect(progressBarDefinition.validateBinding?.({
      datasetId: "sales",
      slots: { measure: [{ fieldKey: "revenue" }, { fieldKey: "orders" }] },
    }).valid).toBe(true);
  });

  it("defines gauge slots for an optional grouping dimension, actual value, and target", () => {
    expect(gaugeDefinition.type).toBe("gauge");
    expect(gaugeDefinition.title).toBe("仪表盘");
    expect(gaugeDefinition.category).toBe("指标");
    expect(gaugeDefinition.defaultLayout).toEqual({ w: 4, h: 4 });
    expect(gaugeDefinition.dataSlots).toEqual([
      expect.objectContaining({ key: "dimension", title: "分组维度", acceptedTypes: ["string", "date"], required: false, multiple: false }),
      expect.objectContaining({ key: "measure", title: "实际值", acceptedTypes: ["number"], required: true, multiple: false }),
      expect.objectContaining({ key: "target", title: "目标值", acceptedTypes: ["number"], required: true, multiple: false }),
    ]);
    expect(gaugeDefinition.propsSchema.parse({ aggregation: "sum", decimals: 1 })).toEqual({ aggregation: "sum", decimals: 1 });
    expect(gaugeDefinition.validateBinding?.({
      datasetId: "sales",
      slots: { measure: { fieldKey: "revenue" }, target: { fieldKey: "revenueTarget" } },
    }).valid).toBe(true);
  });

  it("defines a liquid chart with an optional grouping dimension, actual value, and target", () => {
    expect(liquidDefinition.type).toBe("liquid");
    expect(liquidDefinition.title).toBe("水波图");
    expect(liquidDefinition.defaultLayout).toEqual({ w: 4, h: 4 });
    expect(liquidDefinition.dataSlots).toEqual([
      expect.objectContaining({ key: "dimension", title: "分组维度", acceptedTypes: ["string", "date"], required: false, multiple: false }),
      expect.objectContaining({ key: "measure", title: "实际值", acceptedTypes: ["number"], required: true, multiple: false }),
      expect.objectContaining({ key: "target", title: "目标值", acceptedTypes: ["number"], required: true, multiple: false }),
    ]);
    expect(liquidDefinition.propsSchema.parse({ aggregation: "sum", decimals: 1 })).toEqual({ aggregation: "sum", decimals: 1 });
    expect(liquidDefinition.validateBinding?.({
      datasetId: "sales",
      slots: { measure: { fieldKey: "revenue" }, target: { fieldKey: "revenueTarget" } },
    }).valid).toBe(true);
  });

  it("defines a metric breakdown with one dimension and one metric", () => {
    expect(metricBreakdownDefinition.type).toBe("metricBreakdown");
    expect(metricBreakdownDefinition.title).toBe("指标拆解");
    expect(metricBreakdownDefinition.defaultLayout).toEqual({ w: 6, h: 4 });
    expect(metricBreakdownDefinition.dataSlots).toEqual([
      expect.objectContaining({ key: "dimension", title: "拆解维度", acceptedTypes: ["string", "date", "boolean"], required: true, multiple: false }),
      expect.objectContaining({ key: "measure", title: "拆解指标", acceptedTypes: ["number"], required: true, multiple: false }),
    ]);
    expect(metricBreakdownDefinition.propsSchema.parse({ aggregation: "sum", decimals: 1 })).toEqual({ aggregation: "sum", decimals: 1 });
    expect(metricBreakdownDefinition.validateBinding?.({
      datasetId: "sales",
      slots: { dimension: { fieldKey: "productLine" }, measure: { fieldKey: "revenue" } },
    }).valid).toBe(true);
  });

  it("defines crosstab slots for a two-dimensional pivot", () => {
    expect(crosstabDefinition.type).toBe("crosstab");
    expect(crosstabDefinition.title).toBe("交叉表");
    expect(crosstabDefinition.category).toBe("表格");
    expect(crosstabDefinition.defaultLayout).toEqual({ w: 10, h: 7 });
    expect(crosstabDefinition.dataSlots).toEqual([
      expect.objectContaining({ key: "rowDimension", acceptedTypes: ["string", "date", "boolean"], required: true }),
      expect.objectContaining({ key: "columnDimension", acceptedTypes: ["string", "date", "boolean"], required: true }),
      expect.objectContaining({ key: "measure", acceptedTypes: ["number"], required: true }),
    ]);
    expect(crosstabDefinition.propsSchema.parse({ aggregation: "sum", showTotals: true })).toEqual({
      aggregation: "sum",
      showTotals: true,
    });
  });

  it("defines heatmap slots for a row-column metric intensity matrix", () => {
    expect(heatmapDefinition.type).toBe("heatmap");
    expect(heatmapDefinition.title).toBe("热力图");
    expect(heatmapDefinition.category).toBe("表格");
    expect(heatmapDefinition.defaultLayout).toEqual({ w: 10, h: 7 });
    expect(heatmapDefinition.dataSlots).toEqual([
      expect.objectContaining({ key: "rowDimension", title: "行维度", acceptedTypes: ["string", "date", "boolean"], required: true }),
      expect.objectContaining({ key: "columnDimension", title: "列维度", acceptedTypes: ["string", "date", "boolean"], required: true }),
      expect.objectContaining({ key: "measure", title: "指标", acceptedTypes: ["number"], required: true }),
    ]);
    expect(heatmapDefinition.propsSchema.parse({ aggregation: "sum", showValues: true })).toEqual({
      aggregation: "sum",
      showValues: true,
    });
    expect(heatmapDefinition.validateBinding?.({
      datasetId: "sales",
      slots: {
        rowDimension: { fieldKey: "weekday" },
        columnDimension: { fieldKey: "hourBucket" },
        measure: { fieldKey: "visitors" },
      },
    }).valid).toBe(true);
  });

  it("defines trend analysis slots for time-series metrics", () => {
    expect(trendDefinition.type).toBe("trend");
    expect(trendDefinition.title).toBe("趋势分析");
    expect(trendDefinition.category).toBe("趋势图");
    expect(trendDefinition.defaultLayout).toEqual({ w: 8, h: 5 });
    expect(trendDefinition.dataSlots).toEqual([
      expect.objectContaining({ key: "timeDimension", title: "日期", acceptedTypes: ["date"], required: true }),
      expect.objectContaining({ key: "measure", title: "指标", acceptedTypes: ["number"], required: true }),
    ]);
    expect(trendDefinition.propsSchema.parse({ aggregation: "sum", showSummary: true, timeGranularity: "month" })).toEqual({
      aggregation: "sum",
      showSummary: true,
      timeGranularity: "month",
    });
    expect(trendDefinition.validateBinding?.({ datasetId: "sales", slots: { timeDimension: { fieldKey: "date" }, measure: { fieldKey: "revenue" } } }).valid).toBe(true);
  });

  it("defines metric trend slots for multi-metric time-series panels", () => {
    expect(metricTrendDefinition.type).toBe("metricTrend");
    expect(metricTrendDefinition.title).toBe("指标趋势");
    expect(metricTrendDefinition.category).toBe("指标");
    expect(metricTrendDefinition.defaultLayout).toEqual({ w: 8, h: 5 });
    expect(metricTrendDefinition.dataSlots).toEqual([
      expect.objectContaining({ key: "timeDimension", title: "日期/维度", acceptedTypes: ["date", "string"], required: true, multiple: false }),
      expect.objectContaining({ key: "measure", title: "指标/度量", acceptedTypes: ["number"], required: true, multiple: true }),
    ]);
    expect(metricTrendDefinition.propsSchema.parse({ aggregation: "sum", showSummary: true, timeGranularity: "month" })).toEqual({
      aggregation: "sum",
      showSummary: true,
      timeGranularity: "month",
    });
    expect(metricTrendDefinition.validateBinding?.({
      datasetId: "sales",
      slots: { timeDimension: { fieldKey: "businessDate" }, measure: [{ fieldKey: "revenue" }, { fieldKey: "orders" }] },
    }).valid).toBe(true);
  });

  it("defines multidimensional analysis slots for date-grained dimension and metric breakdowns", () => {
    expect(multidimensionalDefinition.type).toBe("multidimensional");
    expect(multidimensionalDefinition.title).toBe("多维分析");
    expect(multidimensionalDefinition.category).toBe("表格");
    expect(multidimensionalDefinition.defaultLayout).toEqual({ w: 10, h: 7 });
    expect(multidimensionalDefinition.dataSlots).toEqual([
      expect.objectContaining({
        key: "dateDimension",
        title: "日期",
        acceptedTypes: ["date"],
        required: true,
        multiple: false,
      }),
      expect.objectContaining({
        key: "dimensions",
        title: "维度字段",
        acceptedTypes: ["string", "boolean"],
        required: true,
        multiple: true,
      }),
      expect.objectContaining({
        key: "measures",
        title: "指标字段",
        acceptedTypes: ["number"],
        required: true,
        multiple: true,
      }),
    ]);
    expect(multidimensionalDefinition.propsSchema.parse({ aggregation: "sum", showTotals: true, timeGranularity: "quarter" })).toEqual({
      aggregation: "sum",
      showTotals: true,
      timeGranularity: "quarter",
    });
    expect(multidimensionalDefinition.validateBinding?.({
      datasetId: "sales",
      slots: {
        dateDimension: { fieldKey: "businessDate" },
        dimensions: [{ fieldKey: "region" }, { fieldKey: "category" }],
        measures: [{ fieldKey: "revenue" }, { fieldKey: "orders" }],
      },
    }).valid).toBe(true);
  });

  it("requires at least one measure binding and supports multiple selections", () => {
    const binding = (measure: unknown) => ({
      datasetId: "sales",
      slots: { measure },
    });
    expect(barDefinition.validateBinding?.(undefined).valid).toBe(false);
    expect(barDefinition.validateBinding?.(binding([]) as never).valid).toBe(false);
    expect(barDefinition.validateBinding?.(binding([
      { fieldKey: "revenue" },
      { fieldKey: "profit" },
    ]) as never).valid).toBe(true);
    expect(barDefinition.validateBinding?.(binding({ fieldKey: "revenue" }) as never).valid).toBe(true);
    expect(barDefinition.validateBinding?.(binding([{ fieldKey: "revenue" }]) as never).valid).toBe(true);
    expect(barDefinition.validateBinding?.({
      datasetId: "sales",
      slots: { measure: { fieldKey: "revenue" } },
    }).valid).toBe(true);
  });

  it("creates fresh deterministic defaults without aliases", () => {
    const first = barDefinition.createDefaults();
    const second = barDefinition.createDefaults();
    expect(first).toEqual({ color: "#1677ff", showLegend: true });
    expect(first).not.toBe(second);
  });

  it("reports stable missing and duplicate registration errors", () => {
    const registry = new ComponentRegistry();
    expect(() => registry.get("bar")).toThrowError(
      expect.objectContaining({ code: "DEFINITION_NOT_FOUND" }),
    );
    registry.register(barDefinition);
    expect(() => registry.register(barDefinition)).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_DEFINITION" }),
    );
  });

  it("returns immutable registry errors", () => {
    const registry = new ComponentRegistry();
    let captured: unknown;
    try {
      registry.get("bar");
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(ComponentRegistryError);
    expect(Object.isFrozen(captured)).toBe(true);
    const registryError = captured as ComponentRegistryError;
    expect(() => {
      (registryError as { code: string }).code = "DUPLICATE_DEFINITION";
    }).toThrow();
    expect(() => {
      (registryError as { message: string }).message = "changed";
    }).toThrow();
    expect(registryError.code).toBe("DEFINITION_NOT_FOUND");
    expect(registryError.message).toBe("Component definition is not registered: bar");
  });

  it("does not expose mutable registered definitions", () => {
    const definition = createDefaultRegistry().get("bar");
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.dataSlots)).toBe(true);
    expect(() => {
      (definition.dataSlots as unknown as { key: string }[])[0]!.key = "changed";
    }).toThrow();
    expect(createDefaultRegistry().get("bar").dataSlots[0]!.key).toBe("dimension");
  });
});
