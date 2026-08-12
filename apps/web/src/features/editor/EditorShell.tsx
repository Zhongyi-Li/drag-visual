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
import { ComponentType, type GridItem } from "@drag-visual/contracts";
import { Card } from "antd";
import { useEffect, useRef, useState } from "react";

import { ComponentPalette } from "./ComponentPalette.js";
import { compactLayout } from "./canvasLayout.js";
import { addRegistryComponent, addRegistryComponentToGroup } from "./componentActions.js";
import { EditorToolbar } from "./EditorToolbar.js";
import { GridCanvas } from "./GridCanvas.js";
import { InspectorPanel } from "./InspectorPanel.js";
import "./editor.css";
import { PALETTE_DROP_ID, parseAnalysisGroupDropId, resolvePaletteDrop } from "./paletteDrag.js";
import type { EditorStore } from "./store/editorStore.js";
import { useEditorShortcuts } from "./useEditorShortcuts.js";
import { createBrowserUuid } from "../../app/browserUuid.js";

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

const analysisGroupDropZoneAt = (point: { readonly clientX: number; readonly clientY: number }): HTMLElement | null => {
  const candidates = document.querySelectorAll<HTMLElement>("[data-analysis-group-drop-zone]");
  for (const candidate of Array.from(candidates)) {
    const rect = candidate.getBoundingClientRect();
    if (point.clientX >= rect.left && point.clientX <= rect.right && point.clientY >= rect.top && point.clientY <= rect.bottom) {
      return candidate;
    }
  }
  return null;
};

const analysisGroupDropZoneById = (groupId: string): HTMLElement | null =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-analysis-group-drop-zone]"))
    .find((element) => parseAnalysisGroupDropId(element.dataset.analysisGroupDropZone ?? "") === groupId)
    ?? null;

export const EditorShell = ({
  store,
  createComponentId = createBrowserUuid,
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
  const [activeAnalysisGroupId, setActiveAnalysisGroupId] = useState<string | null>(null);
  const paletteHighlightTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const paletteDragActive = useRef(false);
  const activeAnalysisGroupIdRef = useRef<string | null>(null);
  const activeAnalysisGroupPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  useEditorShortcuts(store, onSave);

  useEffect(() => () => {
    if (paletteHighlightTimer.current) clearTimeout(paletteHighlightTimer.current);
  }, []);

  const updateAnalysisGroupDropTarget = (point: { readonly clientX: number; readonly clientY: number }) => {
    const zone = analysisGroupDropZoneAt(point);
    const nextGroupId = zone === null ? null : parseAnalysisGroupDropId(zone.dataset.analysisGroupDropZone ?? "");
    activeAnalysisGroupPointerRef.current = nextGroupId === null ? null : point;
    if (nextGroupId === activeAnalysisGroupIdRef.current) return;
    activeAnalysisGroupIdRef.current = nextGroupId;
    setActiveAnalysisGroupId(nextGroupId);
  };
  const clearPaletteDropTarget = () => {
    paletteDragActive.current = false;
    activeAnalysisGroupPointerRef.current = null;
    activeAnalysisGroupIdRef.current = null;
    setActiveAnalysisGroupId(null);
  };
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (paletteDragActive.current && event.isPrimary) updateAnalysisGroupDropTarget(event);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (paletteDragActive.current && event.isPrimary) updateAnalysisGroupDropTarget(event);
    };
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    return () => {
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
    };
  });

  const guideToChartLibrary = () => {
    const search = document.getElementById("component-search");
    search?.scrollIntoView?.({ block: "nearest" });
    search?.focus();
    if (paletteHighlightTimer.current) clearTimeout(paletteHighlightTimer.current);
    setIsPaletteHighlighted(true);
    paletteHighlightTimer.current = setTimeout(() => setIsPaletteHighlighted(false), 1800);
  };
  const autoArrange = () => {
    const dashboard = store.getState().history.present;
    const current = dashboard.layout.filter((item) => item.parentId === undefined);
    const arranged = compactLayout(current);
    const updates = arranged.filter((item) => {
      const previous = dashboard.layout.find((candidate) => candidate.i === item.i);
      return previous !== undefined && (
        previous.x !== item.x || previous.y !== item.y || previous.w !== item.w || previous.h !== item.h
      );
    });
    if (updates.length > 0) {
      store.getState().dispatch({ type: "layout.change", updates: updates as [GridItem, ...GridItem[]] });
    }
  };

  const onDragStart = (event: DragStartEvent) => {
    const parsedType = ComponentType.safeParse(event.active.data.current?.type);
    setActiveTitle(parsedType.success ? registry.get(parsedType.data).title : null);
    paletteDragActive.current = parsedType.success;
    const activator = event.activatorEvent;
    if (parsedType.success && "clientX" in activator && "clientY" in activator && typeof activator.clientX === "number" && typeof activator.clientY === "number") {
      updateAnalysisGroupDropTarget({ clientX: activator.clientX, clientY: activator.clientY });
    }
  };
  const onDragEnd = (event: DragEndEvent) => {
    setActiveTitle(null);
    const over = event.over;
    const parsedType = ComponentType.safeParse(event.active.data.current?.type);
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
    const activeGroupId = activeAnalysisGroupIdRef.current;
    const nativeGroupPoint = activeAnalysisGroupPointerRef.current;
    const detectedGroupDropZone = point === null ? null : analysisGroupDropZoneAt(point);
    const groupDropZone = detectedGroupDropZone ?? (activeGroupId === null ? null : analysisGroupDropZoneById(activeGroupId));
    clearPaletteDropTarget();
    if (!parsedType.success || !point) return;
    const parentId = detectedGroupDropZone === null
      ? activeGroupId
      : parseAnalysisGroupDropId(detectedGroupDropZone.dataset.analysisGroupDropZone ?? "");
    if (parentId !== null) {
      if (parsedType.data === "dashboardHeader" || parsedType.data === "analysisGroup" || parsedType.data === "text") return;
      const rect = groupDropZone?.getBoundingClientRect();
      if (!rect) return;
      const drop = resolvePaletteDrop(parsedType.data, nativeGroupPoint ?? point, rect);
      const title = typeof event.active.data.current?.title === "string" ? event.active.data.current.title : undefined;
      if (drop) addRegistryComponentToGroup(store, registry, createComponentId, drop.type, parentId, drop, title);
      return;
    }
    if (over?.id !== PALETTE_DROP_ID) return;
    const drop = resolvePaletteDrop(parsedType.data, point, over.rect);
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
        onAutoArrange={autoArrange}
        onRename={onRename}
        onAddChart={guideToChartLibrary}
      />
      <DndContext sensors={sensors} collisionDetection={paletteCollisionDetection} onDragStart={onDragStart} onDragCancel={() => { setActiveTitle(null); clearPaletteDropTarget(); }} onDragEnd={onDragEnd}>
        <div
          className={`editor-workbench${inspectorCollapsed ? " editor-workbench--inspector-collapsed" : ""}${dataPanelCollapsed ? " editor-workbench--data-panel-collapsed" : ""}`}
          data-testid="editor-workbench"
        >
          <ComponentPalette store={store} createComponentId={createComponentId} registry={registry} highlighted={isPaletteHighlighted} />
          <GridCanvas store={store} registry={registry} createComponentId={createComponentId} onStartFromLibrary={guideToChartLibrary} activeAnalysisGroupDropId={activeAnalysisGroupId} />
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
