import type { Dashboard } from "@drag-visual/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  dashboardToPrismaJson,
  PrismaDashboardRepository,
} from "./prisma-dashboard.repository.js";

const validDashboard = (overrides: Partial<Dashboard> = {}): Dashboard => ({
  schemaVersion: 1,
  id: "645615f9-cddb-468e-a11d-91b477a4e2ac",
  name: "销售看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [],
  components: [],
  datasets: [],
  revision: 1,
  updatedAt: "2020-01-01T00:00:00.000Z",
  ...overrides,
});

const createRepository = () => {
  const dashboardRecord = {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  };
  return {
    dashboardRecord,
    repository: new PrismaDashboardRepository({ dashboardRecord } as never),
  };
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("dashboardToPrismaJson", () => {
  it("preserves valid nested JSON null values", () => {
    const dashboard: Dashboard = {
      schemaVersion: 1,
      id: "645615f9-cddb-468e-a11d-91b477a4e2ac",
      name: "销售看板",
      theme: {
        primaryColor: "#1677ff",
        backgroundColor: "#f5f7fa",
      },
      layout: [{ i: "text-1", x: 0, y: 0, w: 1, h: 1 }],
      components: [
        {
          id: "text-1",
          type: "text",
          props: { content: null },
        },
      ],
      datasets: [],
      revision: 1,
      updatedAt: "2020-01-01T00:00:00.000Z",
    };

    expect(dashboardToPrismaJson(dashboard)).toEqual(dashboard);
  });

  it("preserves hostile own keys without changing object prototypes", () => {
    const hostileProps: Record<string, unknown> = {};
    Object.defineProperty(hostileProps, "__proto__", {
      value: { polluted: true },
      enumerable: true,
    });
    Object.defineProperty(hostileProps, "constructor", {
      value: "constructor-value",
      enumerable: true,
    });
    Object.defineProperty(hostileProps, "prototype", {
      value: "prototype-value",
      enumerable: true,
    });
    const dashboard: Dashboard = {
      schemaVersion: 1,
      id: "645615f9-cddb-468e-a11d-91b477a4e2ac",
      name: "键名测试",
      theme: {
        primaryColor: "#1677ff",
        backgroundColor: "#f5f7fa",
      },
      layout: [{ i: "text-1", x: 0, y: 0, w: 1, h: 1 }],
      components: [{ id: "text-1", type: "text", props: hostileProps }],
      datasets: [],
      revision: 1,
      updatedAt: "2020-01-01T00:00:00.000Z",
    };

    const converted = dashboardToPrismaJson(dashboard);
    const components = converted.components;
    expect(Array.isArray(components)).toBe(true);
    const component = (components as unknown[])[0];
    expect(typeof component).toBe("object");
    const props = (component as Record<string, unknown>).props as Record<
      string,
      unknown
    >;

    expect(Object.hasOwn(props, "__proto__")).toBe(true);
    expect(props.__proto__).toEqual({ polluted: true });
    expect(props.constructor).toBe("constructor-value");
    expect(props.prototype).toBe("prototype-value");
    expect(Object.getPrototypeOf(props)).toBe(Object.prototype);
    expect(JSON.stringify(converted)).toBe(JSON.stringify(dashboard));
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "rejects non-finite numbers defensively: %s",
    (invalid) => {
      const dashboard = validDashboard({
        layout: [{ i: "text-1", x: 0, y: 0, w: 1, h: 1 }],
        components: [
          {
            id: "text-1",
            type: "text",
            props: { invalid } as never,
          },
        ],
      });

      expect(() => dashboardToPrismaJson(dashboard)).toThrow(TypeError);
    },
  );

  it("rejects a circular graph defensively", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const dashboard = validDashboard({
      layout: [{ i: "text-1", x: 0, y: 0, w: 1, h: 1 }],
      components: [
        { id: "text-1", type: "text", props: circular as never },
      ],
    });

    expect(() => dashboardToPrismaJson(dashboard)).toThrow(
      "Dashboard JSON contains a circular value",
    );
  });
});

describe("PrismaDashboardRepository", () => {
  it("creates with synchronized columns and parses the returned draft", async () => {
    const { repository, dashboardRecord } = createRepository();
    const dashboard = validDashboard();
    dashboardRecord.create.mockResolvedValue({ draftSchema: dashboard });

    await expect(repository.create(dashboard)).resolves.toEqual(dashboard);
    expect(dashboardRecord.create).toHaveBeenCalledWith({
      data: {
        id: dashboard.id,
        name: dashboard.name,
        revision: dashboard.revision,
        draftSchema: dashboard,
      },
    });
  });

  it("finds and parses a persisted draft", async () => {
    const { repository, dashboardRecord } = createRepository();
    const dashboard = validDashboard();
    dashboardRecord.findUnique.mockResolvedValue({ draftSchema: dashboard });

    await expect(repository.find(dashboard.id)).resolves.toEqual(dashboard);
    expect(dashboardRecord.findUnique).toHaveBeenCalledWith({
      where: { id: dashboard.id },
    });
  });

  it("returns null when a persisted dashboard does not exist", async () => {
    const { repository, dashboardRecord } = createRepository();
    dashboardRecord.findUnique.mockResolvedValue(null);

    await expect(repository.find(validDashboard().id)).resolves.toBeNull();
  });

  it("updates using the optimistic id/revision pair and synchronized JSON", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T10:00:00.000Z"));
    const { repository, dashboardRecord } = createRepository();
    const dashboard = validDashboard();
    dashboardRecord.updateMany.mockResolvedValue({ count: 1 });

    const result = await repository.updateIfRevision(dashboard);

    expect(result).toEqual({
      ...dashboard,
      revision: 2,
      updatedAt: "2026-07-02T10:00:00.000Z",
    });
    expect(dashboardRecord.updateMany).toHaveBeenCalledWith({
      where: { id: dashboard.id, revision: 1 },
      data: {
        name: dashboard.name,
        revision: 2,
        draftSchema: result,
      },
    });
  });

  it("returns null when the optimistic update affects no row", async () => {
    const { repository, dashboardRecord } = createRepository();
    dashboardRecord.updateMany.mockResolvedValue({ count: 0 });

    await expect(repository.updateIfRevision(validDashboard())).resolves.toBeNull();
  });
});
