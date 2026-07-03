import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";

export const DASHBOARD_REPOSITORY = Symbol("DASHBOARD_REPOSITORY");

export interface DashboardRepository {
  create(dashboard: Dashboard): Promise<Dashboard>;
  find(id: string): Promise<Dashboard | null>;
  updateIfRevision(dashboard: Dashboard): Promise<Dashboard | null>;
}

const clone = (dashboard: Dashboard): Dashboard => structuredClone(dashboard);

export class InMemoryDashboardRepository implements DashboardRepository {
  readonly #dashboards = new Map<string, Dashboard>();

  async create(dashboard: Dashboard): Promise<Dashboard> {
    const stored = clone(DashboardSchema.parse(dashboard));
    this.#dashboards.set(stored.id, stored);
    return clone(stored);
  }

  async find(id: string): Promise<Dashboard | null> {
    const dashboard = this.#dashboards.get(id);
    return dashboard ? clone(dashboard) : null;
  }

  async updateIfRevision(dashboard: Dashboard): Promise<Dashboard | null> {
    const current = this.#dashboards.get(dashboard.id);
    if (!current || current.revision !== dashboard.revision) return null;

    const next = DashboardSchema.parse({
      ...dashboard,
      revision: dashboard.revision + 1,
      updatedAt: new Date().toISOString(),
    });
    this.#dashboards.set(next.id, clone(next));
    return clone(next);
  }
}
