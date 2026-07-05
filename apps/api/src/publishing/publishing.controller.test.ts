import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "vitest";

import { safeJsonFastifyOptions } from "../fastify-options.js";
import { InMemoryPublishingRepository, PUBLISHING_REPOSITORY } from "./publishing.repository.js";
import { PublishingController } from "./publishing.controller.js";
import { PublishingService } from "./publishing.service.js";

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

const missingId = "c91a0d8e-1fc0-4f38-8c72-8b43c251f0f1";

describe("PublishingController", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const bootstrap = async (repository = new InMemoryPublishingRepository()) => {
    const module = await Test.createTestingModule({
      controllers: [PublishingController],
      providers: [
        PublishingService,
        { provide: PUBLISHING_REPOSITORY, useValue: repository },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(safeJsonFastifyOptions));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return repository;
  };

  it("publishes a draft and returns the immutable snapshot", async () => {
    const repository = new InMemoryPublishingRepository();
    repository.seed({ id: dashboard().id, draftSchema: dashboard(), publishedSchema: null });
    await bootstrap(repository);

    const response = await app!.inject({ method: "POST", url: `/dashboards/${dashboard().id}/publish` });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(dashboard());
  });

  it("reads a published dashboard snapshot", async () => {
    const repository = new InMemoryPublishingRepository();
    repository.seed({ id: dashboard().id, draftSchema: dashboard(), publishedSchema: dashboard({ name: "发布快照" }) });
    await bootstrap(repository);

    const response = await app!.inject({ method: "GET", url: `/published-dashboards/${dashboard().id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: "发布快照" });
  });

  it("maps missing and unpublished dashboards to stable not-found errors", async () => {
    const repository = new InMemoryPublishingRepository();
    repository.seed({ id: dashboard().id, draftSchema: dashboard(), publishedSchema: null });
    await bootstrap(repository);

    const publishMissing = await app!.inject({ method: "POST", url: `/dashboards/${missingId}/publish` });
    expect(publishMissing.statusCode).toBe(404);
    expect(publishMissing.json()).toEqual({ code: "DASHBOARD_NOT_FOUND", message: "Dashboard was not found" });

    const getUnpublished = await app!.inject({ method: "GET", url: `/published-dashboards/${dashboard().id}` });
    expect(getUnpublished.statusCode).toBe(404);
    expect(getUnpublished.json()).toEqual({ code: "PUBLISHED_DASHBOARD_NOT_FOUND", message: "Published dashboard was not found" });
  });

  it("maps invalid draft schemas without leaking validation internals", async () => {
    const repository = new InMemoryPublishingRepository();
    repository.seed({ id: dashboard().id, draftSchema: { bad: true }, publishedSchema: null });
    await bootstrap(repository);

    const response = await app!.inject({ method: "POST", url: `/dashboards/${dashboard().id}/publish` });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ code: "INVALID_DRAFT_SCHEMA", message: "Stored draft schema is invalid" });
  });
});
