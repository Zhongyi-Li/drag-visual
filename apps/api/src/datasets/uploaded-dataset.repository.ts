import {
  Dataset,
  DatasetFieldOptions,
  DatasetQueryResult,
  type DatasetAggregation,
  type DatasetField,
  type DatasetFilter,
  type DatasetQueryRequest,
  type DatasetQueryResult as DatasetQueryResultValue,
  type DatasetSummary,
} from "@drag-visual/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { Prisma, type UploadedDatasetRecord } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { DatasetInvalidResponseError } from "./dataset.errors.js";

type DatasetRow = DatasetQueryResultValue["rows"][number];

export interface CreateUploadedDatasetInput {
  id: string;
  ownerId: string;
  name: string;
  originalName: string;
  contentType: string;
  fileContent: Buffer;
  schema: Dataset;
  result: DatasetQueryResultValue;
}

export interface UploadedDataset {
  dataset: Dataset;
  result: DatasetQueryResultValue;
}

const asJson = (value: Dataset | DatasetQueryResultValue): Prisma.InputJsonObject =>
  value as unknown as Prisma.InputJsonObject;

const clone = <Value>(value: Value): Value => structuredClone(value);

const dateValue = (value: unknown): string | undefined =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : undefined;

const aggregationValue = (
  values: readonly (number | null)[],
  aggregation: DatasetAggregation,
): number | null => {
  const present = values.filter((value): value is number => value !== null);
  if (aggregation === "count") return present.length;
  if (present.length === 0) return null;
  if (aggregation === "sum") return present.reduce((total, value) => total + value, 0);
  if (aggregation === "avg") return present.reduce((total, value) => total + value, 0) / present.length;
  if (aggregation === "max") return Math.max(...present);
  return Math.min(...present);
};

const aggregationColumn = (field: DatasetField, aggregation: DatasetAggregation): DatasetField => ({
  ...field,
  type: "number",
  nullable: aggregation !== "count",
});

