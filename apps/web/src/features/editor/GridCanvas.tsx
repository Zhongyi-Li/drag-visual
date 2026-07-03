import { AppstoreAddOutlined } from "@ant-design/icons";
import { useDroppable } from "@dnd-kit/core";
import type { ComponentRegistry } from "@drag-visual/component-registry";
import type { GridItem as DashboardGridItem } from "@drag-visual/contracts";
import ReactGridLayout, {
  useContainerWidth,
  type EventCallback,
  type Layout,
  type LayoutItem,
  type ReactGridLayoutProps,
} from "react-grid-layout";
import type { ComponentType as ReactComponentType } from "react";
import { useState } from "react";
import { useStore } from "zustand";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

import { clampLayoutItem, GRID_COLUMNS, GRID_MARGIN, GRID_PADDING, GRID_ROW_HEIGHT } from "./canvasLayout.js";
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

const toDashboardItem = (item: LayoutItem, minimum: { w: number; h: number }): DashboardGridItem =>
  clampLayoutItem({ i: item.i, x: item.x, y: item.y, w: item.w, h: item.h }, minimum);

export const GridCanvas = ({ store, registry, createComponentId, gridWidth, GridRenderer = ReactGridLayout }: GridCanvasProps) => {
  const dashboard = useStore(store, editorSelectors.dashboard);
  const [isInteracting, setIsInteracting] = useState(false);
  const { width: measuredWidth, containerRef } = useContainerWidth({ initialWidth: 900 });
  const { setNodeRef, isOver } = useDroppable({ id: PALETTE_DROP_ID });
  const width = gridWidth ?? measuredWidth;

  const layout: Layout = dashboard.layout.map((item) => {
    const component = dashboard.components.find((candidate) => candidate.id === item.i);
    const minimum = component ? registry.get(component.type).defaultLayout : { w: 1, h: 1 };
    return { ...clampLayoutItem(item, minimum), minW: minimum.w, minH: minimum.h };
  });

  const dispatchStoppedLayout = (nextLayout: Layout, nextItem: LayoutItem | null) => {
    const source = nextLayout.length > 0 ? nextLayout : nextItem ? [nextItem] : [];
    if (source.length === 0) {
      setIsInteracting(false);
      return;
    }
    const updates = source.flatMap((item) => {
      const component = dashboard.components.find((candidate) => candidate.id === item.i);
      return component ? [toDashboardItem(item, registry.get(component.type).defaultLayout)] : [];
    });
    const changedUpdates = updates.filter((update) => {
      const current = dashboard.layout.find((item) => item.i === update.i);
      return !current || current.x !== update.x || current.y !== update.y || current.w !== update.w || current.h !== update.h;
    });
    if (changedUpdates.length > 0) {
      store.getState().dispatch({ type: "layout.change", updates: changedUpdates as [DashboardGridItem, ...DashboardGridItem[]] });
    }
    setIsInteracting(false);
  };
  const startInteraction: EventCallback = () => setIsInteracting(true);
  const stopInteraction: EventCallback = (nextLayout, _oldItem, nextItem) => dispatchStoppedLayout(nextLayout, nextItem);

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
        <div ref={containerRef} className="editor-canvas__grid-container">
          <span className="editor-visually-hidden">已添加 {dashboard.components.length} 个组件</span>
          <GridRenderer
          width={width}
          layout={layout}
          gridConfig={{ cols: GRID_COLUMNS, rowHeight: GRID_ROW_HEIGHT, margin: [GRID_MARGIN, GRID_MARGIN], containerPadding: [GRID_PADDING, GRID_PADDING] }}
          dragConfig={{ enabled: true, bounded: true, handle: ".component-frame__drag-handle", cancel: ".component-frame__actions", threshold: 3 }}
          resizeConfig={{ enabled: true, handles: ["se"] }}
          onDragStart={startInteraction}
          onDrag={startInteraction}
          onDragStop={stopInteraction}
          onResizeStart={startInteraction}
          onResize={startInteraction}
          onResizeStop={stopInteraction}
        >
          {dashboard.components.map((component) => (
            <div key={component.id}>
              <ComponentFrame component={component} store={store} createComponentId={createComponentId} isInteracting={isInteracting} />
            </div>
          ))}
          </GridRenderer>
        </div>
      )}
    </main>
  );
};
