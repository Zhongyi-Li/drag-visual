import type { ChartJumpRule } from "@drag-visual/contracts";

import { appPath } from "../../app/appPath.js";

export type ChartJumpFilterValues = Readonly<Record<string, string>>;

const chartJumpTargetParameter = "jumpTarget";

const filterValue = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim().length === 0 ? undefined : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return undefined;
};

/** Turns the selected chart row into values accepted by target global filters. */
export const chartJumpFilterValues = (rule: ChartJumpRule, row: Readonly<Record<string, unknown>>): ChartJumpFilterValues => {
  const values: Record<string, string> = {};
  for (const mapping of rule.parameterMappings) {
    const value = filterValue(row[mapping.sourceFieldKey]);
    if (value !== undefined) values[mapping.targetFilterId] = value;
  }
  return values;
};

/** Builds an application-relative target URL, including mapped global-filter values. */
export const chartJumpHref = (
  rule: ChartJumpRule,
  row: Readonly<Record<string, unknown>>,
  mode: "preview" | "published",
): string => {
  const path = appPath(`${mode === "preview" ? "preview" : "view"}/${rule.targetDashboardId}`);
  const url = new URL(path, "https://zhbi.local");
  const filters = chartJumpFilterValues(rule, row);
  if (Object.keys(filters).length > 0) url.searchParams.set("jumpFilters", JSON.stringify(filters));
  if (rule.targetPosition === "component" && rule.targetComponentId !== undefined) url.searchParams.set(chartJumpTargetParameter, rule.targetComponentId);
  return `${url.pathname}${url.search}`;
};

/** Reads the optional component anchor configured for a chart jump. */
export const chartJumpTargetFromSearch = (search: string): string | undefined => {
  const candidate = new URLSearchParams(search).get(chartJumpTargetParameter);
  return candidate === null || candidate.trim().length === 0 ? undefined : candidate;
};

/** A stable DOM id for components that may receive a chart-jump scroll target. */
export const chartJumpTargetElementId = (componentId: string): string => `chart-jump-target-${componentId}`;

/** Reads only scalar values from a chart-jump URL; invalid links safely fall back to defaults. */
export const chartJumpFiltersFromSearch = (search: string): ChartJumpFilterValues => {
  const raw = new URLSearchParams(search).get("jumpFilters");
  if (raw === null) return {};
  try {
    const candidate: unknown = JSON.parse(raw);
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) return {};
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(candidate)) {
      const parsed = filterValue(value);
      if (parsed !== undefined) values[key] = parsed;
    }
    return values;
  } catch {
    return {};
  }
};
