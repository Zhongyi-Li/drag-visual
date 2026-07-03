import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import { Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { DashboardRepository } from "./dashboard.repository.js";

const toNestedInputJson = (
  value: unknown,
  ancestors: WeakSet<object>,
): Prisma.InputJsonValue | null => {
  if (value === null) return null;
  if (
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    throw new TypeError("Dashboard JSON contains a non-finite number");
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new TypeError("Dashboard JSON contains a circular value");
    }
    ancestors.add(value);
    const result = value.map((entry) => toNestedInputJson(entry, ancestors));
    ancestors.delete(value);
    return result;
  }
  if (typeof value === "object") return objectToInputJson(value, ancestors);
  throw new TypeError("Dashboard JSON contains an unsupported value");
};

const objectToInputJson = (
  value: object,
  ancestors: WeakSet<object>,
): Prisma.InputJsonObject => {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("Dashboard JSON contains a non-plain object");
  }
  if (ancestors.has(value)) {
    throw new TypeError("Dashboard JSON contains a circular value");
  }
  ancestors.add(value);
  const result: Record<string, Prisma.InputJsonValue | null> = {};
  for (const [key, entry] of Object.entries(value)) {
    Object.defineProperty(result, key, {
      value: toNestedInputJson(entry, ancestors),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  ancestors.delete(value);
  return result;
};

export const dashboardToPrismaJson = (
  dashboard: Dashboard,
): Prisma.InputJsonObject => objectToInputJson(dashboard, new WeakSet());

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
