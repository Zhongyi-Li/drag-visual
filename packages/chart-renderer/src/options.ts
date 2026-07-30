import type { ComponentInstance, DatasetField } from "@drag-visual/contracts";

type Row = Readonly<Record<string, unknown>>;
type Aggregation = "first" | "sum" | "avg" | "count" | "max" | "min";
type CrosstabAggregation = "sum" | "avg" | "count" | "max" | "min";
type TrendAggregation = "sum" | "avg" | "count" | "max" | "min";
type MultidimensionalAggregation = "sum" | "avg" | "max" | "min";
type HeatmapAggregation = "sum" | "avg" | "max" | "min";
type TimeGranularity = "day" | "week" | "month" | "quarter" | "year";

interface CrosstabCellAccumulator {
  readonly values: number[];
}

interface HeatmapCell {
  readonly columnKey: string;
  readonly columnLabel: string;
  readonly value: number;
  readonly intensity: number;
}

const fieldKeys = (component: ComponentInstance, slot: string): string[] => {
  const value = component.binding?.slots[slot];
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map((binding) => binding.fieldKey);
};

// Dataset schemas do not currently carry a dedicated currency semantic type.
// Until they do, use the field key and author-facing label to consistently
// identify common monetary metrics across every chart renderer.
export const isCurrencyMetric = (fieldKey: string, fields: readonly DatasetField[] = []): boolean => {
  const field = fields.find((candidate) => candidate.key === fieldKey);
  return /(金额|价格|价|费用|成本|收入|营收|销售额|成交额|毛利|利润|gmv|amount|price|cost|fee|revenue|income|sales|profit|currency|money)/i
    .test(`${fieldKey} ${field?.label ?? ""}`);
};

const withCurrencyUnit = (value: string, isCurrency: boolean): string => isCurrency ? `${value} ¥` : value;

const metricAggregationFor = (
  component: ComponentInstance,
  slot: string,
  fieldKey: string,
  fallback: TrendAggregation,
): TrendAggregation => {
  const value = component.binding?.slots[slot];
  const bindings = value === undefined ? [] : Array.isArray(value) ? value : [value];
  const aggregation = bindings.find((binding) => binding.fieldKey === fieldKey)?.aggregation;
  return aggregation === "sum" || aggregation === "avg" || aggregation === "count" || aggregation === "max" || aggregation === "min"
    ? aggregation
    : fallback;
};

const propString = (component: ComponentInstance, key: string, fallback: string): string =>
  typeof component.props[key] === "string" ? component.props[key] : fallback;

const propBoolean = (component: ComponentInstance, key: string, fallback: boolean): boolean =>
  typeof component.props[key] === "boolean" ? component.props[key] : fallback;

const propTimeGranularity = (component: ComponentInstance): TimeGranularity => {
  const value = component.props.timeGranularity;
  return value === "week" || value === "month" || value === "quarter" || value === "year" ? value : "day";
};

const numericValue = (row: Row, key: string): number => {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

const aggregateNumbers = (values: readonly number[], aggregation: CrosstabAggregation): number => {
  if (values.length === 0) return 0;
  if (aggregation === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (aggregation === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (aggregation === "count") return values.length;
  if (aggregation === "max") return Math.max(...values);
  return Math.min(...values);
};

const sortLabel = (label: string): number | string => {
  const timestamp = Date.parse(label);
  return Number.isNaN(timestamp) ? label : timestamp;
};

const compareLabels = (left: string, right: string): number => {
  const leftKey = sortLabel(left);
  const rightKey = sortLabel(right);
  if (typeof leftKey === "number" && typeof rightKey === "number") return leftKey - rightKey;
  return String(leftKey).localeCompare(String(rightKey), "zh-CN", { numeric: true });
};

const labelFor = (value: unknown): string => {
  if (value === null || value === undefined || value === "") return "未分类";
  return String(value);
};

const isLegacyRankingAuxiliaryField = (key: string, label: string): boolean =>
  /^(权重|调整系数|加权销售额|加权结果|weight|adjustment(?:_?factor)?|weighted(?:sales|revenue|result)?)$/i.test(key) ||
  /^(权重|调整系数|加权销售额|加权结果|weight|adjustment(?:\s*factor)?|weighted(?:\s*sales|\s*revenue|\s*result)?)$/i.test(label);

const pad2 = (value: number): string => String(value).padStart(2, "0");

const dateFromValue = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== "string") return null;
  const simpleDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (simpleDate) {
    return new Date(Date.UTC(Number(simpleDate[1]), Number(simpleDate[2]) - 1, Number(simpleDate[3])));
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : new Date(timestamp);
};

const lineDimensionLabel = (value: unknown, field: DatasetField | undefined): string => {
  const raw = labelFor(value);
  const dateLikeField = field?.type === "date" || /date|time|日期|时间|month|月份/i.test(`${field?.key ?? ""} ${field?.label ?? ""}`);
  if (!dateLikeField) return raw;
  const date = dateFromValue(value);
  if (date === null) return raw;
  const isMonthly = /month|月份/i.test(`${field?.key ?? ""} ${field?.label ?? ""}`);
  if (isMonthly) return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
  return date.toISOString().slice(0, 10);
};

const compactCategoryLabel = (value: string, maximumLength: number): string =>
  value.length > maximumLength ? `${value.slice(0, Math.max(1, maximumLength - 1))}…` : value;

const aggregateBarRows = (
  rows: readonly Row[],
  dimension: string,
  measures: readonly string[],
  dimensionField: DatasetField | undefined,
  aggregationForMeasure: (measure: string) => CrosstabAggregation,
): readonly Row[] => {
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const label = lineDimensionLabel(row[dimension], dimensionField);
    const group = groups.get(label);
    if (group === undefined) groups.set(label, [row]);
    else group.push(row);
  }

  return Array.from(groups, ([label, group]) => {
    const aggregate: Record<string, unknown> = { [dimension]: label };
    for (const measure of measures) {
      aggregate[measure] = aggregateNumbers(group.map((row) => numericValue(row, measure)), aggregationForMeasure(measure));
    }
    return aggregate;
  });
};

const lineYAxisScale = (rows: readonly Row[], measures: readonly string[], stacked = false, splitCount = 3) => {
  const values = stacked
    ? rows.map((row) => measures.reduce((sum, measure) => sum + numericValue(row, measure), 0))
    : rows.flatMap((row) => measures.map((measure) => numericValue(row, measure)));
  const maximum = Math.max(0, ...values);
  if (maximum === 0) return { min: 0, max: 1, interval: 1 };
  const rawInterval = maximum / splitCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawInterval));
  const normalized = rawInterval / magnitude;
  // Keep the final grid line close to the largest value. Skipping directly
  // from 2 to 5 can inflate a 650k maximum to 1m, flattening the columns and
  // hiding useful differences between the remaining categories.
  const niceMultiplier = normalized <= 1.25 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  const interval = niceMultiplier * magnitude;
  return { min: 0, max: Math.ceil(maximum / interval) * interval, interval };
};

const formatMetricValue = (value: number, isCurrency = false): string => withCurrencyUnit(
  new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value),
  isCurrency,
);

const compactAxisValue = (value: number, isCurrency = false): string => {
  const absolute = Math.abs(value);
  if (absolute >= 100_000_000) return withCurrencyUnit(`${(value / 100_000_000).toFixed(1).replace(/\.0$/, "")}亿`, isCurrency);
  if (absolute >= 10_000) return withCurrencyUnit(`${(value / 10_000).toFixed(1).replace(/\.0$/, "")}万`, isCurrency);
  if (absolute >= 1_000) return withCurrencyUnit(`${(value / 1_000).toFixed(1).replace(/\.0$/, "")}k`, isCurrency);
  return formatMetricValue(value, isCurrency);
};

const hasWidelyDifferentBarScales = (rows: readonly Row[], measures: readonly string[]): boolean => {
  const maxima = measures
    .map((measure) => Math.max(0, ...rows.map((row) => numericValue(row, measure))))
    .filter((maximum) => maximum > 0);
  if (maxima.length < 2) return false;
  return Math.max(...maxima) / Math.min(...maxima) >= 50;
};

const percentTooltipFormatter = (
  params: { readonly dataIndex?: number; readonly marker?: string; readonly seriesId?: string; readonly seriesName?: string; readonly value?: unknown },
  rows: readonly Row[],
): string => {
  const value = typeof params.value === "number" ? params.value : Number(params.value);
  const displayValue = Number.isFinite(value) ? value.toFixed(2) : "0.00";
  const row = rows[params.dataIndex ?? -1];
  const rawValue = row === undefined || params.seriesId === undefined ? 0 : numericValue(row, params.seriesId);
  return `${params.marker ?? ""}${params.seriesName ?? "指标"}<br/>${formatMetricValue(rawValue)}（${displayValue}%）`;
};

const metricTooltipFormatter = (
  params: { readonly marker?: string; readonly seriesName?: string; readonly value?: unknown },
  currencySeriesNames: ReadonlySet<string> = new Set(),
): string => {
  const value = typeof params.value === "number" ? params.value : Number(params.value);
  const seriesName = params.seriesName ?? "指标";
  return `${params.marker ?? ""}${seriesName}<br/>${formatMetricValue(Number.isFinite(value) ? value : 0, currencySeriesNames.has(seriesName))}`;
};

