import { z } from "zod";

import { safeJsonRecord, safeRecord } from "./safe-record.js";
import { DatasetFilter } from "./dataset.js";

const nonEmptyString = z.string().min(1);
const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const ComponentType = z.enum([
  "bar",
  "stackedBar",
  "percentBar",
  "horizontalBar",
  "barLine",
  "ringBar",
  "ranking",
  "crosstab",
  "trend",
  "multidimensional",
  "heatmap",
  "line",
  "area",
  "stackedArea",
  "percentArea",
  "pie",
  "donut",
  "rose",
  "sunburst",
  "radar",
  "treemap",
  "kpi",
  "kpiInsight",
  "metricTrend",
  "metricBreakdown",
  "flipNumber",
  "progressBar",
  "targetProgress",
  "progressIndicator",
  "gauge",
  "liquid",
  "table",
  "text",
  "dashboardHeader",
  "analysisGroup",
]);

export type ComponentType = z.infer<typeof ComponentType>;

export const GridItem = z.object({
  i: nonEmptyString,
  /** When present, this item is positioned in the named analysis group instead of the root canvas. */
  parentId: nonEmptyString.optional(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
}).strict();

export type GridItem = z.infer<typeof GridItem>;

export const MetricAggregation = z.enum(["sum", "avg", "count", "max", "min"]);

export type MetricAggregation = z.infer<typeof MetricAggregation>;

/** A single numeric source referenced by a calculated metric after aggregation. */
export const CalculatedMetricReference = z.object({
  fieldKey: nonEmptyString,
  aggregation: MetricAggregation,
}).strict();

export type CalculatedMetricReference = z.infer<typeof CalculatedMetricReference>;

export const CalculatedMetricToken = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("metric"), reference: CalculatedMetricReference }).strict(),
  z.object({ kind: z.literal("operator"), value: z.enum(["+", "-", "*", "/", "(", ")"]) }).strict(),
]);

export type CalculatedMetricToken = z.infer<typeof CalculatedMetricToken>;

/**
 * A component-scoped semantic metric. Its source fields are aggregated first,
 * then the saved expression is evaluated once for every chart group.
 */
export const CalculatedMetric = z.object({
  id: nonEmptyString,
  name: z.string().min(1).max(50),
  tokens: z.array(CalculatedMetricToken).min(1).max(30),
  format: z.enum(["number", "percent", "currency"]),
  decimals: z.number().int().min(0).max(4).default(2),
  divideByZero: z.enum(["dash", "zero"]).default("dash"),
}).strict();

export type CalculatedMetric = z.infer<typeof CalculatedMetric>;

export const FieldBinding = z.object({
  fieldKey: nonEmptyString,
  // Aggregation is intentionally kept on the individual metric binding. A component can
  // therefore combine, for example, sales by sum and order count by count.
  aggregation: MetricAggregation.optional(),
}).strict();

export type FieldBinding = z.infer<typeof FieldBinding>;

export const DateFilterPreset = z.enum([
  "all",
  "today",
  "yesterday",
  "last7Days",
  "last30Days",
  "thisMonth",
  "lastMonth",
  "thisYear",
]);

export type DateFilterPreset = z.infer<typeof DateFilterPreset>;

export const DateFilterControl = z
  .object({
    fieldKey: nonEmptyString,
    defaultPreset: DateFilterPreset,
    // A saved absolute default range. When absent, legacy preset behaviour is
    // retained so existing dashboards do not need a migration.
    defaultRange: z.object({
      start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).strict().optional(),
    allowCustom: z.boolean(),
    timezone: z.literal("Asia/Shanghai"),
  })
  .strict();

export type DateFilterControl = z.infer<typeof DateFilterControl>;

/** A source-free date control owned by an analysis group and mapped to its children. */
export const AnalysisGroupDateFilterTarget = z.object({
  componentId: nonEmptyString,
  fieldKey: nonEmptyString,
}).strict();

export type AnalysisGroupDateFilterTarget = z.infer<typeof AnalysisGroupDateFilterTarget>;

export const AnalysisGroupDateFilterControl = z.object({
  defaultPreset: DateFilterPreset,
  defaultRange: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).strict().nullable().default(null),
  allowCustom: z.boolean(),
  timezone: z.literal("Asia/Shanghai"),
  /** Each child chart supplies its own date field; the group has no dataset of its own. */
  targets: z.array(AnalysisGroupDateFilterTarget).max(99),
}).strict();

