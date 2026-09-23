import {
  Dataset,
  DatasetCalculatedField,
  DatasetCombineConfig,
  type DatasetCombineStep,
  DatasetDraft,
  DatasetDraftUpdateRequest,
  DatasetDraftPreviewRequest,
  DatasetProcessingFilter,
  DatasetProcessingPublishResult,
  DatasetProcessingRecord,
  DatasetProcessingTask,
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
import { randomUUID } from "node:crypto";

import { Prisma, type UploadedDatasetRecord } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { DatasetInvalidResponseError, DatasetNameConflictError, DatasetQueryInvalidError } from "./dataset.errors.js";
import {
  ORDER_PROFIT_REPORT_DATASET_ID,
  OrderProfitReportDatasetRepository,
  RETAIL_ORDER_DATASET_ID,
  RetailOrderDatasetRepository,
  SG_STORAGE_DATASET_ID,
  SgStorageDatasetRepository,
  STORAGE_TURNOVER_DATASET_ID,
  StorageTurnoverDatasetRepository,
} from "./retail-order-dataset.repository.js";

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

const asJson = (value: unknown): Prisma.InputJsonObject =>
  value as unknown as Prisma.InputJsonObject;

const clone = <Value>(value: Value): Value => structuredClone(value);

const storedCalculatedFields = (value: unknown): DatasetCalculatedField[] => {
  const parsed = DatasetCalculatedField.array().safeParse(value ?? []);
  if (!parsed.success) throw new DatasetInvalidResponseError();
  return parsed.data;
};
const storedCombine = (value: unknown): DatasetCombineConfig | null => {
  if (value === null || value === undefined) return null;
  const parsed = DatasetCombineConfig.safeParse(value);
  if (!parsed.success) throw new DatasetInvalidResponseError();
  return parsed.data;
};
const combineSteps = (config: DatasetCombineConfig | null): readonly DatasetCombineStep[] => config === null ? [] : config.kind === "pipeline" ? config.steps : [config];
const combineKind = (config: DatasetCombineConfig | null): "join" | "union" | "pipeline" | null => {
  const steps = combineSteps(config);
  return steps.length === 0 ? null : steps.length === 1 ? steps[0]!.kind : "pipeline";
};
const storedFilters = (value: unknown): DatasetProcessingFilter[] => {
  const parsed = DatasetProcessingFilter.array().safeParse(value ?? []);
  if (!parsed.success) throw new DatasetInvalidResponseError();
  return parsed.data;
};
const storedSelectedFields = (value: unknown): string[] | null => {
  if (value === null || value === undefined) return null;
  const parsed = DatasetDraftUpdateRequest.shape.selectedFields.safeParse(value);
  if (!parsed.success) throw new DatasetInvalidResponseError();
  return parsed.data;
};

const calculatedColumns = (schema: Dataset, fields: readonly DatasetCalculatedField[]): DatasetField[] => {
  const known = new Map(schema.fields.map((field) => [field.key, field]));
  const ids = new Set<string>();
  fields.forEach((field) => {
    if (ids.has(field.id) || known.get(field.leftField)?.type !== "number" || known.get(field.rightField)?.type !== "number") {
      throw new DatasetQueryInvalidError();
    }
    ids.add(field.id);
    known.set(field.id, { key: field.id, label: field.label, type: "number", nullable: true });
  });
  return fields.map((field) => ({ key: field.id, label: field.label, type: "number" as const, nullable: true }));
};

const effectiveDataset = (schema: Dataset, fields: readonly DatasetCalculatedField[], publishedVersion: number): Dataset => Dataset.parse({
  ...schema,
  schemaVersion: fields.length === 0 ? schema.schemaVersion : `${schema.schemaVersion}-published-${publishedVersion}`,
  fields: [...schema.fields, ...calculatedColumns(schema, fields)],
});

const applyCalculatedFields = (result: DatasetQueryResultValue, schema: Dataset, fields: readonly DatasetCalculatedField[]): DatasetQueryResultValue => {
  if (fields.length === 0) return result;
  const columns = [...result.columns, ...calculatedColumns(schema, fields)];
  const numeric = (value: unknown): number | null => {
    if (value === null || value === undefined || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const rows = result.rows.map((row) => fields.reduce<DatasetRow>((nextRow, field) => {
    const left = numeric(nextRow[field.leftField]);
    const right = numeric(nextRow[field.rightField]);
    let value: number | null = null;
    if (left !== null && right !== null && !((field.operator === "/" || field.operator === "percent") && right === 0)) {
      if (field.operator === "+") value = left + right;
      else if (field.operator === "-") value = left - right;
      else if (field.operator === "*") value = left * right;
      else if (field.operator === "percent") value = (left / right) * 100;
      else value = left / right;
    }
    return { ...nextRow, [field.id]: value };
  }, { ...row }));
  return DatasetQueryResult.parse({ ...result, columns, rows });
};

const applyProcessingView = (
  result: DatasetQueryResultValue,
  schema: Dataset,
  filters: readonly DatasetProcessingFilter[],
  selectedFields: readonly string[] | null,
): DatasetQueryResultValue => {
  const fieldMap = new Map(schema.fields.map((field) => [field.key, field]));
  filters.forEach((filter) => { if (!fieldMap.has(filter.fieldKey)) throw new DatasetQueryInvalidError(); });
  const matches = (row: DatasetRow, filter: DatasetProcessingFilter): boolean => {
    const value = row[filter.fieldKey];
    const empty = value === null || value === undefined || (typeof value === "string" && value.trim() === "");
    if (filter.operator === "isEmpty") return empty;
    if (filter.operator === "isNotEmpty") return !empty;
    if (filter.operator === "contains") return typeof value === "string" && String(value).toLocaleLowerCase().includes(String(filter.value).toLocaleLowerCase());
    if (filter.operator === "eq") return String(value) === String(filter.value);
    if (filter.operator === "neq") return String(value) !== String(filter.value);
    const left = typeof value === "number" ? value : Number(value);
    const right = typeof filter.value === "number" ? filter.value : Number(filter.value);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (filter.operator === "gt") return left > right;
    if (filter.operator === "gte") return left >= right;
    if (filter.operator === "lt") return left < right;
    return left <= right;
  };
  const rows = result.rows.filter((row) => filters.every((filter) => matches(row, filter)));
  const keys = selectedFields === null ? schema.fields.map((field) => field.key) : selectedFields;
  if (new Set(keys).size !== keys.length || keys.some((key) => !fieldMap.has(key))) throw new DatasetQueryInvalidError();
  const columns = keys.map((key) => fieldMap.get(key)!);
  return DatasetQueryResult.parse({ ...result, columns, rows: rows.map((row) => Object.fromEntries(keys.map((key) => [key, row[key] ?? null]))), total: rows.length });
};

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
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RetailOrderDatasetRepository) private readonly retailOrders: RetailOrderDatasetRepository,
    @Inject(StorageTurnoverDatasetRepository) private readonly storageTurnover: StorageTurnoverDatasetRepository,
    @Inject(OrderProfitReportDatasetRepository) private readonly orderProfitReport: OrderProfitReportDatasetRepository,
    @Inject(SgStorageDatasetRepository) private readonly sgStorage: SgStorageDatasetRepository,
  ) {}

  async list(ownerId?: string): Promise<readonly DatasetSummary[]> {
    if (!ownerId) return [];
    const records = await this.prisma.uploadedDatasetRecord.findMany({
      where: { ownerId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, originalName: true, schema: true, queryResult: true, publishedCalculatedFields: true, publishedVersion: true, publishedCombine: true },
    });
    return records.flatMap((record) => {
      const schema = Dataset.safeParse(record.schema);
      return schema.success
        ? [{ id: record.id, name: record.name, sourceName: record.originalName, schemaVersion: effectiveDataset(schema.data, storedCalculatedFields(record.publishedCalculatedFields), record.publishedVersion).schemaVersion }]
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
        draftCalculatedFields: [],
        draftCombine: Prisma.JsonNull,
      },
    });
    return this.toUploadedDataset(record);
  }

  /** Deletes only a file dataset owned by the requesting user. */
  async delete(id: string, ownerId?: string): Promise<boolean> {
    if (!ownerId) return false;
    const result = await this.prisma.$transaction(async (transaction) => {
      const deleted = await transaction.uploadedDatasetRecord.deleteMany({
        where: { id, ownerId },
      });
      if (deleted.count > 0) {
        await transaction.datasetProcessingRecord.deleteMany({ where: { ownerId, resultDatasetId: id } });
      }
      return deleted;
    });
    return result.count > 0;
  }

  async getSchema(id: string, ownerId?: string): Promise<Dataset | null> {
    if (!ownerId) return null;
    const record = await this.prisma.uploadedDatasetRecord.findFirst({
      where: { id, ownerId },
      select: { id: true, name: true, schema: true, queryResult: true, publishedCalculatedFields: true, publishedVersion: true, publishedCombine: true },
    });
    if (!record) return null;
    const parsed = Dataset.safeParse(record.schema);
    if (!parsed.success) throw new DatasetInvalidResponseError();
    // The database record is authoritative for identity/name. This prevents a
    // stale JSON snapshot from exposing or impersonating another dataset id.
    const published = storedCalculatedFields(record.publishedCalculatedFields);
    const base = Dataset.parse({ ...parsed.data, id: record.id, name: record.name });
    const snapshot = DatasetQueryResult.safeParse(record.queryResult);
    if (!snapshot.success) throw new DatasetInvalidResponseError();
    const combined = await this.combineSnapshot(record.name, base, snapshot.data, storedCombine(record.publishedCombine), ownerId);
    return effectiveDataset(combined.dataset, published, record.publishedVersion);
  }

  async query(
    id: string,
    request: DatasetQueryRequest,
    ownerId?: string,
  ): Promise<DatasetQueryResultValue | null> {
    if (!ownerId) return null;
    const record = await this.prisma.uploadedDatasetRecord.findFirst({
      where: { id, ownerId },
      select: { id: true, name: true, schema: true, queryResult: true, publishedCalculatedFields: true, publishedVersion: true, publishedCombine: true },
    });
    if (!record) return null;

    const schema = Dataset.safeParse(record.schema);
    const snapshot = DatasetQueryResult.safeParse(record.queryResult);
    if (!schema.success || !snapshot.success) throw new DatasetInvalidResponseError();

    const published = storedCalculatedFields(record.publishedCalculatedFields);
    const combined = await this.combineSnapshot(record.name, schema.data, snapshot.data, storedCombine(record.publishedCombine), ownerId);
    const effective = effectiveDataset(combined.dataset, published, record.publishedVersion);
    const enriched = applyCalculatedFields(combined.result, combined.dataset, published);
    const fields = effective.fields;
    const rows = filterRows(enriched.rows, request.filters);
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

  async getDraft(id: string, ownerId?: string): Promise<DatasetDraft | null> {
    if (!ownerId) return null;
    const record = await this.prisma.uploadedDatasetRecord.findFirst({
      where: { id, ownerId },
      select: { id: true, name: true, schema: true, draftCalculatedFields: true, draftCombine: true, draftFilters: true, draftSelectedFields: true, draftVersion: true, publishedCalculatedFields: true, publishedCombine: true, publishedVersion: true, publishedAt: true },
    });
    if (!record) return null;
    const schema = Dataset.parse({ ...(Dataset.parse(record.schema)), id: record.id, name: record.name });
    const published = storedCalculatedFields(record.publishedCalculatedFields);
    const draft = storedCalculatedFields(record.draftCalculatedFields);
    return DatasetDraft.parse({
      dataset: effectiveDataset(schema, published, record.publishedVersion),
      calculatedFields: draft,
      combine: storedCombine(record.draftCombine),
      filters: storedFilters(record.draftFilters),
      selectedFields: storedSelectedFields(record.draftSelectedFields),
      version: record.draftVersion,
      publishedVersion: record.publishedVersion,
      publishedAt: record.publishedAt?.toISOString() ?? null,
    });
  }

  async updateDraft(id: string, ownerId: string, request: DatasetDraftUpdateRequest): Promise<DatasetDraft | null> {
    const current = await this.getDraft(id, ownerId);
    if (!current) return null;
    calculatedColumns(current.dataset, request.calculatedFields);
    await this.prisma.uploadedDatasetRecord.updateMany({ where: { id, ownerId }, data: { draftCalculatedFields: asJson(request.calculatedFields), draftCombine: request.combine ? asJson(request.combine) : Prisma.JsonNull, draftFilters: asJson(request.filters), draftSelectedFields: request.selectedFields ? asJson(request.selectedFields) : Prisma.JsonNull, draftVersion: { increment: 1 } } });
    return this.getDraft(id, ownerId);
  }

  async listProcessingTasks(ownerId: string): Promise<readonly DatasetProcessingTask[]> {
    const records = await this.prisma.uploadedDatasetRecord.findMany({
      where: { ownerId, OR: [{ draftVersion: { gt: 0 } }, { publishedVersion: { gt: 0 } }] },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, draftCalculatedFields: true, draftCombine: true, draftVersion: true, publishedVersion: true, publishedAt: true, updatedAt: true },
    });
    return records.map((record) => DatasetProcessingTask.parse({
      id: record.id,
      sourceDatasetId: record.id,
      sourceDatasetName: record.name,
      status: record.draftVersion > 0 ? "draft" : "published",
      draftVersion: record.draftVersion,
      publishedVersion: record.publishedVersion,
      calculatedFieldCount: storedCalculatedFields(record.draftCalculatedFields).length,
      combineKind: combineKind(storedCombine(record.draftCombine)),
      updatedAt: record.updatedAt.toISOString(),
      publishedAt: record.publishedAt?.toISOString() ?? null,
    }));
  }

  async listProcessingRecords(ownerId: string): Promise<readonly DatasetProcessingRecord[]> {
    const records = await this.prisma.datasetProcessingRecord.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return records.map((record) => DatasetProcessingRecord.parse({
      id: record.id,
      sourceDatasetId: record.sourceDatasetId,
      sourceDatasetName: record.sourceDatasetName,
      resultDatasetId: record.resultDatasetId,
      resultDatasetName: record.resultDatasetName,
      status: record.status,
      version: record.version,
      calculatedFieldCount: record.calculatedFieldCount,
      combineKind: record.combineKind,
      rowCount: record.rowCount,
      errorMessage: record.errorMessage,
      createdAt: record.createdAt.toISOString(),
    }));
  }

  async publishDraft(id: string, ownerId: string, request: { name: string }): Promise<DatasetProcessingPublishResult | null> {
    const source = await this.prisma.uploadedDatasetRecord.findFirst({
      where: { id, ownerId },
      select: { id: true, name: true, originalName: true, schema: true, queryResult: true, draftCalculatedFields: true, draftCombine: true, draftFilters: true, draftSelectedFields: true, publishedVersion: true },
    });
    if (!source) return null;
    const parsedSchema = Dataset.safeParse(source.schema);
    const parsedSnapshot = DatasetQueryResult.safeParse(source.queryResult);
    if (!parsedSchema.success || !parsedSnapshot.success) throw new DatasetInvalidResponseError();
    const base = Dataset.parse({ ...parsedSchema.data, id: source.id, name: source.name });
    const calculatedFields = storedCalculatedFields(source.draftCalculatedFields);
    const combine = storedCombine(source.draftCombine);
    const filters = storedFilters(source.draftFilters);
    const selectedFields = storedSelectedFields(source.draftSelectedFields);
    const resultName = request.name.trim();
    const duplicate = await this.prisma.uploadedDatasetRecord.findFirst({
      where: { ownerId, name: { equals: resultName, mode: "insensitive" } },
      select: { id: true },
    });
    if (duplicate) throw new DatasetNameConflictError(resultName);
    const combined = await this.combineSnapshot(source.name, base, parsedSnapshot.data, combine, ownerId);
    const version = source.publishedVersion + 1;
    calculatedColumns(combined.dataset, calculatedFields);
    const processingSchema = effectiveDataset(combined.dataset, calculatedFields, version);
    const enriched = applyProcessingView(applyCalculatedFields(combined.result, combined.dataset, calculatedFields), processingSchema, filters, selectedFields);
    const resultId = `processed-${randomUUID()}`;
    const resultSchema = Dataset.parse({
      ...processingSchema,
      id: resultId,
      name: resultName,
      fields: enriched.columns,
      schemaVersion: `processed-${source.id}-v${version}`,
    });
    const resultSnapshot = DatasetQueryResult.parse({
      ...enriched,
      columns: resultSchema.fields,
      total: enriched.rows.length,
      datasetName: resultName,
      sampledAt: new Date().toISOString(),
    });
    const publishedAt = new Date();
    const recordId = `processing-${randomUUID()}`;
    await this.prisma.$transaction([
      this.prisma.uploadedDatasetRecord.create({
        data: {
          id: resultId,
          ownerId,
          name: resultName,
          originalName: `${source.name} · 加工结果`,
          contentType: "application/json",
          sizeBytes: 0,
          fileContent: new Uint8Array(),
          schema: asJson(resultSchema),
          queryResult: asJson(resultSnapshot),
          draftCalculatedFields: [],
          draftCombine: Prisma.JsonNull,
          draftFilters: [],
          draftSelectedFields: Prisma.JsonNull,
        },
      }),
      this.prisma.uploadedDatasetRecord.update({
        where: { id: source.id },
        data: {
          publishedCalculatedFields: [],
          publishedCombine: Prisma.JsonNull,
          publishedVersion: version,
          publishedAt,
          draftVersion: 0,
        },
      }),
      this.prisma.datasetProcessingRecord.create({
        data: {
          id: recordId,
          ownerId,
          sourceDatasetId: source.id,
          sourceDatasetName: source.name,
          resultDatasetId: resultId,
          resultDatasetName: resultName,
          status: "published",
          version,
          configuration: asJson({ calculatedFields, combine, filters, selectedFields }),
          calculatedFieldCount: calculatedFields.length,
          combineKind: combineKind(combine),
          rowCount: resultSnapshot.rows.length,
        },
      }),
    ]);
    const draft = await this.getDraft(id, ownerId);
    if (!draft) return null;
    return DatasetProcessingPublishResult.parse({
      draft,
      resultDataset: { id: resultId, name: resultName, sourceName: source.name, schemaVersion: resultSchema.schemaVersion },
      record: {
        id: recordId,
        sourceDatasetId: source.id,
        sourceDatasetName: source.name,
        resultDatasetId: resultId,
        resultDatasetName: resultName,
        status: "published",
        version,
        calculatedFieldCount: calculatedFields.length,
        combineKind: combineKind(combine),
        rowCount: resultSnapshot.rows.length,
        errorMessage: null,
        createdAt: publishedAt.toISOString(),
      },
    });
  }

  async previewDraft(id: string, ownerId: string, request: DatasetDraftPreviewRequest): Promise<DatasetQueryResultValue | null> {
    const record = await this.prisma.uploadedDatasetRecord.findFirst({ where: { id, ownerId }, select: { name: true, schema: true, queryResult: true } });
    if (!record) return null;
    const schema = Dataset.parse(record.schema);
    const snapshot = DatasetQueryResult.safeParse(record.queryResult);
    if (!snapshot.success) throw new DatasetInvalidResponseError();
    const combined = await this.combineSnapshot(record.name, schema, snapshot.data, request.combine, ownerId);
    const fields = storedCalculatedFields(request.calculatedFields);
    calculatedColumns(combined.dataset, fields);
    const enriched = applyProcessingView(applyCalculatedFields(combined.result, combined.dataset, fields), Dataset.parse({ ...combined.dataset, fields: [...combined.dataset.fields, ...calculatedColumns(combined.dataset, fields)] }), request.filters, request.selectedFields);
    return DatasetQueryResult.parse({ ...enriched, total: enriched.rows.length, datasetName: record.name, sampledAt: new Date().toISOString() });
  }

  private async combineSnapshot(name: string, base: Dataset, snapshot: DatasetQueryResultValue, config: DatasetCombineConfig | null, ownerId: string): Promise<{ dataset: Dataset; result: DatasetQueryResultValue }> {
    let currentDataset = base;
    let currentResult = snapshot;
    for (const [stepIndex, step] of combineSteps(config).entries()) {
      const source = await this.prisma.uploadedDatasetRecord.findFirst({ where: { id: step.sourceDatasetId, ownerId }, select: { name: true, schema: true, queryResult: true } });
      const platform = this.platformRepository(step.sourceDatasetId);
      const platformSchema = source ? null : await platform?.getSchema(step.sourceDatasetId);
      const platformResult = source ? null : await platform?.query(step.sourceDatasetId, { parameters: { limit: 5000 } });
      if (!source && (!platformSchema || !platformResult)) throw new DatasetQueryInvalidError();
      const right = source ? Dataset.parse(source.schema) : platformSchema!;
      const parsedRightResult = source ? DatasetQueryResult.safeParse(source.queryResult) : DatasetQueryResult.safeParse(platformResult);
      if (!parsedRightResult.success) throw new DatasetInvalidResponseError();
      const rightResult = parsedRightResult.data;
      const sourceName = source?.name ?? right.name;
      const warnings = [...(currentResult.warnings ?? []), ...(rightResult.warnings ?? [])];

      if (step.kind === "union") {
        const mappings = step.fieldMappings ?? currentDataset.fields.map((field) => ({ targetField: field.key, sourceField: field.key }));
        const targetKeys = new Set(mappings.map((mapping) => mapping.targetField));
        if (mappings.length !== currentDataset.fields.length || targetKeys.size !== mappings.length || currentDataset.fields.some((field) => !targetKeys.has(field.key))) throw new DatasetQueryInvalidError();
        const mappedSources = mappings.map((mapping) => {
          const target = currentDataset.fields.find((field) => field.key === mapping.targetField);
          const sourceField = right.fields.find((field) => field.key === mapping.sourceField);
          if (!target || !sourceField || target.type !== sourceField.type) throw new DatasetQueryInvalidError();
          return { target, sourceField };
        });
        const mappedRows = rightResult.rows.map((row) => Object.fromEntries(mappedSources.map(({ target, sourceField }) => [target.key, row[sourceField.key] ?? null])));
        currentResult = DatasetQueryResult.parse({ ...currentResult, rows: [...currentResult.rows, ...mappedRows].slice(0, 10000), total: Math.min(10000, currentResult.rows.length + mappedRows.length), warnings: warnings.length > 0 ? warnings : undefined });
        continue;
      }

      const conditions = [{ leftField: step.leftField, rightField: step.rightField }, ...(step.additionalConditions ?? [])];
      const pairs = conditions.map((condition) => {
        const left = currentDataset.fields.find((field) => field.key === condition.leftField);
        const rightField = right.fields.find((field) => field.key === condition.rightField);
        if (!left || !rightField || left.type !== rightField.type) throw new DatasetQueryInvalidError();
        return { left, rightField };
      });
      const outputSources = right.fields.filter((field) => step.selectedFields.includes(field.key));
      const usedKeys = new Set(currentDataset.fields.map((field) => field.key));
      const output = outputSources.map((field) => {
        let key = field.key;
        if (usedKeys.has(key)) {
          key = `joined_${stepIndex + 1}_${field.key}`;
          let suffix = 2;
          while (usedKeys.has(key)) key = `joined_${stepIndex + 1}_${field.key}_${suffix++}`;
        }
        usedKeys.add(key);
        return { ...field, nullable: step.joinType === "left" || step.joinType === "full" ? true : field.nullable, key, label: `${sourceName} · ${field.label}` };
      });
      const baseFields = step.joinType === "right" || step.joinType === "full" ? currentDataset.fields.map((field) => ({ ...field, nullable: true })) : currentDataset.fields;
      const dataset = Dataset.parse({ ...currentDataset, fields: [...baseFields, ...output], schemaVersion: `${currentDataset.schemaVersion}-combine-${stepIndex + 1}` });
      const joinKey = (row: DatasetRow, side: "left" | "right"): string | null => {
        const values = pairs.map(({ left, rightField }) => row[side === "left" ? left.key : rightField.key]);
        return values.some((value) => value === null || value === undefined) ? null : JSON.stringify(values.map((value) => `${typeof value}:${String(value)}`));
      };
      const rightValues = (row: DatasetRow): DatasetRow => Object.fromEntries(output.map((field, index) => [field.key, row[outputSources[index]!.key] ?? null]));
      const matches = new Map<string, DatasetRow[]>(); for (const row of rightResult.rows) { const key = joinKey(row, "right"); if (key === null) continue; const bucket = matches.get(key) ?? []; bucket.push(row); matches.set(key, bucket); }
      const leftMatches = new Map<string, DatasetRow[]>(); for (const row of currentResult.rows) { const key = joinKey(row, "left"); if (key === null) continue; const bucket = leftMatches.get(key) ?? []; bucket.push(row); leftMatches.set(key, bucket); }
      const manyToManyKeys = [...leftMatches.entries()].filter(([key, leftRows]) => leftRows.length > 1 && (matches.get(key)?.length ?? 0) > 1);
      if (manyToManyKeys.length > 0) warnings.push(`检测到 ${manyToManyKeys.length} 个联合关联键在两边均有重复值，结果行数可能成倍增加。`);
      const rows: DatasetRow[] = [];
      if (step.joinType === "right") {
        for (const rightRow of rightResult.rows) { const found = (joinKey(rightRow, "right") === null ? [] : leftMatches.get(joinKey(rightRow, "right")!) ?? []); const values = rightValues(rightRow); if (found.length === 0) rows.push({ ...Object.fromEntries(baseFields.map((field) => [field.key, null])), ...values }); for (const leftRow of found) rows.push({ ...leftRow, ...values }); }
      } else {
        for (const row of currentResult.rows) { const key = joinKey(row, "left"); const found = key === null ? [] : matches.get(key) ?? []; if (found.length === 0 && (step.joinType === "left" || step.joinType === "full")) rows.push({ ...row, ...Object.fromEntries(output.map((field) => [field.key, null])) }); for (const rightRow of found) rows.push({ ...row, ...rightValues(rightRow) }); }
        if (step.joinType === "full") for (const rightRow of rightResult.rows) { const key = joinKey(rightRow, "right"); if (key !== null && (leftMatches.get(key)?.length ?? 0) > 0) continue; rows.push({ ...Object.fromEntries(baseFields.map((field) => [field.key, null])), ...rightValues(rightRow) }); }
      }
      if (rows.length > 10000) throw new DatasetQueryInvalidError();
      if (rows.length > Math.max(currentResult.rows.length, rightResult.rows.length, 1) * 1.5) warnings.push(`整合后预计生成 ${rows.length} 行，明显高于单个数据集的记录数，请确认联合关联键是否唯一。`);
      currentDataset = dataset;
      currentResult = DatasetQueryResult.parse({ columns: dataset.fields, rows, total: rows.length, datasetName: name, ...(warnings.length > 0 ? { warnings } : {}), sampledAt: new Date().toISOString() });
    }
    return { dataset: currentDataset, result: currentResult };
  }

  private platformRepository(id: string): RetailOrderDatasetRepository | null {
    if (id === RETAIL_ORDER_DATASET_ID) return this.retailOrders;
    if (id === STORAGE_TURNOVER_DATASET_ID) return this.storageTurnover;
    if (id === ORDER_PROFIT_REPORT_DATASET_ID) return this.orderProfitReport;
    if (id === SG_STORAGE_DATASET_ID) return this.sgStorage;
    return null;
  }

  private toUploadedDataset(record: UploadedDatasetRecord): UploadedDataset {
    const dataset = Dataset.parse(record.schema);
    const result = DatasetQueryResult.parse(record.queryResult);
    return { dataset, result };
  }
}
