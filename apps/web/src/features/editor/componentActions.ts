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
  point: GridPoint = { x: 0, y: 0 },
): string => {
  const definition = registry.get(type);
  const id = createComponentId();
  const candidate = clampLayoutItem(
    { i: id, x: point.x, y: point.y, ...definition.defaultLayout },
    definition.defaultLayout,
  );
  const layout = findAvailableLayout(store.getState().history.present.layout, candidate);
  store.getState().dispatch({
    type: "component.add",
    component: { id, type, title: definition.title, props: definition.createDefaults() },
    layout,
  });
  store.getState().select(id);
  return id;
};
