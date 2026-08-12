import type { ComponentRegistry } from "@drag-visual/component-registry";
import type { ComponentInstance, DatasetFilter, GridItem } from "@drag-visual/contracts";
import { Empty } from "antd";
import ReactGridLayout, { useContainerWidth, type Layout, type LayoutItem } from "react-grid-layout";
import { useMemo } from "react";
import { useStore } from "zustand";

import { GRID_COLUMNS, GRID_MARGIN, GRID_PADDING, GRID_ROW_HEIGHT, RESIZABLE_ITEM_MINIMUM, clampLayoutItem } from "./canvasLayout.js";
import { ComponentFrame } from "./ComponentFrame.js";
import { analysisGroupDropId } from "./paletteDrag.js";
import type { EditorStore } from "./store/editorStore.js";
import type { DashboardGlobalFilters, DashboardGlobalFilterValues } from "../viewer/dashboardGlobalFilters.js";

interface Props {
  readonly component: ComponentInstance;
  readonly store: EditorStore;
  readonly registry: ComponentRegistry;
  readonly createComponentId: () => string;
  readonly globalFilters: DashboardGlobalFilters;
  readonly globalFilterValues: DashboardGlobalFilterValues;
  readonly onGlobalFilterChange?: ((filterId: string, value: unknown) => void) | undefined;
  readonly globalFilterApplyVersion: number;
  readonly onGlobalFilterQuerySettled?: ((componentId: string, version: number) => void) | undefined;
  readonly globalFiltersLoading: boolean;
  readonly onGlobalFiltersApply?: (() => boolean) | undefined;
  /** Shared filters remain applied to child charts; they are no longer echoed below the title. */
  readonly analysisGroupFilters?: readonly DatasetFilter[] | undefined;
  readonly activePaletteDrop: boolean;
  readonly outerIsInteracting: boolean;
}

const toNestedLayout = (item: LayoutItem, parentId: string): GridItem => ({ ...clampLayoutItem({ i: item.i, x: item.x, y: item.y, w: item.w, h: item.h }, RESIZABLE_ITEM_MINIMUM), parentId });

export const AnalysisGroupCanvas = ({ component, store, registry, createComponentId, globalFilters, globalFilterValues, onGlobalFilterChange, globalFilterApplyVersion, onGlobalFilterQuerySettled, globalFiltersLoading, onGlobalFiltersApply, analysisGroupFilters = [], activePaletteDrop, outerIsInteracting }: Props) => {
  // Select the immutable dashboard snapshot first. Filtering in the selector
  // creates a fresh array for every getSnapshot call and causes React to loop.
  const dashboard = useStore(store, (state) => state.history.present);
  const children = useMemo(() => dashboard.components.filter((candidate) => candidate.parentId === component.id), [component.id, dashboard.components]);
  const childLayouts = useMemo(() => dashboard.layout.filter((item) => item.parentId === component.id), [component.id, dashboard.layout]);
  const props = component.props as Record<string, unknown>;
  const gap = typeof props.gap === "number" ? props.gap : GRID_MARGIN;
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 0, measureBeforeMount: true });
  const layout: Layout = childLayouts.map((item) => ({ ...item, minW: RESIZABLE_ITEM_MINIMUM.w, minH: RESIZABLE_ITEM_MINIMUM.h }));
  const isGroupFiltering = globalFiltersLoading && globalFilters.some((filter) => filter.targets.some((target) => target.componentId !== component.id && children.some((child) => child.id === target.componentId)));
  const persistLayout = (nextLayout: Layout) => {
    const updates = nextLayout.map((item) => toNestedLayout(item, component.id));
    if (updates.length > 0) store.getState().dispatch({ type: "layout.change", updates: updates as [GridItem, ...GridItem[]] });
  };
  return <section className={`analysis-group-canvas${activePaletteDrop ? " analysis-group-canvas--drop-target" : ""}${outerIsInteracting ? " analysis-group-canvas--outer-interacting" : ""}`} data-analysis-group-drop-zone={analysisGroupDropId(component.id)} aria-label={`${component.title || "复合分析"}内部画布`} onClick={(event) => event.stopPropagation()}>
    <div ref={containerRef} className="analysis-group-canvas__grid" data-drop-zone-id={analysisGroupDropId(component.id)} data-analysis-group-drop-zone={analysisGroupDropId(component.id)}>
      {isGroupFiltering && <div className="analysis-group-canvas__loading" role="status"><span>正在更新组合内图表</span></div>}
      {activePaletteDrop && <div className="analysis-group-canvas__drop-placeholder" aria-hidden="true"><span>松开以添加到复合分析</span></div>}
      {children.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="将左侧图表拖入此容器" /> : mounted ? <ReactGridLayout
        width={width}
        layout={layout}
        gridConfig={{ cols: GRID_COLUMNS, rowHeight: GRID_ROW_HEIGHT, margin: [gap, gap], containerPadding: [GRID_PADDING, GRID_PADDING] }}
        dragConfig={{ enabled: true, cancel: ".component-frame__menu-trigger, .component-frame__title-button, .component-frame__title-input, .react-resizable-handle" }}
        resizeConfig={{ enabled: true, handles: ["n", "s", "e", "w", "ne", "nw", "se", "sw"] }}
        onDragStop={persistLayout}
        onResizeStop={persistLayout}
      >
        {children.map((child) => <div key={child.id}><ComponentFrame
          component={child}
          store={store}
          registry={registry}
          createComponentId={createComponentId}
          isInteracting={false}
          globalFilters={globalFilters}
          globalFilterValues={globalFilterValues}
          onGlobalFilterChange={onGlobalFilterChange}
          globalFilterApplyVersion={globalFilterApplyVersion}
          onGlobalFilterQuerySettled={onGlobalFilterQuerySettled}
          globalFiltersLoading={globalFiltersLoading}
          onGlobalFiltersApply={onGlobalFiltersApply}
          analysisGroupFilters={analysisGroupFilters}
        /></div>)}
      </ReactGridLayout> : null}
    </div>
  </section>;
};
