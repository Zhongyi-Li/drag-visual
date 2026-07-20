import { DatasetQueryRequest } from "@drag-visual/contracts";
import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  UseFilters,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import {
  DatasetInvalidResponseError,
  DatasetNotFoundError,
  DatasetQueryInvalidError,
  DatasetService,
} from "./dataset.service.js";

const API_ERRORS = {
  notFound: { code: "DATASET_NOT_FOUND", message: "Dataset was not found" },
  queryInvalid: {
    code: "DATASET_QUERY_INVALID",
    message: "Dataset query is invalid",
  },
  invalidResponse: {
    code: "DATASET_INVALID_RESPONSE",
    message: "Dataset response is invalid",
  },
  internal: { code: "INTERNAL_ERROR", message: "Internal server error" },
} as const;

class DatasetHttpException extends HttpException {}

const apiException = (
  status: HttpStatus,
  body: (typeof API_ERRORS)[keyof typeof API_ERRORS],
): DatasetHttpException => new DatasetHttpException(body, status);

const parseBody = (body: unknown) => {
  try {
    return DatasetQueryRequest.parse(body);
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw apiException(HttpStatus.BAD_REQUEST, API_ERRORS.queryInvalid);
    }
    throw error;
  }
};

const httpError = (error: unknown): never => {
  if (error instanceof HttpException) throw error;
  if (error instanceof DatasetNotFoundError) {
    throw apiException(HttpStatus.NOT_FOUND, API_ERRORS.notFound);
  }
  if (error instanceof DatasetQueryInvalidError) {
    throw apiException(HttpStatus.BAD_REQUEST, API_ERRORS.queryInvalid);
  }
  if (error instanceof DatasetInvalidResponseError) {
    throw apiException(HttpStatus.BAD_GATEWAY, API_ERRORS.invalidResponse);
  }
  throw error;
};

@Catch()
export class DatasetExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatasetExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    if (exception instanceof DatasetHttpException) {
      const response = exception.getResponse();
      if (
        typeof response === "object" &&
        response !== null &&
        "code" in response &&
        "message" in response
      ) {
        reply.status(exception.getStatus()).send(response);
        return;
      }
    }
    const request = http.getRequest<FastifyRequest>();
    this.logger.error({
      message: "Unexpected dataset request failure",
      method: request.method,
      route: request.url.split("?", 1)[0],
      errorType: exception instanceof Error ? exception.name : "Unknown",
    });
    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send(API_ERRORS.internal);
  }
}

@Controller("datasets")
@UseFilters(DatasetExceptionFilter)
export class DatasetController {
  constructor(@Inject(DatasetService) private readonly datasets: DatasetService) {}

  @Get()
  async list() {
    return this.datasets.list();
  }

  @Get(":datasetId/schema")
  async schema(@Param("datasetId") datasetId: string) {
    try {
      return await this.datasets.getSchema(datasetId);
    } catch (error: unknown) {
      return httpError(error);
    }
  }

  @Post(":datasetId/query")
  @HttpCode(HttpStatus.OK)
  async query(@Param("datasetId") datasetId: string, @Body() body: unknown) {
    const request = parseBody(body);
    try {
      return await this.datasets.query(datasetId, request);
    } catch (error: unknown) {
      return httpError(error);
    }
  }
}
