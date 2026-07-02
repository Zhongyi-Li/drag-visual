import type { Dashboard } from "@drag-visual/contracts";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it } from "vitest";

import { DashboardController } from "./dashboard.controller.js";
import {
  DASHBOARD_REPOSITORY,
  InMemoryDashboardRepository,
} from "./dashboard.repository.js";
import { DashboardService } from "./dashboard.service.js";

const existingDashboard = (overrides: Partial<Dashboard> = {}): Dashboard => ({
  version: 1,
  id: "645615f9-cddb-468e-a11d-91b477a4e2ac",
  name: "销售看板",
  theme: {
    primaryColor: "#1677ff",
    backgroundColor: "#f5f7fa",
  },
  layout: [],
  components: [],
  datasets: [],
  revision: 1,
  updatedAt: "2020-01-01T00:00:00.000Z",
  ...overrides,
});

describe("DashboardController", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  const bootstrap = async (
    repository = new InMemoryDashboardRepository(),
  ): Promise<InMemoryDashboardRepository> => {
    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        DashboardService,
        { provide: DASHBOARD_REPOSITORY, useValue: repository },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return repository;
  };

  it("creates a dashboard", async () => {
    const repository = await bootstrap();

    const response = await app!.inject({
      method: "POST",
      url: "/dashboards",
      payload: { name: "  销售看板  " },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ name: "销售看板", revision: 1 });
    await expect(repository.find(response.json().id)).resolves.toEqual(
      response.json(),
    );
  });

  it("maps an overlong name to a stable bad request", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "POST",
      url: "/dashboards",
      payload: { name: "看".repeat(101) },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "DASHBOARD_SCHEMA_INVALID" });
  });

  it("gets an existing dashboard", async () => {
    const repository = new InMemoryDashboardRepository();
    await repository.create(existingDashboard());
    await bootstrap(repository);

    const response = await app!.inject({
      method: "GET",
      url: `/dashboards/${existingDashboard().id}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(existingDashboard());
  });

  it("maps a missing dashboard to a stable not-found response", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "GET",
      url: "/dashboards/missing",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ code: "DASHBOARD_NOT_FOUND" });
  });

  it("saves a dashboard through an optimistic revision", async () => {
    const repository = new InMemoryDashboardRepository();
    await repository.create(existingDashboard());
    await bootstrap(repository);

    const response = await app!.inject({
      method: "PUT",
      url: `/dashboards/${existingDashboard().id}`,
      payload: existingDashboard({ name: "新名称" }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ name: "新名称", revision: 2 });
  });

  it("maps a stale revision to a stable conflict response without overwrite", async () => {
    const repository = new InMemoryDashboardRepository();
    const current = existingDashboard({ revision: 2, name: "服务端版本" });
    await repository.create(current);
    await bootstrap(repository);

    const response = await app!.inject({
      method: "PUT",
      url: `/dashboards/${current.id}`,
      payload: existingDashboard({ revision: 1, name: "过期版本" }),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ code: "DASHBOARD_VERSION_CONFLICT" });
    await expect(repository.find(current.id)).resolves.toEqual(current);
  });

  it("rejects a route and body ID mismatch", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "PUT",
      url: "/dashboards/different-id",
      payload: existingDashboard(),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ code: "DASHBOARD_ID_MISMATCH" });
  });

  it("maps an invalid dashboard body without leaking Zod details", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "PUT",
      url: `/dashboards/${existingDashboard().id}`,
      payload: { id: existingDashboard().id, revision: 1 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ code: "DASHBOARD_SCHEMA_INVALID" });
    expect(response.body).not.toContain("issues");
  });
});
