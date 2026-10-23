import { CreateDatabaseDatasetRequest, DatabaseConnection } from "@drag-visual/contracts";
import { Body, Controller, Delete, HttpCode, HttpException, Inject, Param, Post, UseFilters, UseGuards } from "@nestjs/common";
import { ZodError } from "zod";
import { CurrentUser } from "../auth/current-user.decorator.js";
import type { AuthenticatedUser } from "../auth/auth.service.js";
import { SessionAuthGuard } from "../auth/session-auth.guard.js";
import { DatasetExceptionFilter } from "./dataset.controller.js";
import { DatabaseDatasetRepository } from "./database-dataset.repository.js";
import { DatasetQueryInvalidError } from "./dataset.errors.js";

@Controller("datasets/database")
@UseGuards(SessionAuthGuard)
@UseFilters(DatasetExceptionFilter)
export class DatabaseDatasetController {
  constructor(@Inject(DatabaseDatasetRepository) private readonly sources: DatabaseDatasetRepository) {}

  private async validate<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      if (error instanceof ZodError || error instanceof DatasetQueryInvalidError) throw new HttpException({ code: "DATABASE_INPUT_INVALID", message: "连接信息或所选表无效，请检查后重新连接。" }, 400);
      throw error;
    }
  }

  @Post("tables")
  @HttpCode(200)
  tables(@Body() body: unknown) {
    return this.validate(() => this.sources.tables(DatabaseConnection.parse(body)));
  }

  @Post()
  create(@Body() body: unknown, @CurrentUser() user: AuthenticatedUser) {
    return this.validate(() => this.sources.create(user.id, CreateDatabaseDatasetRequest.parse(body)));
  }

  @Delete("sources/:id")
  @HttpCode(204)
  async delete(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    if (!await this.sources.delete(id, user.id)) throw new HttpException({ code: "DATASET_NOT_FOUND", message: "数据源不存在或无权删除。" }, 404);
  }
}
