import { describe, expect, it } from "vitest";

import { Dashboard, type FieldBinding as FieldBindingValue } from "./dashboard";

const validDashboard = () => ({
  version: 1,
  id: "dashboard-1",
  name: "Sales overview",
  theme: {
    primaryColor: "#3366FF",
    backgroundColor: "#FFFFFF",
  },
  layout: [],
  components: [],
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-02T10:00:00.000Z",
});

describe("Dashboard", () => {
  it("accepts a valid empty dashboard", () => {
    expect(Dashboard.parse(validDashboard())).toEqual(validDashboard());
  });

  it("rejects an unknown component type", () => {
    const dashboard = validDashboard();

    expect(
      Dashboard.safeParse({
        ...dashboard,
        layout: [{ i: "component-1", x: 0, y: 0, w: 4, h: 3 }],
        components: [
          {
            id: "component-1",
            type: "scatter",
            props: {},
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects a layout item for a missing component", () => {
    const result = Dashboard.safeParse({
      ...validDashboard(),
      layout: [{ i: "missing", x: 0, y: 0, w: 4, h: 3 }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["layout", 0, "i"] }),
        ]),
      );
    }
  });

  it("rejects a component without a layout item", () => {
    const result = Dashboard.safeParse({
      ...validDashboard(),
      components: [{ id: "orphan", type: "text", props: {} }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["components", 0, "id"] }),
        ]),
      );
    }
  });

  it("accepts a laid-out component without a data binding", () => {
    const dashboard = {
      ...validDashboard(),
      layout: [{ i: "text-1", x: 0, y: 0, w: 4, h: 3 }],
      components: [{ id: "text-1", type: "text", props: {} }],
    };

    expect(Dashboard.parse(dashboard)).toEqual(dashboard);
  });

  it("rejects duplicate dashboard dataset IDs", () => {
    const duplicateDataset = {
      datasetId: "orders",
      schemaVersion: "v1",
      parameters: {},
    };
    const result = Dashboard.safeParse({
      ...validDashboard(),
      datasets: [duplicateDataset, duplicateDataset],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: ["datasets", 1, "datasetId"] }),
        ]),
      );
    }
  });

  it("rejects a component binding to an undeclared dataset", () => {
    const categoryBinding: FieldBindingValue = { fieldKey: "category" };
    const result = Dashboard.safeParse({
      ...validDashboard(),
      layout: [{ i: "chart-1", x: 0, y: 0, w: 4, h: 3 }],
      components: [
        {
          id: "chart-1",
          type: "bar",
          props: {},
          binding: {
            datasetId: "missing",
            slots: { category: categoryBinding },
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["components", 0, "binding", "datasetId"],
          }),
        ]),
      );
    }
  });

  it.each([
    {
      name: "component IDs",
      value: {
        components: [
          { id: "duplicate", type: "bar", props: {} },
          { id: "duplicate", type: "line", props: {} },
        ],
        layout: [{ i: "duplicate", x: 0, y: 0, w: 4, h: 3 }],
      },
      path: ["components", 1, "id"],
    },
    {
      name: "layout IDs",
      value: {
        components: [{ id: "duplicate", type: "bar", props: {} }],
        layout: [
          { i: "duplicate", x: 0, y: 0, w: 4, h: 3 },
          { i: "duplicate", x: 4, y: 0, w: 4, h: 3 },
        ],
      },
      path: ["layout", 1, "i"],
    },
  ])("rejects duplicate $name", ({ value, path }) => {
    const result = Dashboard.safeParse({ ...validDashboard(), ...value });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path })]),
      );
    }
  });

  it.each([
    ["primary color", { theme: { primaryColor: "blue", backgroundColor: "#FFFFFF" } }],
    ["background color", { theme: { primaryColor: "#3366FF", backgroundColor: "#FFF" } }],
    ["revision zero", { revision: 0 }],
    ["non-datetime update time", { updatedAt: "yesterday" }],
  ])("rejects invalid %s", (_name, override) => {
    expect(
      Dashboard.safeParse({ ...validDashboard(), ...override }).success,
    ).toBe(false);
  });
});
