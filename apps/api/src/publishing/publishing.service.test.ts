import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import { InMemoryPublishingRepository } from "./publishing.repository.js";
import {
  DashboardNotFoundForPublishingError,
  InvalidDraftSchemaError,
  PublishedDashboardNotFoundError,
  PublishingService,
} from "./publishing.service.js";

const dashboard = (overrides: Partial<Dashboard> = {}): Dashboard => DashboardSchema.parse({
  schemaVersion: 1,
  id: "645615f9-cddb-468e-a11d-91b477a4e2ac",
  name: "销售看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [],
  components: [],
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-04T08:00:00.000Z",
  ...overrides,
});

describe("PublishingService", () => {
  it("copies a validated draft into the published snapshot", async () => {
    const repository = new InMemoryPublishingRepository();
    repository.seed({ id: dashboard().id, draftSchema: dashboard(), publishedSchema: null });

    const published = await new PublishingService(repository).publish(dashboard().id);

    expect(published).toEqual(dashboard());
    await expect(repository.getPublished(dashboard().id)).resolves.toEqual(dashboard());
  });

  it("leaves the previous snapshot intact when validation fails", async () => {
    const previous = dashboard({ name: "已发布版本" });
    const repository = new InMemoryPublishingRepository();
    repository.seed({
      id: dashboard().id,
      draftSchema: { bad: true },
      publishedSchema: previous,
    });

    await expect(new PublishingService(repository).publish(dashboard().id)).rejects.toBeInstanceOf(InvalidDraftSchemaError);
    await expect(repository.getPublished(dashboard().id)).resolves.toEqual(previous);
  });

  it("reports a missing draft dashboard", async () => {
    const service = new PublishingService(new InMemoryPublishingRepository());

    await expect(service.publish(dashboard().id)).rejects.toBeInstanceOf(DashboardNotFoundForPublishingError);
  });

  it("parses an existing published dashboard", async () => {
    const repository = new InMemoryPublishingRepository();
    repository.seed({ id: dashboard().id, draftSchema: dashboard(), publishedSchema: dashboard({ name: "发布页" }) });

    await expect(new PublishingService(repository).getPublished(dashboard().id)).resolves.toMatchObject({ name: "发布页" });
  });

  it("reports an unpublished dashboard distinctly from a missing draft", async () => {
    const repository = new InMemoryPublishingRepository();
    repository.seed({ id: dashboard().id, draftSchema: dashboard(), publishedSchema: null });

    await expect(new PublishingService(repository).getPublished(dashboard().id)).rejects.toBeInstanceOf(PublishedDashboardNotFoundError);
  });
});
