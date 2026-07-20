import {
  ArgumentsHost,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  UseFilters,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";

import {
  DashboardNotFoundForPublishingError,
  InvalidDraftSchemaError,
  PublishedDashboardNotFoundError,
  PublishingService,
} from "./publishing.service.js";

const DashboardId = z.uuid();

const API_ERRORS = {
  schemaInvalid: {
    code: "DASHBOARD_SCHEMA_INVALID",
    message: "Dashboard schema is invalid",
  },
  dashboardNotFound: {
    code: "DASHBOARD_NOT_FOUND",
    message: "Dashboard was not found",
  },
  publishedNotFound: {
    code: "PUBLISHED_DASHBOARD_NOT_FOUND",
    message: "Published dashboard was not found",
  },
  invalidDraft: {
    code: "INVALID_DRAFT_SCHEMA",
    message: "Stored draft schema is invalid",
  },
  publishFailed: {
    code: "PUBLISH_FAILED",
    message: "Dashboard publish failed",
  },
} as const;

class PublishingHttpException extends HttpException {}

const apiException = (
  status: HttpStatus,
  body: (typeof API_ERRORS)[keyof typeof API_ERRORS],
): PublishingHttpException => new PublishingHttpException(body, status);

const parseRequest = <Result>(parse: () => Result): Result => {
  try {
    return parse();
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      throw apiException(HttpStatus.BAD_REQUEST, API_ERRORS.schemaInvalid);
    }
    throw error;
  }
};

const httpError = (error: unknown): never => {
  if (error instanceof HttpException) throw error;
  if (error instanceof DashboardNotFoundForPublishingError) {
    throw apiException(HttpStatus.NOT_FOUND, API_ERRORS.dashboardNotFound);
  }
  if (error instanceof PublishedDashboardNotFoundError) {
    throw apiException(HttpStatus.NOT_FOUND, API_ERRORS.publishedNotFound);
  }
  if (error instanceof InvalidDraftSchemaError) {
    throw apiException(HttpStatus.INTERNAL_SERVER_ERROR, API_ERRORS.invalidDraft);
  }
  throw apiException(HttpStatus.INTERNAL_SERVER_ERROR, API_ERRORS.publishFailed);
};

@Catch()
export class PublishingExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PublishingExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    if (exception instanceof PublishingHttpException) {
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
      message: "Unexpected publishing request failure",
      method: request.method,
      route: request.url.split("?", 1)[0],
      errorType: exception instanceof Error ? exception.name : "Unknown",
    });
    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send(API_ERRORS.publishFailed);
  }
}

@Controller()
@UseFilters(PublishingExceptionFilter)
export class PublishingController {
  constructor(@Inject(PublishingService) private readonly publishing: PublishingService) {}

  @Post("dashboards/:id/publish")
  async publish(@Param("id") id: string) {
    const dashboardId = parseRequest(() => DashboardId.parse(id));
    try {
      return await this.publishing.publish(dashboardId);
    } catch (error: unknown) {
      return httpError(error);
    }
  }

  @Get("published-dashboards/:id")
  async getPublished(@Param("id") id: string) {
    const dashboardId = parseRequest(() => DashboardId.parse(id));
    try {
      return await this.publishing.getPublished(dashboardId);
    } catch (error: unknown) {
      return httpError(error);
    }
  }
}
