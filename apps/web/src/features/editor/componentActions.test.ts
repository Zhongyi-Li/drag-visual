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
});