const isoWeek = (date: Date): { year: number; week: number } => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return {
    year: target.getUTCFullYear(),
    week: Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7),
  };
};

const periodLabel = (value: unknown, granularity: TimeGranularity): string => {
  const date = dateFromValue(value);
  if (date === null) return labelFor(value);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  if (granularity === "year") return String(year);
  if (granularity === "quarter") return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
  if (granularity === "month") return `${year}-${pad2(month)}`;
  if (granularity === "week") {
    const { year: weekYear, week } = isoWeek(date);
    return `${weekYear}-W${pad2(week)}`;
  }
  return `${year}-${pad2(month)}-${pad2(date.getUTCDate())}`;
};

export const buildBarOption = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
  rowsAreAggregated = false,
  containerHeight?: number,
) => {
  const dimension = fieldKeys(component, "dimension")[0] ?? "";
  const percentage = component.type === "percentBar";
  const stacked = component.type === "stackedBar" || percentage;
  const measures = stacked ? fieldKeys(component, "measures") : fieldKeys(component, "measure");
  const fieldLabels = new Map(fields.map((field) => [field.key, field.label]));
  const currencyMeasures = new Set(measures.filter((measure) => isCurrencyMetric(measure, fields)));
  const allMeasuresAreCurrency = measures.length > 0 && currencyMeasures.size === measures.length;
  const currencySeriesNames = new Set(measures
    .filter((measure) => currencyMeasures.has(measure))
    .map((measure) => stacked || measures.length > 1 ? fieldLabels.get(measure) ?? measure : component.title ?? fieldLabels.get(measure) ?? measure));
  const dimensionField = fields.find((field) => field.key === dimension);
  const aggregation = propString(component, "aggregation", "sum") as CrosstabAggregation;
  const aggregatedRows = rowsAreAggregated
    ? rows
    : aggregateBarRows(
      rows,
      dimension,
      measures,
      dimensionField,
      (measure) => metricAggregationFor(component, stacked ? "measures" : "measure", measure, aggregation),
    );
  const denseCategories = aggregatedRows.length > 8;
  // A taller card can support more grid lines. Derive the target interval from
  // the actual chart container rather than preserving the same three segments
  // at every height.
  const verticalSplitCount = containerHeight === undefined || containerHeight <= 0
    ? 3
    : Math.max(3, Math.min(6, Math.round(containerHeight / 56)));
  const yAxisScale = percentage ? { min: 0, max: 100, interval: 25 } : lineYAxisScale(aggregatedRows, measures, stacked, verticalSplitCount);
  const independentScales = !stacked && measures.length > 1 && hasWidelyDifferentBarScales(aggregatedRows, measures);
  const colors = [
    propString(component, "color", "#1677ff"),
    "#36cfc9",
    "#9254de",
    "#fa8c16",
  ];
  return {
    color: colors,
    legend: {
      show: propBoolean(component, "showLegend", true),
      top: 8,
      left: 12,
      orient: "horizontal",
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 18,
      textStyle: { color: "#475569", fontSize: 12 },
    },
    grid: {
      top: 44,
      right: independentScales ? 18 + Math.max(0, Math.floor(measures.length / 2) - 1) * 44 : 18,
      // Leave room for every dense category label. In particular, a grouped
      // result with 10 products must not visually look like it only has five.
      // The vertical space belongs to the plotting area. Dense labels still
      // need room, but the old 80px reservation left tall preview cards mostly
      // empty below the chart.
      bottom: denseCategories ? 60 : 40,
      left: independentScales ? 52 + Math.max(0, Math.ceil(measures.length / 2) - 1) * 44 : 52,
      containLabel: true,
    },
    tooltip: percentage
      ? { trigger: "item", formatter: (params: Parameters<typeof percentTooltipFormatter>[0]) => percentTooltipFormatter(params, aggregatedRows) }
      : stacked
        ? { trigger: "item", formatter: (params: Parameters<typeof metricTooltipFormatter>[0]) => metricTooltipFormatter(params, currencySeriesNames) }
        : { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "category",
      boundaryGap: true,
      name: fieldLabels.get(dimension) ?? dimension,
      nameLocation: "middle",
      nameGap: 32,
      nameTextStyle: { color: "#94a3b8", fontSize: 11 },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisTick: { show: false },
      axisLabel: {
        color: "#64748b",
        // A category is data, rather than decoration: never let ECharts drop
        // labels for a normal dense result set. Compact and slightly rotate
        // them instead, while keeping the full name available in the tooltip.
        interval: 0,
        rotate: denseCategories ? 24 : 0,
        hideOverlap: false,
        formatter: (value: string) => compactCategoryLabel(value, denseCategories ? 7 : 18),
      },
      data: aggregatedRows.map((row) => lineDimensionLabel(row[dimension], dimensionField)),
    },
    yAxis: independentScales
      ? measures.map((measure, index) => ({
        type: "value",
        ...lineYAxisScale(aggregatedRows, [measure], false, verticalSplitCount),
        position: index % 2 === 0 ? "left" : "right",
        offset: Math.floor(index / 2) * 44,
        axisLine: { show: true, lineStyle: { color: colors[index % colors.length] } },
        axisLabel: { color: colors[index % colors.length], formatter: (value: number) => compactAxisValue(value, currencyMeasures.has(measure)) },
        splitLine: { show: index === 0, lineStyle: { color: "#edf2f7" } },
      }))
      : {
        type: "value",
        ...yAxisScale,
        axisLabel: { color: "#64748b", formatter: percentage ? (value: number) => `${value.toFixed(2)}%` : allMeasuresAreCurrency ? (value: number) => compactAxisValue(value, true) : undefined },
        splitLine: { lineStyle: { color: "#edf2f7" } },
      },
    series: (percentage ? measures.map((measure, index) => ({ measure, index })).reverse() : measures.map((measure, index) => ({ measure, index }))).map(({ measure, index }) => ({
      type: "bar",
      name: stacked || measures.length > 1 ? fieldLabels.get(measure) ?? measure : component.title ?? fieldLabels.get(measure) ?? measure,
      id: percentage ? measure : undefined,
      data: aggregatedRows.map((row) => {
        const value = numericValue(row, measure);
        if (!percentage) return value;
        const total = measures.reduce((sum, currentMeasure) => sum + numericValue(row, currentMeasure), 0);
        return total === 0 ? 0 : value / total * 100;
      }),
      stack: stacked ? "total" : undefined,
      ...(independentScales ? { yAxisIndex: index } : {}),
      barMaxWidth: 40,
      barMinHeight: 2,
      itemStyle: percentage
        ? {
            color: colors[index % colors.length],
            borderColor: "#ffffff",
            borderWidth: 1,
            borderRadius: index === 0 ? [3, 3, 0, 0] : index === measures.length - 1 ? [0, 0, 3, 3] : 0,
          }
        : { color: colors[index % colors.length] },
      emphasis: { focus: percentage ? "none" : "series" },
      tooltip: percentage ? undefined : {
        valueFormatter: (value: unknown) => formatMetricValue(Number(value), currencyMeasures.has(measure)),
      },
    })),
  };
};

export const buildLineOption = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
) => {
  const dimension = fieldKeys(component, "dimension")[0] ?? "";
  const measures = fieldKeys(component, "measures");
  const fieldLabels = new Map(fields.map((field) => [field.key, field.label]));
  const currencyMeasures = new Set(measures.filter((measure) => isCurrencyMetric(measure, fields)));
  const allMeasuresAreCurrency = measures.length > 0 && currencyMeasures.size === measures.length;
  const dimensionField = fields.find((field) => field.key === dimension);
  const stacked = component.type === "stackedArea" || component.type === "percentArea";
  const percentage = component.type === "percentArea";
  const area = stacked || component.type === "area" || propBoolean(component, "area", false);
  const yAxisScale = percentage ? { min: 0, max: 100, interval: 25 } : lineYAxisScale(rows, measures, stacked);
  const colors = [
    propString(component, "color", "#1677ff"),
    "#36cfc9",
    "#9254de",
    "#fa8c16",
  ];
  return {
    color: colors,
    legend: {
      show: propBoolean(component, "showLegend", true),
      data: percentage ? measures.map((measure) => fieldLabels.get(measure) ?? measure) : undefined,
      top: 8,
      left: 12,
      orient: "horizontal",
      icon: "circle",
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 18,
      textStyle: { color: "#475569", fontSize: 12 },
    },
    grid: { top: 44, right: 18, bottom: 48, left: 52, containLabel: true },
    tooltip: percentage
      ? { trigger: "item", formatter: (params: Parameters<typeof percentTooltipFormatter>[0]) => percentTooltipFormatter(params, rows) }
      : { trigger: "axis", axisPointer: { type: "line" } },
    xAxis: {
      type: "category",
      boundaryGap: false,
      name: fieldLabels.get(dimension) ?? dimension,
      nameLocation: "middle",
      nameGap: 32,
      nameTextStyle: { color: "#94a3b8", fontSize: 11 },
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisTick: { show: false },
      axisLabel: { color: "#64748b", rotate: rows.length > 8 ? 35 : 0, hideOverlap: true },
      data: rows.map((row) => lineDimensionLabel(row[dimension], dimensionField)),
    },
    yAxis: {
      type: "value",
      ...yAxisScale,
      axisLabel: { color: "#64748b", formatter: percentage ? (value: number) => `${value.toFixed(2)}%` : allMeasuresAreCurrency ? (value: number) => compactAxisValue(value, true) : undefined },
      splitLine: { lineStyle: { color: "#edf2f7" } },
    },
    series: (percentage ? measures.map((measure, index) => ({ measure, index })).reverse() : measures.map((measure, index) => ({ measure, index }))).map(({ measure, index }) => ({
      type: "line",
      id: percentage ? measure : undefined,
      name: fieldLabels.get(measure) ?? measure,
      data: rows.map((row) => {
        const value = numericValue(row, measure);
        if (!percentage) return value;
        const total = measures.reduce((sum, currentMeasure) => sum + numericValue(row, currentMeasure), 0);
        return total === 0 ? 0 : value / total * 100;
      }),
      smooth: propBoolean(component, "smooth", false),
      showSymbol: rows.length <= 48,
      lineStyle: { width: percentage ? 2 : 3, color: colors[index % colors.length] },
      areaStyle: area ? { opacity: percentage ? 0.08 : 0.22, color: colors[index % colors.length] } : undefined,
      stack: stacked ? "total" : undefined,
      itemStyle: percentage ? { color: colors[index % colors.length] } : undefined,
      emphasis: { focus: percentage ? "none" : "series" },
      tooltip: percentage ? undefined : {
        valueFormatter: (value: unknown) => formatMetricValue(Number(value), currencyMeasures.has(measure)),
      },
    })),
  };
};

