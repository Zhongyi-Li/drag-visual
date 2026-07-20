import type { Dashboard } from "@drag-visual/contracts";
import { Inject, Injectable } from "@nestjs/common";

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
        data: { publishedSchema: dashboardToPrismaJson(snapshot) },
      });
    });
  }

  async publishDraft(id: string, validate: (draft: unknown) => Dashboard): Promise<Dashboard | null> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.dashboardRecord.findUnique({
        where: { id },
        select: { draftSchema: true },
      });
      if (!current) return null;
      const snapshot = validate(current.draftSchema);
      await transaction.dashboardRecord.update({
        where: { id },
        data: { publishedSchema: dashboardToPrismaJson(snapshot) },
      });
      return snapshot;
    });
  }

  async getPublished(id: string): Promise<unknown | null> {
    const record = await this.prisma.dashboardRecord.findUnique({
      where: { id },
      select: { publishedSchema: true },
    });
    return record?.publishedSchema ?? null;
  }
}
