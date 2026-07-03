import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import { HttpException, Logger } from "@nestjs/common";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dashboardErrorEnvelopeHook,
  safeJsonFastifyOptions,
} from "../fastify-options.js";
import { DashboardController } from "./dashboard.controller.js";
import {
  DASHBOARD_REPOSITORY,
  InMemoryDashboardRepository,
} from "./dashboard.repository.js";
import { DashboardService } from "./dashboard.service.js";

const existingDashboard = (overrides: Partial<Dashboard> = {}): Dashboard => ({
  schemaVersion: 1,
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

const missingDashboardId = "c91a0d8e-1fc0-4f38-8c72-8b43c251f0f1";
const differentDashboardId = "daef93a7-426e-4690-aefd-a9470fe8597f";

describe("DashboardController", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.restoreAllMocks();
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
      new FastifyAdapter(safeJsonFastifyOptions),
    );
    app
      .getHttpAdapter()
      .getInstance()
      .addHook("onSend", dashboardErrorEnvelopeHook as never);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return repository;
  };

  it.each([
    ["a trimmed name", { name: "  销售看板  " }, "销售看板"],
    ["a missing name", {}, "未命名看板"],
    ["a null name", { name: null }, "未命名看板"],
    ["a blank name", { name: "   " }, "未命名看板"],
  ])("creates a dashboard with %s", async (_case, payload, expectedName) => {
    const repository = await bootstrap();

    const response = await app!.inject({
      method: "POST",
      url: "/dashboards",
      payload,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      schemaVersion: 1,
      name: expectedName,
      revision: 1,
    });
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
    expect(response.json()).toEqual({
      code: "DASHBOARD_SCHEMA_INVALID",
      message: "Dashboard schema is invalid",
    });
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

  it("rejects a malformed dashboard route UUID before repository lookup", async () => {
    class LookupMustNotRunRepository extends InMemoryDashboardRepository {
      override async find(): Promise<Dashboard | null> {
        throw new Error("repository lookup must not run");
      }
    }
    await bootstrap(new LookupMustNotRunRepository());

    const response = await app!.inject({
      method: "GET",
      url: "/dashboards/not-a-uuid",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "DASHBOARD_SCHEMA_INVALID",
      message: "Dashboard schema is invalid",
    });
  });

  it("maps a missing dashboard to a stable not-found response", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "GET",
      url: `/dashboards/${missingDashboardId}`,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      code: "DASHBOARD_NOT_FOUND",
      message: "Dashboard was not found",
    });
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

  it("rejects a malformed dashboard route UUID before mismatch or repository work", async () => {
    class SaveMustNotRunRepository extends InMemoryDashboardRepository {
      override async updateIfRevision(): Promise<Dashboard | null> {
        throw new Error("repository update must not run");
      }

      override async find(): Promise<Dashboard | null> {
        throw new Error("repository lookup must not run");
      }
    }
    await bootstrap(new SaveMustNotRunRepository());

    const response = await app!.inject({
      method: "PUT",
      url: "/dashboards/not-a-uuid",
      payload: existingDashboard(),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "DASHBOARD_SCHEMA_INVALID",
      message: "Dashboard schema is invalid",
    });
  });

  it("round-trips hostile-looking prop keys through save and persisted read", async () => {
    const repository = new InMemoryDashboardRepository();
    await repository.create(existingDashboard());
    await bootstrap(repository);
    const hostileProps = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":"constructor-value","prototype":"prototype-value"}',
    ) as Record<string, unknown>;
    const dashboard = existingDashboard({
      layout: [{ i: "text-1", x: 0, y: 0, w: 4, h: 3 }],
      components: [{ id: "text-1", type: "text", props: hostileProps }],
    });

    const saveResponse = await app!.inject({
      method: "PUT",
      url: `/dashboards/${dashboard.id}`,
      headers: { "content-type": "application/json" },
      payload: JSON.stringify(dashboard),
    });
    expect(saveResponse.statusCode, saveResponse.body).toBe(200);

    const getResponse = await app!.inject({
      method: "GET",
      url: `/dashboards/${dashboard.id}`,
    });
    expect(getResponse.statusCode).toBe(200);
    const props = (getResponse.json() as Dashboard).components[0]!.props;

    expect(Object.hasOwn(props, "__proto__")).toBe(true);
    expect(props.__proto__).toEqual({ polluted: true });
    expect(props.constructor).toBe("constructor-value");
    expect(props.prototype).toBe("prototype-value");
    expect(Object.getPrototypeOf(props)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
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
    expect(response.json()).toEqual({
      code: "DASHBOARD_VERSION_CONFLICT",
      message: "Dashboard revision is stale",
    });
    await expect(repository.find(current.id)).resolves.toEqual(current);
  });

  it("rejects a route and body ID mismatch", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "PUT",
      url: `/dashboards/${differentDashboardId}`,
      payload: existingDashboard(),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: "DASHBOARD_ID_MISMATCH",
      message: "Dashboard ID does not match request path",
    });
  });

  it("validates the complete body before comparing valid route and body IDs", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "PUT",
      url: `/dashboards/${differentDashboardId}`,
      payload: existingDashboard({ id: "not-a-uuid" }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "DASHBOARD_SCHEMA_INVALID",
      message: "Dashboard schema is invalid",
    });
  });

  it("maps an invalid dashboard body without leaking Zod details", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "PUT",
      url: `/dashboards/${existingDashboard().id}`,
      payload: { id: existingDashboard().id, revision: 1 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "DASHBOARD_SCHEMA_INVALID",
      message: "Dashboard schema is invalid",
    });
    expect(response.body).not.toContain("issues");
  });

  it("rejects unknown fixed-shape fields without leaking validation details", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "PUT",
      url: `/dashboards/${existingDashboard().id}`,
      payload: { ...existingDashboard(), extra: "not allowed" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "DASHBOARD_SCHEMA_INVALID",
      message: "Dashboard schema is invalid",
    });
  });

  it("maps an oversized JSON body to the stable schema error", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "POST",
      url: "/dashboards",
      payload: { name: "a".repeat(2 * 1024 * 1024) },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "DASHBOARD_SCHEMA_INVALID",
      message: "Dashboard schema is invalid",
    });
  });

  it("maps malformed JSON to the stable schema error", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "POST",
      url: "/dashboards",
      headers: { "content-type": "application/json" },
      payload: "{not-json",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      code: "DASHBOARD_SCHEMA_INVALID",
      message: "Dashboard schema is invalid",
    });
  });

  it("does not expose unexpected service errors", async () => {
    const logError = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    class FailingRepository extends InMemoryDashboardRepository {
      override async find(): Promise<Dashboard | null> {
        throw new Error("database password and SQL details");
      }
    }
    await bootstrap(new FailingRepository());

    const response = await app!.inject({
      method: "GET",
      url: `/dashboards/${existingDashboard().id}`,
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
    expect(response.body).not.toContain("password");
    expect(response.body).not.toContain("SQL");
    expect(logError).toHaveBeenCalledWith({
      message: "Unexpected dashboard request failure",
      method: "GET",
      route: "/dashboards/:id",
      dashboardId: existingDashboard().id,
      errorType: "Error",
    });
    const logged = JSON.stringify(logError.mock.calls);
    expect(logged).not.toContain("password");
    expect(logged).not.toContain("SQL");
  });

  it("does not trust or expose service-originated HttpException bodies", async () => {
    const logError = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    class FailingRepository extends InMemoryDashboardRepository {
      override async find(): Promise<Dashboard | null> {
        throw new HttpException(
          { code: "LEAK", message: "password SQL business-body" },
          418,
        );
      }
    }
    await bootstrap(new FailingRepository());

    const response = await app!.inject({
      method: "GET",
      url: `/dashboards/${existingDashboard().id}`,
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
    const observable = `${response.body}${JSON.stringify(logError.mock.calls)}`;
    expect(observable).not.toContain("password");
    expect(observable).not.toContain("SQL");
    expect(observable).not.toContain("business-body");
  });

  it("treats a corrupt persisted dashboard ZodError as a sanitized internal error", async () => {
    const logError = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    class CorruptPersistedRepository extends InMemoryDashboardRepository {
      override async find(): Promise<Dashboard | null> {
        return DashboardSchema.parse({
          ...existingDashboard(),
          name: "business-body-secret",
          revision: 0,
        });
      }
    }
    await bootstrap(new CorruptPersistedRepository());

    const response = await app!.inject({
      method: "GET",
      url: `/dashboards/${existingDashboard().id}`,
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
    const observable = `${response.body}${JSON.stringify(logError.mock.calls)}`;
    expect(observable).not.toContain("business-body-secret");
    expect(observable).not.toContain("invalid_type");
    expect(observable).not.toContain("issues");
    expect(logError).toHaveBeenCalledWith({
      message: "Unexpected dashboard request failure",
      method: "GET",
      route: "/dashboards/:id",
      dashboardId: existingDashboard().id,
      errorType: "ZodError",
    });
  });

  it("treats an internal create ZodError as a sanitized internal error", async () => {
    const logError = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    class InvalidCreateRepository extends InMemoryDashboardRepository {
      override async create(): Promise<Dashboard> {
        return DashboardSchema.parse({
          ...existingDashboard(),
          name: "business-create-secret",
          revision: 0,
        });
      }
    }
    await bootstrap(new InvalidCreateRepository());

    const response = await app!.inject({
      method: "POST",
      url: "/dashboards",
      payload: { name: "valid request name" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
    const observable = `${response.body}${JSON.stringify(logError.mock.calls)}`;
    expect(observable).not.toContain("business-create-secret");
    expect(observable).not.toContain("invalid_type");
    expect(logError).toHaveBeenCalledWith({
      message: "Unexpected dashboard request failure",
      method: "POST",
      route: "/dashboards",
      errorType: "ZodError",
    });
  });

  it("leaves unknown routes to the framework 404 handler", async () => {
    await bootstrap();

    const response = await app!.inject({ method: "GET", url: "/unknown" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ statusCode: 404 });
    expect(response.json()).not.toHaveProperty("code", "INTERNAL_ERROR");
  });

  it("maps an update of a missing dashboard to not found", async () => {
    await bootstrap();

    const response = await app!.inject({
      method: "PUT",
      url: `/dashboards/${existingDashboard().id}`,
      payload: existingDashboard(),
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      code: "DASHBOARD_NOT_FOUND",
      message: "Dashboard was not found",
    });
  });
});
