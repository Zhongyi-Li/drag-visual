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
  const id = createComponentId();
  const existingLayout = store.getState().history.present.layout;
  // Clicking a palette item should extend the dashboard instead of reusing the
  // top-left origin and letting the grid displace a component that is already
  // on the last occupied row. Drag-and-drop still honors its explicit point.
  const placement = point ?? {
    x: 0,
    y: existingLayout.reduce((bottom, item) => Math.max(bottom, item.y + item.h), 0),
  };
  const candidate = clampLayoutItem(
    { i: id, x: placement.x, y: placement.y, ...definition.defaultLayout },
    definition.defaultLayout,
  );
  const layout = findAvailableLayout(existingLayout, candidate);
  store.getState().dispatch({
    type: "component.add",
    component: { id, type, title: title ?? definition.title, props: definition.createDefaults() },
    layout,
  });
  store.getState().select(id);
  return id;
};
