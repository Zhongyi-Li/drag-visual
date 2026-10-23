CREATE TABLE "DatabaseDatasetRecord" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "encryptedConnection" TEXT NOT NULL,
  "tableSchema" TEXT NOT NULL,
  "tableName" TEXT NOT NULL,
  "schema" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DatabaseDatasetRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DatabaseDatasetRecord_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "UserRecord"("id") ON DELETE CASCADE
);
CREATE INDEX "DatabaseDatasetRecord_ownerId_updatedAt_idx" ON "DatabaseDatasetRecord"("ownerId", "updatedAt");
