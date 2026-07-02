import { randomUUID } from "node:crypto";

import { Dashboard as DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import { Inject, Injectable } from "@nestjs/common";

import {
  DASHBOARD_REPOSITORY,
  type DashboardRepository,
} from "./dashboard.repository.js";

export class DashboardNotFoundError extends Error {
  constructor(id: string) {
    super(`Dashboard not found: ${id}`);
    this.name = "DashboardNotFoundError";
  }
}

export class RevisionConflictError extends Error {
  constructor(id: string) {
    super(`Dashboard revision conflict: ${id}`);
    this.name = "RevisionConflictError";
  }
}

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly repository: DashboardRepository,
  ) {}

  async create(name: string): Promise<Dashboard> {
    const trimmedName = name.trim() || "未命名看板";
    const dashboard = DashboardSchema.parse({
      version: 1,
      id: randomUUID(),
      name: trimmedName,
      theme: {
        primaryColor: "#1677ff",
        backgroundColor: "#f5f7fa",
      },
      layout: [],
      components: [],
      datasets: [],
      revision: 1,
      updatedAt: new Date().toISOString(),
    });
    return this.repository.create(dashboard);
  }

  async get(id: string): Promise<Dashboard> {
    const dashboard = await this.repository.find(id);
    if (!dashboard) throw new DashboardNotFoundError(id);
    return dashboard;
  }

  async save(dashboard: Dashboard): Promise<Dashboard> {
    const validDashboard = DashboardSchema.parse(dashboard);
    const saved = await this.repository.updateIfRevision(validDashboard);
    if (!saved) throw new RevisionConflictError(validDashboard.id);
    return saved;
  }
}
