import { DashboardGlobalFilterConfig, DatasetFilter, QueryFilterControl, type DashboardGlobalFilterConfig as DashboardGlobalFilterConfigValue, type DatasetFilter as DatasetFilterValue, type QueryFilterControl as QueryFilterControlValue } from "@drag-visual/contracts";

export type DashboardGlobalFilterValues = Readonly<Record<string, unknown>>;
/** Accept legacy saved filters that predate the explicit operator field. */
export type DashboardGlobalFilters = readonly (Omit<DashboardGlobalFilterConfigValue, "operator"> & { readonly operator?: DashboardGlobalFilterConfigValue["operator"] })[];

type HeaderComponent = { readonly props: Readonly<Record<string, unknown>> };
type TargetComponent = { readonly id: string };
type QueryFilterOwner = { readonly props?: Readonly<Record<string, unknown>> };

const dateRangeValue = (value: unknown): { start: string; end: string } | undefined => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return typeof record.start === "string" && typeof record.end === "string" ? { start: record.start, end: record.end } : undefined;
};

export const dashboardGlobalFilters = (header: HeaderComponent | undefined): DashboardGlobalFilterConfigValue[] => {
  const parsed = DashboardGlobalFilterConfig.array().safeParse(header?.props.globalFilters);
  return parsed.success ? parsed.data : [];
};

const parsedQueryFilterControls = (value: unknown): QueryFilterControlValue[] => {
  const parsed = QueryFilterControl.array().max(6).safeParse(value);
  return parsed.success ? parsed.data : [];
};

export const activeQueryFilters = (controls: readonly QueryFilterControlValue[]): DatasetFilterValue[] => controls.flatMap((control) => {
  if (control.kind === "fieldText" && control.value.trim().length === 0) return [];
  if (control.kind === "fieldValue" && control.values.every((value) => typeof value === "string" && value.trim().length === 0)) return [];
  const parsed = DatasetFilter.safeParse(control);
  return parsed.success ? [parsed.data] : [];
});

const isEmptyValue = (value: unknown): boolean => value === null || value === undefined || (typeof value === "string" && value.trim().length === 0);

const calendarDateForFilter = (value: unknown, timezone: "Asia/Shanghai"): string | undefined => {
  if (typeof value !== "string") return undefined;
  const raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/.test(raw)) return raw.slice(0, 10);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  const parts = new Intl.DateTimeFormat("en", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  return parts.year && parts.month && parts.day ? `${parts.year}-${parts.month}-${parts.day}` : undefined;
};

/** Saved filters configured directly on a chart. */
export const componentQueryFilters = (component: QueryFilterOwner): DatasetFilterValue[] =>
  activeQueryFilters(componentQueryFilterControls(component));

/** Saved chart controls, including empty values that a viewer can fill in. */
export const componentQueryFilterControls = (component: QueryFilterOwner): QueryFilterControlValue[] =>
  parsedQueryFilterControls(component.props?.queryFilters);

/** Saved filters inherited by each child chart in an analysis group. */
export const analysisGroupQueryFilters = (component: QueryFilterOwner): DatasetFilterValue[] =>
  activeQueryFilters(analysisGroupQueryFilterControls(component));

export const analysisGroupQueryFilterControls = (component: QueryFilterOwner): QueryFilterControlValue[] =>
  parsedQueryFilterControls(component.props?.queryFilters);

export const defaultDashboardGlobalFilterValues = (header: HeaderComponent | undefined): DashboardGlobalFilterValues => {
  const dateRange = header?.props.dateRange;
  const fallback = typeof header?.props.date === "string" ? header.props.date : "";
  const defaults: Record<string, unknown> = {};
  for (const filter of dashboardGlobalFilters(header)) {
    if (filter.controlType !== "dateRange") {
      defaults[filter.id] = "";
      continue;
    }
    const range = dateRangeValue(dateRange);
    defaults[filter.id] = range ?? (fallback ? { start: fallback, end: fallback } : undefined);
  }
  return defaults;
};

