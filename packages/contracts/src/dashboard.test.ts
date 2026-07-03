import { describe, expect, it } from "vitest";

import {
  Dashboard,
  DashboardSchema,
  type FieldBinding as FieldBindingValue,
} from "./dashboard";

const validDashboard = () => ({
  schemaVersion: 1,
  id: "645615f9-cddb-468e-a11d-91b477a4e2ac",
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

describe("DashboardSchema", () => {
  it("accepts a valid empty dashboard", () => {
    expect(DashboardSchema.parse(validDashboard())).toEqual(validDashboard());
    expect(Dashboard).toBe(DashboardSchema);
  });

  it("rejects the obsolete top-level version field", () => {
    const { schemaVersion: _schemaVersion, ...dashboard } = validDashboard();

    expect(
      DashboardSchema.safeParse({ ...dashboard, version: 1 }).success,
    ).toBe(false);
  });

  it("rejects a non-UUID dashboard ID", () => {
    expect(
      DashboardSchema.safeParse({
        ...validDashboard(),
        id: "not-a-uuid",
      }).success,
    ).toBe(false);
  });

  it.each([
    ["dashboard", { extra: true }],
    ["theme", { theme: { ...validDashboard().theme, extra: true } }],
    [
      "layout item",
      {
        layout: [{ i: "text-1", x: 0, y: 0, w: 1, h: 1, extra: true }],
        components: [{ id: "text-1", type: "text", props: {} }],
      },
    ],
    [
      "component",
      {
        layout: [{ i: "text-1", x: 0, y: 0, w: 1, h: 1 }],
        components: [
          { id: "text-1", type: "text", props: {}, extra: true },
        ],
      },
    ],
    [
      "dataset reference",
      {
        datasets: [
          {
            datasetId: "orders",
            schemaVersion: "v1",
            parameters: {},
            extra: true,
          },
        ],
      },
    ],
    [
      "binding",
      {
        datasets: [
          { datasetId: "orders", schemaVersion: "v1", parameters: {} },
        ],
        layout: [{ i: "chart-1", x: 0, y: 0, w: 1, h: 1 }],
        components: [
          {
            id: "chart-1",
            type: "bar",
            props: {},
            binding: { datasetId: "orders", slots: {}, extra: true },
          },
        ],
      },
    ],
  ])("rejects unknown fields on a fixed-shape %s", (_name, override) => {
    expect(
      DashboardSchema.safeParse({ ...validDashboard(), ...override }).success,
    ).toBe(false);
  });

  it.each([
    ["field binding", { fieldKey: "month", extra: true }, undefined],
    [
      "sort",
      { fieldKey: "month" },
      { fieldKey: "revenue", direction: "asc", extra: true },
    ],
  ])("rejects unknown fields on fixed-shape nested %s", (_name, slot, sort) => {
    const dashboard = {
      ...validDashboard(),
      datasets: [
        { datasetId: "orders", schemaVersion: "v1", parameters: {} },
      ],
      layout: [{ i: "chart-1", x: 0, y: 0, w: 1, h: 1 }],
      components: [
        {
          id: "chart-1",
          type: "bar",
          props: {},
          binding: {
            datasetId: "orders",
            slots: { dimension: slot },
            ...(sort ? { sort } : {}),
          },
        },
      ],
    };

    expect(DashboardSchema.safeParse(dashboard).success).toBe(false);
  });

  it.each([
    ["layout", "layout", 101, { i: "item", x: 0, y: 0, w: 1, h: 1 }],
    [
      "components",
      "components",
      101,
      { id: "item", type: "text", props: {} },
    ],
    [
      "datasets",
      "datasets",
      21,
      { datasetId: "dataset", schemaVersion: "v1", parameters: {} },
    ],
  ])("rejects too many %s", (_name, field, count, item) => {
    const values = Array.from({ length: count }, (_, index) => ({
      ...item,
      ...(field === "layout" ? { i: `item-${index}` } : {}),
      ...(field === "components" ? { id: `item-${index}` } : {}),
      ...(field === "datasets" ? { datasetId: `dataset-${index}` } : {}),
    }));
    const matching =
      field === "layout"
        ? {
            components: values.map((_, index) => ({
              id: `item-${index}`,
              type: "text",
              props: {},
            })),
          }
        : field === "components"
          ? {
              layout: values.map((_, index) => ({
                i: `item-${index}`,
                x: 0,
                y: index,
                w: 1,
                h: 1,
              })),
            }
          : {};

    expect(
      DashboardSchema.safeParse({
        ...validDashboard(),
        ...matching,
        [field]: values,
      }).success,
    ).toBe(false);
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

  it("preserves hostile-looking component prop keys without prototype pollution", () => {
    const hostileProps = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":"constructor-value","prototype":"prototype-value"}',
    ) as Record<string, unknown>;
    const dashboard = {
      ...validDashboard(),
      layout: [{ i: "text-1", x: 0, y: 0, w: 4, h: 3 }],
      components: [{ id: "text-1", type: "text", props: hostileProps }],
    };

    const parsed = Dashboard.parse(dashboard);
    const props = parsed.components[0]!.props;

    expect(Object.hasOwn(props, "__proto__")).toBe(true);
    expect(props.__proto__).toEqual({ polluted: true });
    expect(props.constructor).toBe("constructor-value");
    expect(props.prototype).toBe("prototype-value");
    expect(Object.getPrototypeOf(props)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("preserves hostile own keys recursively in JSON component props", () => {
    const nested = JSON.parse(
      '{"outer":{"__proto__":{"polluted":true},"constructor":{"prototype":"safe"}},"items":[{"prototype":"value"}]}',
    ) as Record<string, unknown>;
    const dashboard = {
      ...validDashboard(),
      layout: [{ i: "text-1", x: 0, y: 0, w: 4, h: 3 }],
      components: [{ id: "text-1", type: "text", props: nested }],
    };

    const parsed = DashboardSchema.parse(dashboard);
    const outer = parsed.components[0]!.props.outer as Record<string, unknown>;
    const items = parsed.components[0]!.props.items as Array<Record<string, unknown>>;

    expect(Object.hasOwn(outer, "__proto__")).toBe(true);
    expect(outer.__proto__).toEqual({ polluted: true });
    expect(outer.constructor).toEqual({ prototype: "safe" });
    expect(items[0]!.prototype).toBe("value");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each([
    ["undefined", undefined],
    ["date", new Date()],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["bigint", 1n],
    ["function", () => undefined],
    ["symbol", Symbol("invalid")],
  ])("rejects a nested non-JSON prop value: %s", (_name, invalid) => {
    const result = DashboardSchema.safeParse({
      ...validDashboard(),
      layout: [{ i: "text-1", x: 0, y: 0, w: 4, h: 3 }],
      components: [
        { id: "text-1", type: "text", props: { nested: { invalid } } },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a circular component props graph", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(
      DashboardSchema.safeParse({
        ...validDashboard(),
        layout: [{ i: "text-1", x: 0, y: 0, w: 4, h: 3 }],
        components: [{ id: "text-1", type: "text", props: circular }],
      }).success,
    ).toBe(false);
  });

  it("preserves hostile-looking dataset parameter keys without prototype pollution", () => {
    const parameters = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":"constructor-value","prototype":"prototype-value"}',
    ) as Record<string, unknown>;
    const dashboard = {
      ...validDashboard(),
      datasets: [{ datasetId: "orders", schemaVersion: "v1", parameters }],
    };

    const parsed = Dashboard.parse(dashboard);
    const parsedParameters = parsed.datasets[0]!.parameters;

    expect(Object.hasOwn(parsedParameters, "__proto__")).toBe(true);
    expect(parsedParameters.__proto__).toEqual({ polluted: true });
    expect(parsedParameters.constructor).toBe("constructor-value");
    expect(parsedParameters.prototype).toBe("prototype-value");
    expect(Object.getPrototypeOf(parsedParameters)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("preserves hostile-looking data-binding slot keys", () => {
    const slots = JSON.parse(
      '{"__proto__":{"fieldKey":"proto-field"},"constructor":{"fieldKey":"constructor-field"},"prototype":[{"fieldKey":"prototype-field"}]}',
    ) as Record<string, unknown>;
    const dashboard = {
      ...validDashboard(),
      datasets: [
        { datasetId: "orders", schemaVersion: "v1", parameters: {} },
      ],
      layout: [{ i: "chart-1", x: 0, y: 0, w: 4, h: 3 }],
      components: [
        {
          id: "chart-1",
          type: "bar",
          props: {},
          binding: { datasetId: "orders", slots },
        },
      ],
    };

    const parsed = Dashboard.parse(dashboard);
    const parsedSlots = parsed.components[0]!.binding!.slots;

    expect(Object.hasOwn(parsedSlots, "__proto__")).toBe(true);
    expect(parsedSlots.__proto__).toEqual({ fieldKey: "proto-field" });
    expect(parsedSlots.constructor).toEqual({
      fieldKey: "constructor-field",
    });
    expect(parsedSlots.prototype).toEqual([{ fieldKey: "prototype-field" }]);
    expect(Object.getPrototypeOf(parsedSlots)).toBe(Object.prototype);
  });

  it("validates values stored under hostile-looking data-binding slot keys", () => {
    const slots = JSON.parse('{"__proto__":{"notAFieldKey":"invalid"}}') as Record<
      string,
      unknown
    >;
    const result = Dashboard.safeParse({
      ...validDashboard(),
      datasets: [
        { datasetId: "orders", schemaVersion: "v1", parameters: {} },
      ],
      layout: [{ i: "chart-1", x: 0, y: 0, w: 4, h: 3 }],
      components: [
        {
          id: "chart-1",
          type: "bar",
          props: {},
          binding: { datasetId: "orders", slots },
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-record objects for arbitrary-key contract fields", () => {
    const result = Dashboard.safeParse({
      ...validDashboard(),
      layout: [{ i: "text-1", x: 0, y: 0, w: 4, h: 3 }],
      components: [{ id: "text-1", type: "text", props: new Date() }],
    });

    expect(result.success).toBe(false);
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
