import { DashboardSchema } from "@drag-visual/contracts";
import {
  ArgumentsHost,
  Body,
  Catch,
  Controller,
  Delete,
  ExceptionFilter,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  Param,
  Post,
  Put,
  UseFilters,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";

import {
  DashboardNotFoundError,
  DashboardService,
  RevisionConflictError,
} from "./dashboard.service.js";

const CreateDashboardBody = z
  .object({ name: z.string().max(100).nullable().optional() })
  .strict();
const DashboardId = z.uuid();

const API_ERRORS = {
  schemaInvalid: {
    code: "DASHBOARD_SCHEMA_INVALID",
    message: "Dashboard schema is invalid",
  },
  notFound: {
    code: "DASHBOARD_NOT_FOUND",
    message: "Dashboard was not found",
  },
  idMismatch: {
    code: "DASHBOARD_ID_MISMATCH",
    message: "Dashboard ID does not match request path",
  },
  revisionConflict: {
    code: "DASHBOARD_VERSION_CONFLICT",
    message: "Dashboard revision is stale",
  },
  internal: {
    code: "INTERNAL_ERROR",
    message: "Internal server error",
  },
} as const;

class DashboardHttpException extends HttpException {}

const apiException = (
  status: HttpStatus,
  body: (typeof API_ERRORS)[keyof typeof API_ERRORS],
): DashboardHttpException => new DashboardHttpException(body, status);

@Catch()
export class DashboardExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DashboardExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reply = http.getResponse<FastifyReply>();
    if (exception instanceof DashboardHttpException) {
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
    const pathname = request.url.split("?", 1)[0] ?? "";
    const idMatch = pathname.match(
      /^\/dashboards\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i,
    );
    const context = {
      message: "Unexpected dashboard request failure",
      method: request.method,
      route: idMatch ? "/dashboards/:id" : "/dashboards",
      ...(idMatch?.[1] ? { dashboardId: idMatch[1] } : {}),
      errorType: exception instanceof ZodError ? "ZodError" : "Error",
    };
    this.logger.error(context);
    reply.status(HttpStatus.INTERNAL_SERVER_ERROR).send(API_ERRORS.internal);
  }
}

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
  if (error instanceof DashboardNotFoundError) {
    throw apiException(HttpStatus.NOT_FOUND, API_ERRORS.notFound);
  }
  if (error instanceof RevisionConflictError) {
    throw apiException(HttpStatus.CONFLICT, API_ERRORS.revisionConflict);
  }
  throw error;
};

@Controller("dashboards")
@UseFilters(DashboardExceptionFilter)
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboards: DashboardService) {}

  @Post()
  async create(@Body() body: unknown) {
    const { name } = parseRequest(() => CreateDashboardBody.parse(body));
    try {
      return await this.dashboards.create(name);
    } catch (error: unknown) {
      return httpError(error);
    }
  }

  @Get()
  async list() {
    return this.dashboards.list();
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const dashboardId = parseRequest(() => DashboardId.parse(id));
    try {
      return await this.dashboards.get(dashboardId);
    } catch (error: unknown) {
      return httpError(error);
    }
  }

  @Delete(":id")
  async delete(@Param("id") id: string) {
    const dashboardId = parseRequest(() => DashboardId.parse(id));
    try {
      await this.dashboards.delete(dashboardId);
      return { deleted: true };
    } catch (error: unknown) {
      return httpError(error);
    }
  }

  @Put(":id")
  async save(@Param("id") id: string, @Body() body: unknown) {
    const dashboard = parseRequest(() => DashboardSchema.parse(body));
    const routeId = parseRequest(() => DashboardId.parse(id));
    if (dashboard.id !== routeId) {
      throw apiException(HttpStatus.CONFLICT, API_ERRORS.idMismatch);
    }
    try {
      return await this.dashboards.save(dashboard);
    } catch (error: unknown) {
      return httpError(error);
    }
  }
}
