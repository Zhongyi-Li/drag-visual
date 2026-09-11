import type { ComponentInstance, ComponentType } from "@drag-visual/contracts";

export const DEFAULT_PIE_CATEGORY_LIMIT = 20;
export const MAX_PIE_CATEGORY_LIMIT = 5_000;

export const isPieCategoryChart = (type: ComponentType): boolean =>
  type === "pie" || type === "donut" || type === "rose";

const positiveInteger = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isInteger(value) && value > 0
    ? Math.min(value, MAX_PIE_CATEGORY_LIMIT)
    : undefined;

/** Draft value shown in the inspector. Legacy result caps intentionally become the new default. */
type CategoryLimitComponent = Pick<ComponentInstance, "type"> & {
  readonly props?: Readonly<Record<string, unknown>> | undefined;
};

type ResultLimitComponent = Pick<ComponentInstance, "type"> & {
  readonly binding?: {
    readonly slots: Readonly<Record<string, unknown>>;
  } | undefined;
};

const hasBoundSlot = (component: ResultLimitComponent, slotKey: string): boolean => {
  const value = component.binding?.slots[slotKey];
  return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null;
};

/**
 * Ordinary charts already expose Top N, so a second query-result count is
 * redundant. Only record tables keep the raw-result cap; pie charts replace
 * it with their dedicated maximum-category control.
 */
export const supportsChartResultLimit = (component: ResultLimitComponent): boolean =>
  component.type === "table"
    ? hasBoundSlot(component, "columns")
    : isPieCategoryChart(component.type) && hasBoundSlot(component, "dimension");

export const pieCategoryLimitDraft = (component: CategoryLimitComponent): number =>
  positiveInteger(component.props?.maxCategoryCount) ?? DEFAULT_PIE_CATEGORY_LIMIT;

/** Value used by the chart/query after the author clicks 更新. */
export const appliedPieCategoryLimit = (component: CategoryLimitComponent, allowDraftFallback = false): number =>
  positiveInteger(component.props?.appliedMaxCategoryCount)
  ?? (allowDraftFallback ? positiveInteger(component.props?.maxCategoryCount) : undefined)
  ?? DEFAULT_PIE_CATEGORY_LIMIT;
