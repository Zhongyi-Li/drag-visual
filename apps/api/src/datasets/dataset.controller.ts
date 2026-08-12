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
  Query,
  UseGuards,
  UseFilters,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.service.js";
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
    if (exception instanceof HttpException) {
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
  async list(@CurrentUser() user: AuthenticatedUser) {
    try {
      return await this.datasets.list(user.id);
    } catch (error: unknown) {
      return httpError(error);
    }
  }

  @Get(":datasetId/schema")
  async schema(@Param("datasetId") datasetId: string, @CurrentUser() user: AuthenticatedUser) {
    try {
      return await this.datasets.getSchema(datasetId, user.id);
    } catch (error: unknown) {
      return httpError(error);
    }
  }

  @Get(":datasetId/fields/:fieldKey/options")
  async fieldOptions(
    @Param("datasetId") datasetId: string,
    @Param("fieldKey") fieldKey: string,
    @Query("search") search: string | undefined,
    @Query("limit") rawLimit: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const limit = rawLimit === undefined ? 200 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) return apiException(HttpStatus.BAD_REQUEST, API_ERRORS.queryInvalid);
    try {
      return await this.datasets.getFieldOptions(datasetId, fieldKey, search?.trim() || undefined, limit, user.id);
    } catch (error: unknown) {
      return httpError(error);
    }
  }

  @Post(":datasetId/query")
  @HttpCode(HttpStatus.OK)
  async query(
    @Param("datasetId") datasetId: string,
    @Body() body: unknown,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const request = parseBody(body);
    try {
      return await this.datasets.query(datasetId, request, user.id);
    } catch (error: unknown) {
      return httpError(error);
    }
  }
}
