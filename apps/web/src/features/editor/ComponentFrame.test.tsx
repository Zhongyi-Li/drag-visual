// @vitest-environment jsdom

import { DashboardSchema } from "@drag-visual/contracts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ComponentFrame } from "./ComponentFrame.js";
import { createEditorStore } from "./store/editorStore.js";
import { useEditorShortcuts } from "./useEditorShortcuts.js";

const dashboard = DashboardSchema.parse({
  schemaVersion: 1, id: "123e4567-e89b-42d3-a456-426614174000", name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
  components: [{ id: "bar-1", type: "bar", title: "销售额", props: { color: "#1677ff", showLegend: true } }],
  datasets: [], revision: 1, updatedAt: "2026-07-03T08:00:00.000Z",
});

const ShortcutFrame = ({ store, onSave }: { store: ReturnType<typeof createEditorStore>; onSave?: () => void }) => {
  useEditorShortcuts(store, onSave);
  return <ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />;
};

describe("ComponentFrame", () => {
  it("selects by click without rendering a separate drag handle", async () => {
    const store = createEditorStore(dashboard);
    render(<ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);
    await userEvent.click(screen.getByRole("group", { name: "销售额" }));
    expect(store.getState().selectedComponentId).toBe("bar-1");
    expect(screen.queryByRole("button", { name: "拖动销售额" })).not.toBeInTheDocument();
  });

  it("duplicates once to a safe position, selects the copy, and does not bubble the control click", async () => {
    const store = createEditorStore(dashboard);
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    render(<ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);
    await userEvent.click(screen.getByRole("button", { name: "复制销售额" }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "component.duplicate", sourceId: "bar-1", newComponentId: "bar-2" }));
    expect(store.getState().selectedComponentId).toBe("bar-2");
    expect(store.getState().history.present.layout[1]).toMatchObject({ i: "bar-2", y: 5 });
  });

  it("deletes once and clears selection without selecting through the control", async () => {
    const store = createEditorStore(dashboard);
    store.getState().select("bar-1");
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    render(<ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);
    await userEvent.click(screen.getByRole("button", { name: "删除销售额" }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(store.getState().history.present.components).toHaveLength(0);
    expect(store.getState().selectedComponentId).toBeNull();
  });

  it("reflects the interaction pause flag in the honest placeholder", () => {
    const store = createEditorStore(dashboard);
    render(<ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting />);
    expect(screen.getByText("图表渲染将在后续阶段开放")).toBeInTheDocument();
    expect(screen.getByTestId("component-placeholder")).toHaveAttribute("data-interacting", "true");
  });

  it.each(["销售额", "复制销售额", "删除销售额"])("lets undo and save bubble from the %s focus target", async (label) => {
    const store = createEditorStore(dashboard);
    const undo = vi.spyOn(store.getState(), "undo");
    const save = vi.fn();
    render(<ShortcutFrame store={store} onSave={save} />);
    const target = label === "销售额" ? screen.getByRole("group", { name: label }) : screen.getByRole("button", { name: label });
    target.focus();
    await userEvent.keyboard("{Control>}z{/Control}");
    await userEvent.keyboard("{Meta>}s{/Meta}");
    expect(undo).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
  });

  it.each(["销售额", "复制销售额", "删除销售额"])("lets Delete remove the selected component from the %s focus target without activating it", async (label) => {
    const store = createEditorStore(dashboard);
    store.getState().select("bar-1");
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    render(<ShortcutFrame store={store} />);
    const target = label === "销售额" ? screen.getByRole("group", { name: label }) : screen.getByRole("button", { name: label });
    target.focus();
    await userEvent.keyboard("{Delete}");
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: "component.remove", componentId: "bar-1" });
    expect(store.getState().history.present.components).toHaveLength(0);
  });
});
