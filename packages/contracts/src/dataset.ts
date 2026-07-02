import { z } from "zod";

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
});

export type DatasetField = z.infer<typeof DatasetField>;

export const QueryParameter = z.object({
  key: nonEmptyString,
  label: nonEmptyString,
  type: fieldType,
  required: z.boolean(),
});

export type QueryParameter = z.infer<typeof QueryParameter>;

export const Dataset = z
  .object({
    id: nonEmptyString,
    name: nonEmptyString,
    fields: z.array(DatasetField),
    parameters: z.array(QueryParameter),
    schemaVersion: nonEmptyString,
  })
  .superRefine((dataset, context) => {
    addDuplicateKeyIssues(dataset.fields, "fields", context);
    addDuplicateKeyIssues(dataset.parameters, "parameters", context);
  });

export type Dataset = z.infer<typeof Dataset>;

export const DatasetQueryResult = z
  .object({
    columns: z.array(DatasetField),
    rows: z.array(z.record(z.string(), z.unknown())).max(10_000),
    total: z.number().int().nonnegative().optional(),
    sampledAt: z.iso.datetime(),
  })
  .superRefine((result, context) => {
    addDuplicateKeyIssues(result.columns, "columns", context);
  });

export type DatasetQueryResult = z.infer<typeof DatasetQueryResult>;
