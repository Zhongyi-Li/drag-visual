// @vitest-environment jsdom

import { createDefaultRegistry } from "@drag-visual/component-registry";
import { DashboardSchema } from "@drag-visual/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { GridCanvas, type GridRendererProps } from "./GridCanvas.js";
import { createEditorStore } from "./store/editorStore.js";

vi.mock("../datasets/LocalDatasetProvider.js", () => ({
  useLocalDatasets: () => ({
    getDataset: () => undefined,
    queryDataset: () => undefined,
  }),
}));

const populated = DashboardSchema.parse({
  schemaVersion: 1, id: "123e4567-e89b-42d3-a456-426614174000", name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
  components: [{ id: "bar-1", type: "bar", title: "销售额", props: { color: "#1677ff", showLegend: true } }],
  datasets: [], revision: 1, updatedAt: "2026-07-03T08:00:00.000Z",
});
const empty = DashboardSchema.parse({ ...populated, layout: [], components: [] });
const renderCanvas = (ui: ReactElement) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);
const stacked = DashboardSchema.parse({
  ...populated,
  layout: [
    { i: "trend-1", x: 0, y: 0, w: 12, h: 5 },
    { i: "multi-1", x: 0, y: 5, w: 6, h: 4 },
  ],
  components: [
    { id: "trend-1", type: "trend", title: "趋势分析", props: { aggregation: "sum", showSummary: true, timeGranularity: "day" } },
    { id: "multi-1", type: "multidimensional", title: "多维分析", props: { aggregation: "sum", showTotals: true, timeGranularity: "day" } },
  ],
});