export type AnalysisGroupDateFilterControl = z.infer<typeof AnalysisGroupDateFilterControl>;

/** A dashboard-header filter is configured once and may target only selected charts. */
export const DashboardGlobalFilterControlType = z.enum(["dateRange", "select", "input"]);

export type DashboardGlobalFilterControlType = z.infer<typeof DashboardGlobalFilterControlType>;

/** The condition used by a non-date global filter. Empty checks are static and need no viewer value. */
export const DashboardGlobalFilterOperator = z.enum(["contains", "notContains", "equals", "isEmpty", "isNotEmpty"]);

export type DashboardGlobalFilterOperator = z.infer<typeof DashboardGlobalFilterOperator>;

export const DashboardGlobalFilterTarget = z.object({
  componentId: nonEmptyString,
  fieldKey: nonEmptyString,
}).strict();

export type DashboardGlobalFilterTarget = z.infer<typeof DashboardGlobalFilterTarget>;

export const DashboardGlobalFilterConfig = z.object({
  id: nonEmptyString,
  fieldKey: nonEmptyString,
  label: nonEmptyString,
  controlType: DashboardGlobalFilterControlType,
  // `null` keeps existing saved filters backward-compatible: their behavior is
  // derived from the control type (select = equals, input = contains).
  operator: DashboardGlobalFilterOperator.optional().transform((operator) => operator ?? null),
  targets: z.array(DashboardGlobalFilterTarget).max(99),
}).strict();

export type DashboardGlobalFilterConfig = z.infer<typeof DashboardGlobalFilterConfig>;

export const ComponentDisplayHintMode = z.enum(["auto", "custom", "hidden"]);

export type ComponentDisplayHintMode = z.infer<typeof ComponentDisplayHintMode>;

export const ComponentDisplayAnnotationPosition = z.enum(["topLeft", "topRight", "bottomRight", "bottomLeft"]);

export type ComponentDisplayAnnotationPosition = z.infer<typeof ComponentDisplayAnnotationPosition>;

export const ComponentDisplayAnnotation = z.object({
  position: ComponentDisplayAnnotationPosition,
  text: z.string().max(80),
}).strict();

export type ComponentDisplayAnnotation = z.infer<typeof ComponentDisplayAnnotation>;

/** Presentation-only helper text rendered above a chart's plotting area. */
export const ComponentDisplayAnnotations = z.object({
  annotations: z.array(ComponentDisplayAnnotation).max(4).default([]),
  /** Optional custom text rendered in the upper-right corner of a chart. */
  unitText: z.string().max(80).default(""),
  /** @deprecated Retained only so dashboards saved during the initial rollout remain readable. */
  series: z.object({
    mode: ComponentDisplayHintMode,
    text: z.string().max(180),
  }).strict().optional(),
  /** @deprecated Replaced by the explicit `unitText` input. */
  unit: z.object({
    mode: ComponentDisplayHintMode,
    text: z.string().max(80),
  }).strict().optional(),
}).strict();

export type ComponentDisplayAnnotations = z.infer<typeof ComponentDisplayAnnotations>;

export const DataBinding = z.object({
  datasetId: nonEmptyString,
  slots: safeRecord(z.union([FieldBinding, z.array(FieldBinding)])),
  /** Reusable calculated measures available to the current component's metric slots. */
  calculatedMetrics: z.array(CalculatedMetric).max(20).optional(),
  sort: z
    .object({
      fieldKey: nonEmptyString,
      direction: z.enum(["asc", "desc"]),
  })
  .strict()
  .optional(),
  limit: z.number().int().positive().max(10_000).optional(),
  /** A chart-scoped runtime control. Its selected value is never persisted in the dashboard. */
  dateFilter: DateFilterControl.optional(),
}).strict();

