// @vitest-environment jsdom

import { DashboardSchema } from "@drag-visual/contracts";
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import { createEditorStore } from "./store/editorStore.js";
import { useEditorShortcuts } from "./useEditorShortcuts.js";

const initial = DashboardSchema.parse({
  schemaVersion: 1, id: "123e4567-e89b-42d3-a456-426614174000", name: "快捷键",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" }, layout: [], components: [], datasets: [],
  revision: 1, updatedAt: "2026-07-03T08:00:00.000Z",
});

const Harness = ({ onSave, onCleanup }: { onSave?: () => void; onCleanup?: () => void }) => {
  const store = createEditorStore(initial);
  useEditorShortcuts(store, onSave);
  useEffect(() => () => onCleanup?.(), [onCleanup]);
  return <input aria-label="编辑字段" />;
};

describe("useEditorShortcuts", () => {
  it("supports Windows and Mac undo/redo modifiers and explicit save", () => {
    const store = createEditorStore(initial);
    const undo = vi.spyOn(store.getState(), "undo");
    const redo = vi.spyOn(store.getState(), "redo");
    const save = vi.fn();
    const LocalHarness = () => { useEditorShortcuts(store, save); return null; };
    render(<LocalHarness />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Z", metaKey: true, shiftKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true, bubbles: true }));
    expect(undo).toHaveBeenCalledOnce();
    expect(redo).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
  });

  it("removes the selected component unless focus is editable", () => {
    const store = createEditorStore(DashboardSchema.parse({ ...initial, layout: [{ i: "one", x: 0, y: 0, w: 6, h: 5 }], components: [{ id: "one", type: "bar", props: {} }] }));
    store.getState().select("one");
    const LocalHarness = () => { useEditorShortcuts(store); return <input aria-label="编辑字段" />; };
    const { getByRole } = render(<LocalHarness />);
    const input = getByRole("textbox", { name: "编辑字段" });
    input.focus();
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    expect(store.getState().history.present.components).toHaveLength(1);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    expect(store.getState().history.present.components).toHaveLength(0);
    expect(store.getState().selectedComponentId).toBeNull();
  });

  it.each([
    ["input", () => document.createElement("input")],
    ["textarea", () => document.createElement("textarea")],
    ["select", () => document.createElement("select")],
    ["contenteditable", () => { const node = document.createElement("div"); node.contentEditable = "true"; return node; }],
  ])("leaves native editing shortcuts untouched in %s", (_name, createEditable) => {
    const store = createEditorStore(DashboardSchema.parse({ ...initial, layout: [{ i: "one", x: 0, y: 0, w: 6, h: 5 }], components: [{ id: "one", type: "bar", props: {} }] }));
    store.getState().select("one");
    const undo = vi.spyOn(store.getState(), "undo");
    const redo = vi.spyOn(store.getState(), "redo");
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    const save = vi.fn();
    const LocalHarness = () => { useEditorShortcuts(store, save); return null; };
    render(<LocalHarness />);
    const editable = createEditable();
    document.body.append(editable);
    const events = [
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: "Z", metaKey: true, shiftKey: true, bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }),
    ];
    events.forEach((event) => editable.dispatchEvent(event));
    expect(events.every((event) => !event.defaultPrevented)).toBe(true);
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(store.getState().history.present.components).toHaveLength(1);
    editable.remove();
  });

  it("cleans its window listener on unmount", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<Harness />);
    unmount();
    expect(remove).toHaveBeenCalledWith("keydown", expect.any(Function));
  });
});
