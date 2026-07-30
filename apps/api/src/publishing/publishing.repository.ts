import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";

export const PUBLISHING_REPOSITORY = Symbol("PUBLISHING_REPOSITORY");

export interface PublishingRepository {
  getDraft(id: string): Promise<unknown | null>;
  publishDraft(id: string, validate: (draft: unknown) => Dashboard, ownerId?: string): Promise<Dashboard | null>;
  unpublish(id: string, ownerId?: string): Promise<boolean>;
  replacePublished(id: string, snapshot: Dashboard): Promise<void>;
  getPublished(id: string): Promise<unknown | null>;
}

const cloneDashboard = (value: unknown): unknown => structuredClone(value);

export class InMemoryPublishingRepository implements PublishingRepository {
  readonly #records = new Map<string, { draftSchema: unknown; publishedSchema: unknown | null; ownerId?: string }>();

  seed(value: { id: string; draftSchema: unknown; publishedSchema: unknown | null; ownerId?: string }): void {
    this.#records.set(value.id, {
      draftSchema: cloneDashboard(value.draftSchema),
      publishedSchema: cloneDashboard(value.publishedSchema),
      ownerId: value.ownerId ?? "test-user",
    });
  }

  async getDraft(id: string): Promise<unknown | null> {
    const record = this.#records.get(id);
    return record ? cloneDashboard(record.draftSchema) : null;
  }

  async replacePublished(id: string, snapshot: Dashboard): Promise<void> {
    const current = this.#records.get(id);
    if (!current) throw new Error("DASHBOARD_NOT_FOUND");
    const parsed = DashboardSchema.parse(snapshot);
    this.#records.set(id, {
      draftSchema: cloneDashboard(current.draftSchema),
      publishedSchema: cloneDashboard(parsed),
    });
  }

  async publishDraft(id: string, validate: (draft: unknown) => Dashboard, ownerId?: string): Promise<Dashboard | null> {
    const current = this.#records.get(id);
    if (!current || (ownerId !== undefined && current.ownerId !== ownerId)) return null;
    const snapshot = validate(cloneDashboard(current.draftSchema));
    this.#records.set(id, {
      draftSchema: cloneDashboard(current.draftSchema),
      publishedSchema: cloneDashboard(snapshot),
      ...(current.ownerId ? { ownerId: current.ownerId } : {}),
    });
    return cloneDashboard(snapshot) as Dashboard;
  }

  async unpublish(id: string, ownerId?: string): Promise<boolean> {
    const current = this.#records.get(id);
    if (!current || (ownerId !== undefined && current.ownerId !== ownerId)) return false;
    this.#records.set(id, {
      draftSchema: cloneDashboard(current.draftSchema),
      publishedSchema: null,
      ...(current.ownerId ? { ownerId: current.ownerId } : {}),
    });
    return true;
  }

  async getPublished(id: string): Promise<unknown | null> {
    const record = this.#records.get(id);
    return record ? cloneDashboard(record.publishedSchema) : null;
  }
}
