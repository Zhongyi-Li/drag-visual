import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { createDefaultRegistry, type ComponentRegistry } from "@drag-visual/component-registry";
import { ComponentType } from "@drag-visual/contracts";
import { Card } from "antd";
import { useEffect, useRef, useState } from "react";

import { ComponentPalette } from "./ComponentPalette.js";
import { addRegistryComponent } from "./componentActions.js";
import { EditorToolbar } from "./EditorToolbar.js";
import { GridCanvas } from "./GridCanvas.js";
import { InspectorPanel } from "./InspectorPanel.js";
import "./editor.css";
import { PALETTE_DROP_ID, resolvePaletteDrop } from "./paletteDrag.js";
import type { EditorStore } from "./store/editorStore.js";
import { useEditorShortcuts } from "./useEditorShortcuts.js";

interface EditorShellProps {
  store: EditorStore;
  createComponentId?: () => string;
  onSave?: () => void;
  onPreview?: () => void;
  onPublish?: () => void;
  onRename?: (name: string) => void;
  registry?: ComponentRegistry;
}

const defaultRegistry = createDefaultRegistry();
const paletteCollisionDetection: CollisionDetection = (args) =>
  args.pointerCoordinates === null ? closestCenter(args) : pointerWithin(args);

export const EditorShell = ({
  store,
  createComponentId = () => crypto.randomUUID(),
  onSave,
  onPreview,
  onPublish,
  onRename = () => undefined,
  registry = defaultRegistry,
}: EditorShellProps) => {
  const [activeTitle, setActiveTitle] = useState<string | null>(null);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [dataPanelCollapsed, setDataPanelCollapsed] = useState(false);
  const [isPaletteHighlighted, setIsPaletteHighlighted] = useState(false);
  const paletteHighlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  useEditorShortcuts(store, onSave);

  useEffect(() => () => {
    if (paletteHighlightTimer.current) clearTimeout(paletteHighlightTimer.current);
  }, []);

  const guideToChartLibrary = () => {
    const search = document.getElementById("component-search");
    search?.scrollIntoView?.({ block: "nearest" });
    search?.focus();
    if (paletteHighlightTimer.current) clearTimeout(paletteHighlightTimer.current);
    setIsPaletteHighlighted(true);
    paletteHighlightTimer.current = setTimeout(() => setIsPaletteHighlighted(false), 1800);
  };

  const onDragStart = (event: DragStartEvent) => {
    const parsedType = ComponentType.safeParse(event.active.data.current?.type);
    setActiveTitle(parsedType.success ? registry.get(parsedType.data).title : null);
  };
  const onDragEnd = (event: DragEndEvent) => {
    setActiveTitle(null);
    if (event.over?.id !== PALETTE_DROP_ID) return;
    const parsedType = ComponentType.safeParse(event.active.data.current?.type);
    if (!parsedType.success) return;
    const rect = event.over.rect;
    const activator = event.activatorEvent;
    let point: { clientX: number; clientY: number } | null = null;
    if ("clientX" in activator && "clientY" in activator && typeof activator.clientX === "number" && typeof activator.clientY === "number") {
      point = { clientX: activator.clientX + event.delta.x, clientY: activator.clientY + event.delta.y };
    } else if (event.active.rect.current.translated) {
      const translated = event.active.rect.current.translated;
      point = { clientX: translated.left + translated.width / 2, clientY: translated.top + translated.height / 2 };
    } else if (event.active.rect.current.initial) {
      const initial = event.active.rect.current.initial;
      point = {
        clientX: initial.left + initial.width / 2 + event.delta.x,
        clientY: initial.top + initial.height / 2 + event.delta.y,
      };
    }
    if (!point) return;
    const drop = resolvePaletteDrop(parsedType.data, point, rect);
    const title = typeof event.active.data.current?.title === "string" ? event.active.data.current.title : undefined;
    if (drop) addRegistryComponent(store, registry, createComponentId, drop.type, drop, title);
  };
  return (
    <div className="editor-app">
      <EditorToolbar
        store={store}
        onSave={onSave}
        onPreview={onPreview}
        onPublish={onPublish}
        onRename={onRename}
        onAddChart={guideToChartLibrary}
      />
      <DndContext sensors={sensors} collisionDetection={paletteCollisionDetection} onDragStart={onDragStart} onDragCancel={() => setActiveTitle(null)} onDragEnd={onDragEnd}>
        <div
          className={`editor-workbench${inspectorCollapsed ? " editor-workbench--inspector-collapsed" : ""}${dataPanelCollapsed ? " editor-workbench--data-panel-collapsed" : ""}`}
          data-testid="editor-workbench"
        >
          <ComponentPalette store={store} createComponentId={createComponentId} registry={registry} highlighted={isPaletteHighlighted} />
          <GridCanvas store={store} registry={registry} createComponentId={createComponentId} onStartFromLibrary={guideToChartLibrary} />
          <InspectorPanel
            collapsed={inspectorCollapsed}
            onToggleCollapsed={() => setInspectorCollapsed((current) => !current)}
            dataCollapsed={dataPanelCollapsed}
            onToggleDataCollapsed={() => setDataPanelCollapsed((current) => !current)}
            store={store}
            registry={registry}
          />
        </div>
        <DragOverlay>{activeTitle ? <Card size="small" className="palette-drag-overlay">{activeTitle}</Card> : null}</DragOverlay>
      </DndContext>
    </div>
  );
};
