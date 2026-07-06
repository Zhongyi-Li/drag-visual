// @vitest-environment jsdom

import { DashboardSchema } from "@drag-visual/contracts";
import {
  DndContext,
  KeyboardSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { EditorShell } from "./EditorShell.js";
import { createEditorStore } from "./store/editorStore.js";

const base = {
  schemaVersion: 1 as const,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "集成画布",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
};
const empty = DashboardSchema.parse({ ...base, layout: [], components: [] });
const populated = DashboardSchema.parse({
  ...base,
  layout: [{ i: "bar-1", x: 0, y: 0, w: 8, h: 7 }],
  components: [{ id: "bar-1", type: "bar", title: "销售额", props: { color: "#1677ff", showLegend: true } }],
});
const colliding = DashboardSchema.parse({
  ...base,
  layout: [
    { i: "bar-1", x: 0, y: 0, w: 6, h: 5 },
    { i: "bar-2", x: 6, y: 0, w: 6, h: 5 },
  ],
  components: [
    { id: "bar-1", type: "bar", title: "销售额", props: { color: "#1677ff", showLegend: true } },
    { id: "bar-2", type: "bar", title: "利润额", props: { color: "#1677ff", showLegend: true } },
  ],
});

const domRect = (left: number, top: number, width: number, height: number): DOMRect => ({
  left, top, width, height, right: left + width, bottom: top + height, x: left, y: top,
  toJSON: () => ({ left, top, width, height }),
});
const defaultResizeObserver = globalThis.ResizeObserver;

class PointerEventShim extends MouseEvent {
  readonly pointerId: number;
  readonly isPrimary: boolean;
  readonly pointerType: string;

  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.isPrimary = init.isPrimary ?? true;
    this.pointerType = init.pointerType ?? "mouse";
  }
}

const KeyboardDraggable = () => {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: "keyboard-source", data: { type: "bar" } });
  return <button ref={setNodeRef} className="keyboard-draggable" type="button" {...listeners} {...attributes}>键盘图表</button>;
};

const KeyboardDropZone = () => {
  const { setNodeRef, isOver } = useDroppable({ id: "keyboard-canvas" });
  return <div ref={setNodeRef} className={`keyboard-dropzone${isOver ? " keyboard-dropzone--over" : ""}`}>键盘画布</div>;
};

const KeyboardDndHarness = ({ onDrop }: { onDrop: (overId: string | null) => void }) => {
  const sensors = useSensors(useSensor(KeyboardSensor, {
    coordinateGetter: () => ({ x: 300, y: 200 }),
  }));
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => onDrop(event.over?.id.toString() ?? null)}>
      <KeyboardDraggable />
      <KeyboardDropZone />
    </DndContext>
  );
};

const renderEditorShell = (ui: ReactElement) => render(<AppProviders>{ui}</AppProviders>);

