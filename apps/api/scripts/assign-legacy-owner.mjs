import { config as loadEnv } from "dotenv";
import { Client } from "pg";

loadEnv({ path: new URL("../../../.env", import.meta.url).pathname });

const usernameArgument = process.argv.find((value) => value.startsWith("--username="));
const username = usernameArgument?.slice("--username=".length).trim().toLocaleLowerCase();

if (!username) {
  console.error("Usage: pnpm data:assign-legacy-owner --username=<existing-account>");
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exitCode = 1;
} else {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query('SELECT "id" FROM "UserRecord" WHERE "username" = $1', [username]);
    if (user.rowCount !== 1) throw new Error(`No account exists for username: ${username}`);
    const result = await client.query(
      'UPDATE "DashboardRecord" SET "ownerId" = $1 WHERE "ownerId" IS NULL',
      [user.rows[0].id],
    );
    await client.query("COMMIT");
    console.log(`Assigned ${result.rowCount ?? 0} legacy dashboard(s) to ${username}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}
