import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { DatabaseConnection } from "@drag-visual/contracts";

// Outside apps/: deployment mirroring must preserve this key alongside .env.
const directory = new URL("../../../../.runtime/", import.meta.url);
const keyFile = new URL("database-connection.key", directory);

export class DatabaseCredentials {
  private keyPromise: Promise<Buffer> | undefined;

  private key(): Promise<Buffer> {
    return this.keyPromise ??= this.loadKey();
  }

  private async loadKey(): Promise<Buffer> {
    const configured = process.env.DATABASE_CONNECTION_KEY;
    if (configured) {
      const key = Buffer.from(configured, "base64");
      if (key.length !== 32) throw new Error("DATABASE_CONNECTION_KEY must be a base64-encoded 32-byte key");
      return key;
    }
    await mkdir(directory, { recursive: true, mode: 0o700 });
    try { await writeFile(keyFile, randomBytes(32), { flag: "wx", mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    const key = await readFile(keyFile);
    if (key.length !== 32) throw new Error("Database connection encryption key is invalid");
    return key;
  }

  async encrypt(connection: DatabaseConnection): Promise<string> {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", await this.key(), iv);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(connection), "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
  }

  async decrypt(value: string): Promise<DatabaseConnection> {
    const [version, iv, tag, ciphertext] = value.split(":");
    if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted database connection");
    const decipher = createDecipheriv("aes-256-gcm", await this.key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return DatabaseConnection.parse(JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8")));
  }
}
