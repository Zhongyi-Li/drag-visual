import type { ComponentInstance, DatasetAggregation, DatasetQueryRequest, FieldBinding } from "@drag-visual/contracts";

import { activeCalculatedMetricReferences, calculatedMetricsForBinding } from "./calculatedMetrics.js";

const aggregationValues = new Set<DatasetAggregation>(["sum", "avg", "count", "max", "min"]);
const groupSlotKeys = new Set(["dimension", "dimensions", "timeDimension", "dateDimension", "rowDimension", "columnDimension"]);
const metricSlotKeys = new Set(["measure", "measures", "barMeasure", "lineMeasure", "target", "comparison", "secondaryMeasures", "tooltipMeasures"]);

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
  const calculatedMetricIds = new Set(calculatedMetricsForBinding(component.binding).map((metric) => metric.id));
  const metricBindings = Object.entries(component.binding.slots)
    .filter(([slotKey]) => metricSlotKeys.has(slotKey))
    .flatMap(([, value]) => asBindings(value))
    .filter((binding) => !calculatedMetricIds.has(binding.fieldKey));
  const calculatedReferences = activeCalculatedMetricReferences(component.binding);
  if (metricBindings.length === 0 && calculatedReferences.length === 0) return undefined;
  // The query contract identifies an aggregated value by its field key, so a
  // metric bound to more than one visual role (for example both column and
  // line) must only be requested once.
  const measures = [...metricBindings, ...calculatedReferences].reduce<Array<{ fieldKey: string; aggregation: DatasetAggregation | undefined }>>((result, binding) => {
    if (result.some((measure) => measure.fieldKey === binding.fieldKey)) return result;
    result.push({ fieldKey: binding.fieldKey, aggregation: binding.aggregation ?? defaultAggregation });
    return result;
  }, []);
  if (measures.some((measure) => measure.aggregation === undefined)) return undefined;
  return {
    groupBy,
    measures: measures.map((measure) => ({
      fieldKey: measure.fieldKey,
      aggregation: measure.aggregation!,
    })),
  };
};
