import { afterEach, expect, it, vi } from "vitest";
import { DatabaseCredentials } from "./database-credentials.js";

afterEach(() => vi.unstubAllEnvs());

it("encrypts credentials with a random nonce, persists across instances, rejects tampering and wrong keys", async () => {
  vi.stubEnv("DATABASE_CONNECTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  const value = { type: "mysql" as const, host: "localhost", port: 3306, database: "sales", username: "reader", password: "sensitive-password", ssl: false };
  const cipher = new DatabaseCredentials();
  const first = await cipher.encrypt(value);
  expect(first).not.toContain(value.password);
  expect(await cipher.encrypt(value)).not.toBe(first);
  expect(await new DatabaseCredentials().decrypt(first)).toEqual(value);
  const parts = first.split(":");
  const data = Buffer.from(parts[3]!, "base64"); data[0] = data[0]! ^ 1; parts[3] = data.toString("base64");
  await expect(cipher.decrypt(parts.join(":"))).rejects.toThrow();
  vi.stubEnv("DATABASE_CONNECTION_KEY", Buffer.alloc(32, 8).toString("base64"));
  await expect(new DatabaseCredentials().decrypt(first)).rejects.toThrow();
});
