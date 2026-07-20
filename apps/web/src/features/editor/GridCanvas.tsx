import { AppstoreAddOutlined } from "@ant-design/icons";
import { useDroppable } from "@dnd-kit/core";
import type { ComponentRegistry } from "@drag-visual/component-registry";
import type { GridItem as DashboardGridItem } from "@drag-visual/contracts";
import ReactGridLayout, {
  getCompactor,
  useContainerWidth,
  type Compactor,
  type EventCallback,
  type Layout,
  type LayoutItem,
  type ReactGridLayoutProps,
} from "react-grid-layout";
import type { ComponentType as ReactComponentType, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from "react";
import { useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { clampLayoutItem, createShadowLayout, GRID_COLUMNS, GRID_MARGIN, GRID_PADDING, GRID_ROW_HEIGHT, hasLayoutCollision, RESIZABLE_ITEM_MINIMUM, resolveLayoutCollisions } from "./canvasLayout.js";
import { ComponentFrame } from "./ComponentFrame.js";
import { PALETTE_DROP_ID } from "./paletteDrag.js";
import { editorSelectors, type EditorStore } from "./store/editorStore.js";

export type GridRendererProps = ReactGridLayoutProps;

interface GridCanvasProps {
  store: EditorStore;
  registry: ComponentRegistry;
  createComponentId: () => string;
  gridWidth?: number;
  GridRenderer?: ReactComponentType<GridRendererProps>;
}

const toDashboardItem = (item: LayoutItem): DashboardGridItem =>
  clampLayoutItem({ i: item.i, x: item.x, y: item.y, w: item.w, h: item.h }, RESIZABLE_ITEM_MINIMUM);

const layoutChanged = (left: DashboardGridItem | undefined, right: DashboardGridItem): boolean =>
  !left || left.x !== right.x || left.y !== right.y || left.w !== right.w || left.h !== right.h;

const fixedGridCompactor: Compactor = getCompactor(null, false, false);
const resizeHandles = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
type InteractionMode = "drag" | "resize" | null;

interface DragStartSnapshot {
  readonly item: DashboardGridItem;
  readonly point: { readonly clientX: number; readonly clientY: number };
}

const getEventPoint = (event: Event): DragStartSnapshot["point"] | undefined => {
  const mouseLike = event as Partial<MouseEvent>;
  if (typeof mouseLike.clientX === "number" && typeof mouseLike.clientY === "number") {
    return { clientX: mouseLike.clientX, clientY: mouseLike.clientY };
  }
  const touchLike = event as Partial<TouchEvent>;
  const touch = touchLike.changedTouches?.[0] ?? touchLike.touches?.[0];
  return touch ? { clientX: touch.clientX, clientY: touch.clientY } : undefined;
};

const projectDragCandidate = (snapshot: DragStartSnapshot, point: DragStartSnapshot["point"], width: number): DashboardGridItem => {
  const columnWidth = Math.max(1, (width - GRID_PADDING * 2 - GRID_MARGIN * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  const x = snapshot.item.x + Math.round((point.clientX - snapshot.point.clientX) / (columnWidth + GRID_MARGIN));
  const y = snapshot.item.y + Math.round((point.clientY - snapshot.point.clientY) / (GRID_ROW_HEIGHT + GRID_MARGIN));
  return clampLayoutItem({ ...snapshot.item, x, y }, RESIZABLE_ITEM_MINIMUM);
};

const buildShadowLayout = (nextLayout: Layout, baseline: readonly DashboardGridItem[]): Layout => {
  const active = nextLayout.find((item) => item.moved);
  if (!active) return nextLayout;

  const activeItem = toDashboardItem(active);
  const byId = new Map(nextLayout.map((item) => [item.i, item]));
  return createShadowLayout(baseline, activeItem).map((item) => ({ ...byId.get(item.i), ...item }));
};

export const GridCanvas = ({ store, registry, createComponentId, gridWidth, GridRenderer = ReactGridLayout }: GridCanvasProps) => {
  const dashboard = useStore(store, editorSelectors.dashboard);
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionMode = useRef<InteractionMode>(null);
  const pointerDownPoint = useRef<DragStartSnapshot["point"] | null>(null);
  const dragStartSnapshot = useRef<DragStartSnapshot | null>(null);
  // Do not let the grid mount against a fallback width. A stale 900px measurement
  // makes a 12-column component look narrower than the canvas and prevents it from
  // growing to the visible right edge.
  const { width: measuredWidth, containerRef, mounted: hasMeasuredWidth } = useContainerWidth({
    initialWidth: gridWidth ?? 0,
    measureBeforeMount: gridWidth === undefined,
  });
  const { setNodeRef, isOver } = useDroppable({ id: PALETTE_DROP_ID });
  const width = gridWidth ?? measuredWidth;

  const layout: Layout = dashboard.layout.map((item) => {
    const component = dashboard.components.find((candidate) => candidate.id === item.i);
    return component ? { ...clampLayoutItem(item, RESIZABLE_ITEM_MINIMUM), minW: RESIZABLE_ITEM_MINIMUM.w, minH: RESIZABLE_ITEM_MINIMUM.h } : item;
  });
  const gridCompactor = useMemo<Compactor>(() => ({
    type: fixedGridCompactor.type,
    get allowOverlap() {
      return interactionMode.current === "drag";
    },
    preventCollision: fixedGridCompactor.preventCollision ?? false,
    compact(nextLayout, cols) {
      return interactionMode.current === "drag" ? buildShadowLayout(nextLayout, dashboard.layout) : fixedGridCompactor.compact(nextLayout, cols);
    },
  }), [dashboard.layout]);

  const dispatchStoppedLayout = (nextLayout: Layout, nextItem: LayoutItem | null, resolveCollisions: boolean) => {
    const source = nextLayout.length > 0 ? nextLayout : nextItem ? [nextItem] : [];
    if (source.length === 0) {
      interactionMode.current = null;
      setIsInteracting(false);
      return;
    }
    const activeId = nextItem?.i ?? source[0]?.i;
    const dashboardItems = source.map((item) => toDashboardItem(item));
    const resolvedSource = resolveCollisions && activeId ? resolveLayoutCollisions(dashboardItems, activeId) : dashboardItems;
    const updates = resolvedSource.flatMap((item) => {
      const component = dashboard.components.find((candidate) => candidate.id === item.i);
      return component ? [item] : [];
    });
    const changedUpdates = updates.filter((update) => {
      const current = dashboard.layout.find((item) => item.i === update.i);
      return !current || current.x !== update.x || current.y !== update.y || current.w !== update.w || current.h !== update.h;
    });
    if (changedUpdates.length > 0) {
      store.getState().dispatch({ type: "layout.change", updates: changedUpdates as [DashboardGridItem, ...DashboardGridItem[]] });
    }
    interactionMode.current = null;
    setIsInteracting(false);
  };
  const rememberPointerDown = (event: ReactMouseEvent<HTMLElement> | ReactTouchEvent<HTMLElement>) => {
    pointerDownPoint.current = getEventPoint(event.nativeEvent) ?? null;
  };
  const startInteraction: EventCallback = () => setIsInteracting(true);
  const startResizeInteraction: EventCallback = () => {
    interactionMode.current = "resize";
    pointerDownPoint.current = null;
    dragStartSnapshot.current = null;
    setIsInteracting(true);
  };
  const startDragInteraction: EventCallback = (_nextLayout, _oldItem, nextItem, _placeholder, event) => {
    interactionMode.current = "drag";
    const point = pointerDownPoint.current ?? getEventPoint(event);
    dragStartSnapshot.current = nextItem && point ? { item: toDashboardItem(nextItem), point } : null;
    setIsInteracting(true);
  };
  const stopDragInteraction: EventCallback = (_nextLayout, _oldItem, nextItem, _placeholder, event) => {
    if (!nextItem) {
      interactionMode.current = null;
      pointerDownPoint.current = null;
      dragStartSnapshot.current = null;
      setIsInteracting(false);
      return;
    }
    const nextDashboardItem = toDashboardItem(nextItem);
    const component = dashboard.components.find((candidate) => candidate.id === nextDashboardItem.i);
    const point = getEventPoint(event);
    const intendedItem = dragStartSnapshot.current?.item.i === nextDashboardItem.i && point
      ? projectDragCandidate(dragStartSnapshot.current, point, width)
      : nextDashboardItem;
    pointerDownPoint.current = null;
    dragStartSnapshot.current = null;
    if (!component || hasLayoutCollision(dashboard.layout, intendedItem, nextDashboardItem.i)) {
      interactionMode.current = null;
      setIsInteracting(false);
      return;
    }
    const current = dashboard.layout.find((item) => item.i === nextDashboardItem.i);
    if (layoutChanged(current, nextDashboardItem)) {
      store.getState().dispatch({ type: "layout.change", updates: [nextDashboardItem] });
    }
    interactionMode.current = null;
    setIsInteracting(false);
  };
  const stopResizeInteraction: EventCallback = (nextLayout, _oldItem, nextItem) => dispatchStoppedLayout(nextLayout, nextItem, true);

  return (
    <main
      ref={setNodeRef}
      className={`editor-canvas${isOver ? " editor-canvas--drop-target" : ""}`}
      aria-label="看板画布"
      data-drop-zone-id={PALETTE_DROP_ID}
    >
      {dashboard.components.length === 0 ? (
        <div className="editor-canvas__empty">
          <AppstoreAddOutlined />
          <strong>从左侧添加图表</strong>
          <span>点击或拖动图表组件到画布</span>
        </div>
      ) : (
        <div
          ref={containerRef}
          className={`editor-canvas__grid-container${isInteracting ? " editor-canvas__grid-container--interacting" : ""}`}
          onMouseDownCapture={rememberPointerDown}
          onTouchStartCapture={rememberPointerDown}
        >
          {isInteracting ? (
            <div className="editor-canvas__grid-guides" data-testid="canvas-grid-guides" aria-hidden="true">
              {Array.from({ length: GRID_COLUMNS }, (_, index) => <span key={index} />)}
            </div>
          ) : null}
          <span className="editor-visually-hidden">已添加 {dashboard.components.length} 个组件</span>
          {gridWidth !== undefined || hasMeasuredWidth ? <GridRenderer
            width={width}
            layout={layout}
            compactor={gridCompactor}
            gridConfig={{ cols: GRID_COLUMNS, rowHeight: GRID_ROW_HEIGHT, margin: [GRID_MARGIN, GRID_MARGIN], containerPadding: [GRID_PADDING, GRID_PADDING] }}
            dragConfig={{ enabled: true, cancel: ".component-frame__menu-trigger, .component-frame__title-button, .component-frame__title-input, .react-resizable-handle", threshold: 3 }}
            resizeConfig={{ enabled: true, handles: [...resizeHandles] }}
            onDragStart={startDragInteraction}
            onDrag={startInteraction}
            onDragStop={stopDragInteraction}
            onResizeStart={startResizeInteraction}
            onResize={startInteraction}
            onResizeStop={stopResizeInteraction}
          >
            {dashboard.components.map((component) => (
              <div key={component.id}>
                <ComponentFrame component={component} store={store} createComponentId={createComponentId} isInteracting={isInteracting} />
              </div>
            ))}
          </GridRenderer>
            : null}
        </div>
      )}
    </main>
  );
};
