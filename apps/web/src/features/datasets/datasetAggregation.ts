import type { ComponentInstance, DatasetAggregation, DatasetQueryRequest, FieldBinding } from "@drag-visual/contracts";

const aggregationValues = new Set<DatasetAggregation>(["sum", "avg", "count", "max", "min"]);
const groupSlotKeys = new Set(["dimension", "dimensions", "timeDimension", "dateDimension", "rowDimension", "columnDimension"]);
const metricSlotKeys = new Set(["measure", "measures", "target", "comparison", "secondaryMeasures", "tooltipMeasures"]);

const asBindings = (value: FieldBinding | readonly FieldBinding[] | undefined): readonly FieldBinding[] =>
  value === undefined ? [] : Array.isArray(value) ? value as readonly FieldBinding[] : [value as FieldBinding];

const configuredAggregation = (value: unknown): DatasetAggregation | undefined =>
  typeof value === "string" && aggregationValues.has(value as DatasetAggregation)
    ? value as DatasetAggregation
    : undefined;

/**
 * Builds a source-neutral aggregation request. The server may execute it in
 * SQL; local Excel data deliberately stays on the existing raw-data path.
 */
export const buildDatasetAggregation = (
  component: ComponentInstance,
): DatasetQueryRequest["aggregation"] => {
  if (component.binding === undefined) return undefined;
  // Percentage bars predate the aggregation prop. Treat legacy instances as
  // sum-by-default so one edited metric does not force the remaining metrics
  // back onto the raw-data path.
  const defaultAggregation = configuredAggregation(component.props.aggregation)
    ?? (component.type === "percentBar" ? "sum" : undefined);
  const groupBy = Object.entries(component.binding.slots)
    .filter(([slotKey]) => groupSlotKeys.has(slotKey))
    .flatMap(([, value]) => asBindings(value).map((binding) => binding.fieldKey));
  const metricBindings = Object.entries(component.binding.slots)
    .filter(([slotKey]) => metricSlotKeys.has(slotKey))
    .flatMap(([, value]) => asBindings(value));
  if (metricBindings.length === 0) return undefined;
  const measures = metricBindings.map((binding) => ({
    fieldKey: binding.fieldKey,
    aggregation: binding.aggregation ?? defaultAggregation,
  }));
  if (measures.some((measure) => measure.aggregation === undefined)) return undefined;
  return {
    groupBy,
    measures: measures.map((measure) => ({
      fieldKey: measure.fieldKey,
      aggregation: measure.aggregation!,
    })),
  };
};
