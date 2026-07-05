import { DashboardSchema, migrateDashboard, type Dashboard } from "@drag-visual/contracts";
import { Inject, Injectable } from "@nestjs/common";

import {
  PUBLISHING_REPOSITORY,
  type PublishingRepository,
} from "./publishing.repository.js";

export class DashboardNotFoundForPublishingError extends Error {
  constructor(id: string) {
    super(`Dashboard not found: ${id}`);
    this.name = "DashboardNotFoundForPublishingError";
  }
}

export class PublishedDashboardNotFoundError extends Error {
  constructor(id: string) {
    super(`Published dashboard not found: ${id}`);
    this.name = "PublishedDashboardNotFoundError";
  }
}

export class InvalidDraftSchemaError extends Error {
  constructor(id: string) {
    super(`Invalid draft schema: ${id}`);
    this.name = "InvalidDraftSchemaError";
  }
}

@Injectable()
export class PublishingService {
  constructor(
    @Inject(PUBLISHING_REPOSITORY)
    private readonly repository: PublishingRepository,
  ) {}

  async publish(id: string): Promise<Dashboard> {
    try {
      const published = await this.repository.publishDraft(id, (draft) => {
        const parsed = DashboardSchema.safeParse(draft);
        if (!parsed.success) throw new InvalidDraftSchemaError(id);
        return structuredClone(parsed.data);
      });
      if (published === null) throw new DashboardNotFoundForPublishingError(id);
      return published;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === "DASHBOARD_NOT_FOUND") {
        throw new DashboardNotFoundForPublishingError(id);
      }
      throw error;
    }
  }

  async getPublished(id: string): Promise<Dashboard> {
    const snapshot = await this.repository.getPublished(id);
    if (snapshot === null) throw new PublishedDashboardNotFoundError(id);
    return migrateDashboard(snapshot);
  }
}
