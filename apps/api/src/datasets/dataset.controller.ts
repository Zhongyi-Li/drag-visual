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
  UseGuards,
  UseFilters,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import {
  DatasetInvalidResponseError,
  DatasetNotFoundError,
  DatasetQueryInvalidError,
  DatasetService,
} from "./dataset.service.js";
import { DatasetTimeoutError, DatasetUpstreamError } from "./dataset.errors.js";

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
  upstream: { code: "DATASET_UPSTREAM_ERROR", message: "Dataset upstream request failed" },
  timeout: { code: "DATASET_TIMEOUT", message: "Dataset request timed out" },
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
  if (error instanceof DatasetUpstreamError) {
    throw apiException(HttpStatus.BAD_GATEWAY, API_ERRORS.upstream);
  }
  if (error instanceof DatasetTimeoutError) {
    throw apiException(HttpStatus.GATEWAY_TIMEOUT, API_ERRORS.timeout);
  }
  throw error;
};

@Catch()
export class DatasetExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DatasetExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    if (exception instanceof DatasetHttpException || (exception instanceof HttpException && exception.getStatus() === HttpStatus.UNAUTHORIZED)) {
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
      errorMessage: exception instanceof Error ? exception.message : String(exception),
    });
    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send(API_ERRORS.internal);
  }
}

@Controller("datasets")
@UseFilters(DatasetExceptionFilter)
@UseGuards(SessionAuthGuard)
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
