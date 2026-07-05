import type { ComponentInstance } from "@drag-visual/contracts";

type Row = Readonly<Record<string, unknown>>;
type Aggregation = "first" | "sum" | "avg" | "max" | "min";

const fieldKeys = (component: ComponentInstance, slot: string): string[] => {
  const value = component.binding?.slots[slot];
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map((binding) => binding.fieldKey);
};

const propString = (component: ComponentInstance, key: string, fallback: string): string =>
  typeof component.props[key] === "string" ? component.props[key] : fallback;

const propBoolean = (component: ComponentInstance, key: string, fallback: boolean): boolean =>
  typeof component.props[key] === "boolean" ? component.props[key] : fallback;

const numericValue = (row: Row, key: string): number => {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};

export const buildBarOption = (component: ComponentInstance, rows: readonly Row[]) => {
  const dimension = fieldKeys(component, "dimension")[0] ?? "";
  const measure = fieldKeys(component, "measure")[0] ?? "";
  return {
    color: [propString(component, "color", "#1677ff")],
    legend: { show: propBoolean(component, "showLegend", true) },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: rows.map((row) => String(row[dimension] ?? "")) },
    yAxis: { type: "value" },
    series: [{ type: "bar", name: component.title ?? "指标", data: rows.map((row) => numericValue(row, measure)) }],
  };
};

export const buildLineOption = (component: ComponentInstance, rows: readonly Row[]) => {
  const dimension = fieldKeys(component, "dimension")[0] ?? "";
  const measures = fieldKeys(component, "measures");
  const area = propBoolean(component, "area", false);
  return {
    color: [propString(component, "color", "#1677ff")],
    legend: { show: propBoolean(component, "showLegend", true) },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: rows.map((row) => String(row[dimension] ?? "")) },
    yAxis: { type: "value" },
    series: measures.map((measure) => ({
      type: "line",
      name: measure,
      data: rows.map((row) => numericValue(row, measure)),
      areaStyle: area ? {} : undefined,
    })),
  };
};

export const buildPieOption = (component: ComponentInstance, rows: readonly Row[]) => {
  const dimension = fieldKeys(component, "dimension")[0] ?? "";
  const measure = fieldKeys(component, "measure")[0] ?? "";
  return {
    color: [propString(component, "color", "#1677ff")],
    legend: { show: propBoolean(component, "showLegend", true) },
    tooltip: { trigger: "item" },
    series: [{
      type: "pie",
      name: component.title ?? "指标",
      data: rows.map((row) => ({ name: String(row[dimension] ?? ""), value: numericValue(row, measure) })),
    }],
  };
};

export const buildKpiValue = (values: readonly number[], aggregation: Aggregation): number | null => {
  if (values.length === 0) return null;
  if (aggregation === "first") return values[0] ?? null;
  if (aggregation === "sum") return values.reduce((sum, value) => sum + value, 0);
  if (aggregation === "avg") return values.reduce((sum, value) => sum + value, 0) / values.length;
  if (aggregation === "max") return Math.max(...values);
  return Math.min(...values);
};

export const buildTableModel = (component: ComponentInstance, rows: readonly Row[]) => ({
  columns: fieldKeys(component, "columns"),
  rows: rows.slice(0, 100),
});

export const componentFieldKeys = fieldKeys;