export const filtersForComponent = (
  component: TargetComponent,
  filters: DashboardGlobalFilters,
  values: DashboardGlobalFilterValues,
): DatasetFilter[] => {
  const result: DatasetFilter[] = [];
  for (const filter of filters) {
  const target = filter.targets.find((candidate) => candidate.componentId === component.id);
  if (target === undefined) continue;
  const value = values[filter.id];
  const operator = filter.operator ?? (filter.controlType === "select" ? "equals" : "contains");
  if (operator === "isEmpty" || operator === "isNotEmpty") {
    result.push({ kind: "fieldNull", fieldKey: target.fieldKey, operator });
    continue;
  }
  if (filter.controlType === "dateRange") {
    const range = dateRangeValue(value);
    if (range !== undefined) result.push({ kind: "dateRange", fieldKey: target.fieldKey, start: range.start, end: range.end, timezone: "Asia/Shanghai" });
    continue;
  }
  if (typeof value !== "string" || value.trim().length === 0) continue;
  if (operator === "equals") result.push({ kind: "fieldValue", fieldKey: target.fieldKey, values: [value] });
  else result.push({ kind: "fieldText", fieldKey: target.fieldKey, operator: operator === "notContains" ? "notContains" : "contains", value: value.trim() });
  }
  return result;
};

/** A globally bound date range replaces the chart's own date control. */
export const hasDashboardGlobalDateTarget = (
  component: TargetComponent,
  filters: DashboardGlobalFilters,
): boolean => filters.some((filter) => filter.controlType === "dateRange" && filter.targets.some((target) => target.componentId === component.id));

export const filterRowsByDashboardFilters = <Row extends Readonly<Record<string, unknown>>>(rows: readonly Row[], filters: readonly DatasetFilter[]): readonly Row[] => rows.filter((row) => filters.every((filter) => {
  if (filter.kind === "dateRange") {
    const date = calendarDateForFilter(row[filter.fieldKey], filter.timezone);
    return date !== undefined && date >= filter.start && date <= filter.end;
  }
  if (filter.kind === "fieldValue") return filter.values.some((value) => String(row[filter.fieldKey]) === String(value));
  if (filter.kind === "fieldNull") {
    const empty = isEmptyValue(row[filter.fieldKey]);
    return filter.operator === "isEmpty" ? empty : !empty;
  }
  if (filter.kind === "numberComparison") {
    const value = row[filter.fieldKey];
    if (typeof value !== "number") return false;
    if (filter.operator === "eq") return value === filter.value;
    if (filter.operator === "neq") return value !== filter.value;
    if (filter.operator === "gt") return value > filter.value;
    if (filter.operator === "gte") return value >= filter.value;
    if (filter.operator === "lt") return value < filter.value;
    return value <= filter.value;
  }
  const value = row[filter.fieldKey];
  if (typeof value !== "string") return false;
  const contains = value.toLocaleLowerCase().includes(filter.value.toLocaleLowerCase());
  return filter.operator === "notContains" ? !contains : contains;
}));

/**
 * Re-check filters that target a chart dimension after a remote query. This
 * prevents an out-of-contract response or stale snapshot from reintroducing
 * categories outside the current selection, while avoiding filters for fields
 * that an aggregated result deliberately does not return.
 */
export const filterRowsByDimensionFilters = <Row extends Readonly<Record<string, unknown>>>(
  rows: readonly Row[],
  filters: readonly DatasetFilter[],
  dimensionFieldKeys: readonly string[],
): readonly Row[] => {
  const dimensions = new Set(dimensionFieldKeys);
  const applicableFilters = filters.filter((filter) => dimensions.has(filter.fieldKey));
  return applicableFilters.length === 0 ? rows : filterRowsByDashboardFilters(rows, applicableFilters);
};