export const buildTrendModel = (component: ComponentInstance, rows: readonly Row[], fields: readonly DatasetField[] = []) => {
  const labels = new Map(fields.map((field) => [field.key, field.label]));
  const timeDimension = fieldKeys(component, "timeDimension")[0] ?? "";
  const measure = fieldKeys(component, "measure")[0] ?? "";
  const aggregation = metricAggregationFor(component, "measure", measure, propString(component, "aggregation", "sum") as TrendAggregation);
  const granularity = propTimeGranularity(component);
  const grouped = new Map<string, number[]>();

  rows.forEach((row) => {
    const label = periodLabel(row[timeDimension], granularity);
    const values = grouped.get(label) ?? [];
    values.push(numericValue(row, measure));
    grouped.set(label, values);
  });

  const points = [...grouped.entries()]
    .map(([label, values]) => ({ label, value: aggregateNumbers(values, aggregation) }))
    .sort((left, right) => compareLabels(left.label, right.label));
  const latest = points.at(-1) ?? null;
  const previous = points.at(-2) ?? null;
  const peak = points.reduce<{ label: string; value: number } | null>((currentPeak, point) =>
    currentPeak === null || point.value > currentPeak.value ? point : currentPeak, null);
  const absolute = latest !== null && previous !== null ? latest.value - previous.value : null;
  const rate = absolute !== null && previous !== null && previous.value !== 0 ? absolute / previous.value : null;

  return {
    timeLabel: labels.get(timeDimension) ?? timeDimension,
    measureLabel: labels.get(measure) ?? measure,
    measureIsCurrency: isCurrencyMetric(measure, fields),
    points,
    latest,
    previous,
    change: absolute === null ? null : { absolute, rate },
    peak,
    showSummary: propBoolean(component, "showSummary", true),
  };
};

export const buildTrendOption = (component: ComponentInstance, model: ReturnType<typeof buildTrendModel>) => ({
  color: [propString(component, "color", "#1677ff")],
  grid: { left: 42, right: 18, top: 24, bottom: 34 },
  tooltip: {
    trigger: "axis",
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderWidth: 0,
    textStyle: { color: "#fff" },
  },
  xAxis: {
    type: "category",
    data: model.points.map((point) => point.label),
    axisLine: { lineStyle: { color: "#dbe3ee" } },
    axisTick: { show: false },
    axisLabel: { color: "#64748b", formatter: model.measureIsCurrency ? (value: number) => compactAxisValue(value, true) : undefined },
  },
  yAxis: {
    type: "value",
    splitLine: { lineStyle: { color: "#edf2f7" } },
    axisLabel: { color: "#64748b" },
  },
  series: [{
    type: "line",
    name: model.measureLabel,
    data: model.points.map((point) => point.value),
    smooth: true,
    symbolSize: 7,
    lineStyle: { width: 3 },
    itemStyle: { borderColor: "#fff", borderWidth: 2 },
    areaStyle: { opacity: 0.12 },
    tooltip: { valueFormatter: (value: unknown) => formatMetricValue(Number(value), model.measureIsCurrency) },
  }],
});

export const buildMetricTrendModel = (component: ComponentInstance, rows: readonly Row[], fields: readonly DatasetField[] = []) => {
  const labels = new Map(fields.map((field) => [field.key, field.label]));
  const timeDimension = fieldKeys(component, "timeDimension")[0] ?? "";
  const timeDimensionField = fields.find((field) => field.key === timeDimension);
  const measures = fieldKeys(component, "measure");
  const defaultAggregation = propString(component, "aggregation", "sum") as TrendAggregation;
  const granularity = propTimeGranularity(component);
  // “日期/维度” may deliberately use a normal category field. Never pass a
  // product name through Date.parse: strings containing model numbers can be
  // interpreted as dates by the browser and produce phantom axis labels.
  const isTimeDimension = timeDimensionField?.type === "date" || (
    timeDimensionField === undefined && /date|time|日期|时间|month|月份/i.test(timeDimension)
  );
  const periodSet = new Set<string>();
  const grouped = new Map<string, Map<string, number[]>>();

  measures.forEach((measure) => grouped.set(measure, new Map()));
  rows.forEach((row) => {
    const label = isTimeDimension ? periodLabel(row[timeDimension], granularity) : labelFor(row[timeDimension]);
    periodSet.add(label);
    measures.forEach((measure) => {
      const measureGroups = grouped.get(measure) ?? new Map<string, number[]>();
      const values = measureGroups.get(label) ?? [];
      values.push(numericValue(row, measure));
      measureGroups.set(label, values);
      grouped.set(measure, measureGroups);
    });
  });

  const periods = isTimeDimension ? [...periodSet].sort(compareLabels) : [...periodSet];
  const measureModels = measures.map((measure) => {
    const aggregation = metricAggregationFor(component, "measure", measure, defaultAggregation);
    const measureGroups = grouped.get(measure) ?? new Map<string, number[]>();
    const points = periods.map((label) => ({
      label,
      value: aggregateNumbers(measureGroups.get(label) ?? [], aggregation),
    }));
    // The trend is broken down by period/category, but the header represents
    // the whole current result set. Sum the displayed groups so the total is
    // consistent with every point currently visible on the X axis.
    const total = points.reduce((sum, point) => sum + point.value, 0);
    const latest = points.at(-1) ?? null;
    const previous = points.at(-2) ?? null;
    const peak = points.reduce<{ label: string; value: number } | null>((currentPeak, point) =>
      currentPeak === null || point.value > currentPeak.value ? point : currentPeak, null);
    const absolute = latest !== null && previous !== null ? latest.value - previous.value : null;
    const rate = absolute !== null && previous !== null && previous.value !== 0 ? absolute / previous.value : null;

    return {
      key: measure,
      label: labels.get(measure) ?? measure,
      isCurrency: isCurrencyMetric(measure, fields),
      points,
      total,
      latest,
      previous,
      change: absolute === null ? null : { absolute, rate },
      peak,
    };
  });

  return {
    timeLabel: labels.get(timeDimension) ?? timeDimension,
    isTimeDimension,
    periods,
    measures: measureModels,
    showSummary: propBoolean(component, "showSummary", true),
  };
};

export const buildMetricTrendOption = (
  component: ComponentInstance,
  model: ReturnType<typeof buildMetricTrendModel>,
  activeMeasureKey?: string,
) => {
  const activeMeasure = model.measures.find((measure) => measure.key === activeMeasureKey) ?? model.measures[0];
  const denseCategoryAxis = !model.isTimeDimension && model.periods.length > 6;
  return {
    color: ["#2f6fed"],
    grid: { left: 48, right: 20, top: 16, bottom: denseCategoryAxis ? 68 : 38 },
    tooltip: {
      trigger: "axis",
      triggerOn: "mousemove|click",
      axisPointer: { type: "line", lineStyle: { color: "#9bbcf5", type: "dashed" } },
      backgroundColor: "rgba(15, 35, 67, 0.94)",
      borderColor: "rgba(255, 255, 255, 0.16)",
      borderWidth: 1,
      padding: [8, 10],
      extraCssText: "border-radius: 8px; box-shadow: 0 8px 20px rgba(15, 35, 67, 0.18);",
      textStyle: { color: "#fff" },
    },
    xAxis: {
      type: "category",
      data: model.periods,
      axisLine: { lineStyle: { color: "#dbe3ee" } },
      axisTick: { show: false },
      axisLabel: {
        color: "#64748b",
        fontSize: 11,
        margin: 12,
        // A category is a data point. Keep every category visible instead of
        // silently dropping labels and forcing people to hunt through tooltips.
        interval: model.isTimeDimension ? "auto" : 0,
        rotate: denseCategoryAxis ? 24 : 0,
        hideOverlap: model.isTimeDimension,
        formatter: denseCategoryAxis ? (value: string) => compactCategoryLabel(value, 10) : undefined,
      },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#edf2f7", type: "solid" } },
      axisLabel: { color: "#64748b", fontSize: 11, margin: 10, formatter: activeMeasure?.isCurrency ? (value: number) => compactAxisValue(value, true) : undefined },
    },
    series: activeMeasure === undefined ? [] : [{
      type: "line",
      name: activeMeasure.label,
      data: activeMeasure.points.map((point) => point.value),
      smooth: true,
      symbol: "circle",
      symbolSize: 6,
      lineStyle: { color: "#2f6fed", width: 2.5 },
      itemStyle: { color: "#2f6fed", borderColor: "#fff", borderWidth: 2 },
      areaStyle: { color: "#2f6fed", opacity: 0.08 },
      emphasis: { focus: "series", scale: true },
      tooltip: { valueFormatter: (value: unknown) => formatMetricValue(Number(value), activeMeasure.isCurrency) },
    }],
  };
};

