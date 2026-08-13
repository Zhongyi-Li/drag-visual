import {
  Dataset,
  DatasetFieldOptions,
  DatasetQueryResult,
  type DatasetAggregation,
  type DatasetAggregationRequest,
  type DatasetField,
  type DatasetQueryRequest,
  type DatasetQueryResult as DatasetQueryResultValue,
  type DatasetSummary,
} from "@drag-visual/contracts";
import { Injectable, Optional } from "@nestjs/common";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

import { DatasetUpstreamError } from "./dataset.errors.js";
import type { DatasetRepository } from "./dataset.repository.js";

export const RETAIL_ORDER_DATASET_ID = "retail-delivery-orders";
export const STORAGE_TURNOVER_DATASET_ID = "storage-turnover";
const RETAIL_ORDER_DATABASE = "os";
const DEFAULT_RESULT_LIMIT = 1_000;
const MAX_RESULT_LIMIT = 5_000;

interface MysqlTableDatasetConfig {
  readonly id: string;
  readonly table: string;
  readonly schemaVersion: string;
  readonly sortColumn: string;
}

const RETAIL_ORDER_DATASET: MysqlTableDatasetConfig = {
  id: RETAIL_ORDER_DATASET_ID,
  table: "os_order_combined",
  schemaVersion: "retail-delivery-orders-v2",
  sortColumn: "order_time",
};

const STORAGE_TURNOVER_DATASET: MysqlTableDatasetConfig = {
  id: STORAGE_TURNOVER_DATASET_ID,
  table: "os_storage_turnover",
  schemaVersion: "storage-turnover-v1",
  sortColumn: "id",
};

interface MysqlColumnRow extends RowDataPacket {
  readonly sourceKey: string;
  readonly label: string;
  readonly dataType: string;
  readonly nullable: "YES" | "NO";
}

interface MysqlCountRow extends RowDataPacket {
  readonly total: number | string;
}

interface MysqlTableRow extends RowDataPacket {
  readonly tableComment: string | null;
}

interface RetailOrderColumn {
  readonly sourceKey: string;
  readonly field: DatasetField;
}

interface SqlFilter {
  readonly whereSql: string;
  readonly values: readonly string[];
}

const mysqlTableDataset = (config: MysqlTableDatasetConfig, name: string, fields: readonly DatasetField[] = []): Dataset => Dataset.parse({
  id: config.id,
  name,
  fields,
  parameters: [
    // This is an output cap for a chart query, not a pagination control.
    // It deliberately stays out of the chart header and is configured per
    // component in the inspector next to the 更新 button.
    { key: "limit", label: "结果展示", type: "number", required: false, defaultValue: DEFAULT_RESULT_LIMIT },
  ],
  schemaVersion: config.schemaVersion,
});

const clone = <Value>(value: Value): Value => structuredClone(value);

const positiveInteger = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;

export const validateRetailOrderResultLimit = (parameters: Record<string, unknown>): boolean => {
  const limit = parameters.limit;
  return limit === undefined || (typeof limit === "number" && Number.isInteger(limit) && limit > 0 && limit <= MAX_RESULT_LIMIT);
};

export const validateStorageTurnoverResultLimit = validateRetailOrderResultLimit;

const toCamelCase = (value: string): string => value.replace(/_([a-z0-9])/g, (_, character: string) => character.toUpperCase());

const toDatasetFieldType = (type: string): DatasetField["type"] => {
  if (["bigint", "decimal", "double", "float", "int", "integer", "mediumint", "smallint", "tinyint"].includes(type)) return "number";
  if (["date", "datetime", "timestamp", "time", "year"].includes(type)) return "date";
  return "string";
};

const quoteIdentifier = (value: string): string => {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new DatasetUpstreamError();
  return `\`${value}\``;
};

const toDatasetValue = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return String(value);
};

const toRetailOrderValue = (value: unknown, field: DatasetField): string | number | boolean | null => {
  const normalized = toDatasetValue(value);
  if (field.type !== "number" || typeof normalized !== "string") return normalized;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : normalized;
};

const toRetailOrderRow = (
  record: RowDataPacket,
  columns: readonly RetailOrderColumn[],
): Record<string, string | number | boolean | null> => Object.fromEntries(
  columns.map(({ sourceKey, field }) => [field.key, toRetailOrderValue(record[sourceKey], field)]),
);

