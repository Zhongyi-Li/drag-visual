// @vitest-environment jsdom

import { createDefaultRegistry } from "@drag-visual/component-registry";
import { DashboardSchema } from "@drag-visual/contracts";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GridCanvas, type GridRendererProps } from "./GridCanvas.js";
import { createEditorStore } from "./store/editorStore.js";

const populated = DashboardSchema.parse({
  schemaVersion: 1, id: "123e4567-e89b-42d3-a456-426614174000", name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
  components: [{ id: "bar-1", type: "bar", title: "销售额", props: { color: "#1677ff", showLegend: true } }],
  datasets: [], revision: 1, updatedAt: "2026-07-03T08:00:00.000Z",
});
const empty = DashboardSchema.parse({ ...populated, layout: [], components: [] });

describe("GridCanvas", () => {
  it("renders an empty state only without components", () => {
    const { rerender } = render(<GridCanvas store={createEditorStore(empty)} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} />);
    expect(screen.getByText("从左侧添加图表")).toBeInTheDocument();
    rerender(<GridCanvas store={createEditorStore(populated)} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} />);
    expect(screen.queryByText("从左侧添加图表")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "销售额" })).toBeInTheDocument();
  });

  it("passes controlled 12-column layout and registry minimum sizes to the grid", () => {
    let received: GridRendererProps | undefined;
    const FakeGrid = (props: GridRendererProps) => { received = props; return <div>{props.children}</div>; };
    render(<GridCanvas store={createEditorStore(populated)} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} GridRenderer={FakeGrid} />);
    expect(received?.width).toBe(900);
    expect(received?.gridConfig).toEqual({ cols: 12, rowHeight: 44, margin: [12, 12], containerPadding: [12, 12] });
    expect(received?.layout).toEqual([{ i: "bar-1", x: 0, y: 0, w: 6, h: 5, minW: 6, minH: 5 }]);
    expect(received?.compactor).toMatchObject({ type: null, allowOverlap: false, preventCollision: true });
    expect(received?.dragConfig).toMatchObject({ enabled: true, cancel: ".component-frame__actions, .react-resizable-handle" });
    expect(received?.dragConfig).not.toHaveProperty("bounded");
    expect(received?.dragConfig).not.toHaveProperty("handle");
  });

  it("dispatches one clamped layout change only on drag stop", () => {
    const store = createEditorStore(populated);
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    let received: GridRendererProps | undefined;
    const FakeGrid = (props: GridRendererProps) => { received = props; return <div>{props.children}</div>; };
    render(<GridCanvas store={store} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} GridRenderer={FakeGrid} />);
    act(() => received?.onDragStart?.([], null, { i: "bar-1", x: 0, y: 0, w: 6, h: 5 }, null, new Event("pointerdown"), null));
    expect(screen.getByTestId("component-placeholder")).toHaveAttribute("data-interacting", "true");
    expect(dispatch).not.toHaveBeenCalled();
    act(() => received?.onDrag?.([], null, { i: "bar-1", x: 20, y: 3, w: 6, h: 5 }, null, new Event("pointermove"), null));
    expect(dispatch).not.toHaveBeenCalled();
    act(() => received?.onDragStop?.([], null, { i: "bar-1", x: 20, y: 3, w: 6, h: 5 }, null, new Event("pointerup"), null));
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: "layout.change", updates: [{ i: "bar-1", x: 6, y: 3, w: 6, h: 5 }] });
    expect(screen.getByTestId("component-placeholder")).toHaveAttribute("data-interacting", "false");
  });

  it("dispatches one minimum-clamped layout change only on resize stop", () => {
    const store = createEditorStore(DashboardSchema.parse({
      ...populated,
      layout: [{ i: "bar-1", x: 0, y: 0, w: 8, h: 7 }],
    }));
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    let received: GridRendererProps | undefined;
    const FakeGrid = (props: GridRendererProps) => { received = props; return <div>{props.children}</div>; };
    render(<GridCanvas store={store} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} GridRenderer={FakeGrid} />);
    act(() => received?.onResizeStart?.([], null, { i: "bar-1", x: 0, y: 0, w: 6, h: 5 }, null, new Event("pointerdown"), null));
    act(() => received?.onResize?.([], null, { i: "bar-1", x: 0, y: 0, w: 2, h: 2 }, null, new Event("pointermove"), null));
    expect(dispatch).not.toHaveBeenCalled();
    act(() => received?.onResizeStop?.([], null, { i: "bar-1", x: 0, y: 0, w: 2, h: 2 }, null, new Event("pointerup"), null));
    expect(dispatch).toHaveBeenCalledWith({ type: "layout.change", updates: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }] });
  });

  it("does not create history or dirty state when a stop reports no layout change", () => {
    const store = createEditorStore(populated);
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    let received: GridRendererProps | undefined;
    const FakeGrid = (props: GridRendererProps) => { received = props; return <div>{props.children}</div>; };
    render(<GridCanvas store={store} registry={createDefaultRegistry()} createComponentId={() => "copy"} gridWidth={900} GridRenderer={FakeGrid} />);
    act(() => received?.onDragStart?.([], null, { i: "bar-1", x: 0, y: 0, w: 6, h: 5 }, null, new Event("pointerdown"), null));
    act(() => received?.onDragStop?.([], null, { i: "bar-1", x: 0, y: 0, w: 6, h: 5 }, null, new Event("pointerup"), null));
    expect(dispatch).not.toHaveBeenCalled();
    expect(store.getState().history.past).toHaveLength(0);
    expect(store.getState().dirty).toBe(false);
  });
});
