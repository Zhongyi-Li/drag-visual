ALTER TABLE "UploadedDatasetRecord"
  ADD COLUMN "draftCalculatedFields" JSONB,
  ADD COLUMN "draftVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "publishedCalculatedFields" JSONB,
  ADD COLUMN "publishedVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "publishedAt" TIMESTAMPTZ;