export type DataBinding = z.infer<typeof DataBinding>;

export const ComponentInstance = z.object({
  id: nonEmptyString,
  /** Optional owning analysis group. Root components omit this field. */
  parentId: nonEmptyString.optional(),
  type: ComponentType,
  title: z.string().optional(),
  /** Optional helper text rendered directly below a chart title. */
  subtitle: z.string().max(180).optional(),
  displayAnnotations: ComponentDisplayAnnotations.optional(),
  props: safeJsonRecord,
  binding: DataBinding.optional(),
}).strict();

export type ComponentInstance = z.infer<typeof ComponentInstance>;

export const DashboardSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.uuid(),
    name: z.string().min(1).max(100),
    theme: z
      .object({
        primaryColor: hexColor,
        backgroundColor: hexColor,
      })
      .strict(),
    layout: z.array(GridItem).max(100),
    components: z.array(ComponentInstance).max(100),
    datasets: z.array(
      z.object({
        datasetId: nonEmptyString,
        schemaVersion: nonEmptyString,
        parameters: safeJsonRecord,
      }).strict(),
    ).max(20),
    revision: z.number().int().positive(),
    updatedAt: z.iso.datetime(),
    /** Publication metadata is managed by the server and used by the workspace list. */
    publishedAt: z.iso.datetime().nullable().optional(),
  })
  .strict()
  .superRefine((dashboard, context) => {
    const datasetIds = new Set<string>();
    dashboard.datasets.forEach((dataset, index) => {
      if (datasetIds.has(dataset.datasetId)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate dataset ID: ${dataset.datasetId}`,
          path: ["datasets", index, "datasetId"],
        });
      }
      datasetIds.add(dataset.datasetId);
    });

    const componentIds = new Set<string>();
    dashboard.components.forEach((component, index) => {
      if (componentIds.has(component.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate component ID: ${component.id}`,
          path: ["components", index, "id"],
        });
      }
      componentIds.add(component.id);

      if (component.binding && !datasetIds.has(component.binding.datasetId)) {
        context.addIssue({
          code: "custom",
          message: `Component binding references undeclared dataset: ${component.binding.datasetId}`,
          path: ["components", index, "binding", "datasetId"],
        });
      }
    });

    dashboard.components.forEach((component, index) => {
      if (component.parentId === undefined) return;
      const parent = dashboard.components.find((candidate) => candidate.id === component.parentId);
      if (parent?.type !== "analysisGroup") {
        context.addIssue({ code: "custom", message: `Component parent must be an analysis group: ${component.parentId}`, path: ["components", index, "parentId"] });
      }
      if (component.parentId === component.id) {
        context.addIssue({ code: "custom", message: "Component cannot parent itself", path: ["components", index, "parentId"] });
      }
    });

    const layoutIds = new Set<string>();
    dashboard.layout.forEach((item, index) => {
      if (layoutIds.has(item.i)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate layout ID: ${item.i}`,
          path: ["layout", index, "i"],
        });
      }
      layoutIds.add(item.i);

      if (!componentIds.has(item.i)) {
        context.addIssue({
          code: "custom",
          message: `Layout item references missing component: ${item.i}`,
          path: ["layout", index, "i"],
        });
      }
      const component = dashboard.components.find((candidate) => candidate.id === item.i);
      if (component?.parentId !== item.parentId) {
        context.addIssue({ code: "custom", message: `Layout parent does not match component parent: ${item.i}`, path: ["layout", index, "parentId"] });
      }
    });

    dashboard.components.forEach((component, index) => {
      if (!layoutIds.has(component.id)) {
        context.addIssue({
          code: "custom",
          message: `Component has no matching layout item: ${component.id}`,
          path: ["components", index, "id"],
        });
      }
    });
  });

/** @deprecated Prefer DashboardSchema for runtime validation. */
export const Dashboard = DashboardSchema;

export type Dashboard = z.infer<typeof DashboardSchema>;
