import { DatabaseTablesResponse, Dataset, DatasetQueryResult, type CreateDatabaseDatasetRequest, type DatabaseConnection, type DatasetFieldOptions, type DatasetQueryRequest, type DatasetSummary } from "@drag-visual/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type { DatabaseDatasetRecord, Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { DatabaseCredentials } from "./database-credentials.js";
import { DatabaseDriver, quoteDatabaseIdentifier } from "./database-driver.js";
import { buildDatabaseQuery, DATABASE_ROW_LIMIT, normalizeDatabaseCell } from "./database-query.js";
import { DatasetQueryInvalidError } from "./dataset.errors.js";

@Injectable()
export class DatabaseDatasetRepository {
  private readonly credentials = new DatabaseCredentials();
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DatabaseDriver) private readonly driver: DatabaseDriver,
  ) {}

  async tables(connection: DatabaseConnection) {
    return DatabaseTablesResponse.parse({ tables: await this.driver.tables(connection) });
  }

  async create(ownerId: string, input: CreateDatabaseDatasetRequest): Promise<Dataset> {
    const tables = await this.driver.tables(input.connection);
    if (!tables.some((table) => table.name === input.table.name && table.schema === input.table.schema)) throw new DatasetQueryInvalidError();
    const fields = await this.driver.fields(input.connection, input.table);
    const id = `database-${randomUUID()}`;
    const schema = Dataset.parse({ id, name: input.name, fields, parameters: [], schemaVersion: `db-${createHash("sha256").update(JSON.stringify(fields)).digest("hex").slice(0, 16)}` });
    const { sql, values } = buildDatabaseQuery(input.connection.type, input.table, schema, { parameters: {} });
    // Verify SELECT permission before persisting a usable source (including empty tables).
    await this.driver.read(input.connection, (query) => query(sql.replace(/LIMIT \d+$/, "LIMIT 1"), values));
    await this.prisma.databaseDatasetRecord.create({ data: {
      id, ownerId, name: input.name,
      encryptedConnection: await this.credentials.encrypt(input.connection),
      tableSchema: input.table.schema, tableName: input.table.name,
      schema: schema as unknown as Prisma.InputJsonObject,
    } });
    return schema;
  }

  async list(ownerId?: string): Promise<DatasetSummary[]> {
    if (!ownerId) return [];
    const records = await this.prisma.databaseDatasetRecord.findMany({
      where: { ownerId }, orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, tableSchema: true, tableName: true, schema: true },
    });
    return records.map((record) => ({ id: record.id, name: record.name, sourceName: `${record.tableSchema}.${record.tableName}`, schemaVersion: Dataset.parse(record.schema).schemaVersion }));
  }

  private async record(id: string, ownerId?: string): Promise<DatabaseDatasetRecord | null> {
    if (!ownerId) return null;
    return this.prisma.databaseDatasetRecord.findFirst({ where: { id, ownerId } });
  }

  async getSchema(id: string, ownerId?: string): Promise<Dataset | null> {
    const record = await this.record(id, ownerId);
    return record ? Dataset.parse({ ...Dataset.parse(record.schema), id: record.id, name: record.name }) : null;
  }

  async query(id: string, request: DatasetQueryRequest, ownerId?: string): Promise<DatasetQueryResult | null> {
    const record = await this.record(id, ownerId);
    if (!record) return null;
    const connection = await this.credentials.decrypt(record.encryptedConnection);
    const schema = Dataset.parse(record.schema);
    const { sql, values, columns } = buildDatabaseQuery(connection.type, { schema: record.tableSchema, name: record.tableName }, schema, request);
    const rows = await this.driver.read(connection, (query) => query(sql, values));
    const result = DatasetQueryResult.parse({
      columns,
      rows: rows.slice(0, DATABASE_ROW_LIMIT).map((row) => Object.fromEntries(columns.map((field) => [field.key, normalizeDatabaseCell(row[field.key], field)]))),
      sampledAt: new Date().toISOString(), datasetName: record.name,
      ...(rows.length > DATABASE_ROW_LIMIT ? { warnings: [`数据超过 ${DATABASE_ROW_LIMIT} 行，当前返回前 ${DATABASE_ROW_LIMIT} 行；请添加筛选或使用图表聚合。`] } : { total: rows.length }),
    });
    if (Buffer.byteLength(JSON.stringify(result)) > 5 * 1024 * 1024) throw new DatasetQueryInvalidError();
    return result;
  }

  async getFieldOptions(id: string, key: string, search: string | undefined, limit: number, ownerId?: string): Promise<DatasetFieldOptions | null> {
    const record = await this.record(id, ownerId);
    if (!record) return null;
    if (!Dataset.parse(record.schema).fields.some((field) => field.key === key && ["string", "boolean"].includes(field.type))) throw new DatasetQueryInvalidError();
    const connection = await this.credentials.decrypt(record.encryptedConnection);
    const quote = (value: string) => quoteDatabaseIdentifier(connection.type, value);
    const column = quote(key);
    const source = `${quote(record.tableSchema)}.${quote(record.tableName)}`;
    const value = connection.type === "mysql" ? `CAST(${column} AS CHAR)` : `CAST(${column} AS TEXT)`;
    const matching = !search ? "" : connection.type === "mysql" ? ` AND LOCATE(?, LOWER(${value})) > 0` : ` AND STRPOS(LOWER(${value}), $1) > 0`;
    const sql = `SELECT DISTINCT ${value} AS ${quote("value")} FROM ${source} WHERE ${column} IS NOT NULL${matching} ORDER BY ${quote("value")} LIMIT ${Math.max(1, Math.min(200, Math.floor(limit)))}`;
    const rows = await this.driver.read(connection, (query) => query(sql, search ? [search.toLowerCase()] : []));
    return { options: rows.map((row) => String(row.value)) };
  }

  async delete(id: string, ownerId: string): Promise<boolean> {
    return (await this.prisma.databaseDatasetRecord.deleteMany({ where: { id, ownerId } })).count > 0;
  }
}
