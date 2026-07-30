import { z } from "zod";

import { safeJsonRecord } from "./safe-record.js";

const nonEmptyString = z.string().min(1);
const fieldType = z.enum(["string", "number", "date", "boolean"]);

const addDuplicateKeyIssues = (
  entries: ReadonlyArray<{ key: string }>,
  path: "fields" | "parameters" | "columns",
  context: z.RefinementCtx,
) => {
  const keys = new Set<string>();
  entries.forEach((entry, index) => {
    if (keys.has(entry.key)) {
      context.addIssue({
        code: "custom",
        message: `Duplicate ${path} key: ${entry.key}`,
        path: [path, index, "key"],
      });
    }
    keys.add(entry.key);
  });
};

export const DatasetField = z.object({
  key: nonEmptyString,
  label: nonEmptyString,
  type: fieldType,
  nullable: z.boolean(),
}).strict();

export type DatasetField = z.infer<typeof DatasetField>;

export const QueryParameter = z.object({
  key: nonEmptyString,
  label: nonEmptyString,
  type: fieldType,
  required: z.boolean(),
  runtime: z.boolean().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
}).strict();

export type QueryParameter = z.infer<typeof QueryParameter>;

export const DatasetSummary = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    schemaVersion: nonEmptyString,
  })
  .strict();

export type DatasetSummary = z.infer<typeof DatasetSummary>;

export const Dataset = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    fields: z.array(DatasetField),
    parameters: z.array(QueryParameter),
    schemaVersion: nonEmptyString,
  })
  .strict()
  .superRefine((dataset, context) => {
    addDuplicateKeyIssues(dataset.fields, "fields", context);
    addDuplicateKeyIssues(dataset.parameters, "parameters", context);
  });

export type Dataset = z.infer<typeof Dataset>;

export const DatasetAggregation = z.enum(["sum", "avg", "count", "max", "min"]);

export type DatasetAggregation = z.infer<typeof DatasetAggregation>;

export const DatasetAggregationMeasure = z.object({
  fieldKey: nonEmptyString,
  aggregation: DatasetAggregation,
}).strict();

export type DatasetAggregationMeasure = z.infer<typeof DatasetAggregationMeasure>;

export const DatasetAggregationRequest = z.object({
  groupBy: z.array(nonEmptyString).max(10),
  measures: z.array(DatasetAggregationMeasure).min(1).max(20),
}).strict().superRefine((aggregation, context) => {
  const groupBy = new Set<string>();
  aggregation.groupBy.forEach((fieldKey, index) => {
    if (groupBy.has(fieldKey)) {
      context.addIssue({ code: "custom", message: `Duplicate group field: ${fieldKey}`, path: ["groupBy", index] });
    }
    groupBy.add(fieldKey);
  });
  const measures = new Set<string>();
  aggregation.measures.forEach((measure, index) => {
    if (measures.has(measure.fieldKey)) {
      context.addIssue({ code: "custom", message: `Duplicate aggregation field: ${measure.fieldKey}`, path: ["measures", index, "fieldKey"] });
    }
    if (groupBy.has(measure.fieldKey)) {
      context.addIssue({ code: "custom", message: `Field cannot be both group and aggregation: ${measure.fieldKey}`, path: ["measures", index, "fieldKey"] });
    }
    measures.add(measure.fieldKey);
  });
});

export type DatasetAggregationRequest = z.infer<typeof DatasetAggregationRequest>;

export const DatasetQueryRequest = z
  .object({
    parameters: safeJsonRecord,
    aggregation: DatasetAggregationRequest.optional(),
  })
  .strict();

export type DatasetQueryRequest = z.infer<typeof DatasetQueryRequest>;

export const DatasetQueryResult = z
  .object({
    columns: z.array(DatasetField),
    rows: z.array(safeJsonRecord).max(10_000),
    total: z.number().int().nonnegative().optional(),
    // A business interface can return its own human-readable data name.
    // Keep it with the snapshot so UI consumers can label the dataset without
    // deriving a name from a technical endpoint or identifier.
    datasetName: nonEmptyString.optional(),
    sampledAt: z.iso.datetime(),
  })
  .strict()
  .superRefine((result, context) => {
    addDuplicateKeyIssues(result.columns, "columns", context);
  });

export type DatasetQueryResult = z.infer<typeof DatasetQueryResult>;

export const ErrorCode = z.enum([
  "DASHBOARD_SCHEMA_INVALID",
  "DASHBOARD_NOT_FOUND",
  "PUBLISHED_DASHBOARD_NOT_FOUND",
  "DASHBOARD_ID_MISMATCH",
  "DASHBOARD_VERSION_CONFLICT",
  "DATASET_QUERY_INVALID",
  "DATASET_NOT_FOUND",
  "DATASET_INVALID_RESPONSE",
  "DATASET_UPSTREAM_ERROR",
  "DATASET_TIMEOUT",
  "PUBLISH_FAILED",
  "INTERNAL_ERROR",
]);

export type ErrorCode = z.infer<typeof ErrorCode>;

export const ErrorResponse = z
  .object({
    code: ErrorCode,
    message: nonEmptyString,
  })
  .strict();

export type ErrorResponse = z.infer<typeof ErrorResponse>;