const filterRows = (
  rows: readonly DatasetRow[],
  filters: DatasetQueryRequest["filters"],
): DatasetRow[] => {
  if (filters === undefined || filters.length === 0) return rows.map(clone);
  const matches = (row: DatasetRow, filter: DatasetFilter): boolean => {
    if (filter.kind === "dateRange") {
      const value = dateValue(row[filter.fieldKey]);
      return value !== undefined && value >= filter.start && value <= filter.end;
    }
    if (filter.kind === "fieldValue") return filter.values.some((value) => String(row[filter.fieldKey]) === String(value));
    if (filter.kind === "fieldNull") {
      const value = row[filter.fieldKey];
      const empty = value === null || value === undefined || (typeof value === "string" && value.trim().length === 0);
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
  };
  return rows.filter((row) => filters.every((filter) => matches(row, filter))).map(clone);
};

const aggregateRows = (
  rows: readonly DatasetRow[],
  fields: readonly DatasetField[],
  aggregation: NonNullable<DatasetQueryRequest["aggregation"]>,
): Pick<DatasetQueryResultValue, "columns" | "rows" | "total"> => {
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
  const groupFields = aggregation.groupBy.map((fieldKey) => fieldsByKey.get(fieldKey));
  const measures = aggregation.measures.map((measure) => ({
    field: fieldsByKey.get(measure.fieldKey),
    aggregation: measure.aggregation,
  }));
  // DatasetService validates this before reaching a repository. Keeping this
  // check here protects the repository when it is used directly in tests or
  // from a future internal job.
  if (groupFields.some((field) => field === undefined) || measures.some(({ field }) => field?.type !== "number")) {
    throw new DatasetInvalidResponseError();
  }

  const resolvedGroups = groupFields as DatasetField[];
  const resolvedMeasures = measures as { field: DatasetField; aggregation: DatasetAggregation }[];
  const buckets = new Map<string, DatasetRow[]>();
  for (const row of rows) {
    const values = resolvedGroups.map((field) => row[field.key] ?? null);
    const key = JSON.stringify(values);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  const resultRows = Array.from(buckets.values(), (bucket): DatasetRow => {
    const first = bucket[0]!;
    const groupValues = resolvedGroups.map((field) => [field.key, first[field.key] ?? null]);
    const measureValues = resolvedMeasures.map(({ field, aggregation: operation }) => {
      const values = bucket.map((row) => {
        const value = row[field.key];
        return typeof value === "number" ? value : null;
      });
      return [field.key, aggregationValue(values, operation)];
    });
    return Object.fromEntries([...groupValues, ...measureValues]);
  });

  return {
    columns: [
      ...resolvedGroups,
      ...resolvedMeasures.map(({ field, aggregation: operation }) => aggregationColumn(field, operation)),
    ],
    rows: resultRows,
    total: resultRows.length,
  };
};

/**
 * Reads user-owned file datasets from PostgreSQL. The file bytes remain in the
 * record for audit/re-import purposes; chart reads deliberately use the
 * contract-validated parsed snapshot so queries do not need to parse a file.
 */
@Injectable()
export class UploadedDatasetRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(ownerId?: string): Promise<readonly DatasetSummary[]> {
    if (!ownerId) return [];
    const records = await this.prisma.uploadedDatasetRecord.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, schema: true },
    });
    return records.flatMap((record) => {
      const schema = Dataset.safeParse(record.schema);
      return schema.success
        ? [{ id: record.id, name: record.name, schemaVersion: schema.data.schemaVersion }]
        : [];
    });
  }

  async create(input: CreateUploadedDatasetInput): Promise<UploadedDataset> {
    const record = await this.prisma.uploadedDatasetRecord.create({
      data: {
        id: input.id,
        ownerId: input.ownerId,
        name: input.name,
        originalName: input.originalName,
        contentType: input.contentType,
        sizeBytes: input.fileContent.byteLength,
        fileContent: new Uint8Array(input.fileContent),
        schema: asJson(input.schema),
        queryResult: asJson(input.result),
      },
    });
    return this.toUploadedDataset(record);
  }

  async getSchema(id: string, ownerId?: string): Promise<Dataset | null> {
    if (!ownerId) return null;
    const record = await this.prisma.uploadedDatasetRecord.findFirst({
      where: { id, ownerId },
      select: { id: true, name: true, schema: true },
    });
    if (!record) return null;
    const parsed = Dataset.safeParse(record.schema);
    if (!parsed.success) throw new DatasetInvalidResponseError();
    // The database record is authoritative for identity/name. This prevents a
    // stale JSON snapshot from exposing or impersonating another dataset id.
    return Dataset.parse({ ...parsed.data, id: record.id, name: record.name });
  }

  async query(
    id: string,
    request: DatasetQueryRequest,
    ownerId?: string,
  ): Promise<DatasetQueryResultValue | null> {
    if (!ownerId) return null;
    const record = await this.prisma.uploadedDatasetRecord.findFirst({
      where: { id, ownerId },
      select: { id: true, name: true, schema: true, queryResult: true },
    });
    if (!record) return null;

    const schema = Dataset.safeParse(record.schema);
    const snapshot = DatasetQueryResult.safeParse(record.queryResult);
    if (!schema.success || !snapshot.success) throw new DatasetInvalidResponseError();

    const fields = schema.data.fields;
    const rows = filterRows(snapshot.data.rows, request.filters);
    const data = request.aggregation === undefined
      ? { columns: fields, rows, total: rows.length }
      : aggregateRows(rows, fields, request.aggregation);

    return DatasetQueryResult.parse({
      ...data,
      datasetName: record.name,
      sampledAt: new Date().toISOString(),
    });
  }

  async getFieldOptions(id: string, fieldKey: string, search: string | undefined, limit: number, ownerId?: string): Promise<DatasetFieldOptions | null> {
    if (!ownerId) return null;
    const record = await this.prisma.uploadedDatasetRecord.findFirst({
      where: { id, ownerId },
      select: { schema: true, queryResult: true },
    });
    if (!record) return null;
    const schema = Dataset.safeParse(record.schema);
    const snapshot = DatasetQueryResult.safeParse(record.queryResult);
    if (!schema.success || !snapshot.success) throw new DatasetInvalidResponseError();
    if (!schema.data.fields.some((field) => field.key === fieldKey)) return null;
    const keyword = search?.toLocaleLowerCase();
    const options = [...new Set(snapshot.data.rows
      .map((row) => row[fieldKey])
      .filter((value): value is string | boolean => typeof value === "string" || typeof value === "boolean")
      .map(String)
      .filter((value) => keyword === undefined || value.toLocaleLowerCase().includes(keyword)))]
      .sort((left, right) => left.localeCompare(right, "zh-CN"))
      .slice(0, limit);
    return DatasetFieldOptions.parse({ options });
  }

  private toUploadedDataset(record: UploadedDatasetRecord): UploadedDataset {
    const dataset = Dataset.parse(record.schema);
    const result = DatasetQueryResult.parse(record.queryResult);
    return { dataset, result };
  }
}
