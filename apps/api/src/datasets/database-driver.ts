import { type DatabaseConnection, type DatabaseTable, type DatasetField } from "@drag-visual/contracts";
import { HttpException, Injectable } from "@nestjs/common";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { Client } from "pg";

export type DatabaseRows = Record<string, unknown>[];
export type DatabaseQuery = (sql: string, values?: readonly unknown[]) => Promise<DatabaseRows>;

export const databaseFailure = (error?: unknown): HttpException => {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  const failure = (name: string, message: string, status = 502) => new HttpException({ code: name, message }, status);
  if (["ER_BAD_DB_ERROR", "3D000"].includes(code)) return failure("DATABASE_NOT_FOUND", "数据库名称不存在，请填写数据库中的实际库名，不是 Navicat 等工具中的连接名称。", 400);
  if (["ER_ACCESS_DENIED_ERROR", "28P01", "28000"].includes(code)) return failure("DATABASE_AUTH_FAILED", "数据库账号或密码不正确，或该账号不允许从 BI 服务所在主机登录。");
  if (["ER_DBACCESS_DENIED_ERROR", "ER_TABLEACCESS_DENIED_ERROR", "ER_COLUMNACCESS_DENIED_ERROR", "42501"].includes(code)) return failure("DATABASE_PERMISSION_DENIED", "该账号没有所选数据库或数据表的读取权限。");
  if (["ENOTFOUND", "EAI_AGAIN"].includes(code)) return failure("DATABASE_HOST_NOT_FOUND", "无法解析数据库地址，请检查主机名或 IP。");
  if (code === "ECONNREFUSED") return failure("DATABASE_CONNECTION_REFUSED", "数据库拒绝连接，请检查端口、数据库服务和访问规则。");
  if (["ETIMEDOUT", "PROTOCOL_SEQUENCE_TIMEOUT", "57014"].includes(code)) return failure("DATABASE_TIMEOUT", "数据库连接或查询超时，请检查网络和查询范围。", 504);
  if (code.startsWith("ERR_TLS_") || code.startsWith("CERT_") || ["DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"].includes(code)) return failure("DATABASE_TLS_FAILED", "数据库 TLS 连接或证书校验失败，请检查加密连接设置和服务器证书。");
  return failure("DATABASE_CONNECTION_FAILED", "无法连接数据库或读取数据，请检查地址、端口、账号密码、TLS 设置及表读取权限。");
};

export const quoteDatabaseIdentifier = (type: DatabaseConnection["type"], value: string): string => {
  if (!value || value.includes("\0") || value.length > 128) throw new Error("Invalid database identifier");
  const quote = type === "mysql" ? "`" : '"';
  return quote + value.replaceAll(quote, quote + quote) + quote;
};

@Injectable()
export class DatabaseDriver {
  async read<T>(config: DatabaseConnection, operation: (query: DatabaseQuery) => Promise<T>): Promise<T> {
    try {
      if (config.type === "mysql") {
        const connection = await mysql.createConnection({
          host: config.host, port: config.port, database: config.database,
          user: config.username, password: config.password,
          connectTimeout: 10000, multipleStatements: false,
          supportBigNumbers: true, bigNumberStrings: true, dateStrings: true,
          ...(config.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
        });
        try {
          await connection.query("SET SESSION TRANSACTION READ ONLY");
          await connection.query("START TRANSACTION READ ONLY");
          return await operation(async (sql, values = []) => {
            const [rows] = await connection.query<RowDataPacket[]>({ sql, values: [...values], timeout: 10000 });
            return rows;
          });
        } finally { connection.destroy(); }
      }
      const client = new Client({
        host: config.host, port: config.port, database: config.database,
        user: config.username, password: config.password,
        connectionTimeoutMillis: 10000, statement_timeout: 10000, query_timeout: 12000,
        ...(config.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
      });
      // Prevent an idle socket error from becoming an uncaught EventEmitter error.
      client.on("error", () => undefined);
      try {
        await client.connect();
        await client.query("BEGIN READ ONLY");
        return await operation(async (sql, values = []) => (await client.query(sql, [...values])).rows as DatabaseRows);
      } finally { await client.end().catch(() => undefined); }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Driver error messages can contain hosts, users and SQL. Never return/log them.
      throw databaseFailure(error);
    }
  }

  async tables(config: DatabaseConnection): Promise<DatabaseTable[]> {
    return this.read(config, async (query) => {
      const rows = config.type === "mysql"
        ? await query("SELECT TABLE_SCHEMA AS `schema`, TABLE_NAME AS `name` FROM information_schema.tables WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME LIMIT 2001", [config.database])
        : await query("SELECT table_schema AS schema, table_name AS name FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_schema, table_name LIMIT 2001");
      if (rows.length > 2000) throw new HttpException({ code: "DATABASE_TOO_MANY_TABLES", message: "数据库表数量超过 2000，请使用权限范围更小的数据库账号。" }, 400);
      return rows.map((row) => ({ schema: String(row.schema), name: String(row.name) }));
    });
  }

  async fields(config: DatabaseConnection, table: DatabaseTable): Promise<DatasetField[]> {
    return this.read(config, async (query) => {
      const rows = config.type === "mysql"
        ? await query("SELECT COLUMN_NAME AS `name`, DATA_TYPE AS `type`, COLUMN_TYPE AS `full_type`, IS_NULLABLE AS `nullable`, COLUMN_COMMENT AS `label` FROM information_schema.columns WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION LIMIT 257", [table.schema, table.name])
        : await query("SELECT column_name AS name, data_type AS type, udt_name AS full_type, is_nullable AS nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position LIMIT 257", [table.schema, table.name]);
      if (rows.length === 0 || rows.length > 256) throw new HttpException({ code: "DATABASE_TABLE_INVALID", message: "所选表不可读或字段数超过 256，请重新选择表。" }, 400);
      return rows.map((row) => {
        const raw = String(row.type).toLowerCase();
        const boolean = raw === "boolean" || row.full_type === "tinyint(1)";
        const type: DatasetField["type"] = boolean ? "boolean"
          : /^(smallint|mediumint|int|integer|tinyint|numeric|decimal|real|double|float)/.test(raw) ? "number"
          : /^(date|timestamp)/.test(raw) ? "date" : "string";
        return { key: String(row.name), label: String(row.label || row.name), type, nullable: row.nullable === "YES" };
      });
    });
  }
}
