import type { DatabaseConnection, DatabaseTable, Dataset, DatasetField, DatasetQueryRequest } from "@drag-visual/contracts";
import { DatasetQueryInvalidError } from "./dataset.errors.js";
import { quoteDatabaseIdentifier } from "./database-driver.js";

export const DATABASE_ROW_LIMIT = 5000;

/** Identifiers come only from the persisted schema; all filter values are bound. */
export const buildDatabaseQuery = (type: DatabaseConnection["type"], table: DatabaseTable, dataset: Dataset, request: DatasetQueryRequest) => {
  const values: unknown[] = [];
  const bind = (value: unknown): string => { values.push(value); return type === "mysql" ? "?" : `$${values.length}`; };
  const fields = new Map(dataset.fields.map((field) => [field.key, field]));
  const field = (key: string): DatasetField => { const result = fields.get(key); if (!result) throw new DatasetQueryInvalidError(); return result; };
  const quote = (key: string) => quoteDatabaseIdentifier(type, field(key).key);
  const source = `${quoteDatabaseIdentifier(type, table.schema)}.${quoteDatabaseIdentifier(type, table.name)}`;
  const text = (column: string) => `CAST(${column} AS ${type === "mysql" ? "CHAR" : "TEXT"})`;
  const filters = request.filters ?? [...(request.globalFilters ?? []), ...(request.componentFilters ?? [])];
  const conditions = filters.map((filter) => {
    const column = quote(filter.fieldKey);
    if (filter.kind === "dateRange") {
      if (field(filter.fieldKey).type !== "date") throw new DatasetQueryInvalidError();
      return `(DATE(${column}) >= ${bind(filter.start)} AND DATE(${column}) <= ${bind(filter.end)})`;
    }
    if (filter.kind === "fieldValue") {
      if (!["string", "boolean"].includes(field(filter.fieldKey).type)) throw new DatasetQueryInvalidError();
      return `${column} IN (${filter.values.map(bind).join(", ")})`;
    }
    if (filter.kind === "numberComparison") {
      if (field(filter.fieldKey).type !== "number") throw new DatasetQueryInvalidError();
      const operators = { eq: "=", neq: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" } as const;
      return `${column} ${operators[filter.operator]} ${bind(filter.value)}`;
    }
    if (filter.kind === "fieldNull") {
      const empty = field(filter.fieldKey).type === "string" ? `(${column} IS NULL OR TRIM(${text(column)}) = '')` : `(${column} IS NULL)`;
      return filter.operator === "isEmpty" ? empty : `NOT ${empty}`;
    }
    if (field(filter.fieldKey).type !== "string") throw new DatasetQueryInvalidError();
    const value = bind(filter.value.toLowerCase());
    const position = type === "mysql" ? `LOCATE(${value}, LOWER(${text(column)}))` : `STRPOS(LOWER(${text(column)}), ${value})`;
    return `${position} ${filter.operator === "notContains" ? "=" : ">"} 0`;
  });
  let columns = dataset.fields;
  let selection = dataset.fields.map((column) => quote(column.key)).join(", ");
  let grouping = "";
  if (request.aggregation) {
    const { groupBy, measures } = request.aggregation;
    if (measures.some((measure) => field(measure.fieldKey).type !== "number" || groupBy.includes(measure.fieldKey))) throw new DatasetQueryInvalidError();
    const operations = { sum: "SUM", avg: "AVG", min: "MIN", max: "MAX", count: "COUNT" } as const;
    selection = [...groupBy.map(quote), ...measures.map((measure) => `${operations[measure.aggregation]}(${quote(measure.fieldKey)}) AS ${quote(measure.fieldKey)}`)].join(", ");
    columns = [...groupBy.map(field), ...measures.map((measure) => ({ ...field(measure.fieldKey), type: "number" as const, nullable: measure.aggregation !== "count" }))];
    if (groupBy.length) grouping = ` GROUP BY ${groupBy.map(quote).join(", ")}`;
  }
  const order = request.aggregation ? request.aggregation.groupBy : [];
  const sql = `SELECT ${type === "mysql" ? "/*+ MAX_EXECUTION_TIME(10000) */ " : ""}${selection} FROM ${source}${conditions.length ? ` WHERE ${conditions.join(" AND ")}` : ""}${grouping}${order.length ? ` ORDER BY ${order.map(quote).join(", ")}` : ""} LIMIT ${DATABASE_ROW_LIMIT + 1}`;
  return { sql, values, columns };
};

export const normalizeDatabaseCell = (value: unknown, field: DatasetField): string | number | boolean | null => {
  if (value === null || value === undefined) return null;
  if (field.type === "boolean") return value === true || value === 1 || value === "1" || value === "true";
  if (field.type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new DatasetQueryInvalidError();
    return number;
  }
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
};