const piePalette = [
  "#4b7cf5", "#41c4d5", "#9587e7", "#ffb675", "#7e829f", "#3fc59d",
  "#2d83ca", "#f77aa2", "#138b78", "#d48368", "#5599ac", "#b68de9",
];

const formatPieValue = (value: number): string => {
  const absolute = Math.abs(value);
  if (absolute >= 100_000_000) return `${(value / 100_000_000).toFixed(1).replace(/\.0$/, "")}亿`;
  if (absolute >= 10_000) return `${(value / 10_000).toFixed(1).replace(/\.0$/, "")}万`;
  return formatMetricValue(value);
};

const pieItems = (rows: readonly Row[], dimension: string, measures: readonly string[]) => {
  const values = new Map<string, Map<string, number>>();
  rows.forEach((row) => {
    const label = labelFor(row[dimension]);
    const measureValues = values.get(label) ?? new Map<string, number>();
    measures.forEach((measure) => measureValues.set(measure, (measureValues.get(measure) ?? 0) + numericValue(row, measure)));
    values.set(label, measureValues);
  });
  const primaryMeasure = measures[0] ?? "";
  return [...values].map(([name, measureValues]) => ({
    name,
    value: measureValues.get(primaryMeasure) ?? 0,
    metricValues: Object.fromEntries(measures.map((measure) => [measure, measureValues.get(measure) ?? 0])),
  }));
};

const radarMaximum = (values: readonly number[]): number => {
  const maximum = Math.max(0, ...values);
  if (maximum === 0) return 1;
  const raw = maximum * 1.2;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  return Math.ceil(raw / magnitude) * magnitude;
};

export const buildRadarOption = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
) => {
  const dimension = fieldKeys(component, "dimension")[0] ?? "";
  const measures = fieldKeys(component, "measure");
  const labels = fieldLabelMap(fields);
  const items = pieItems(rows, dimension, measures);
  const maximum = radarMaximum(items.flatMap((item) => measures.map((measure) => item.metricValues[measure] ?? 0)));
  const colors = [propString(component, "color", piePalette[0]!), "#41c4d5", ...piePalette.slice(2)];

  return {
    color: colors,
    legend: {
      // Radar legends are rendered by the React shell so every selected
      // measure stays visible even though ECharts models them as data items.
      show: false,
    },
    tooltip: {
      trigger: "item",
      formatter: (params: { readonly seriesName?: string; readonly marker?: string; readonly value?: readonly unknown[] }) => {
        const values = Array.isArray(params.value) ? params.value : [];
        const measure = measures.find((fieldKey) => (labels.get(fieldKey) ?? fieldKey) === params.seriesName) ?? "";
        const lines = items.map((item, index) => `${item.name}：${withCurrencyUnit(formatPieValue(Number(values[index] ?? 0)), isCurrencyMetric(measure, fields))}`);
        return `${params.marker ?? ""}${params.seriesName ?? "指标"}<br/>${lines.join("<br/>")}`;
      },
    },
    radar: {
      center: ["50%", "57%"],
      radius: "64%",
      shape: "polygon",
      splitNumber: 5,
      indicator: items.map((item) => ({ name: item.name, max: maximum })),
      axisName: { color: "#5b6472", fontSize: 12 },
      axisLine: { lineStyle: { color: "#e3e8ef" } },
      splitLine: { lineStyle: { color: "#e7ebf0" } },
      splitArea: { areaStyle: { color: ["rgba(255, 255, 255, 0)"] } },
    },
    series: [{
      type: "radar",
      symbol: "none",
      data: measures.map((measure, index) => ({
        name: labels.get(measure) ?? measure,
        value: items.map((item) => item.metricValues[measure] ?? 0),
        lineStyle: { width: 1, color: colors[index % colors.length] },
        areaStyle: { color: colors[index % colors.length], opacity: 0.28 },
        itemStyle: { color: colors[index % colors.length] },
      })),
    }],
  };
};

export const buildTreemapOption = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
  activeMeasureKey?: string,
) => {
  const dimension = fieldKeys(component, "dimension")[0] ?? "";
  const measures = fieldKeys(component, "measure");
  const measure = measures.includes(activeMeasureKey ?? "") ? activeMeasureKey! : measures[0] ?? "";
  const labels = fieldLabelMap(fields);
  const items = pieItems(rows, dimension, [measure]);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const colors = [propString(component, "color", piePalette[0]!), ...piePalette.slice(1)];
  const data = items.map((item, index) => ({
    name: item.name,
    value: Math.max(0, item.value),
    percent: total === 0 ? 0 : item.value / total * 100,
    itemStyle: { color: colors[index % colors.length] },
  }));
  const measureLabel = (labels.get(measure) ?? measure) || "指标";
  const measureIsCurrency = isCurrencyMetric(measure, fields);

  return {
    tooltip: {
      formatter: (params: { readonly name?: string; readonly value?: unknown; readonly data?: { readonly percent?: number }; readonly marker?: string }) => {
        const value = typeof params.value === "number" ? params.value : Number(params.value);
        const percent = params.data?.percent ?? 0;
        return `${params.marker ?? ""}${params.name ?? "未分类"}<br/>${measureLabel}：${withCurrencyUnit(formatPieValue(Number.isFinite(value) ? value : 0), measureIsCurrency)}<br/>占比：${percent.toFixed(2)}%`;
      },
    },
    series: [{
      type: "treemap",
      data,
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      sort: "desc",
      visibleMin: 1,
      label: {
        show: true,
        color: "#ffffff",
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 20,
        formatter: (params: { readonly name?: string; readonly data?: { readonly percent?: number } }) => `${params.name ?? "未分类"}\n${(params.data?.percent ?? 0).toFixed(2)}%`,
      },
      upperLabel: { show: false },
      itemStyle: { borderColor: "#ffffff", borderWidth: 2, gapWidth: 2 },
      emphasis: { itemStyle: { borderColor: "#ffffff", borderWidth: 3 } },
    }],
  };
};

export const buildPieOption = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
) => {
  const dimension = fieldKeys(component, "dimension")[0] ?? "";
  const measures = fieldKeys(component, "measure");
  const primaryMeasure = measures[0] ?? "";
  const labels = fieldLabelMap(fields);
  const primaryMeasureLabel = labels.get(primaryMeasure) ?? (primaryMeasure || "指标");
  const primaryMeasureIsCurrency = isCurrencyMetric(primaryMeasure, fields);
  // The title check preserves existing dashboards created before rose became a
  // first-class component type. New charts always use the explicit type.
  const rose = component.type === "rose" || (component.type === "pie" && (component.title ?? "").includes("玫瑰"));
  // Keep title-based legacy ring charts readable while using a first-class
  // component type for all newly created ring charts.
  const donut = component.type === "donut" || (component.type === "pie" && (component.title ?? "").includes("环形"));
  const data = pieItems(rows, dimension, measures);
  return {
    color: [propString(component, "color", piePalette[0]!), ...piePalette.slice(1)],
    legend: {
      // 饼图和玫瑰图的图例是识别各扇区的必要信息，固定展示，
      // 也兼容此前保存的 showLegend: false 配置。
      show: true,
      type: "scroll",
      ...(donut
        ? { orient: "vertical", left: "58%", top: "center", bottom: undefined }
        : { orient: "horizontal", bottom: 0, left: "center" }),
      itemWidth: 8,
      itemHeight: 8,
      icon: "circle",
      textStyle: { color: "#475569", fontSize: 12 },
    },
    tooltip: {
      trigger: "item",
      formatter: (params: { readonly name?: string; readonly value?: unknown; readonly percent?: number; readonly marker?: string }) => {
        const percent = typeof params.percent === "number" && Number.isFinite(params.percent) ? params.percent : 0;
        const item = data.find((candidate) => candidate.name === params.name);
        const metricLines = measures.map((measure, index) => {
          const value = item?.metricValues[measure] ?? (index === 0 && typeof params.value === "number" ? params.value : 0);
          const suffix = index === 0 ? `（${percent.toFixed(2)}%）` : "";
          return `${labels.get(measure) ?? measure}：${withCurrencyUnit(formatPieValue(value), isCurrencyMetric(measure, fields))}${suffix}`;
        });
        return `${params.marker ?? ""}${params.name ?? "未分类"}<br/>${metricLines.length > 0 ? metricLines.join("<br/>") : `${primaryMeasureLabel}：0（0.00%）`}`;
      },
    },
    series: [{
      type: "pie",
      name: component.title ?? primaryMeasureLabel,
      roseType: rose ? "area" : undefined,
      startAngle: 90,
      clockwise: true,
      // 环形图以右侧 Legend 说明分类；其他饼图为底部 Legend 预留空间。
      radius: donut ? ["42%", "68%"] : rose ? ["0%", "58%"] : "56%",
      center: donut ? ["30%", "50%"] : ["50%", "44%"],
      avoidLabelOverlap: true,
      minShowLabelAngle: 2,
      label: {
        show: !donut,
        color: "#334155",
        fontSize: 12,
        formatter: (params: { readonly name?: string; readonly value?: unknown; readonly percent?: number }) => {
          const value = typeof params.value === "number" ? params.value : Number(params.value);
          const safeValue = Number.isFinite(value) ? value : 0;
          const percent = typeof params.percent === "number" && Number.isFinite(params.percent) ? params.percent : 0;
          return `${params.name ?? "未分类"} ${withCurrencyUnit(formatPieValue(safeValue), primaryMeasureIsCurrency)} (${percent.toFixed(2)}%)`;
        },
      },
      labelLine: { show: !donut, length: 12, length2: 8, lineStyle: { width: 1 } },
      itemStyle: { borderColor: "#fff", borderWidth: 1 },
      data,
    }],
  };
};

