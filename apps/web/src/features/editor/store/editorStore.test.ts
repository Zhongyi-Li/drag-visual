import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import { createEditorStore, editorSelectors } from "./editorStore.js";

const dashboard = (revision = 1): Dashboard => DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "销售看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [], components: [], datasets: [], revision,
  updatedAt: `2026-07-03T08:00:0${revision}.000Z`,
});

const addBar = (id = "bar-1") => ({
  type: "component.add" as const,
  component: { id, type: "bar" as const, props: { color: "#1677ff", showLegend: true } },
  layout: { i: id, x: 0, y: 0, w: 6, h: 5 },
});

describe("editor store", () => {
  it("keeps selection and save state outside the persisted dashboard", () => {
    const store = createEditorStore(dashboard());
    store.getState().select("bar-1");
    expect(DashboardSchema.parse(editorSelectors.dashboard(store.getState()))).toEqual(dashboard());
    expect(editorSelectors.dashboard(store.getState())).not.toHaveProperty("selectedComponentId");
  });

  it("tracks dispatch, undo, redo, dirty state, and redo invalidation", () => {
    const store = createEditorStore(dashboard());
    store.getState().dispatch(addBar());
    expect(editorSelectors.canUndo(store.getState())).toBe(true);
    expect(editorSelectors.canRedo(store.getState())).toBe(false);
    expect(store.getState().dirty).toBe(true);
    store.getState().undo();
    expect(store.getState().dirty).toBe(false);
    expect(editorSelectors.canRedo(store.getState())).toBe(true);
    store.getState().redo();
    expect(store.getState().dirty).toBe(true);
    store.getState().undo();
    store.getState().dispatch(addBar("bar-2"));
    expect(editorSelectors.canRedo(store.getState())).toBe(false);
  });

  it("clears selection when the selected component is removed", () => {
    const store = createEditorStore(dashboard());
    store.getState().dispatch(addBar());
    store.getState().select("bar-1");
    store.getState().dispatch({ type: "component.remove", componentId: "bar-1" });
    expect(store.getState().selectedComponentId).toBeNull();
  });

  it("rebases history on a validated server dashboard and preserves valid selection", () => {
    const store = createEditorStore(dashboard());
    store.getState().dispatch(addBar());
    store.getState().select("bar-1");
    const server = DashboardSchema.parse({
      ...editorSelectors.dashboard(store.getState()), revision: 2,
      updatedAt: "2026-07-03T09:00:00.000Z",
    });
    store.getState().markSaved(server);
    expect(store.getState().dirty).toBe(false);
    expect(store.getState().lastSavedRevision).toBe(2);
    expect(store.getState().selectedComponentId).toBe("bar-1");
    expect(editorSelectors.canUndo(store.getState())).toBe(false);
  });

  it("rejects an invalid server dashboard without corrupting state", () => {
    const store = createEditorStore(dashboard());
    store.getState().dispatch(addBar());
    const before = store.getState();
    expect(() => store.getState().markSaved({ ...dashboard(2), layout: [{ i: "ghost", x: 0, y: 0, w: 1, h: 1 }] })).toThrow();
    expect(store.getState()).toMatchObject({ history: before.history, dirty: true, saveStatus: "idle" });
  });

  it("tracks saving failures and isolates factory instances", () => {
    const first = createEditorStore(dashboard());
    const second = createEditorStore(dashboard());
    first.getState().markSaving();
    expect(first.getState().saveStatus).toBe("saving");
    first.getState().markSaveFailed();
    expect(first.getState().saveStatus).toBe("error");
    expect(second.getState().saveStatus).toBe("idle");
  });

  it("preserves edits made after a save began when the earlier response arrives", () => {
    const store = createEditorStore(dashboard());
    store.getState().dispatch(addBar("bar-b"));
    store.getState().markSaving();
    store.getState().dispatch(addBar("bar-c"));
    const submitted = DashboardSchema.parse({
      ...dashboard(2),
      components: [{ id: "bar-b", type: "bar", props: { color: "#1677ff", showLegend: true } }],
      layout: [{ i: "bar-b", x: 0, y: 0, w: 6, h: 5 }],
      updatedAt: "2026-07-03T09:00:00.000Z",
    });

    store.getState().markSaved(submitted);

    expect(editorSelectors.dashboard(store.getState()).components.map((component) => component.id)).toEqual(["bar-b", "bar-c"]);
    expect(editorSelectors.dashboard(store.getState())).toMatchObject({
      revision: 2,
      updatedAt: "2026-07-03T09:00:00.000Z",
    });
    expect(store.getState()).toMatchObject({ dirty: true, lastSavedRevision: 2, saveStatus: "idle" });
  });

  it("does not expose a mutable saved snapshot", () => {
    const store = createEditorStore(dashboard());
    expect(Object.isFrozen(store.getState().savedSnapshot)).toBe(true);
    expect(Object.isFrozen(store.getState().savedSnapshot.theme)).toBe(true);
    expect(() => {
      (store.getState().savedSnapshot.theme as { primaryColor: string }).primaryColor = "#000000";
    }).toThrow();
    expect(store.getState().savedSnapshot.theme.primaryColor).toBe("#1677ff");
  });
});
