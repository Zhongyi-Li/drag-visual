import type { CalculatedMetric, DataBinding, DatasetAggregationRequest, DatasetField, DatasetQueryResult, MetricAggregation } from "@drag-visual/contracts";

type Row = DatasetQueryResult["rows"][number];

const metricSlotKeys = new Set(["measure", "measures", "barMeasure", "lineMeasure", "target", "comparison", "secondaryMeasures", "tooltipMeasures"]);

const slotBindings = (binding: DataBinding): readonly { readonly fieldKey: string }[] => (
  Object.entries(binding.slots)
    .filter(([slot]) => metricSlotKeys.has(slot))
    .flatMap(([, value]) => Array.isArray(value) ? value : [value])
);

export const calculatedMetricsForBinding = (binding: DataBinding | undefined): readonly CalculatedMetric[] => binding?.calculatedMetrics ?? [];

export const calculatedMetricFields = (
  fields: readonly DatasetField[],
  binding: DataBinding | undefined,
): readonly DatasetField[] => {
  const metrics = calculatedMetricsForBinding(binding);
  if (metrics.length === 0) return fields;
  const known = new Set(fields.map((field) => field.key));
  return [
    ...fields,
    ...metrics.filter((metric) => !known.has(metric.id)).map((metric) => ({
      key: metric.id,
      label: metric.name,
      type: "number" as const,
      nullable: true,
    })),
  ];
};

/** References needed by calculations that are actually used in one of the chart's metric slots. */
export const activeCalculatedMetricReferences = (
  binding: DataBinding | undefined,
): readonly { readonly fieldKey: string; readonly aggregation: MetricAggregation }[] => {
  if (binding === undefined) return [];
  const selectedMetricIds = new Set(slotBindings(binding).map((item) => item.fieldKey));
  const seen = new Map<string, MetricAggregation>();
  calculatedMetricsForBinding(binding)
    .filter((metric) => selectedMetricIds.has(metric.id))
    .flatMap((metric) => metric.tokens)
    .forEach((token) => {
      if (token.kind !== "metric") return;
      // The dataset aggregation API returns one result column per source
      // field. Keep the first configured aggregation if a formula repeats it.
      if (!seen.has(token.reference.fieldKey)) seen.set(token.reference.fieldKey, token.reference.aggregation);
    });
  return Array.from(seen, ([fieldKey, aggregation]) => ({ fieldKey, aggregation }));
};

export const hasActiveCalculatedMetrics = (binding: DataBinding | undefined): boolean => activeCalculatedMetricReferences(binding).length > 0;

const aggregateNumbers = (values: readonly number[], aggregation: MetricAggregation): number => {
  if (aggregation === "sum") return values.reduce((total, value) => total + value, 0);
  if (aggregation === "avg") return values.reduce((total, value) => total + value, 0) / values.length;
  if (aggregation === "count") return values.length;
  if (aggregation === "max") return Math.max(...values);
  return Math.min(...values);
};

/** Mirrors the dataset aggregation contract for browser-stored imports. */
export const aggregateLocalRows = (
  rows: readonly Row[],
  aggregation: DatasetAggregationRequest,
): readonly Row[] => {
  const groups = new Map<string, Row[]>();
  rows.forEach((row) => {
    const values = aggregation.groupBy.map((fieldKey) => row[fieldKey] ?? null);
    const key = JSON.stringify(values);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  });
  return Array.from(groups.values(), (group) => {
    const first = group[0] ?? {};
    const aggregate = Object.fromEntries(aggregation.groupBy.map((fieldKey) => [fieldKey, first[fieldKey] ?? null])) as Row;
    aggregation.measures.forEach((measure) => {
      const values = group.flatMap((row) => {
        const source = row[measure.fieldKey];
        const numeric: number = typeof source === "number" ? source : Number(source);
        return Number.isFinite(numeric) ? [numeric] : [];
      });
      aggregate[measure.fieldKey] = values.length === 0 ? null : aggregateNumbers(values, measure.aggregation);
    });
    return aggregate;
  });
};

const precedence: Readonly<Record<"+" | "-" | "*" | "/", number>> = { "+": 1, "-": 1, "*": 2, "/": 2 };

const evaluate = (metric: CalculatedMetric, row: Row): number | null => {
  const values: Array<number | "+" | "-" | "*" | "/"> = [];
  const operators: Array<"+" | "-" | "*" | "/" | "("> = [];
  const apply = () => {
    const operator = operators.pop();
    const right = values.pop();
    const left = values.pop();
    if (operator === undefined || operator === "(" || typeof left !== "number" || typeof right !== "number") return false;
    if (operator === "+") values.push(left + right);
    if (operator === "-") values.push(left - right);
    if (operator === "*") values.push(left * right);
    if (operator === "/") values.push(right === 0 ? (metric.divideByZero === "zero" ? 0 : Number.NaN) : left / right);
    return true;
  };

  for (const token of metric.tokens) {
    if (token.kind === "metric") {
      const value = row[token.reference.fieldKey];
      const numeric = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(numeric)) return null;
      values.push(numeric);
      continue;
    }
    if (token.value === "(") {
      operators.push("(");
      continue;
    }
    if (token.value === ")") {
      while (operators.length > 0 && operators.at(-1) !== "(") if (!apply()) return null;
      if (operators.pop() !== "(") return null;
      continue;
    }
    while (operators.length > 0 && operators.at(-1) !== "(" && precedence[operators.at(-1) as "+" | "-" | "*" | "/"] >= precedence[token.value]) {
      if (!apply()) return null;
    }
    operators.push(token.value);
  }
  while (operators.length > 0) if (!apply()) return null;
  const result = values[0];
  return values.length === 1 && typeof result === "number" && Number.isFinite(result) ? result : null;
};

/** Evaluates all component-scoped calculated metrics against already-aggregated rows. */
export const applyCalculatedMetrics = (
  rows: readonly Row[],
  binding: DataBinding | undefined,
): readonly Row[] => {
  const metrics = calculatedMetricsForBinding(binding);
  if (metrics.length === 0) return rows;
  return rows.map((row) => Object.assign({}, row, Object.fromEntries(metrics.map((metric) => {
    const value = evaluate(metric, row);
    // Chart engines consume percentage points (28.6) rather than ratios
    // (0.286), matching their numeric axes and the user's selected display format.
    return [metric.id, value === null || metric.format !== "percent" ? value : value * 100];
  }))));
};