export const buildSunburstOption = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
  activeMeasureKey?: string,
) => {
  const dimension = fieldKeys(component, "dimension")[0] ?? "";
  const measures = fieldKeys(component, "measure");
  const activeMeasure = measures.includes(activeMeasureKey ?? "") ? activeMeasureKey! : measures[0] ?? "";
  const tooltipMeasures = fieldKeys(component, "tooltipMeasures");
  const displayedMetrics = [activeMeasure, ...tooltipMeasures].filter((measure, index, values) => measure.length > 0 && values.indexOf(measure) === index);
  const labels = fieldLabelMap(fields);
  const measureLabel = (labels.get(activeMeasure) ?? activeMeasure) || "指标";
  const items = pieItems(rows, dimension, displayedMetrics);
  const data = items.map(({ name, value }) => ({ name, value }));
  return {
    color: [propString(component, "color", piePalette[0]!), ...piePalette.slice(1)],
    // Sunburst legends are rendered by the React shell. ECharts' built-in
    // legend only recognises the series name for this chart type, so it cannot
    // reliably list the individual dimension values.
    legend: {
      show: false,
    },
    tooltip: {
      trigger: "item",
      formatter: (params: { readonly name?: string; readonly value?: unknown; readonly marker?: string }) => {
        const value = typeof params.value === "number" ? params.value : Number(params.value);
        const item = items.find((candidate) => candidate.name === params.name);
        const metricLines = displayedMetrics.map((measure, index) => {
          const metricValue = item?.metricValues[measure] ?? (index === 0 && Number.isFinite(value) ? value : 0);
          return `${labels.get(measure) ?? measure}：${withCurrencyUnit(formatPieValue(metricValue), isCurrencyMetric(measure, fields))}`;
        });
        return `${params.marker ?? ""}${params.name ?? "未分类"}<br/>${metricLines.length > 0 ? metricLines.join("<br/>") : `${measureLabel}：0`}`;
      },
    },
    series: [{
      type: "sunburst",
      name: component.title ?? "旭日图",
      data,
      radius: ["18%", "74%"],
      center: ["50%", "55%"],
      sort: undefined,
      nodeClick: false,
      label: {
        color: "#ffffff",
        fontSize: 12,
        rotate: "tangential",
        formatter: (params: { readonly name?: string }) => params.name ?? "未分类",
      },
      itemStyle: { borderColor: "#ffffff", borderWidth: 1 },
      emphasis: { focus: "ancestor" },
    }],
  };
};

export const buildRingBarOption = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
  rowsAreAggregated = false,
) => {
  const labels = fieldLabelMap(fields);
  const dimension = fieldKeys(component, "dimension")[0] ?? "";
  const measure = fieldKeys(component, "measure")[0] ?? "";
  const tooltipMeasures = fieldKeys(component, "tooltipMeasures");
  const metricKeys = [measure, ...tooltipMeasures].filter((fieldKey, index, values) => fieldKey.length > 0 && values.indexOf(fieldKey) === index);
  const dimensionField = fields.find((field) => field.key === dimension);
  const aggregation = propString(component, "aggregation", "sum") as CrosstabAggregation;
  const groupedRows = rowsAreAggregated
    ? rows
    : aggregateBarRows(
      rows,
      dimension,
      metricKeys,
      dimensionField,
      (fieldKey) => metricAggregationFor(
        component,
        fieldKey === measure ? "measure" : "tooltipMeasures",
        fieldKey,
        aggregation,
      ),
    );
  // The existing Top N binding is the explicit way to control ring density.
  // Do not silently drop dimensions when an author leaves Top N unset.
  const items = groupedRows.map((row) => ({
    name: labelFor(row[dimension]),
    value: numericValue(row, measure),
    tooltipValues: tooltipMeasures.map((fieldKey) => ({
      fieldKey,
      value: numericValue(row, fieldKey),
    })),
  }));
  const maximum = Math.max(0, ...items.map((item) => item.value));
  // Reserve a little of the circle so the largest value still has a visible
  // rounded end instead of looking like a completed donut.
  const maximumWithHeadroom = maximum === 0 ? 1 : maximum * 1.15;
  const measureLabel = labels.get(measure) ?? measure;
  const measureIsCurrency = isCurrencyMetric(measure, fields);
  const color = propString(component, "color", "#3478f6");
  // Keep adjacent tracks visually distinct, including when a chart has many
  // dimensions. The width compensates automatically below.
  const ringGap = items.length > 10 ? 3 : 4;
  const ringWidth = Math.min(8, Math.max(3.5, (66 - ringGap * Math.max(0, items.length - 1)) / Math.max(1, items.length)));
  const outerRadius = 82;
  return {
    color: [color],
    legend: {
      show: propBoolean(component, "showLegend", true),
      data: [measureLabel],
      top: 8,
      left: 12,
      icon: "roundRect",
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: "#5b6b82", fontSize: 12 },
    },
    tooltip: {
      trigger: "item",
      // The chart cards clip their contents. Rendering the tooltip at document
      // level keeps it above the canvas, configuration drawer, and other cards.
      appendToBody: true,
      renderMode: "html",
      extraCssText: "z-index:2147483647 !important;",
      formatter: (params: { readonly seriesIndex?: number }) => {
        const item = items[Math.floor((params.seriesIndex ?? 0) / 2)];
        if (item === undefined) return "";
        const share = maximum === 0 ? 0 : item.value / maximum * 100;
        return [
          item.name,
          `${measureLabel}：${formatMetricValue(item.value, measureIsCurrency)}`,
          ...item.tooltipValues.map((entry) => `${labels.get(entry.fieldKey) ?? entry.fieldKey}：${formatMetricValue(entry.value, isCurrencyMetric(entry.fieldKey, fields))}`),
          `相对最大值：${share.toFixed(1)}%`,
        ].join("<br/>");
      },
    },
    series: items.flatMap((item, index) => {
      const ringOuter = outerRadius - index * (ringWidth + ringGap);
      const ringInner = Math.max(0, ringOuter - ringWidth);
      const fillPercent = Math.max(0, Math.min(100, item.value / maximumWithHeadroom * 100));
      const radius = [`${ringInner}%`, `${ringOuter}%`];
      return [
        {
          type: "pie",
          radius,
          center: ["53%", "58%"],
          startAngle: 90,
          clockwise: true,
          label: { show: false },
          labelLine: { show: false },
          data: [{ name: item.name, value: 100, itemStyle: { color: "#edf4ff", borderRadius: 8 } }],
          z: 1,
        },
        {
          type: "pie",
          name: measureLabel,
          radius,
          center: ["53%", "58%"],
          startAngle: 90,
          clockwise: true,
          // A dense set of outer labels obscures the rings. The dimension and
          // all metric values belong in the hover tooltip instead.
          label: { show: false },
          labelLine: { show: false },
          data: [
            { name: item.name, value: fillPercent, itemStyle: { color, borderRadius: 8 } },
            // The transparent remainder sits over the track to create the
            // progress arc. It must remain interactive so hovering anywhere
            // on this ring shows the same dimension tooltip.
            { name: item.name, value: 100 - fillPercent, itemStyle: { color: "transparent" } },
          ],
          z: 2,
        },
      ];
    }),
  };
};