describe("GridCanvas", () => {
  it("renders an empty state only without components", () => {
    const { rerender } = renderCanvas(<GridCanvas store={createEditorStore(empty)} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} />);
    expect(screen.getByText("从左侧添加图表")).toBeInTheDocument();
    rerender(<QueryClientProvider client={new QueryClient()}><GridCanvas store={createEditorStore(populated)} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} /></QueryClientProvider>);
    expect(screen.queryByText("从左侧添加图表")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "销售额" })).toBeInTheDocument();
  });

  it("passes controlled 12-column layout and compact resize minimums to the grid", () => {
    let received: GridRendererProps | undefined;
    const FakeGrid = (props: GridRendererProps) => { received = props; return <div>{props.children}</div>; };
    renderCanvas(<GridCanvas store={createEditorStore(populated)} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} GridRenderer={FakeGrid} />);
    expect(received?.width).toBe(900);
    expect(received?.gridConfig).toEqual({ cols: 12, rowHeight: 44, margin: [12, 12], containerPadding: [12, 12] });
    expect(received?.layout).toEqual([{ i: "bar-1", x: 0, y: 0, w: 6, h: 5, minW: 2, minH: 2 }]);
    expect(received?.compactor).toMatchObject({ type: null, allowOverlap: false });
    expect(received?.compactor).not.toMatchObject({ preventCollision: true });
    expect(received?.dragConfig).toMatchObject({ enabled: true, cancel: ".component-frame__menu-trigger, .component-frame__title-button, .component-frame__title-input, .react-resizable-handle" });
    expect(received?.dragConfig).not.toHaveProperty("bounded");
    expect(received?.dragConfig).not.toHaveProperty("handle");
    expect(received?.resizeConfig).toMatchObject({
      enabled: true,
      handles: ["n", "s", "e", "w", "ne", "nw", "se", "sw"],
    });
  });

  it("dispatches one clamped layout change only on drag stop", () => {
    const store = createEditorStore(populated);
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    let received: GridRendererProps | undefined;
    const FakeGrid = (props: GridRendererProps) => { received = props; return <div>{props.children}</div>; };
    renderCanvas(<GridCanvas store={store} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} GridRenderer={FakeGrid} />);
    act(() => received?.onDragStart?.([], null, { i: "bar-1", x: 0, y: 0, w: 6, h: 5 }, null, new Event("pointerdown"), null));
    expect(screen.getByTestId("component-renderer")).toHaveAttribute("data-interacting", "true");
    expect(dispatch).not.toHaveBeenCalled();
    act(() => received?.onDrag?.([], null, { i: "bar-1", x: 20, y: 3, w: 6, h: 5 }, null, new Event("pointermove"), null));
    expect(dispatch).not.toHaveBeenCalled();
    act(() => received?.onDragStop?.([], null, { i: "bar-1", x: 20, y: 3, w: 6, h: 5 }, null, new Event("pointerup"), null));
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: "layout.change", updates: [{ i: "bar-1", x: 6, y: 3, w: 6, h: 5 }] });
    expect(screen.getByTestId("component-renderer")).toHaveAttribute("data-interacting", "false");
  });

  it("dispatches one compact minimum-clamped layout change only on resize stop", () => {
    const store = createEditorStore(DashboardSchema.parse({
      ...populated,
      layout: [{ i: "bar-1", x: 0, y: 0, w: 8, h: 7 }],
    }));
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    let received: GridRendererProps | undefined;
    const FakeGrid = (props: GridRendererProps) => { received = props; return <div>{props.children}</div>; };
    renderCanvas(<GridCanvas store={store} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} GridRenderer={FakeGrid} />);
    act(() => received?.onResizeStart?.([], null, { i: "bar-1", x: 0, y: 0, w: 6, h: 5 }, null, new Event("pointerdown"), null));
    act(() => received?.onResize?.([], null, { i: "bar-1", x: 0, y: 0, w: 2, h: 2 }, null, new Event("pointermove"), null));
    expect(dispatch).not.toHaveBeenCalled();
    act(() => received?.onResizeStop?.([], null, { i: "bar-1", x: 0, y: 0, w: 1, h: 1 }, null, new Event("pointerup"), null));
    expect(dispatch).toHaveBeenCalledWith({ type: "layout.change", updates: [{ i: "bar-1", x: 0, y: 0, w: 2, h: 2 }] });
  });

  it("persists an east-edge resize through all remaining grid columns", () => {
    const store = createEditorStore(DashboardSchema.parse({
      ...populated,
      layout: [{ i: "bar-1", x: 0, y: 0, w: 8, h: 7 }],
    }));
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    let received: GridRendererProps | undefined;
    const FakeGrid = (props: GridRendererProps) => { received = props; return <div>{props.children}</div>; };
    renderCanvas(<GridCanvas store={store} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={1320} GridRenderer={FakeGrid} />);

    act(() => received?.onResizeStop?.(
      [{ i: "bar-1", x: 0, y: 0, w: 12, h: 7 }],
      null,
      { i: "bar-1", x: 0, y: 0, w: 12, h: 7 },
      null,
      new Event("pointerup"),
      null,
    ));

    expect(dispatch).toHaveBeenCalledWith({ type: "layout.change", updates: [{ i: "bar-1", x: 0, y: 0, w: 12, h: 7 }] });
  });

  it("pushes lower overlapping components down when resizing a component taller", () => {
    const store = createEditorStore(stacked);
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    let received: GridRendererProps | undefined;
    const FakeGrid = (props: GridRendererProps) => { received = props; return <div>{props.children}</div>; };
    renderCanvas(<GridCanvas store={store} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} GridRenderer={FakeGrid} />);

    act(() => received?.onResizeStop?.([
      { i: "trend-1", x: 0, y: 0, w: 12, h: 8 },
      { i: "multi-1", x: 0, y: 5, w: 6, h: 4 },
    ], null, { i: "trend-1", x: 0, y: 0, w: 12, h: 8 }, null, new Event("pointerup"), null));

    expect(dispatch).toHaveBeenCalledWith({
      type: "layout.change",
      updates: [
        { i: "trend-1", x: 0, y: 0, w: 12, h: 8 },
        { i: "multi-1", x: 0, y: 8, w: 6, h: 4 },
      ],
    });
  });

  it("uses deterministic shadow layout instead of RGL collision push while dragging", () => {
    let received: GridRendererProps | undefined;
    const FakeGrid = (props: GridRendererProps) => { received = props; return <div>{props.children}</div>; };
    renderCanvas(<GridCanvas store={createEditorStore(stacked)} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} GridRenderer={FakeGrid} />);

    act(() => received?.onDragStart?.([], null, { i: "multi-1", x: 6, y: 0, w: 6, h: 4 }, null, new Event("pointerdown"), null));
    expect(received?.compactor?.allowOverlap).toBe(true);
    const compacted = received?.compactor?.compact([
      { i: "trend-1", x: 0, y: 0, w: 12, h: 5, moved: false },
      { i: "multi-1", x: 6, y: 0, w: 6, h: 4, moved: true },
    ], 12);

    expect(compacted?.find((item) => item.i === "trend-1")).toMatchObject({ y: 4 });
    expect(compacted?.find((item) => item.i === "multi-1")).toMatchObject({ y: 0 });
  });

  it("does not persist temporary drag displacement when the dragged component returns to its original slot", () => {
    const store = createEditorStore(stacked);
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    let received: GridRendererProps | undefined;
    const FakeGrid = (props: GridRendererProps) => { received = props; return <div>{props.children}</div>; };
    renderCanvas(<GridCanvas store={store} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} GridRenderer={FakeGrid} />);

    act(() => received?.onDragStop?.([
      { i: "trend-1", x: 0, y: 9, w: 12, h: 5 },
      { i: "multi-1", x: 0, y: 5, w: 6, h: 4 },
    ], null, { i: "multi-1", x: 0, y: 5, w: 6, h: 4 }, null, new Event("pointerup"), null));

    expect(dispatch).not.toHaveBeenCalled();
    expect(store.getState().history.present.layout).toEqual(stacked.layout);
  });

  it("persists only the dragged component when passive components were temporarily displaced", () => {
    const store = createEditorStore(stacked);
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    let received: GridRendererProps | undefined;
    const FakeGrid = (props: GridRendererProps) => { received = props; return <div>{props.children}</div>; };
    renderCanvas(<GridCanvas store={store} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} GridRenderer={FakeGrid} />);

    act(() => received?.onDragStop?.([
      { i: "trend-1", x: 0, y: 9, w: 12, h: 5 },
      { i: "multi-1", x: 6, y: 5, w: 6, h: 4 },
    ], null, { i: "multi-1", x: 6, y: 5, w: 6, h: 4 }, null, new Event("pointerup"), null));

    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: "layout.change", updates: [{ i: "multi-1", x: 6, y: 5, w: 6, h: 4 }] });
  });

  it("shows 12 guide columns only while dragging or resizing", () => {
    let received: GridRendererProps | undefined;
    const FakeGrid = (props: GridRendererProps) => { received = props; return <div>{props.children}</div>; };
    renderCanvas(<GridCanvas store={createEditorStore(populated)} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} GridRenderer={FakeGrid} />);
    expect(screen.queryByTestId("canvas-grid-guides")).not.toBeInTheDocument();

    act(() => received?.onResizeStart?.([], null, { i: "bar-1", x: 0, y: 0, w: 6, h: 5 }, null, new Event("pointerdown"), null));
    expect(screen.getByTestId("canvas-grid-guides").children).toHaveLength(12);

    act(() => received?.onResizeStop?.([], null, { i: "bar-1", x: 0, y: 0, w: 6, h: 5 }, null, new Event("pointerup"), null));
    expect(screen.queryByTestId("canvas-grid-guides")).not.toBeInTheDocument();
  });

  it("does not create history or dirty state when a stop reports no layout change", () => {
    const store = createEditorStore(populated);
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    let received: GridRendererProps | undefined;
    const FakeGrid = (props: GridRendererProps) => { received = props; return <div>{props.children}</div>; };
    renderCanvas(<GridCanvas store={store} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} GridRenderer={FakeGrid} />);
    act(() => received?.onDragStart?.([], null, { i: "bar-1", x: 0, y: 0, w: 6, h: 5 }, null, new Event("pointerdown"), null));
    act(() => received?.onDragStop?.([], null, { i: "bar-1", x: 0, y: 0, w: 6, h: 5 }, null, new Event("pointerup"), null));
    expect(dispatch).not.toHaveBeenCalled();
    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().dirty).toBe(false);
  });
});
