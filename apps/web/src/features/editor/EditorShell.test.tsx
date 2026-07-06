// @vitest-environment jsdom

import { DashboardSchema } from "@drag-visual/contracts";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProviders } from "../../app/AppProviders.js";
import { describe, expect, it, vi } from "vitest";

import { EditorShell } from "./EditorShell.js";
import { createEditorStore } from "./store/editorStore.js";

const initial = DashboardSchema.parse({
  schemaVersion: 1, id: "123e4567-e89b-42d3-a456-426614174000", name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [], components: [], datasets: [], revision: 1, updatedAt: "2026-07-03T08:00:00.000Z",
});

const webRoot = basename(process.cwd()) === "web"
  ? process.cwd()
  : resolve(process.cwd(), "apps/web");
const editorCss = readFileSync(resolve(webRoot, "src/features/editor/editor.css"), "utf8");

const renderShell = (ui: ReactElement) => render(<AppProviders>{ui}</AppProviders>);

describe("EditorShell", () => {
  it("renders three editor columns and registry-driven palette", () => {
    renderShell(<EditorShell store={createEditorStore(initial)} />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "图表组件" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "看板画布" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "配置面板" })).toBeInTheDocument();
    expect(screen.queryByText("官方")).not.toBeInTheDocument();
    expect(screen.queryByText("自定义")).not.toBeInTheDocument();
    expect(screen.getByText("表格")).toBeInTheDocument();
    expect(screen.getByText("指标")).toBeInTheDocument();
    expect(screen.getByText("线/面积图")).toBeInTheDocument();
    expect(screen.getByText("柱/条图")).toBeInTheDocument();
    expect(screen.getByText("饼/环形")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加交叉表" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "添加指标看板" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "添加线图" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "添加柱图" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "添加饼图" })).toBeEnabled();
    expect(screen.getByText("尚未选择组件")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "保存状态" })).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("complementary", { name: "图表组件" })).toHaveClass("editor-panel-scroll");
    expect(screen.getByRole("complementary", { name: "配置面板" })).toHaveClass("editor-panel-scroll");
  });

  it("keeps exact panel widths with independently scrolling side panels", () => {
    expect(editorCss).toContain("grid-template-columns: 240px minmax(720px, 1fr) 320px");
    expect(editorCss).toContain(".editor-panel-scroll");
    expect(editorCss).toContain("overflow-y: auto");
    expect(editorCss).not.toContain("html, body");
    expect(editorCss).toContain(".editor-app *");
  });

  it("adds and selects a bar, then wires undo and redo", async () => {
    const store = createEditorStore(initial);
    renderShell(<EditorShell store={store} createComponentId={() => "bar-1"} />);
    const undo = screen.getByRole("button", { name: "撤销" });
    const redo = screen.getByRole("button", { name: "重做" });
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "添加柱图" }));
    expect(store.getState().selectedComponentId).toBe("bar-1");
    expect(screen.getByText("柱图配置")).toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "数据集" })).toBeInTheDocument();
    expect(undo).toBeEnabled();
    await userEvent.click(undo);
    expect(redo).toBeEnabled();
  });

  it("keeps keyboard activation as an accessible add path", async () => {
    const store = createEditorStore(initial);
    renderShell(<EditorShell store={store} createComponentId={() => "bar-keyboard"} />);
    const add = screen.getByRole("button", { name: "添加柱图" });
    add.focus();
    await userEvent.keyboard("{Enter}");
    expect(store.getState().history.present.components[0]).toMatchObject({ id: "bar-keyboard", type: "bar" });
  });

  it("wires editor shortcuts through the shell", () => {
    const store = createEditorStore(initial);
    const save = vi.fn();
    renderShell(<EditorShell store={store} onSave={save} />);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }));
    expect(save).toHaveBeenCalledOnce();
  });

  it("shows honest unavailable persistence actions", () => {
    renderShell(<EditorShell store={createEditorStore(initial)} />);
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "预览" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "发布" })).toBeDisabled();
  });

  it("filters definitions by title and exposes unavailable filter honestly", async () => {
    renderShell(<EditorShell store={createEditorStore(initial)} />);
    const search = screen.getByRole("searchbox", { name: "搜索图表" });
    await userEvent.type(search, "不存在");
    expect(screen.queryByRole("button", { name: "添加柱图" })).not.toBeInTheDocument();
    expect(screen.getByText("未找到匹配的图表")).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, "柱/条图");
    expect(screen.getByRole("button", { name: "添加柱图" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "筛选图表（即将开放）" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "添加查询控件（即将开放）" })).toBeDisabled();
  });

  it("focuses palette search from the enabled toolbar action", async () => {
    renderShell(<EditorShell store={createEditorStore(initial)} />);
    await userEvent.click(screen.getByRole("button", { name: "添加图表" }));
    expect(screen.getByRole("searchbox", { name: "搜索图表" })).toHaveFocus();
  });

  it("adds a curated palette entry with its mapped component type and visible title", async () => {
    const store = createEditorStore(initial);
    renderShell(<EditorShell store={store} createComponentId={() => "line-1"} />);
    await userEvent.type(screen.getByRole("searchbox", { name: "搜索图表" }), "趋势分析");
    expect(screen.queryByRole("button", { name: "添加柱图" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "添加趋势分析" }));
    expect(store.getState().history.present.components[0]).toMatchObject({ id: "line-1", type: "line", title: "趋势分析" });
  });
});
