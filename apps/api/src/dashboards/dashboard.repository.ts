import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";

export const DASHBOARD_REPOSITORY = Symbol("DASHBOARD_REPOSITORY");

export interface DashboardRepository {
  create(dashboard: Dashboard, ownerId?: string): Promise<Dashboard>;
  list(ownerId?: string): Promise<Dashboard[]>;
  find(id: string, ownerId?: string): Promise<Dashboard | null>;
  delete(id: string, ownerId?: string): Promise<boolean>;
  updateIfRevision(dashboard: Dashboard, ownerId?: string): Promise<Dashboard | null>;
  renameIfRevision(id: string, name: string, revision: number, ownerId?: string): Promise<Dashboard | null>;
}

const clone = (dashboard: Dashboard): Dashboard => structuredClone(dashboard);

export class InMemoryDashboardRepository implements DashboardRepository {
  readonly #dashboards = new Map<string, { dashboard: Dashboard; ownerId?: string }>();

  async create(dashboard: Dashboard, ownerId?: string): Promise<Dashboard> {
    const stored = clone(DashboardSchema.parse(dashboard));
    this.#dashboards.set(stored.id, { dashboard: stored, ownerId: ownerId ?? "test-user" });
    return clone(stored);
  }

  async list(ownerId?: string): Promise<Dashboard[]> {
    return [...this.#dashboards.values()]
      .filter((record) => ownerId === undefined || record.ownerId === ownerId)
      .map((record) => record.dashboard)
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .map(clone);
  }

  async find(id: string, ownerId?: string): Promise<Dashboard | null> {
    const record = this.#dashboards.get(id);
    return record && (ownerId === undefined || record.ownerId === ownerId) ? clone(record.dashboard) : null;
  }

  async delete(id: string, ownerId?: string): Promise<boolean> {
    const record = this.#dashboards.get(id);
    if (!record || (ownerId !== undefined && record.ownerId !== ownerId)) return false;
    return this.#dashboards.delete(id);
  }

  async updateIfRevision(dashboard: Dashboard, ownerId?: string): Promise<Dashboard | null> {
    const current = this.#dashboards.get(dashboard.id);
    if (!current || current.dashboard.revision !== dashboard.revision || (ownerId !== undefined && current.ownerId !== ownerId)) return null;
    const next = DashboardSchema.parse({
      ...dashboard,
      revision: dashboard.revision + 1,
      updatedAt: new Date().toISOString(),
    });
    this.#dashboards.set(next.id, { dashboard: clone(next), ...(current.ownerId ? { ownerId: current.ownerId } : {}) });
    return clone(next);
  }

  async renameIfRevision(id: string, name: string, revision: number, ownerId?: string): Promise<Dashboard | null> {
    const current = this.#dashboards.get(id);
    if (!current || current.dashboard.revision !== revision || (ownerId !== undefined && current.ownerId !== ownerId)) return null;
    const next = DashboardSchema.parse({
      ...current.dashboard,
      name,
      revision: current.dashboard.revision + 1,
      updatedAt: new Date().toISOString(),
    });
    this.#dashboards.set(id, { dashboard: clone(next), ...(current.ownerId ? { ownerId: current.ownerId } : {}) });
    return clone(next);
  }
}