export const buildRankingOption = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
) => {
  const model = buildRankingModel(component, rows, fields);
  const showValue = component.props.showValue !== false;
  const color = propString(component, "color", "#1677ff");
  const isWeighted = model.rankingMode === "weighted";
  const isCurrency = !isWeighted && isCurrencyMetric(model.measures[0]?.key ?? "", fields);
  const values = model.items.map((item) => isWeighted ? item.score : item.values[0]?.value ?? 0);
  const maximum = Math.max(0, ...values);
  return {
    grid: { top: 12, right: showValue ? 64 : 20, bottom: 12, left: 88, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, formatter: (params: Parameters<typeof metricTooltipFormatter>[0]) => metricTooltipFormatter(params, isCurrency ? new Set([model.measures[0]?.label ?? "指标"]) : new Set()) },
    xAxis: {
      type: "value",
      min: 0,
      max: maximum === 0 ? 1 : Math.ceil(maximum * 1.08),
      axisLabel: { color: "#64748b", formatter: (value: number) => compactAxisValue(value, isCurrency) },
      splitLine: { lineStyle: { color: "#edf2f7" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: model.items.map((item, index) => `${index + 1}. ${item.label}`),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: "#334155", width: 78, overflow: "truncate" },
    },
    series: [{
      type: "bar",
      name: isWeighted ? "排名分值" : model.measures[0]?.label ?? "指标",
      data: values,
      barMaxWidth: 24,
      showBackground: true,
      backgroundStyle: { color: "#f1f5f9", borderRadius: 12 },
      itemStyle: { color, borderRadius: [0, 12, 12, 0] },
      label: showValue
        ? {
          show: true,
          position: "right",
          color: "#475569",
          formatter: ({ value }: { readonly value: unknown }) => formatMetricValue(Number(value), isCurrency),
        }
        : { show: false },
    }],
  };
};

export const buildRankingModel = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
) => {
  const labels = fieldLabelMap(fields);
  const dimension = fieldKeys(component, "dimension")[0] ?? "";
  const measures = fieldKeys(component, "measure").filter((key) =>
    !isLegacyRankingAuxiliaryField(key, labels.get(key) ?? key));
  const maxItems = Math.max(3, Math.min(20, Math.trunc(typeof component.props.maxItems === "number" ? component.props.maxItems : 10)));
  const aggregation = propString(component, "aggregation", "sum") as CrosstabAggregation;
  const rankingMode = component.props.rankingMode === "weighted" && measures.length > 1 ? "weighted" : "primary";
  const rawWeights = component.props.metricWeights;
  const configuredWeights = rawWeights !== null && typeof rawWeights === "object" && !Array.isArray(rawWeights)
    ? rawWeights as Readonly<Record<string, unknown>>
    : {};
  const grouped = new Map<string, number[][]>();

  for (const row of rows) {
    const label = labelFor(row[dimension]);
    const values = grouped.get(label) ?? measures.map(() => []);
    measures.forEach((measure, index) => values[index]?.push(numericValue(row, measure)));
    grouped.set(label, values);
  }

  const items = Array.from(grouped.entries()).map(([label, values]) => ({
    label,
    values: measures.map((measure, index) => ({ key: measure, value: aggregateNumbers(values[index] ?? [], aggregation) })),
  }));
  const baseWeights = measures.map((measure) => {
    const value = configuredWeights[measure];
    return typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : 100 / Math.max(1, measures.length);
  });
  const scoredItems = items.map((item) => {
    const score = rankingMode === "weighted"
      ? item.values.reduce((total, entry, index) => {
        const weight = baseWeights[index] ?? 0;
        return total + entry.value * weight / 100;
      }, 0)
      : item.values[0]?.value ?? 0;
    return { ...item, score };
  }).sort((left, right) => right.score - left.score || compareLabels(left.label, right.label)).slice(0, maxItems);
  const maximum = Math.max(0, ...scoredItems.map((item) => item.score));

  return {
    dimensionLabel: labels.get(dimension) ?? dimension,
    measures: measures.map((key) => ({ key, label: labels.get(key) ?? key })),
    rankingMode,
    items: scoredItems.map((item) => ({
      ...item,
      primaryRatio: maximum === 0 ? 0 : Math.max(0, Math.min(1, item.score / maximum)),
    })),
  };
};

export const buildKpiValue = (values: readonly number[], aggregation: Aggregation): number | null => {
  if (values.length === 0) return null;
  if (aggregation === "first") return values[0] ?? null;
  if (aggregation === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (aggregation === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (aggregation === "count") return values.length;
  if (aggregation === "max") return Math.max(...values);
  return Math.min(...values);
};

const aggregateKpiSlot = (
  component: ComponentInstance,
  rows: readonly Row[],
  slot: string,
  aggregation: Aggregation,
): number | null => {
  const field = fieldKeys(component, slot)[0];
  if (field === undefined) return null;
  return buildKpiValue(rows.flatMap((row) => typeof row[field] === "number" ? [row[field] as number] : []), aggregation);
};

export const buildKpiModel = (component: ComponentInstance, rows: readonly Row[]) => {
  const aggregation = propString(component, "aggregation", "first") as Aggregation;
  const value = aggregateKpiSlot(component, rows, "measure", aggregation);
  const targetValue = aggregateKpiSlot(component, rows, "target", aggregation);
  const comparisonValue = aggregateKpiSlot(component, rows, "comparison", aggregation);
  const delta = value !== null && comparisonValue !== null ? value - comparisonValue : null;

  return {
    value,
    target: targetValue === null
      ? null
      : { value: targetValue, progress: value !== null && targetValue !== 0 ? value / targetValue : null },
    comparison: comparisonValue === null || delta === null
      ? null
      : { value: comparisonValue, delta, rate: comparisonValue !== 0 ? delta / comparisonValue : null },
  };
};

const formatGaugeNumber = (value: number | null): string => value === null ? "—" : new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
}).format(value);

export const buildGaugeModel = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
) => {
  const aggregation = propString(component, "aggregation", "sum") as Aggregation;
  const decimals = typeof component.props.decimals === "number" ? component.props.decimals : 1;
  const measureKey = fieldKeys(component, "measure")[0];
  const targetKey = fieldKeys(component, "target")[0];
  const value = measureKey === undefined ? null : aggregateField(rows, measureKey, aggregation);
  const target = targetKey === undefined ? null : aggregateField(rows, targetKey, aggregation);
  const percentage = value !== null && target !== null && target > 0 ? value / target * 100 : null;
  const labels = fieldLabelMap(fields);

  return {
    label: labels.get(measureKey ?? "") ?? measureKey ?? "实际值",
    measureKey,
    targetKey,
    measureIsCurrency: isCurrencyMetric(measureKey ?? "", fields),
    targetIsCurrency: isCurrencyMetric(targetKey ?? "", fields),
    value,
    target,
    percentage,
    pointerValue: percentage === null ? 0 : Math.max(0, Math.min(100, percentage)),
    decimals: Math.max(0, Math.min(4, Math.trunc(decimals))),
  };
};

interface MetricChartGroup {
  readonly key: string;
  readonly label: string | undefined;
  readonly rows: readonly Row[];
}

const buildMetricChartGroups = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[],
): readonly MetricChartGroup[] => {
  const dimension = fieldKeys(component, "dimension")[0];
  if (dimension === undefined) return [{ key: "all", label: undefined, rows }];

  const dimensionField = fields.find((field) => field.key === dimension);
  const groups = new Map<string, Row[]>();
  rows.forEach((row) => {
    const label = dimensionField?.type === "date" ? periodLabel(row[dimension], "month") : labelFor(row[dimension]);
    const groupRows = groups.get(label) ?? [];
    groupRows.push(row);
    groups.set(label, groupRows);
  });

  return [...groups.entries()]
    .sort(([left], [right]) => compareLabels(left, right))
    .map(([label, groupRows]) => ({ key: label, label, rows: groupRows }));
};

export const buildGaugeModels = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
) => buildMetricChartGroups(component, rows, fields).map((group) => ({
  ...group,
  model: buildGaugeModel(component, group.rows, fields),
}));

export const buildGaugeOption = (
  component: ComponentInstance,
  model: ReturnType<typeof buildGaugeModel>,
  label = model.label,
) => {
  const percentage = model.percentage;
  const accent = percentage === null ? "#94a3b8" : percentage >= 100 ? "#16a34a" : percentage >= 85 ? "#1677ff" : percentage >= 60 ? "#d97706" : "#dc2626";
  const displayPercentage = percentage === null ? "—" : `${percentage.toFixed(model.decimals)}%`;
  const summary = `实际 ${withCurrencyUnit(formatGaugeNumber(model.value), model.measureIsCurrency)} / 目标 ${withCurrencyUnit(formatGaugeNumber(model.target), model.targetIsCurrency)}`;

  return {
    series: [{
      type: "gauge",
      startAngle: 210,
      endAngle: -30,
      min: 0,
      max: 100,
      splitNumber: 4,
      radius: "90%",
      axisLine: {
        lineStyle: {
          width: 16,
          color: [[0.6, "#fee2e2"], [0.85, "#fef3c7"], [1, "#dcfce7"]],
        },
      },
      progress: { show: true, roundCap: true, width: 16, itemStyle: { color: accent } },
      pointer: { show: true, length: "58%", width: 4, itemStyle: { color: accent } },
      anchor: { show: true, size: 10, itemStyle: { color: accent } },
      axisTick: { distance: -21, length: 5, lineStyle: { color: "#94a3b8", width: 1 } },
      splitLine: { distance: -23, length: 10, lineStyle: { color: "#64748b", width: 1 } },
      axisLabel: { distance: -38, color: "#64748b", fontSize: 10, formatter: (value: number) => `${value}%` },
      title: { show: true, offsetCenter: [0, "42%"], color: "#475569", fontSize: 12, fontWeight: 600 },
      detail: {
        valueAnimation: true,
        offsetCenter: [0, "8%"],
        formatter: `{value|${displayPercentage}}\n{summary|${summary}}`,
        rich: {
          value: { color: "#0f172a", fontSize: 26, fontWeight: 700, lineHeight: 34 },
          summary: { color: "#64748b", fontSize: 11, lineHeight: 18 },
        },
      },
      data: [{ value: model.pointerValue, name: label }],
    }],
  };
};