const aggregationExpression = (sourceKey: string, aggregation: DatasetAggregation): string => {
  const field = quoteIdentifier(sourceKey);
  if (aggregation === "sum") return `SUM(${field})`;
  if (aggregation === "avg") return `AVG(${field})`;
  if (aggregation === "count") return `COUNT(${field})`;
  if (aggregation === "max") return `MAX(${field})`;
  return `MIN(${field})`;
};

const aggregationResultField = (column: RetailOrderColumn, aggregation: DatasetAggregation): DatasetField => ({
  ...column.field,
  type: "number",
  nullable: aggregation === "count" ? false : true,
});

const nextCalendarDay = (value: string): string => {
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year!, month! - 1, day! + 1));
  return next.toISOString().slice(0, 10);
};

const sqlFilter = (
  columns: readonly RetailOrderColumn[],
  filters: DatasetQueryRequest["filters"],
): SqlFilter => {
  if (filters === undefined || filters.length === 0) return { whereSql: "", values: [] };
  const predicates: string[] = [];
  const values: string[] = [];
  for (const filter of filters) {
    const column = columns.find((candidate) => candidate.field.key === filter.fieldKey);
    if (column === undefined) throw new DatasetUpstreamError();
    const source = quoteIdentifier(column.sourceKey);
    if (filter.kind === "dateRange") {
      if (column.field.type !== "date") throw new DatasetUpstreamError();
      // Half-open ranges include every time on the selected final day while
      // keeping the indexed source column bare in the predicate.
      predicates.push(`${source} >= ? AND ${source} < ?`);
      values.push(filter.start, nextCalendarDay(filter.end));
      continue;
    }
    if (filter.kind === "fieldValue") {
      if (column.field.type !== "string" && column.field.type !== "boolean") throw new DatasetUpstreamError();
      predicates.push(`${source} IN (${filter.values.map(() => "?").join(", ")})`);
      values.push(...filter.values.map(String));
      continue;
    }
    if (filter.kind === "fieldNull") {
      predicates.push(filter.operator === "isEmpty"
        ? `(${source} IS NULL OR TRIM(${source}) = '')`
        : `(${source} IS NOT NULL AND TRIM(${source}) <> '')`);
      continue;
    }
    if (filter.kind === "numberComparison") {
      if (column.field.type !== "number") throw new DatasetUpstreamError();
      const operator = { eq: "=", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=" }[filter.operator];
      predicates.push(`${source} ${operator} ?`);
      values.push(String(filter.value));
      continue;
    }
    if (column.field.type !== "string") throw new DatasetUpstreamError();
    predicates.push(`${source} ${filter.operator === "notContains" ? "NOT LIKE" : "LIKE"} ?`);
    values.push(`%${filter.value}%`);
  }
  return { whereSql: ` WHERE ${predicates.join(" AND ")}`, values };
};

const execute = <Value extends RowDataPacket[]>(pool: Pool, sql: string, values: readonly string[]): Promise<[Value, unknown]> =>
  values.length === 0 ? pool.execute<Value>(sql) : pool.execute<Value>(sql, [...values]);

const createPool = (): Pool => {
  const connectionUrl = process.env.RETAIL_MYSQL_URL;
  if (!connectionUrl) throw new DatasetUpstreamError();

  let url: URL;
  try {
    url = new URL(connectionUrl);
  } catch {
    throw new DatasetUpstreamError();
  }
  const database = url.pathname.replace(/^\//, "");
  if (url.protocol !== "mysql:" || !database) throw new DatasetUpstreamError();

  return mysql.createPool({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    charset: "utf8mb4",
    connectionLimit: 5,
    dateStrings: true,
    decimalNumbers: true,
    enableKeepAlive: true,
    bigNumberStrings: true,
    supportBigNumbers: true,
    waitForConnections: true,
  });
};

@Injectable()
export class RetailOrderDatasetRepository implements DatasetRepository {
  private managedPool: Pool | undefined;
  private columnsPromise: Promise<readonly RetailOrderColumn[]> | undefined;
  private datasetNamePromise: Promise<string> | undefined;
  protected readonly config: MysqlTableDatasetConfig = RETAIL_ORDER_DATASET;

  constructor(@Optional() private readonly suppliedPool?: Pool) {}

  async list(): Promise<readonly DatasetSummary[]> {
    const { id, name, schemaVersion } = mysqlTableDataset(this.config, await this.datasetName());
    return [{ id, name, schemaVersion }];
  }

  async getSchema(id: string): Promise<Dataset | null> {
    if (id !== this.config.id) return null;
    const fields = (await this.columns()).map(({ field }) => field);
    return mysqlTableDataset(this.config, await this.datasetName(), fields);
  }

  async query(id: string, request: DatasetQueryRequest): Promise<DatasetQueryResultValue | null> {
    if (id !== this.config.id) return null;
    const columns = await this.columns();
    const limit = Math.min(positiveInteger(request.parameters.limit, DEFAULT_RESULT_LIMIT), MAX_RESULT_LIMIT);
    const table = `${quoteIdentifier(RETAIL_ORDER_DATABASE)}.${quoteIdentifier(this.config.table)}`;
    const filter = sqlFilter(columns, request.filters);
    if (request.aggregation !== undefined) {
      return this.queryAggregation(columns, request.aggregation, table, limit, filter);
    }
    const selectedColumns = columns.map(({ sourceKey }) => quoteIdentifier(sourceKey)).join(", ");

    try {
      const [totalRows] = await execute<MysqlCountRow[]>(this.pool(), `SELECT COUNT(*) AS total FROM ${table}${filter.whereSql}`, filter.values);
      const [rows] = await execute<RowDataPacket[]>(
        this.pool(),
        // This MySQL instance rejects prepared placeholders in LIMIT. The
        // value is validated as a bounded positive integer before interpolation.
        `SELECT ${selectedColumns} FROM ${table}${filter.whereSql} ORDER BY ${quoteIdentifier(this.config.sortColumn)} DESC LIMIT ${limit}`,
        filter.values,
      );
      const total = Number(totalRows[0]?.total ?? 0);

      return DatasetQueryResult.parse({
        columns: columns.map(({ field }) => field),
        rows: rows.map((row) => toRetailOrderRow(row, columns)),
        total: Number.isSafeInteger(total) && total >= 0 ? total : 0,
        datasetName: await this.datasetName(),
        sampledAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      if (error instanceof DatasetUpstreamError) throw error;
      throw new DatasetUpstreamError();
    }
  }

  async getFieldOptions(id: string, fieldKey: string, search: string | undefined, limit: number): Promise<DatasetFieldOptions | null> {
    if (id !== this.config.id) return null;
    const column = (await this.columns()).find((candidate) => candidate.field.key === fieldKey);
    if (column === undefined || (column.field.type !== "string" && column.field.type !== "boolean")) return null;
    const table = `${quoteIdentifier(RETAIL_ORDER_DATABASE)}.${quoteIdentifier(this.config.table)}`;
    const source = quoteIdentifier(column.sourceKey);
    const whereSql = search ? ` WHERE ${source} IS NOT NULL AND ${source} LIKE ?` : ` WHERE ${source} IS NOT NULL`;
    const values = search ? [`%${search}%`] : [];
    try {
      const [rows] = await execute<RowDataPacket[]>(
        this.pool(),
        `SELECT DISTINCT ${source} AS value FROM ${table}${whereSql} ORDER BY ${source} ASC LIMIT ${limit}`,
        values,
      );
      return DatasetFieldOptions.parse({ options: rows.map((row) => String(row.value)) });
    } catch (error: unknown) {
      if (error instanceof DatasetUpstreamError) throw error;
      throw new DatasetUpstreamError();
    }
  }

  private async queryAggregation(
    columns: readonly RetailOrderColumn[],
    aggregation: DatasetAggregationRequest,
    table: string,
    limit: number,
    filter: SqlFilter,
  ): Promise<DatasetQueryResultValue> {
    const columnsByKey = new Map(columns.map((column) => [column.field.key, column]));
    const groupColumns = aggregation.groupBy.map((fieldKey) => columnsByKey.get(fieldKey));
    const measures = aggregation.measures.map((measure) => ({
      column: columnsByKey.get(measure.fieldKey),
      aggregation: measure.aggregation,
    }));
    if (groupColumns.some((column) => column === undefined) || measures.some(({ column }) => column === undefined)) {
      throw new DatasetUpstreamError();
    }
    const resolvedGroupColumns = groupColumns as RetailOrderColumn[];
    const resolvedMeasures = measures as { readonly column: RetailOrderColumn; readonly aggregation: DatasetAggregation }[];
    const selectedColumns = [
      ...resolvedGroupColumns.map(({ sourceKey }) => `${quoteIdentifier(sourceKey)} AS ${quoteIdentifier(sourceKey)}`),
      ...resolvedMeasures.map(({ column, aggregation: operation }) =>
        `${aggregationExpression(column.sourceKey, operation)} AS ${quoteIdentifier(column.sourceKey)}`),
    ].join(", ");
    const groupBy = resolvedGroupColumns.map(({ sourceKey }) => quoteIdentifier(sourceKey));
    const groupBySql = groupBy.length === 0 ? "" : ` GROUP BY ${groupBy.join(", ")}`;
    const orderBySql = groupBy.length === 0 ? "" : ` ORDER BY ${groupBy.join(", ")} ASC`;
    const resultColumns = [
      ...resolvedGroupColumns,
      ...resolvedMeasures.map(({ column, aggregation: operation }) => ({
        ...column,
        field: aggregationResultField(column, operation),
      })),
    ];

    try {
      const totalSql = groupBy.length === 0
        ? "SELECT 1 AS total"
        : `SELECT COUNT(*) AS total FROM (SELECT 1 FROM ${table}${filter.whereSql}${groupBySql}) AS grouped_rows`;
      const [totalRows] = await execute<MysqlCountRow[]>(this.pool(), totalSql, filter.values);
      const [rows] = await execute<RowDataPacket[]>(
        this.pool(),
        // GROUP BY executes before LIMIT, so the chart receives complete
        // aggregate values rather than aggregates of an arbitrary detail page.
        `SELECT ${selectedColumns} FROM ${table}${filter.whereSql}${groupBySql}${orderBySql} LIMIT ${limit}`,
        filter.values,
      );
      const total = Number(totalRows[0]?.total ?? 0);
      return DatasetQueryResult.parse({
        columns: resultColumns.map(({ field }) => field),
        rows: rows.map((row) => toRetailOrderRow(row, resultColumns)),
        total: Number.isSafeInteger(total) && total >= 0 ? total : 0,
        datasetName: await this.datasetName(),
        sampledAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      if (error instanceof DatasetUpstreamError) throw error;
      throw new DatasetUpstreamError();
    }
  }

  private pool(): Pool {
    if (this.suppliedPool) return this.suppliedPool;
    this.managedPool ??= createPool();
    return this.managedPool;
  }

  private columns(): Promise<readonly RetailOrderColumn[]> {
    if (this.columnsPromise === undefined) {
      const request = this.loadColumns();
      const retryable = request.catch((error: unknown) => {
        if (this.columnsPromise === retryable) this.columnsPromise = undefined;
        throw error;
      });
      this.columnsPromise = retryable;
    }
    return this.columnsPromise;
  }

  private datasetName(): Promise<string> {
    if (this.datasetNamePromise === undefined) {
      const request = this.loadDatasetName();
      const retryable = request.catch((error: unknown) => {
        if (this.datasetNamePromise === retryable) this.datasetNamePromise = undefined;
        throw error;
      });
      this.datasetNamePromise = retryable;
    }
    return this.datasetNamePromise;
  }

  private async loadDatasetName(): Promise<string> {
    try {
      const [rows] = await this.pool().execute<MysqlTableRow[]>(
        `SELECT TABLE_COMMENT AS tableComment
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
        [RETAIL_ORDER_DATABASE, this.config.table],
      );
      return rows[0]?.tableComment?.trim() || this.config.table;
    } catch (error: unknown) {
      if (error instanceof DatasetUpstreamError) throw error;
      throw new DatasetUpstreamError();
    }
  }

  private async loadColumns(): Promise<readonly RetailOrderColumn[]> {
    try {
      const [rows] = await this.pool().execute<MysqlColumnRow[]>(
        `SELECT COLUMN_NAME AS sourceKey, COLUMN_COMMENT AS label, DATA_TYPE AS dataType, IS_NULLABLE AS nullable
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [RETAIL_ORDER_DATABASE, this.config.table],
      );
      const columns = rows.map((row) => ({
        sourceKey: row.sourceKey,
        field: {
          key: toCamelCase(row.sourceKey),
          label: row.label.trim() || toCamelCase(row.sourceKey),
          type: toDatasetFieldType(row.dataType.toLowerCase()),
          nullable: row.nullable === "YES",
        },
      }));
      if (columns.length === 0) throw new DatasetUpstreamError();
      return columns;
    } catch (error: unknown) {
      if (error instanceof DatasetUpstreamError) throw error;
      throw new DatasetUpstreamError();
    }
  }
}

@Injectable()
export class StorageTurnoverDatasetRepository extends RetailOrderDatasetRepository {
  protected override readonly config: MysqlTableDatasetConfig = STORAGE_TURNOVER_DATASET;
}
