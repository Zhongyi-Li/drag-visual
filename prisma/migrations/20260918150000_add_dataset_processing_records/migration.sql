CREATE TABLE "DatasetProcessingRecord" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "sourceDatasetId" TEXT NOT NULL,
  "sourceDatasetName" TEXT NOT NULL,
  "resultDatasetId" TEXT,
  "resultDatasetName" TEXT,
  "status" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "configuration" JSONB NOT NULL,
  "calculatedFieldCount" INTEGER NOT NULL DEFAULT 0,
  "combineKind" TEXT,
  "rowCount" INTEGER,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DatasetProcessingRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DatasetProcessingRecord_ownerId_createdAt_idx"
  ON "DatasetProcessingRecord"("ownerId", "createdAt");

CREATE INDEX "DatasetProcessingRecord_sourceDatasetId_version_idx"
  ON "DatasetProcessingRecord"("sourceDatasetId", "version");

ALTER TABLE "DatasetProcessingRecord"
  ADD CONSTRAINT "DatasetProcessingRecord_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "UserRecord"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
