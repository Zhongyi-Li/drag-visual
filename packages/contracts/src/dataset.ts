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

export const DatasetQueryRequest = z
  .object({
    parameters: safeJsonRecord,
  })
  .strict();

export type DatasetQueryRequest = z.infer<typeof DatasetQueryRequest>;

export const DatasetQueryResult = z
  .object({
    columns: z.array(DatasetField),
    rows: z.array(safeJsonRecord).max(10_000),
    total: z.number().int().nonnegative().optional(),
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
