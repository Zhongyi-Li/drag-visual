import {
  Controller,
  Inject,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UseFilters,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.service.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { DatasetExceptionFilter } from "./dataset.controller.js";
import {
  DatasetUploadFileTooLargeError,
  DatasetUploadFileTypeError,
  DatasetUploadInvalidError,
  DatasetUploadService,
  type UploadedFileInput,
} from "./dataset-upload.service.js";

const uploadError = (
  status: HttpStatus,
  code: string,
  message: string,
): HttpException => new HttpException({ code, message }, status);

const invalidUpload = (): HttpException => uploadError(
  HttpStatus.BAD_REQUEST,
  "DATASET_UPLOAD_INVALID",
  "上传数据集参数无效",
);

const readUploadParts = async (request: FastifyRequest): Promise<{
  file: UploadedFileInput | undefined;
  schema: string | undefined;
  result: string | undefined;
}> => {
  if (!request.isMultipart()) throw invalidUpload();
  let file: UploadedFileInput | undefined;
  let schema: string | undefined;
  let result: string | undefined;
  for await (const part of request.parts()) {
    if (part.type === "field") {
      if (part.fieldname === "schema" && typeof part.value === "string") schema = part.value;
      if (part.fieldname === "result" && typeof part.value === "string") result = part.value;
      continue;
    }
    if (part.fieldname !== "file" || file !== undefined) {
      await part.toBuffer();
      throw invalidUpload();
    }
    file = {
      filename: part.filename,
      contentType: part.mimetype,
      content: await part.toBuffer(),
    };
  }
  return { file, schema, result };
};

@Controller("datasets")
@UseFilters(DatasetExceptionFilter)
@UseGuards(SessionAuthGuard)
export class DatasetUploadController {
  constructor(
    @Inject(DatasetUploadService)
    private readonly uploads: DatasetUploadService,
  ) {}

  @Post("uploads")
  async upload(
    @Req() request: FastifyRequest,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    try {
      const parts = await readUploadParts(request);
      if (!parts.file) throw new DatasetUploadInvalidError();
      return await this.uploads.upload(user.id, parts.file, parts.schema, parts.result);
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      if (
        error instanceof DatasetUploadFileTooLargeError ||
        (error instanceof Error && (error as Error & { code?: string }).code === "FST_REQ_FILE_TOO_LARGE")
      ) {
        throw uploadError(HttpStatus.PAYLOAD_TOO_LARGE, "DATASET_FILE_TOO_LARGE", "文件不能超过 5MB");
      }
      if (error instanceof DatasetUploadFileTypeError) {
        throw uploadError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "DATASET_FILE_TYPE_UNSUPPORTED", "当前仅支持上传 CSV 或 XLSX 文件");
      }
      if (error instanceof DatasetUploadInvalidError) throw invalidUpload();
      throw error;
    }
  }
}
