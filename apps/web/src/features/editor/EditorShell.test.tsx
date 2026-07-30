// @vitest-environment jsdom

import { DashboardSchema } from "@drag-visual/contracts";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { ReactElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getByRole("complementary", { name: "配置与数据面板" })).toBeInTheDocument();
    expect(screen.queryByText("官方")).not.toBeInTheDocument();
    expect(screen.queryByText("自定义")).not.toBeInTheDocument();
    expect(screen.getByText("表格")).toBeInTheDocument();
    expect(screen.getByText("指标")).toBeInTheDocument();
    expect(screen.queryByText("线/面积图")).not.toBeInTheDocument();
    expect(screen.getByText("柱/条图")).toBeInTheDocument();
    expect(screen.getByText("饼/环形")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "添加交叉表" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加指标看板" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "添加线图" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加柱图" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "添加饼图" })).toBeEnabled();
    expect(screen.getByText("尚未选择组件")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "保存状态" })).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("complementary", { name: "图表组件" })).toHaveClass("editor-panel-scroll");
    expect(screen.getByRole("region", { name: "配置面板" })).toHaveClass("editor-panel-scroll");
  });

  it("keeps exact panel widths with independently scrolling side panels", () => {
    expect(editorCss).toContain("grid-template-columns: 240px minmax(400px, 1fr) 520px");
    expect(editorCss).toContain(".editor-workbench--inspector-collapsed");
    expect(editorCss).toContain("grid-template-columns: 240px minmax(672px, 1fr) 248px");
    expect(editorCss).toContain(".editor-workbench--data-panel-collapsed");
    expect(editorCss).toContain(".editor-workbench--inspector-collapsed.editor-workbench--data-panel-collapsed");
    expect(editorCss).not.toContain("transition: grid-template-columns");
    expect(editorCss).toContain(".editor-panel-scroll");
    expect(editorCss).toContain("overflow-y: auto");
    expect(editorCss).not.toContain("html, body");
    expect(editorCss).toContain(".editor-app *");
  });

  it("scopes multi-direction resize handles to the editor canvas", () => {
    expect(editorCss).toContain(".editor-canvas .react-grid-item > .react-resizable-handle");
    expect(editorCss).toContain("transform: none");
    expect(editorCss).toContain(".editor-canvas .react-grid-item:has(.component-frame--selected)");
    expect(editorCss).toContain(".react-resizable-handle.react-resizable-handle-n");
    expect(editorCss).toContain(".react-resizable-handle.react-resizable-handle-s");
    expect(editorCss).toContain(".react-resizable-handle.react-resizable-handle-e");
    expect(editorCss).toContain(".react-resizable-handle.react-resizable-handle-w");
    expect(editorCss).toContain("border-radius: 50%");
  });

  it("collapses and expands the right inspector panel", async () => {
    renderShell(<EditorShell store={createEditorStore(initial)} />);
    const workbench = screen.getByTestId("editor-workbench");
    expect(workbench).not.toHaveClass("editor-workbench--inspector-collapsed");
    expect(document.querySelector(".inspector-heading__settings")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "收起配置栏" }));
    expect(workbench).toHaveClass("editor-workbench--inspector-collapsed");
    expect(screen.queryByRole("tab", { name: "字段" })).not.toBeInTheDocument();
    expect(screen.getByText("数据")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "展开配置栏" }));
    expect(workbench).not.toHaveClass("editor-workbench--inspector-collapsed");
    expect(screen.getByRole("tab", { name: "字段" })).toBeInTheDocument();
  });

  it("collapses and expands the data panel independently", async () => {
    renderShell(<EditorShell store={createEditorStore(initial)} />);
    const workbench = screen.getByTestId("editor-workbench");

    expect(workbench).not.toHaveClass("editor-workbench--data-panel-collapsed");
    await userEvent.click(screen.getByRole("button", { name: "收起数据栏" }));
    expect(workbench).toHaveClass("editor-workbench--data-panel-collapsed");
    expect(screen.queryByText("数据")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "展开数据栏" }));
    expect(workbench).not.toHaveClass("editor-workbench--data-panel-collapsed");
    expect(screen.getByText("数据")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "保存并发布" })).toBeDisabled();
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

  it("edits the dashboard name from the title bar", async () => {
    const onRename = vi.fn();
    renderShell(<EditorShell store={createEditorStore(initial)} onRename={onRename} />);

    await userEvent.click(screen.getByRole("button", { name: "修改看板名称" }));
    const input = screen.getByRole("textbox", { name: "编辑看板名称" });
    await userEvent.clear(input);
    await userEvent.type(input, "经营总览{Enter}");

    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith("经营总览");
  });

  it("shows the full chart name when hovering a palette item", async () => {
    renderShell(<EditorShell store={createEditorStore(initial)} />);
    await userEvent.hover(screen.getByRole("button", { name: "添加热力图" }));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("热力图");
    expect(tooltip.parentElement).toHaveClass("ant-tooltip-placement-top");
  });

  it("opens a file dataset import dialog from the toolbar data entry", async () => {
    renderShell(<EditorShell store={createEditorStore(initial)} />);
    await userEvent.click(screen.getByRole("button", { name: "数据集" }));
    expect(screen.getByRole("dialog", { name: "本地数据集管理" })).toHaveClass("dataset-management-modal");
    expect(screen.getByLabelText("选择数据文件")).toHaveClass("editor-file-import-input");
    expect(screen.queryByRole("button", { name: "替换当前数据集" })).not.toBeInTheDocument();
    expect(editorCss).not.toContain(".editor-file-import-button");
    expect(editorCss).toContain(".dataset-management-modal .ant-modal-body");
    expect(editorCss).toContain("max-height: min(72vh, 760px)");
    expect(editorCss).toContain("overflow-y: auto");
  });

  it("requires an explicit edit action before renaming a dataset", async () => {
    renderShell(<EditorShell store={createEditorStore(initial)} />);
    await userEvent.click(screen.getByRole("button", { name: "数据集" }));
    await userEvent.upload(
      screen.getByLabelText("选择数据文件"),
      new File(["月份,收入\n1月,120000"], "运营数据.csv", { type: "text/csv" }),
    );

    expect(await screen.findByRole("button", { name: "修改数据集名称 运营数据" })).toBeEnabled();
    expect(screen.queryByRole("textbox", { name: "编辑数据集名称" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "修改数据集名称 运营数据" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑数据集名称" }), { target: { value: "误修改名称" } });
    expect(screen.getByRole("button", { name: "查看数据集 运营数据" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "取消修改数据集名称" }));
    expect(screen.queryByRole("textbox", { name: "编辑数据集名称" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看数据集 运营数据" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "修改数据集名称 运营数据" }));
    fireEvent.change(screen.getByRole("textbox", { name: "编辑数据集名称" }), { target: { value: "门店运营" } });
    await userEvent.click(screen.getByRole("button", { name: "保存数据集名称" }));
    expect(screen.getByRole("button", { name: "查看数据集 门店运营" })).toBeInTheDocument();
  }, 20_000);

  it("makes an imported CSV dataset available for component binding", async () => {
    const store = createEditorStore(initial);
    const view = renderShell(<EditorShell store={store} createComponentId={() => "bar-imported"} />);
    await userEvent.click(screen.getByRole("button", { name: "数据集" }));
    await userEvent.upload(
      screen.getByLabelText("选择数据文件"),
      new File(["月份,收入\n1月,120000"], "运营数据.csv", { type: "text/csv" }),
    );
    expect(await screen.findByText("已导入 运营数据，共 1 行数据。")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "已有数据集" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看数据集 运营数据" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "删除数据集 运营数据" })).toBeEnabled();
    expect(screen.getByText("1月")).toBeInTheDocument();
    expect(screen.getByText("120000")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "字段 revenue 显示名" }), { target: { value: "成交额" } });
    expect(screen.getByDisplayValue("成交额")).toBeInTheDocument();

    view.unmount();
    renderShell(<EditorShell store={createEditorStore(initial)} createComponentId={() => "bar-imported-restored"} />);

    await userEvent.click(screen.getByRole("button", { name: "添加柱图" }));
    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "数据集" }));
    expect(await screen.findByText("运营数据")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "数据集" }));
    await userEvent.click(screen.getByRole("button", { name: "删除数据集 运营数据" }));
    await userEvent.click(screen.getByRole("button", { name: "删 除" }));
    expect(await screen.findByText("暂无本地数据集")).toBeInTheDocument();
  }, 20_000);

  it("hides chart types marked for future development from the palette", async () => {
    renderShell(<EditorShell store={createEditorStore(initial)} />);
    const search = screen.getByRole("searchbox", { name: "搜索图表" });

    for (const title of ["趋势分析", "多维分析", "交叉表", "翻牌器", "水波图", "指标拆解", "旭日图", "雷达图", "矩形树图", "线图", "面积图"]) {
      await userEvent.clear(search);
      await userEvent.type(search, title);
      expect(screen.queryByRole("button", { name: `添加${title}` })).not.toBeInTheDocument();
      expect(screen.getByText("未找到匹配的图表")).toBeInTheDocument();
    }
  });

  it("adds the rose palette entry as a dedicated polar-area component", async () => {
    const store = createEditorStore(initial);
    renderShell(<EditorShell store={store} createComponentId={() => "rose-1"} />);

    await userEvent.click(screen.getByRole("button", { name: "添加玫瑰图" }));

    expect(store.getState().history.present.components[0]).toMatchObject({
      id: "rose-1", type: "rose", title: "玫瑰图", props: { color: "#1677ff", showLegend: true },
    });
  });

  it("adds the donut palette entry as a dedicated ring component", async () => {
    const store = createEditorStore(initial);
    renderShell(<EditorShell store={store} createComponentId={() => "donut-1"} />);

    await userEvent.click(screen.getByRole("button", { name: "添加环形图" }));

    expect(store.getState().history.present.components[0]).toMatchObject({
      id: "donut-1", type: "donut", title: "环形图", props: { color: "#1677ff", showLegend: true },
    });
  });

  it("adds ring bar and ranking palette entries as dedicated components", async () => {
    const store = createEditorStore(initial);
    let nextId = "ring-1";
    renderShell(<EditorShell store={store} createComponentId={() => nextId} />);

    await userEvent.click(screen.getByRole("button", { name: "添加环形柱图" }));
    expect(store.getState().history.present.components[0]).toMatchObject({
      id: "ring-1", type: "ringBar", title: "环形柱图", props: { aggregation: "sum", color: "#1677ff", showLegend: true },
    });

    nextId = "ranking-1";
    await userEvent.click(screen.getByRole("button", { name: "添加排行榜" }));
    expect(store.getState().history.present.components[1]).toMatchObject({
      id: "ranking-1", type: "ranking", title: "排行榜", props: { color: "#1677ff", maxItems: 10, showValue: true },
    });
  });

  it("adds the metric trend palette entry as a dedicated metric trend component", async () => {
    const store = createEditorStore(initial);
    renderShell(<EditorShell store={store} createComponentId={() => "metric-trend-1"} />);

    await userEvent.click(screen.getByRole("button", { name: "添加指标趋势" }));

    expect(store.getState().history.present.components[0]).toMatchObject({
      id: "metric-trend-1",
      type: "metricTrend",
      title: "指标趋势",
      props: { aggregation: "sum", showSummary: true, timeGranularity: "day" },
    });
  });

  it("adds progress bar, target progress, and gauge palette entries as dedicated metric components", async () => {
    const store = createEditorStore(initial);
    let nextId = "progress-1";
    renderShell(<EditorShell store={store} createComponentId={() => nextId} />);

    await userEvent.click(screen.getByRole("button", { name: "添加进度条" }));

    expect(store.getState().history.present.components[0]).toMatchObject({
      id: "progress-1",
      type: "progressBar",
      title: "进度条",
      props: { aggregation: "sum", decimals: 1, showValue: true },
    });

    nextId = "target-progress-1";
    await userEvent.click(screen.getByRole("button", { name: "添加目标完成率" }));

    expect(store.getState().history.present.components[1]).toMatchObject({
      id: "target-progress-1",
      type: "targetProgress",
      title: "目标完成率",
      props: { aggregation: "sum", color: "#f57c00", decimals: 0, showValue: true, suffix: "" },
    });

    nextId = "gauge-1";
    await userEvent.click(screen.getByRole("button", { name: "添加仪表盘" }));

    expect(store.getState().history.present.components[2]).toMatchObject({
      id: "gauge-1",
      type: "gauge",
      title: "仪表盘",
      props: { aggregation: "sum", decimals: 1 },
    });

  });

  it("adds the curated heatmap entry as a dedicated heatmap component", async () => {
    const store = createEditorStore(initial);
    renderShell(<EditorShell store={store} createComponentId={() => "heatmap-1"} />);

    await userEvent.click(screen.getByRole("button", { name: "添加热力图" }));

    expect(store.getState().history.present.components[0]).toMatchObject({
      id: "heatmap-1",
      type: "heatmap",
      title: "热力图",
      props: { aggregation: "sum", showValues: true },
    });
  });
});
