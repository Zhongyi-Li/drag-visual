import type { Dashboard } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import { dashboardToPrismaJson } from "./prisma-dashboard.repository.js";

describe("dashboardToPrismaJson", () => {
  it("preserves valid nested JSON null values", () => {
    const dashboard: Dashboard = {
      version: 1,
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
      version: 1,
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
});
