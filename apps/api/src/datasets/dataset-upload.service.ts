import { randomUUID } from "node:crypto";

import {
  Dataset,
  DatasetQueryResult,
  type DatasetQueryResult as DatasetQueryResultValue,
} from "@drag-visual/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { ZodError } from "zod";

import {
  UploadedDatasetRepository,
  type UploadedDataset,
} from "./uploaded-dataset.repository.js";

export const MAX_UPLOADED_DATASET_FILE_SIZE = 5 * 1024 * 1024;
const MAX_UPLOADED_DATASET_ROWS = 10_000;
const SUPPORTED_FILE_EXTENSIONS = new Set(["csv", "xlsx"]);

export class DatasetUploadInvalidError extends Error {}
export class DatasetUploadFileTooLargeError extends Error {}
export class DatasetUploadFileTypeError extends Error {}

export interface UploadedFileInput {
  filename: string;
  contentType: string;
  content: Buffer;
}

const fileExtension = (filename: string): string | undefined => {
  const match = /\.([a-z0-9]+)$/i.exec(filename.trim());
  return match?.[1]?.toLowerCase();
};

const safeOriginalName = (value: string): string => value
  .replace(/[\\/]/g, "_")
  .trim()
  .slice(0, 255);

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new DatasetUploadInvalidError();
  }
};

const parseMetadata = (schemaValue: string, resultValue: string, datasetId: string) => {
  try {
    const submittedSchema = Dataset.parse(parseJson(schemaValue));
    const submittedResult = DatasetQueryResult.parse(parseJson(resultValue));
    const dataset = Dataset.parse({ ...submittedSchema, id: datasetId });
    if (
      JSON.stringify(submittedResult.columns) !== JSON.stringify(dataset.fields) ||
      submittedResult.rows.length !== submittedResult.total ||
      submittedResult.rows.length > MAX_UPLOADED_DATASET_ROWS
    ) {
      throw new DatasetUploadInvalidError();
    }
    return {
      dataset,
      result: submittedResult,
    };
  } catch (error: unknown) {
    if (error instanceof DatasetUploadInvalidError) throw error;
    if (error instanceof ZodError) throw new DatasetUploadInvalidError();
    throw error;
  }
};

@Injectable()
export class DatasetUploadService {
  constructor(
    @Inject(UploadedDatasetRepository)
    private readonly repository: UploadedDatasetRepository,
  ) {}

  async upload(
    ownerId: string,
    file: UploadedFileInput,
    schemaJson: string | undefined,
    resultJson: string | undefined,
  ): Promise<UploadedDataset> {
    const originalName = safeOriginalName(file.filename);
    if (!originalName || !schemaJson || !resultJson) throw new DatasetUploadInvalidError();
    if (file.content.byteLength > MAX_UPLOADED_DATASET_FILE_SIZE) {
      throw new DatasetUploadFileTooLargeError();
    }
    if (!SUPPORTED_FILE_EXTENSIONS.has(fileExtension(originalName) ?? "")) {
      throw new DatasetUploadFileTypeError();
    }

    const datasetId = `uploaded-${randomUUID()}`;
    const metadata = parseMetadata(schemaJson, resultJson, datasetId);
    return this.repository.create({
      id: datasetId,
      ownerId,
      name: metadata.dataset.name,
      originalName,
      contentType: file.contentType.slice(0, 255) || "application/octet-stream",
      fileContent: file.content,
      schema: metadata.dataset,
      result: metadata.result as DatasetQueryResultValue,
    });
  }
}
