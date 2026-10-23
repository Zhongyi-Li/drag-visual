import { afterEach, expect, it, vi } from "vitest";
import { DatabaseDatasetRepository } from "./database-dataset.repository.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { DatabaseDriver } from "./database-driver.js";

afterEach(() => vi.unstubAllEnvs());

it("persists only encrypted connection data and checks owner before querying/deleting", async () => {
  vi.stubEnv("DATABASE_CONNECTION_KEY", Buffer.alloc(32, 1).toString("base64"));
  const fields = [{ key: "amount", label: "amount", type: "number", nullable: true }];
  const create = vi.fn().mockResolvedValue({});
  const findFirst = vi.fn().mockResolvedValue(null);
  const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
  const read = vi.fn().mockImplementation(async (_config, operation) => operation(vi.fn().mockResolvedValue([])));
  const repository = new DatabaseDatasetRepository({ databaseDatasetRecord: { create, findFirst, deleteMany } } as unknown as PrismaService, {
    tables: vi.fn().mockResolvedValue([{ schema: "sales", name: "orders" }]), fields: vi.fn().mockResolvedValue(fields), read,
  } as unknown as DatabaseDriver);
  const schema = await repository.create("owner-1", { connection: { type: "mysql", host: "localhost", port: 3306, database: "sales", username: "reader", password: "super-secret", ssl: false }, table: { schema: "sales", name: "orders" }, name: "Orders" });
  expect(schema.id).toMatch(/^database-/);
  expect(JSON.stringify(create.mock.calls)).not.toContain("super-secret");
  expect(create.mock.calls[0]![0].data.ownerId).toBe("owner-1");
  read.mockClear();
  expect(await repository.query(schema.id, { parameters: {} }, "other-user")).toBeNull();
  expect(findFirst).toHaveBeenCalledWith({ where: { id: schema.id, ownerId: "other-user" } });
  expect(read).not.toHaveBeenCalled();
  expect(await repository.query(schema.id, { parameters: {} })).toBeNull();
  expect(await repository.delete(schema.id, "other-user")).toBe(false);
  expect(deleteMany).toHaveBeenCalledWith({ where: { id: schema.id, ownerId: "other-user" } });
});
