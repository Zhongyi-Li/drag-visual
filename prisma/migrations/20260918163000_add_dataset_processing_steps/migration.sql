ALTER TABLE "UploadedDatasetRecord"
  ADD COLUMN "draftFilters" JSONB,
  ADD COLUMN "draftSelectedFields" JSONB;
