import { createDefaultRegistry } from "@drag-visual/component-registry";
import { DashboardSchema } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import { addRegistryComponent } from "./componentActions.js";
import { createEditorStore } from "./store/editorStore.js";

const empty = DashboardSchema.parse({
  schemaVersion: 1, id: "123e4567-e89b-42d3-a456-426614174000", name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" }, layout: [], components: [], datasets: [],
  revision: 1, updatedAt: "2026-07-03T08:00:00.000Z",
});

describe("addRegistryComponent", () => {
  it("creates fresh component defaults and layout on every add, then selects the latest", () => {
    const ids = ["bar-1", "bar-2"];
    const store = createEditorStore(empty);
    const registry = createDefaultRegistry();
    addRegistryComponent(store, registry, () => ids.shift()!, "bar");
    addRegistryComponent(store, registry, () => ids.shift()!, "bar");
    const dashboard = store.getState().history.present;
    expect(dashboard.components.map(({ id }) => id)).toEqual(["bar-1", "bar-2"]);
    expect(dashboard.layout).toEqual([
      { i: "bar-1", x: 0, y: 0, w: 6, h: 5 },
      { i: "bar-2", x: 0, y: 5, w: 6, h: 5 },
    ]);
    expect(dashboard.components[0]?.props).not.toBe(dashboard.components[1]?.props);
    expect(store.getState().selectedComponentId).toBe("bar-2");
  });

  it("clamps a point-based add to the 12-column canvas", () => {
    const store = createEditorStore(empty);
    addRegistryComponent(store, createDefaultRegistry(), () => "bar-1", "bar", { x: 11, y: 3 });
    expect(store.getState().history.present.layout[0]).toEqual({ i: "bar-1", x: 6, y: 3, w: 6, h: 5 });
  });

  it("appends a palette-added component after the bottom-most existing component", () => {
    const populated = DashboardSchema.parse({
      ...empty,
      layout: [
        { i: "bar-1", x: 0, y: 0, w: 12, h: 5 },
        { i: "stacked-1", x: 0, y: 5, w: 12, h: 5 },
        { i: "table-1", x: 0, y: 10, w: 12, h: 6 },
      ],
      components: [
        { id: "bar-1", type: "bar", title: "柱图", props: { aggregation: "sum", color: "#1677ff", showLegend: true } },
        { id: "stacked-1", type: "stackedBar", title: "堆积", props: { aggregation: "sum", color: "#1677ff", showLegend: true } },
        { id: "table-1", type: "table", title: "明细表", props: { pageSize: 20, striped: false } },
      ],
    });
    const store = createEditorStore(populated);

    addRegistryComponent(store, createDefaultRegistry(), () => "percent-1", "percentBar");

    expect(store.getState().history.present.layout).toContainEqual({
      i: "percent-1", x: 0, y: 16, w: 6, h: 5,
    });
    expect(store.getState().history.present.layout.find((item) => item.i === "table-1")).toEqual({
      i: "table-1", x: 0, y: 10, w: 12, h: 6,
    });
  });

  it("keeps the selected palette entry title when provided", () => {
    const store = createEditorStore(empty);
    addRegistryComponent(store, createDefaultRegistry(), () => "multi-1", "multidimensional", { x: 0, y: 0 }, "多维分析");
    expect(store.getState().history.present.components[0]).toMatchObject({
      id: "multi-1",
      type: "multidimensional",
      title: "多维分析",
      props: { aggregation: "sum", showTotals: true, timeGranularity: "day" },
    });
  });
});