describe("editor canvas library integration", () => {
  beforeEach(() => {
    // jsdom has no layout engine. These browser-boundary shims give RGL and dnd-kit
    // stable measurements while their real sensors/listeners and event paths remain mounted.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains("palette-card")) return domRect(100, 120, 60, 76);
      if (this.classList.contains("editor-canvas")) return domRect(240, 96, 900, 700);
      if (this.classList.contains("editor-canvas__grid-container")) return domRect(240, 96, 900, 700);
      if (this.classList.contains("react-grid-item")) return domRect(252, 108, 438, 268);
      if (this.classList.contains("keyboard-draggable")) return domRect(100, 120, 60, 76);
      if (this.classList.contains("keyboard-dropzone")) return domRect(240, 96, 900, 700);
      return domRect(0, 0, 0, 0);
    });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 900 });
    Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get() { return document.body; } });
    Object.defineProperty(window, "PointerEvent", { configurable: true, value: PointerEventShim });
  });

  afterEach(() => {
    globalThis.ResizeObserver = defaultResizeObserver;
    vi.restoreAllMocks();
  });

  it("runs a real react-grid-layout drag and resize through one stop command each", () => {
    const store = createEditorStore(populated);
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    renderEditorShell(<EditorShell store={store} createComponentId={() => "unused"} />);
    expect(document.querySelector(".react-grid-layout")).toBeInTheDocument();

    const frame = screen.getByRole("group", { name: "销售额" });
    fireEvent.mouseDown(frame, { clientX: 270, clientY: 120, button: 0 });
    fireEvent.mouseMove(document, { clientX: 420, clientY: 176, buttons: 1 });
    expect(screen.getByTestId("component-placeholder")).toHaveAttribute("data-interacting", "true");
    fireEvent.mouseUp(document, { clientX: 420, clientY: 176, button: 0 });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(store.getState().history.present.layout[0]).toMatchObject({ x: 4, y: 3 });

    dispatch.mockClear();
    const resizeHandle = document.querySelector(".react-resizable-handle-se");
    expect(resizeHandle).toBeInTheDocument();
    fireEvent.mouseDown(resizeHandle!, { clientX: 690, clientY: 376, button: 0 });
    fireEvent.mouseMove(document, { clientX: 300, clientY: 130, buttons: 1 });
    fireEvent.mouseUp(document, { clientX: 300, clientY: 130, button: 0 });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(store.getState().history.present.layout[0]).toMatchObject({ w: 6, h: 5 });
  });

  it("blocks a real react-grid-layout drag into an occupied slot", () => {
    const store = createEditorStore(colliding);
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    renderEditorShell(<EditorShell store={store} createComponentId={() => "unused"} />);
    const frame = screen.getByRole("group", { name: "销售额" });
    fireEvent.mouseDown(frame, { clientX: 270, clientY: 120, button: 0 });
    fireEvent.mouseMove(document, { clientX: 700, clientY: 120, buttons: 1 });
    fireEvent.mouseUp(document, { clientX: 700, clientY: 120, button: 0 });
    expect(dispatch).not.toHaveBeenCalled();
    const [first, second] = store.getState().history.present.layout;
    expect(first).toMatchObject({ i: "bar-1", x: 0, y: 0 });
    expect(second).toMatchObject({ i: "bar-2", x: 6, y: 0 });
    expect(first && second && (
      first.x + first.w <= second.x || second.x + second.w <= first.x ||
      first.y + first.h <= second.y || second.y + second.h <= first.y
    )).toBe(true);
  });

  it("runs real dnd-kit pointer drops inside and ignores drops outside", () => {
    const ids = ["inside", "outside"];
    const store = createEditorStore(empty);
    renderEditorShell(<EditorShell store={store} createComponentId={() => ids.shift()!} />);
    const palette = screen.getByRole("button", { name: "添加柱图" });

    fireEvent.pointerDown(palette, { clientX: 130, clientY: 150, pointerId: 1, button: 0, isPrimary: true });
    fireEvent.pointerMove(document, { clientX: 540, clientY: 270, pointerId: 1, buttons: 1, isPrimary: true });
    fireEvent.pointerMove(document, { clientX: 541, clientY: 271, pointerId: 1, buttons: 1, isPrimary: true });
    expect(document.querySelector(".palette-drag-overlay")).toBeInTheDocument();
    fireEvent.pointerUp(document, { clientX: 540, clientY: 270, pointerId: 1, button: 0, isPrimary: true });
    expect(store.getState().history.present.layout[0]).toMatchObject({ i: "inside", x: 4, y: 3 });

    fireEvent.pointerDown(palette, { clientX: 130, clientY: 150, pointerId: 2, button: 0, isPrimary: true });
    fireEvent.pointerMove(document, { clientX: 100, clientY: 40, pointerId: 2, buttons: 1, isPrimary: true });
    fireEvent.pointerUp(document, { clientX: 100, clientY: 40, pointerId: 2, button: 0, isPrimary: true });
    expect(store.getState().history.present.components).toHaveLength(1);
  });

  it("runs real dnd-kit KeyboardSensor activation, movement, and drop", async () => {
    const onDrop = vi.fn();
    render(<KeyboardDndHarness onDrop={onDrop} />);
    const source = screen.getByRole("button", { name: "键盘图表" });
    source.focus();
    fireEvent.keyDown(source, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(document.body, { code: "ArrowRight", key: "ArrowRight" });
    await waitFor(() => expect(screen.getByText("键盘画布")).toHaveClass("keyboard-dropzone--over"));
    fireEvent.keyDown(document.body, { code: "Space", key: " " });
    await waitFor(() => expect(onDrop).toHaveBeenCalledWith("keyboard-canvas"));
  });

  it("mounts the actual editor palette KeyboardSensor through activation, movement, and canvas over state", async () => {
    const store = createEditorStore(empty);
    renderEditorShell(<EditorShell store={store} createComponentId={() => "keyboard-editor"} />);
    const palette = screen.getByRole("button", { name: "添加柱图" });
    palette.focus();
    fireEvent.keyDown(palette, { code: "Space", key: " " });
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.keyDown(document.body, { code: "ArrowRight", key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("main", { name: "看板画布" })).toHaveClass("editor-canvas--drop-target"));
    expect(document.querySelector(".palette-drag-overlay")?.parentElement?.getAttribute("style")).toContain("translate3d(25px");
    // jsdom cannot faithfully complete dnd-kit's default async end-key lifecycle with
    // Ant's animated DragOverlay. The focused real KeyboardSensor harness above proves
    // the drop event; EditorShell.test.tsx separately proves the product Enter-to-add path.
  });

  it("updates the real grid width when ResizeObserver reports a container change", async () => {
    let reportWidth: ((width: number) => void) | undefined;
    class ControlledResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        reportWidth = (width) => callback([
          { contentRect: domRect(0, 0, width, 700) } as ResizeObserverEntry,
        ], this);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = ControlledResizeObserver;
    renderEditorShell(<EditorShell store={createEditorStore(populated)} createComponentId={() => "unused"} />);
    const item = document.querySelector<HTMLElement>(".react-grid-item");
    expect(item).toBeInTheDocument();
    const initialWidth = item!.style.width;
    expect(reportWidth).toBeTypeOf("function");
    act(() => reportWidth!(600));
    await waitFor(() => expect(item!.style.width).not.toBe(initialWidth));
    expect(item!.style.width).toBe("380px");
  });
});
