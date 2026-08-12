import type { ComponentRegistry } from "@drag-visual/component-registry";
import type { ComponentType } from "@drag-visual/contracts";

import { clampLayoutItem, findAvailableLayout } from "./canvasLayout.js";
import type { EditorStore } from "./store/editorStore.js";

interface GridPoint { readonly x: number; readonly y: number }

export const addRegistryComponent = (
  store: EditorStore,
  registry: ComponentRegistry,
  createComponentId: () => string,
  type: ComponentType,
  point?: GridPoint,
  title?: string,
): string => {
  const definition = registry.get(type);
  const existingDashboard = store.getState().history.present;
  const existingHeader = type === "dashboardHeader"
    ? existingDashboard.components.find((component) => component.type === "dashboardHeader")
    : undefined;
  if (existingHeader) {
    store.getState().select(existingHeader.id);
    return existingHeader.id;
  }
  const id = createComponentId();
  const existingLayout = existingDashboard.layout;
  const pinHeaderToTop = type === "dashboardHeader" && point === undefined;
  const layoutUpdates = pinHeaderToTop
    ? existingLayout
      .filter((item) => item.parentId === undefined)
      .map((item) => ({ ...item, y: item.y + definition.defaultLayout.h }))
    : [];
  const layoutForPlacement = pinHeaderToTop
    ? existingLayout.map((item) => layoutUpdates.find((update) => update.i === item.i) ?? item)
    : existingLayout;
  // Clicking a palette item should extend the dashboard instead of reusing the
  // top-left origin and letting the grid displace a component that is already
  // on the last occupied row. The information bar is the exception: a click
  // reserves the top rows and keeps every existing top-level item below it.
  // Drag-and-drop still honors its explicit point.
  const placement = pinHeaderToTop ? { x: 0, y: 0 } : point ?? {
    x: 0,
    y: existingLayout.reduce((bottom, item) => Math.max(bottom, item.y + item.h), 0),
  };
  const candidate = clampLayoutItem(
    { i: id, x: placement.x, y: placement.y, ...definition.defaultLayout },
    definition.defaultLayout,
  );
  const layout = findAvailableLayout(layoutForPlacement, candidate);
  store.getState().dispatch({
    type: "component.add",
    component: { id, type, title: type === "dashboardHeader" ? "" : title ?? definition.title, props: definition.createDefaults() },
    layout,
    ...(layoutUpdates.length > 0 ? { layoutUpdates } : {}),
  });
  store.getState().select(id);
  return id;
};

/** Adds a chart into an analysis group's own 12-column layout. */
export const addRegistryComponentToGroup = (
  store: EditorStore,
  registry: ComponentRegistry,
  createComponentId: () => string,
  type: ComponentType,
  parentId: string,
  point?: GridPoint,
  title?: string,
): string => {
  const definition = registry.get(type);
  const id = createComponentId();
  const nestedLayout = store.getState().history.present.layout.filter((item) => item.parentId === parentId);
  const placement = point ?? { x: 0, y: nestedLayout.reduce((bottom, item) => Math.max(bottom, item.y + item.h), 0) };
  const candidate = clampLayoutItem({ i: id, parentId, x: placement.x, y: placement.y, ...definition.defaultLayout }, definition.defaultLayout);
  const layout = findAvailableLayout(nestedLayout, candidate);
  store.getState().dispatch({
    type: "component.add",
    component: { id, parentId, type, title: title ?? definition.title, props: definition.createDefaults() },
    layout,
  });
  store.getState().select(id);
  return id;
};