export const buildLiquidModel = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
) => {
  const labels = new Map(fields.map((field) => [field.key, field.label]));
  const aggregation = propString(component, "aggregation", "sum") as Aggregation;
  const measure = fieldKeys(component, "measure")[0];
  const target = fieldKeys(component, "target")[0];
  const value = aggregateKpiSlot(component, rows, "measure", aggregation);
  const targetValue = aggregateKpiSlot(component, rows, "target", aggregation);
  const percentage = value !== null && targetValue !== null && targetValue !== 0 ? value / targetValue * 100 : null;
  const decimals = typeof component.props.decimals === "number" ? component.props.decimals : 1;

  return {
    label: measure === undefined ? "实际值" : labels.get(measure) ?? measure,
    targetLabel: target === undefined ? "目标值" : labels.get(target) ?? target,
    measureKey: measure,
    targetKey: target,
    measureIsCurrency: isCurrencyMetric(measure ?? "", fields),
    targetIsCurrency: isCurrencyMetric(target ?? "", fields),
    value,
    target: targetValue,
    percentage,
    fillPercentage: percentage === null ? 0 : Math.max(0, Math.min(100, percentage)),
    decimals: Math.max(0, Math.min(4, Math.trunc(decimals))),
  };
};

export const buildLiquidModels = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
) => buildMetricChartGroups(component, rows, fields).map((group) => ({
  ...group,
  model: buildLiquidModel(component, group.rows, fields),
}));

export const buildMetricBreakdownModel = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
) => {
  const labels = new Map(fields.map((field) => [field.key, field.label]));
  const dimension = fieldKeys(component, "dimension")[0] ?? "";
  const measure = fieldKeys(component, "measure")[0] ?? "";
  const aggregation = propString(component, "aggregation", "sum") as CrosstabAggregation;
  const groups = new Map<string, number[]>();

  rows.forEach((row) => {
    const label = labelFor(row[dimension]);
    const values = groups.get(label) ?? [];
    values.push(numericValue(row, measure));
    groups.set(label, values);
  });

  const values = [...groups.entries()]
    .map(([label, groupValues]) => ({ key: label, label, value: aggregateNumbers(groupValues, aggregation) }))
    .sort((left, right) => right.value - left.value || compareLabels(left.label, right.label));
  const total = values.reduce((sum, item) => sum + item.value, 0);
  const maximum = values.reduce((max, item) => Math.max(max, item.value), 0);
  const decimals = typeof component.props.decimals === "number" ? component.props.decimals : 1;

  return {
    dimensionLabel: labels.get(dimension) ?? dimension,
    measureLabel: labels.get(measure) ?? measure,
    measureKey: measure,
    measureIsCurrency: isCurrencyMetric(measure, fields),
    total,
    decimals: Math.max(0, Math.min(4, Math.trunc(decimals))),
    items: values.map((item) => ({
      ...item,
      share: total === 0 ? null : item.value / total,
      barRatio: maximum === 0 ? 0 : Math.max(0, item.value / maximum),
    })),
  };
};

export const buildFlipNumberModel = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
) => {
  const labels = fieldLabelMap(fields);
  const aggregation = propString(component, "aggregation", "sum") as Aggregation;
  return {
    items: fieldKeys(component, "measure").map((measure) => ({
        key: measure,
        label: labels.get(measure) ?? measure,
        isCurrency: isCurrencyMetric(measure, fields),
        value: aggregateField(rows, measure, aggregation),
    })),
  };
};

export const buildProgressBarModel = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
) => {
  const labels = fieldLabelMap(fields);
  const configuredAggregation = propString(component, "aggregation", "sum");
  const aggregation: TrendAggregation = configuredAggregation === "avg" || configuredAggregation === "count" || configuredAggregation === "max" || configuredAggregation === "min"
    ? configuredAggregation
    : "sum";
  const measureKeys = fieldKeys(component, "measure");
  const legacyValueKeys = fieldKeys(component, "value");
  const measures = measureKeys.length > 0 ? measureKeys : legacyValueKeys;
  const targetKeys = fieldKeys(component, "target");
  const configuredPairs = Array.isArray(component.props.progressPairs)
    ? component.props.progressPairs.flatMap((pair) => {
      const measure = Array.isArray(pair)
        ? pair[0]
        : pair !== null && typeof pair === "object" ? (pair as { readonly measure?: unknown }).measure : undefined;
      const target = Array.isArray(pair)
        ? pair[1]
        : pair !== null && typeof pair === "object" ? (pair as { readonly target?: unknown }).target : undefined;
      if (typeof measure !== "string" || !measures.includes(measure)) return [];
      return [{ measure, ...(typeof target === "string" ? { target } : {}) }];
    })
    : [];
  const configuredMeasures = new Set(configuredPairs.map((pair) => pair.measure));
  const configuredTargets = new Set(configuredPairs.flatMap((pair) => pair.target === undefined ? [] : [pair.target]));
  const remainingMeasures = measures.filter((measure) => !configuredMeasures.has(measure));
  const remainingTargets = targetKeys.filter((target) => !configuredTargets.has(target));
  const progressPairs = [
    ...configuredPairs,
    ...remainingMeasures.map((measure, index) => ({
      measure,
      ...(remainingTargets[index] === undefined ? {} : { target: remainingTargets[index] }),
    })),
  ];

  return {
    items: progressPairs.map(({ measure, target: targetKey }) => {
      const value = aggregateField(rows, measure, metricAggregationFor(component, "measure", measure, aggregation));
      const target = targetKey === undefined
        ? value
        : aggregateField(rows, targetKey, metricAggregationFor(component, "target", targetKey, "max"));
      return {
        key: measure,
        label: labels.get(measure) ?? measure,
        isCurrency: isCurrencyMetric(measure, fields),
        targetIsCurrency: isCurrencyMetric(targetKey ?? "", fields),
        value,
        target,
        progress: value !== null && target !== null && target !== 0 ? value / target : null,
      };
    }),
  };
};

export const buildTargetProgressModel = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
) => {
  const labels = fieldLabelMap(fields);
  const dimension = fieldKeys(component, "dimension")[0] ?? "";
  const measure = fieldKeys(component, "measure")[0] ?? "";
  const target = fieldKeys(component, "target")[0] ?? "";
  const dimensionField = fields.find((field) => field.key === dimension);
  const aggregation = propString(component, "aggregation", "sum") as CrosstabAggregation;
  const groups = new Map<string, Row[]>();

  rows.forEach((row) => {
    const label = lineDimensionLabel(row[dimension], dimensionField);
    const group = groups.get(label);
    if (group === undefined) groups.set(label, [row]);
    else group.push(row);
  });

  return {
    dimensionLabel: labels.get(dimension) ?? dimension,
    measureLabel: labels.get(measure) ?? measure,
    targetLabel: labels.get(target) ?? target,
    measureKey: measure,
    targetKey: target,
    measureIsCurrency: isCurrencyMetric(measure, fields),
    targetIsCurrency: isCurrencyMetric(target, fields),
    items: [...groups.entries()].map(([label, groupRows]) => {
      const value = aggregateNumbers(
        groupRows.map((row) => numericValue(row, measure)),
        metricAggregationFor(component, "measure", measure, aggregation),
      );
      const targetValue = aggregateNumbers(
        groupRows.map((row) => numericValue(row, target)),
        // A target is repeated on every detail row for the same dimension. Use
        // the shared target once by default; authors can still explicitly
        // choose another aggregation on the target binding when needed.
        metricAggregationFor(component, "target", target, "max"),
      );
      return {
        key: label,
        label,
        value,
        target: targetValue,
        progress: targetValue > 0 ? value / targetValue : null,
      };
    }),
  };
};

const fieldLabelMap = (fields: readonly DatasetField[]): Map<string, string> =>
  new Map(fields.map((field) => [field.key, field.label]));

const aggregateField = (
  rows: readonly Row[],
  field: string,
  aggregation: Aggregation,
): number | null => buildKpiValue(rows.flatMap((row) => typeof row[field] === "number" ? [row[field] as number] : []), aggregation);

