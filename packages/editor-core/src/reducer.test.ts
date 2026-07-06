import type {
  ComponentInstance,
  Dashboard,
  DataBinding,
  GridItem,
} from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import {
  EditorCommandError,
  applyCommand,
  type EditorCommand,
  type LayoutChangeCommand,
} from "./index.js";

if (false) {
  const emptyLayoutChange: LayoutChangeCommand = {
    type: "layout.change",
    // @ts-expect-error Layout changes require at least one complete update.
    updates: [],
  };
  void emptyLayoutChange;
}

const emptyDashboard = (): Dashboard => ({
  schemaVersion: 1,
  id: "645615f9-cddb-468e-a11d-91b477a4e2ac",
  name: "Sales overview",
  theme: { primaryColor: "#3366FF", backgroundColor: "#FFFFFF" },
  layout: [],
  components: [],
  datasets: [
    {
      datasetId: "orders",
      schemaVersion: "v1",
      parameters: {},
    },
  ],
  revision: 7,
  updatedAt: "2026-07-02T10:00:00.000Z",
});

const component = (
  id = "chart-1",
  props: ComponentInstance["props"] = { nested: { labels: ["revenue"] } },
): ComponentInstance => ({
  id,
  type: "bar",
  title: "Revenue",
  props,
  binding: {
    datasetId: "orders",
    slots: { measure: { fieldKey: "revenue" } },
  },
});

const layout = (i = "chart-1", x = 0): GridItem => ({
  i,
  x,
  y: 0,
  w: 4,
  h: 3,
});

const populatedDashboard = (): Dashboard => ({
  ...emptyDashboard(),
  components: [component()],
  layout: [layout()],
});

