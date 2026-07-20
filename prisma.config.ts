import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";
import { fileURLToPath } from "node:url";

// Prisma commands are run from apps/api, so relying on process.cwd() would
// miss the workspace-level .env file.
loadEnv({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/drag_visual",
  },
});