export const buildKpiBoardModel = (
  component: ComponentInstance,
  rows: readonly Row[],
  fields: readonly DatasetField[] = [],
) => {
  const dimension = fieldKeys(component, "dimension")[0];
  const measureKeys = fieldKeys(component, "measure");
  const measure = measureKeys[0];
  if (dimension === undefined || measure === undefined) return null;

  const labels = fieldLabelMap(fields);
  const dimensionField = fields.find((field) => field.key === dimension);
  const aggregation = propString(component, "aggregation", "first") as Aggregation;
  const grouped = new Map<string, Row[]>();
  rows.forEach((row) => {
    const label = dimensionField?.type === "date" ? periodLabel(row[dimension], "month") : labelFor(row[dimension]);
    const groupRows = grouped.get(label) ?? [];
    groupRows.push(row);
    grouped.set(label, groupRows);
  });

  const metricKeys = [
    ...measureKeys.slice(1),
    ...fieldKeys(component, "target"),
    ...fieldKeys(component, "comparison"),
    ...fieldKeys(component, "secondaryMeasures"),
  ].filter((key, index, all) => key !== measure && all.indexOf(key) === index);

  return {
    dimensionLabel: labels.get(dimension) ?? dimension,
    measureLabel: labels.get(measure) ?? measure,
    measureKey: measure,
    groups: [...grouped.entries()]
      .sort(([left], [right]) => compareLabels(left, right))
      .map(([label, groupRows]) => ({
        label,
        value: aggregateField(groupRows, measure, aggregation),
        metrics: metricKeys.map((key) => ({
          key,
          label: labels.get(key) ?? key,
          isCurrency: isCurrencyMetric(key, fields),
          value: aggregateField(groupRows, key, aggregation),
        })),
      })),
  };
};

export const buildTableModel = (component: ComponentInstance, rows: readonly Row[], fields: readonly DatasetField[] = []) => {
  const labels = new Map(fields.map((field) => [field.key, field.label]));
  return {
    columns: fieldKeys(component, "columns").map((key) => ({ key, label: labels.get(key) ?? key })),
    rows: rows.slice(0, 100),
  };
};

export const buildCrosstabModel = (component: ComponentInstance, rows: readonly Row[], fields: readonly DatasetField[] = []) => {
  const labels = new Map(fields.map((field) => [field.key, field.label]));
  const rowDimension = fieldKeys(component, "rowDimension")[0] ?? "";
  const columnDimension = fieldKeys(component, "columnDimension")[0] ?? "";
  const measure = fieldKeys(component, "measure")[0] ?? "";
  const aggregation = propString(component, "aggregation", "sum") as CrosstabAggregation;
  const rowLabels: string[] = [];
  const columnLabels: string[] = [];
  const cells = new Map<string, Map<string, CrosstabCellAccumulator>>();

  rows.forEach((row) => {
    const rowLabel = labelFor(row[rowDimension]);
    const columnLabel = labelFor(row[columnDimension]);
    const value = numericValue(row, measure);
    if (!rowLabels.includes(rowLabel)) rowLabels.push(rowLabel);
    if (!columnLabels.includes(columnLabel)) columnLabels.push(columnLabel);
    const rowMap = cells.get(rowLabel) ?? new Map<string, CrosstabCellAccumulator>();
    const cell = rowMap.get(columnLabel) ?? { values: [] };
    cell.values.push(value);
    rowMap.set(columnLabel, cell);
    cells.set(rowLabel, rowMap);
  });

  const crosstabRows = rowLabels.map((rowLabel) => {
    const rowMap = cells.get(rowLabel);
    const values = columnLabels.map((columnLabel) => aggregateNumbers(rowMap?.get(columnLabel)?.values ?? [], aggregation));
    const sourceValues = [...(rowMap?.values() ?? [])].flatMap((cell) => cell.values);
    return {
      label: rowLabel,
      values,
      total: aggregateNumbers(sourceValues, aggregation),
    };
  });

  const columnTotals = columnLabels.map((columnLabel) => {
    const sourceValues = rowLabels.flatMap((rowLabel) => cells.get(rowLabel)?.get(columnLabel)?.values ?? []);
    return aggregateNumbers(sourceValues, aggregation);
  });
  const grandValues = rowLabels.flatMap((rowLabel) => [...(cells.get(rowLabel)?.values() ?? [])].flatMap((cell) => cell.values));

  return {
    rowHeader: labels.get(rowDimension) ?? rowDimension,
    columnHeader: labels.get(columnDimension) ?? columnDimension,
    measureLabel: labels.get(measure) ?? measure,
    measureKey: measure,
    measureIsCurrency: isCurrencyMetric(measure, fields),
    columns: columnLabels.map((label) => ({ key: label, label })),
    rows: crosstabRows,
    columnTotals,
    grandTotal: aggregateNumbers(grandValues, aggregation),
    showTotals: propBoolean(component, "showTotals", true),
  };
};

export const buildHeatmapModel = (component: ComponentInstance, rows: readonly Row[], fields: readonly DatasetField[] = []) => {
  const labels = new Map(fields.map((field) => [field.key, field.label]));
  const rowDimension = fieldKeys(component, "rowDimension")[0] ?? "";
  const columnDimension = fieldKeys(component, "columnDimension")[0] ?? "";
  const measure = fieldKeys(component, "measure")[0] ?? "";
  const aggregation = propString(component, "aggregation", "sum") as HeatmapAggregation;
  const rowLabels: string[] = [];
  const columnLabels: string[] = [];
  const cells = new Map<string, Map<string, number[]>>();

  rows.forEach((row) => {
    const rowLabel = labelFor(row[rowDimension]);
    const columnLabel = labelFor(row[columnDimension]);
    const value = numericValue(row, measure);
    if (!rowLabels.includes(rowLabel)) rowLabels.push(rowLabel);
    if (!columnLabels.includes(columnLabel)) columnLabels.push(columnLabel);
    const rowMap = cells.get(rowLabel) ?? new Map<string, number[]>();
    const values = rowMap.get(columnLabel) ?? [];
    values.push(value);
    rowMap.set(columnLabel, values);
    cells.set(rowLabel, rowMap);
  });

  const aggregatedRows = rowLabels.map((rowLabel) => ({
    label: rowLabel,
    rawValues: columnLabels.map((columnLabel) => aggregateNumbers(cells.get(rowLabel)?.get(columnLabel) ?? [], aggregation)),
  }));
  const allValues = aggregatedRows.flatMap((row) => row.rawValues);
  const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 0;
  const spread = maxValue - minValue;
  const heatmapRows = aggregatedRows.map((row) => ({
    label: row.label,
    cells: row.rawValues.map<HeatmapCell>((value, index) => ({
      columnKey: columnLabels[index] ?? String(index),
      columnLabel: columnLabels[index] ?? String(index),
      value,
      intensity: spread === 0 ? (value > 0 ? 1 : 0) : (value - minValue) / spread,
    })),
  }));

  return {
    rowHeader: labels.get(rowDimension) ?? rowDimension,
    columnHeader: labels.get(columnDimension) ?? columnDimension,
    measureLabel: labels.get(measure) ?? measure,
    measureKey: measure,
    measureIsCurrency: isCurrencyMetric(measure, fields),
    columns: columnLabels.map((label) => ({ key: label, label })),
    rows: heatmapRows,
    minValue,
    maxValue,
    showValues: propBoolean(component, "showValues", true),
  };
};

export const buildMultidimensionalModel = (component: ComponentInstance, rows: readonly Row[], fields: readonly DatasetField[] = []) => {
  const labels = new Map(fields.map((field) => [field.key, field.label]));
  const dateDimension = fieldKeys(component, "dateDimension")[0] ?? "";
  const dimensions = fieldKeys(component, "dimensions");
  const measures = fieldKeys(component, "measures");
  const aggregation = propString(component, "aggregation", "sum") as MultidimensionalAggregation;
  const granularity = propTimeGranularity(component);
  const groups = new Map<string, { dimensions: string[]; valuesByMeasure: Map<string, number[]> }>();

  rows.forEach((row) => {
    const dimensionValues = [
      ...(dateDimension.length > 0 ? [periodLabel(row[dateDimension], granularity)] : []),
      ...dimensions.map((dimension) => labelFor(row[dimension])),
    ];
    const key = dimensionValues.join("\u0000");
    const group = groups.get(key) ?? { dimensions: dimensionValues, valuesByMeasure: new Map<string, number[]>() };
    measures.forEach((measure) => {
      const values = group.valuesByMeasure.get(measure) ?? [];
      values.push(numericValue(row, measure));
      group.valuesByMeasure.set(measure, values);
    });
    groups.set(key, group);
  });

  const analysisRows = [...groups.entries()].map(([key, group]) => ({
    key,
    dimensions: group.dimensions,
    values: measures.map((measure) => aggregateNumbers(group.valuesByMeasure.get(measure) ?? [], aggregation)),
  }));

  return {
    dimensions: [
      ...(dateDimension.length > 0 ? [{ key: dateDimension, label: labels.get(dateDimension) ?? dateDimension }] : []),
      ...dimensions.map((key) => ({ key, label: labels.get(key) ?? key })),
    ],
    measures: measures.map((key) => ({ key, label: labels.get(key) ?? key, isCurrency: isCurrencyMetric(key, fields) })),
    rows: analysisRows,
    totals: measures.map((measure) => aggregateNumbers(rows.map((row) => numericValue(row, measure)), aggregation)),
    showTotals: propBoolean(component, "showTotals", true),
  };
};

export const componentFieldKeys = fieldKeys;
