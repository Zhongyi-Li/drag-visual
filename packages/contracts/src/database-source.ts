import { z } from "zod";

export const DatabaseConnection = z.object({
  type: z.enum(["mysql", "postgresql"]),
  host: z.string().trim().min(1).max(253).refine((value) => !/[\s/\\?#@]/.test(value), "请输入主机名或 IP，不要包含协议或路径"),
  port: z.number().int().min(1).max(65535),
  database: z.string().trim().min(1).max(128),
  username: z.string().trim().min(1).max(128),
  password: z.string().max(2048),
  ssl: z.boolean().default(false),
}).strict();
export type DatabaseConnection = z.infer<typeof DatabaseConnection>;

export const DatabaseTable = z.object({ schema: z.string().min(1).max(128), name: z.string().min(1).max(128) }).strict();
export type DatabaseTable = z.infer<typeof DatabaseTable>;

export const DatabaseTablesResponse = z.object({ tables: z.array(DatabaseTable).max(2000) }).strict();
export const CreateDatabaseDatasetRequest = z.object({
  connection: DatabaseConnection,
  table: DatabaseTable,
  name: z.string().trim().min(1).max(100),
}).strict();
export type CreateDatabaseDatasetRequest = z.infer<typeof CreateDatabaseDatasetRequest>;
