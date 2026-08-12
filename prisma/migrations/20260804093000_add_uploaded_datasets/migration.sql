CREATE TABLE "UploadedDatasetRecord" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "fileContent" BYTEA NOT NULL,
  "schema" JSONB NOT NULL,
  "queryResult" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UploadedDatasetRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UploadedDatasetRecord_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "UserRecord"("id") ON DELETE CASCADE
);

CREATE INDEX "UploadedDatasetRecord_ownerId_updatedAt_idx" ON "UploadedDatasetRecord"("ownerId", "updatedAt");
