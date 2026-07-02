import { Dashboard as DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import { Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { DashboardRepository } from "./dashboard.repository.js";

const toNestedInputJson = (
  value: unknown,
): Prisma.InputJsonValue | null => {
  if (value === null) return null;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(toNestedInputJson);
  if (typeof value === "object") return objectToInputJson(value);
  throw new TypeError("Dashboard JSON contains an unsupported value");
};

const objectToInputJson = (value: object): Prisma.InputJsonObject => {
  const result: Record<string, Prisma.InputJsonValue | null> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      Object.defineProperty(result, key, {
        value: toNestedInputJson(entry),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }
  return result;
};

export const dashboardToPrismaJson = (
  dashboard: Dashboard,
): Prisma.InputJsonObject => objectToInputJson(dashboard);

@Injectable()
export class PrismaDashboardRepository implements DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(dashboard: Dashboard): Promise<Dashboard> {
    const record = await this.prisma.dashboardRecord.create({
      data: {
        id: dashboard.id,
        name: dashboard.name,
        revision: dashboard.revision,
        draftSchema: dashboardToPrismaJson(dashboard),
      },
    });
    return DashboardSchema.parse(record.draftSchema);
  }

  async find(id: string): Promise<Dashboard | null> {
    const record = await this.prisma.dashboardRecord.findUnique({
      where: { id },
    });
    return record ? DashboardSchema.parse(record.draftSchema) : null;
  }

  async updateIfRevision(dashboard: Dashboard): Promise<Dashboard | null> {
    const next = DashboardSchema.parse({
      ...dashboard,
      revision: dashboard.revision + 1,
      updatedAt: new Date().toISOString(),
    });
    const result = await this.prisma.dashboardRecord.updateMany({
      where: { id: dashboard.id, revision: dashboard.revision },
      data: {
        name: next.name,
        revision: next.revision,
        draftSchema: dashboardToPrismaJson(next),
      },
    });
    return result.count === 1 ? next : null;
  }
}
