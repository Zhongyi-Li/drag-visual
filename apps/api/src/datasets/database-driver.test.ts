import { afterEach, expect, it, vi } from "vitest";
import mysql from "mysql2/promise";
import { DatabaseDriver } from "./database-driver.js";

vi.mock("mysql2/promise", () => ({ default: { createConnection: vi.fn() } }));
afterEach(() => vi.clearAllMocks());
const config = { type: "mysql" as const, host: "localhost", port: 3306, database: "sales", username: "reader", password: "hidden", ssl: false };

it("lists MySQL tables in a read-only transaction and closes the socket", async () => {
  const query = vi.fn().mockResolvedValue([[]]);
  query.mockImplementation(async (input: unknown) => typeof input === "string" ? [[]] : [[{ schema: "sales", name: "orders" }]]);
  const destroy = vi.fn();
  vi.mocked(mysql.createConnection).mockResolvedValue({ query, destroy } as never);
  expect(await new DatabaseDriver().tables(config)).toEqual([{ schema: "sales", name: "orders" }]);
  expect(query).toHaveBeenNthCalledWith(1, "SET SESSION TRANSACTION READ ONLY");
  expect(query).toHaveBeenNthCalledWith(2, "START TRANSACTION READ ONLY");
  expect(query).toHaveBeenNthCalledWith(3, expect.objectContaining({ values: ["sales"], timeout: 10000 }));
  expect(query.mock.calls[2]![0].sql).toContain("AS `schema`");
  expect(destroy).toHaveBeenCalledOnce();
});

it("closes failed MySQL queries and never exposes raw credentials or SQL", async () => {
  const destroy = vi.fn();
  const query = vi.fn().mockRejectedValue(new Error("hidden password, SELECT sensitive FROM table"));
  vi.mocked(mysql.createConnection).mockResolvedValue({ query, destroy } as never);
  try { await new DatabaseDriver().tables(config); throw new Error("Expected failure"); }
  catch (error) {
    expect((error as { getResponse: () => unknown }).getResponse()).toEqual({ code: "DATABASE_CONNECTION_FAILED", message: expect.any(String) });
    expect(JSON.stringify(error)).not.toContain("hidden");
  }
  expect(destroy).toHaveBeenCalledOnce();
});

it.each([
  ["ER_BAD_DB_ERROR", "DATABASE_NOT_FOUND", 400, "实际库名"],
  ["3D000", "DATABASE_NOT_FOUND", 400, "实际库名"],
  ["ER_ACCESS_DENIED_ERROR", "DATABASE_AUTH_FAILED", 502, "账号或密码"],
  ["ER_DBACCESS_DENIED_ERROR", "DATABASE_PERMISSION_DENIED", 502, "读取权限"],
  ["ECONNREFUSED", "DATABASE_CONNECTION_REFUSED", 502, "拒绝连接"],
  ["ETIMEDOUT", "DATABASE_TIMEOUT", 504, "超时"],
  ["CERT_HAS_EXPIRED", "DATABASE_TLS_FAILED", 502, "证书"],
])("classifies %s without exposing the driver's raw message", async (code, expected, status, message) => {
  vi.mocked(mysql.createConnection).mockRejectedValue(Object.assign(new Error("hidden password and internal connection details"), { code }));
  try { await new DatabaseDriver().tables(config); throw new Error("Expected failure"); }
  catch (error) {
    const exception = error as { getStatus: () => number; getResponse: () => unknown };
    expect(exception.getStatus()).toBe(status);
    expect(exception.getResponse()).toEqual({ code: expected, message: expect.stringContaining(message) });
    expect(JSON.stringify(exception.getResponse())).not.toContain("hidden");
  }
});
