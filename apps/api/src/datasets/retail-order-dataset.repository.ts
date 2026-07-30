import {
  Dataset,
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
const RETAIL_ORDER_DATABASE = "os";
const RETAIL_ORDER_TABLE = "os_order_combined";
const RETAIL_ORDER_RESULT_NAME = "零售发货单";
const DEFAULT_RESULT_LIMIT = 1_000;
const MAX_RESULT_LIMIT = 5_000;

interface MysqlColumnRow extends RowDataPacket {
  readonly sourceKey: string;
  readonly label: string;
  readonly dataType: string;
  readonly nullable: "YES" | "NO";
}

interface MysqlCountRow extends RowDataPacket {
  readonly total: number | string;
}

interface RetailOrderColumn {
  readonly sourceKey: string;
  readonly field: DatasetField;
}

const retailOrderDataset = Dataset.parse({
  id: RETAIL_ORDER_DATASET_ID,
  name: "零售发货单（业务表）",
  fields: [],
  parameters: [
    // This is an output cap for a chart query, not a pagination control.
    // It deliberately stays out of the chart header and is configured per
    // component in the inspector next to the 更新 button.
    { key: "limit", label: "结果展示", type: "number", required: false, defaultValue: DEFAULT_RESULT_LIMIT },
  ],
  schemaVersion: "retail-delivery-orders-v2",
});

const clone = <Value>(value: Value): Value => structuredClone(value);

const positiveInteger = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;

export const validateRetailOrderResultLimit = (parameters: Record<string, unknown>): boolean => {
  const limit = parameters.limit;
  return limit === undefined || (typeof limit === "number" && Number.isInteger(limit) && limit > 0 && limit <= MAX_RESULT_LIMIT);
};

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

  constructor(@Optional() private readonly suppliedPool?: Pool) {}

  async list(): Promise<readonly DatasetSummary[]> {
    const { id, name, schemaVersion } = retailOrderDataset;
    return [{ id, name, schemaVersion }];
  }

  async getSchema(id: string): Promise<Dataset | null> {
    if (id !== RETAIL_ORDER_DATASET_ID) return null;
    const fields = (await this.columns()).map(({ field }) => field);
    return Dataset.parse({ ...retailOrderDataset, fields });
  }

  async query(id: string, request: DatasetQueryRequest): Promise<DatasetQueryResultValue | null> {
    if (id !== RETAIL_ORDER_DATASET_ID) return null;
    const columns = await this.columns();
    const limit = Math.min(positiveInteger(request.parameters.limit, DEFAULT_RESULT_LIMIT), MAX_RESULT_LIMIT);
    const table = `${quoteIdentifier(RETAIL_ORDER_DATABASE)}.${quoteIdentifier(RETAIL_ORDER_TABLE)}`;
    if (request.aggregation !== undefined) {
      return this.queryAggregation(columns, request.aggregation, table, limit);
    }
    const selectedColumns = columns.map(({ sourceKey }) => quoteIdentifier(sourceKey)).join(", ");

    try {
      const [totalRows] = await this.pool().execute<MysqlCountRow[]>(`SELECT COUNT(*) AS total FROM ${table}`);
      const [rows] = await this.pool().execute<RowDataPacket[]>(
        // This MySQL instance rejects prepared placeholders in LIMIT. The
        // value is validated as a bounded positive integer before interpolation.
        `SELECT ${selectedColumns} FROM ${table} ORDER BY ${quoteIdentifier("order_time")} DESC LIMIT ${limit}`,
      );
      const total = Number(totalRows[0]?.total ?? 0);

      return DatasetQueryResult.parse({
        columns: columns.map(({ field }) => field),
        rows: rows.map((row) => toRetailOrderRow(row, columns)),
        total: Number.isSafeInteger(total) && total >= 0 ? total : 0,
        datasetName: RETAIL_ORDER_RESULT_NAME,
        sampledAt: new Date().toISOString(),
      });
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
        : `SELECT COUNT(*) AS total FROM (SELECT 1 FROM ${table}${groupBySql}) AS grouped_rows`;
      const [totalRows] = await this.pool().execute<MysqlCountRow[]>(totalSql);
      const [rows] = await this.pool().execute<RowDataPacket[]>(
        // GROUP BY executes before LIMIT, so the chart receives complete
        // aggregate values rather than aggregates of an arbitrary detail page.
        `SELECT ${selectedColumns} FROM ${table}${groupBySql}${orderBySql} LIMIT ${limit}`,
      );
      const total = Number(totalRows[0]?.total ?? 0);
      return DatasetQueryResult.parse({
        columns: resultColumns.map(({ field }) => field),
        rows: rows.map((row) => toRetailOrderRow(row, resultColumns)),
        total: Number.isSafeInteger(total) && total >= 0 ? total : 0,
        datasetName: RETAIL_ORDER_RESULT_NAME,
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
    this.columnsPromise ??= this.loadColumns();
    return this.columnsPromise;
  }

  private async loadColumns(): Promise<readonly RetailOrderColumn[]> {
    try {
      const [rows] = await this.pool().execute<MysqlColumnRow[]>(
        `SELECT COLUMN_NAME AS sourceKey, COLUMN_COMMENT AS label, DATA_TYPE AS dataType, IS_NULLABLE AS nullable
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [RETAIL_ORDER_DATABASE, RETAIL_ORDER_TABLE],
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