const expectCode = (operation: () => unknown, code: string) => {
  try {
    operation();
    throw new Error("Expected command to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(EditorCommandError);
    expect((error as EditorCommandError).code).toBe(code);
  }
};

describe("applyCommand", () => {
  it("adds a complete component and matching layout atomically", () => {
    const initial = emptyDashboard();
    const next = applyCommand(initial, {
      type: "component.add",
      component: component(),
      layout: layout(),
    });

    expect(next.components).toEqual([component()]);
    expect(next.layout).toEqual([layout()]);
    expect(next).not.toBe(initial);
    expect(next.revision).toBe(initial.revision);
    expect(next.updatedAt).toBe(initial.updatedAt);
    expect(initial.components).toEqual([]);
    expect(initial.layout).toEqual([]);
  });

  it("rejects an add whose component and layout IDs differ", () => {
    expectCode(
      () =>
        applyCommand(emptyDashboard(), {
          type: "component.add",
          component: component(),
          layout: layout("other"),
        }),
      "ID_MISMATCH",
    );
  });

  it("rejects a duplicate add without changing the input", () => {
    const initial = populatedDashboard();
    const before = structuredClone(initial);

    expectCode(
      () =>
        applyCommand(initial, {
          type: "component.add",
          component: component(),
          layout: layout(),
        }),
      "DUPLICATE_ID",
    );
    expect(initial).toEqual(before);
  });

  it("removes a component and its layout atomically", () => {
    const initial = populatedDashboard();
    const next = applyCommand(initial, {
      type: "component.remove",
      componentId: "chart-1",
    });

    expect(next.components).toEqual([]);
    expect(next.layout).toEqual([]);
    expect(initial).toEqual(populatedDashboard());
  });

  it("rejects removal of a missing component", () => {
    expectCode(
      () =>
        applyCommand(emptyDashboard(), {
          type: "component.remove",
          componentId: "missing",
        }),
      "MISSING_COMPONENT",
    );
  });

  it("duplicates title, props, and binding without nested aliases", () => {
    const initial = populatedDashboard();
    const next = applyCommand(initial, {
      type: "component.duplicate",
      sourceId: "chart-1",
      newComponentId: "chart-2",
      layout: layout("chart-2", 5),
    });
    const source = next.components[0]!;
    const duplicate = next.components[1]!;

    expect(duplicate).toEqual({ ...source, id: "chart-2" });
    expect(next.layout[1]).toEqual(layout("chart-2", 5));
    expect(duplicate.props).not.toBe(source.props);
    expect(duplicate.props.nested).not.toBe(source.props.nested);
    expect(duplicate.binding).not.toBe(source.binding);
    expect(duplicate.binding?.slots).not.toBe(source.binding?.slots);
  });

  it("rejects duplicate targets, missing sources, and mismatched duplicate layout IDs", () => {
    const initial = populatedDashboard();
    expectCode(
      () =>
        applyCommand(initial, {
          type: "component.duplicate",
          sourceId: "missing",
          newComponentId: "chart-2",
          layout: layout("chart-2"),
        }),
      "MISSING_COMPONENT",
    );
    expectCode(
      () =>
        applyCommand(initial, {
          type: "component.duplicate",
          sourceId: "chart-1",
          newComponentId: "chart-1",
          layout: layout("chart-1"),
        }),
      "DUPLICATE_ID",
    );
    expectCode(
      () =>
        applyCommand(initial, {
          type: "component.duplicate",
          sourceId: "chart-1",
          newComponentId: "chart-2",
          layout: layout("other"),
        }),
      "ID_MISMATCH",
    );
  });

  it("applies multiple complete layout updates atomically", () => {
    const initial: Dashboard = {
      ...populatedDashboard(),
      components: [component(), component("chart-2")],
      layout: [layout(), layout("chart-2", 4)],
    };
    const updates: LayoutChangeCommand["updates"] = [
      { ...layout(), x: 2, w: 6 },
      { ...layout("chart-2"), x: 8, h: 5 },
    ];
    const next = applyCommand(initial, { type: "layout.change", updates });

    expect(next.layout).toEqual(updates);
    expect(initial.layout).toEqual([layout(), layout("chart-2", 4)]);
  });

  it("rejects unknown or duplicate layout update IDs without partial changes", () => {
    const initial = populatedDashboard();
    const before = structuredClone(initial);
    expectCode(
      () =>
        applyCommand(initial, {
          type: "layout.change",
          updates: [layout(), layout()],
        }),
      "DUPLICATE_UPDATE_ID",
    );
    expectCode(
      () =>
        applyCommand(initial, {
          type: "layout.change",
          updates: [layout("missing")],
        }),
      "MISSING_COMPONENT",
    );
    expect(initial).toEqual(before);
  });

  it("replaces complete props and deep-clones hostile own keys", () => {
    const initial = populatedDashboard();
    const nextProps = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"nested":[1]},"prototype":"own"}',
    ) as ComponentInstance["props"];
    const next = applyCommand(initial, {
      type: "component.props.update",
      componentId: "chart-1",
      nextProps,
    });
    const props = next.components[0]!.props;

    expect(Object.hasOwn(props, "__proto__")).toBe(true);
    expect(props.__proto__).toEqual({ polluted: true });
    expect(props.constructor).toEqual({ nested: [1] });
    expect(props.prototype).toBe("own");
    expect(props).not.toBe(nextProps);
    expect(props.constructor).not.toBe(nextProps.constructor);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(initial.components[0]!.props).toEqual(component().props);
  });

  it("replaces, clones, and clears bindings", () => {
    const initial = populatedDashboard();
    const nextBinding: DataBinding = {
      datasetId: "orders",
      slots: { dimension: [{ fieldKey: "month" }] },
      sort: { fieldKey: "month", direction: "asc" },
    };
    const replaced = applyCommand(initial, {
      type: "component.binding.update",
      componentId: "chart-1",
      nextBinding,
    });
    const cleared = applyCommand(replaced, {
      type: "component.binding.update",
      componentId: "chart-1",
      nextBinding: undefined,
    });

    expect(replaced.components[0]!.binding).toEqual(nextBinding);
    expect(replaced.components[0]!.binding).not.toBe(nextBinding);
    expect(replaced.components[0]!.binding?.slots).not.toBe(nextBinding.slots);
    expect(cleared.components[0]!.binding).toBeUndefined();
  });

  it("updates the complete theme", () => {
    const initial = emptyDashboard();
    const nextTheme = { primaryColor: "#112233", backgroundColor: "#AABBCC" };
    const next = applyCommand(initial, {
      type: "dashboard.theme.update",
      nextTheme,
    });

    expect(next.theme).toEqual(nextTheme);
    expect(next.theme).not.toBe(nextTheme);
    expect(initial.theme).toEqual({
      primaryColor: "#3366FF",
      backgroundColor: "#FFFFFF",
    });
  });

  it("upserts a dashboard dataset reference", () => {
    const updated = applyCommand(emptyDashboard(), {
      type: "dashboard.dataset.upsert",
      dataset: {
        datasetId: "sales",
        schemaVersion: "v1",
        parameters: { year: 0, fromDate: "2026-01-01" },
      },
    });

    expect(updated.datasets).toContainEqual({
      datasetId: "sales",
      schemaVersion: "v1",
      parameters: { year: 0, fromDate: "2026-01-01" },
    });
  });

  it("replaces an existing dashboard dataset reference", () => {
    const withDataset: Dashboard = {
      ...emptyDashboard(),
      datasets: [{ datasetId: "sales", schemaVersion: "old", parameters: {} }],
    };
    const updated = applyCommand(withDataset, {
      type: "dashboard.dataset.upsert",
      dataset: {
        datasetId: "sales",
        schemaVersion: "v1",
        parameters: { year: 0 },
      },
    });

    expect(updated.datasets).toEqual([
      { datasetId: "sales", schemaVersion: "v1", parameters: { year: 0 } },
    ]);
  });

  it("wraps result schema failures in a stable command error", () => {
    expectCode(
      () =>
        applyCommand(populatedDashboard(), {
          type: "component.binding.update",
          componentId: "chart-1",
          nextBinding: { datasetId: "undeclared", slots: {} },
        }),
      "INVALID_DASHBOARD",
    );
    expectCode(
      () =>
        applyCommand(populatedDashboard(), {
          type: "component.props.update",
          componentId: "chart-1",
          nextProps: { bad: Number.NaN },
        }),
      "INVALID_DASHBOARD",
    );
  });

  it("returns a fresh deeply independent snapshot even for untouched nested values", () => {
    const initial = populatedDashboard();
    const next = applyCommand(initial, {
      type: "dashboard.theme.update",
      nextTheme: { primaryColor: "#000000", backgroundColor: "#FFFFFF" },
    });

    expect(next.components).not.toBe(initial.components);
    expect(next.components[0]!.props).not.toBe(initial.components[0]!.props);
    expect(next.datasets).not.toBe(initial.datasets);
    expect(next.datasets[0]!.parameters).not.toBe(
      initial.datasets[0]!.parameters,
    );
  });

  it("rejects a forged unknown command instead of returning undefined", () => {
    const forged = { type: "component.teleport" } as unknown as EditorCommand;

    expectCode(() => applyCommand(populatedDashboard(), forged), "INVALID_COMMAND");
  });

  it("wraps malformed known commands instead of leaking raw TypeError", () => {
    const malformed = {
      type: "component.add",
    } as unknown as EditorCommand;

    expectCode(
      () => applyCommand(populatedDashboard(), malformed),
      "INVALID_COMMAND",
    );
  });
});
