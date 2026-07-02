import { Dashboard as DashboardSchema } from "@drag-visual/contracts";
import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import { z, ZodError } from "zod";

import {
  DashboardNotFoundError,
  DashboardService,
  RevisionConflictError,
} from "./dashboard.service.js";

const CreateDashboardBody = z.object({ name: z.string() });

const httpError = (error: unknown): never => {
  if (error instanceof DashboardNotFoundError) {
    throw new HttpException(
      { code: "DASHBOARD_NOT_FOUND" },
      HttpStatus.NOT_FOUND,
    );
  }
  if (error instanceof RevisionConflictError) {
    throw new HttpException(
      { code: "DASHBOARD_VERSION_CONFLICT" },
      HttpStatus.CONFLICT,
    );
  }
  if (error instanceof ZodError) {
    throw new HttpException(
      { code: "DASHBOARD_SCHEMA_INVALID" },
      HttpStatus.BAD_REQUEST,
    );
  }
  throw error;
};

@Controller("dashboards")
export class DashboardController {
  constructor(private readonly dashboards: DashboardService) {}

  @Post()
  async create(@Body() body: unknown) {
    try {
      const { name } = CreateDashboardBody.parse(body);
      return await this.dashboards.create(name);
    } catch (error: unknown) {
      return httpError(error);
    }
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    try {
      return await this.dashboards.get(id);
    } catch (error: unknown) {
      return httpError(error);
    }
  }

  @Put(":id")
  async save(@Param("id") id: string, @Body() body: unknown) {
    try {
      const bodyId =
        typeof body === "object" && body !== null && "id" in body
          ? body.id
          : undefined;
      if (typeof bodyId === "string" && bodyId !== id) {
        throw new HttpException(
          { code: "DASHBOARD_ID_MISMATCH" },
          HttpStatus.CONFLICT,
        );
      }
      return await this.dashboards.save(DashboardSchema.parse(body));
    } catch (error: unknown) {
      return httpError(error);
    }
  }
}
