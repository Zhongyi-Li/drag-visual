import type { Dashboard } from "@drag-visual/contracts";
import { Inject, Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client.js";
import { dashboardToPrismaJson } from "../dashboards/prisma-dashboard.repository.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { PublishingRepository } from "./publishing.repository.js";

@Injectable()
export class PrismaPublishingRepository implements PublishingRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getDraft(id: string): Promise<unknown | null> {
    const record = await this.prisma.dashboardRecord.findUnique({
      where: { id },
      select: { draftSchema: true },
    });
    return record?.draftSchema ?? null;
  }

  async replacePublished(id: string, snapshot: Dashboard): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.dashboardRecord.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!current) throw new Error("DASHBOARD_NOT_FOUND");
      await transaction.dashboardRecord.update({
        where: { id },
        data: { publishedSchema: dashboardToPrismaJson(snapshot), publishedAt: new Date() },
      });
    });
  }

  async publishDraft(id: string, validate: (draft: unknown) => Dashboard, ownerId?: string): Promise<Dashboard | null> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.dashboardRecord.findUnique({
        where: { id, ...(ownerId ? { ownerId } : {}) },
        select: { draftSchema: true },
      });
      if (!current) return null;
      const snapshot = validate(current.draftSchema);
      await transaction.dashboardRecord.update({
        where: { id },
        data: { publishedSchema: dashboardToPrismaJson(snapshot), publishedAt: new Date() },
      });
      return snapshot;
    });
  }

  async unpublish(id: string, ownerId?: string): Promise<boolean> {
    const result = await this.prisma.dashboardRecord.updateMany({
      where: { id, ...(ownerId ? { ownerId } : {}) },
      data: { publishedSchema: Prisma.DbNull, publishedAt: null },
    });
    return result.count === 1;
  }

  async getPublished(id: string): Promise<unknown | null> {
    const record = await this.prisma.dashboardRecord.findUnique({
      where: { id },
      select: { publishedSchema: true },
    });
    return record?.publishedSchema ?? null;
  }
}
