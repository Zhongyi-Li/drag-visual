// @vitest-environment jsdom

import { createDefaultRegistry } from "@drag-visual/component-registry";
import { DashboardSchema } from "@drag-visual/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { InspectorPanel } from "./InspectorPanel.js";
import { createEditorStore } from "./store/editorStore.js";

const dashboard = DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [],
  components: [],
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
});

describe("InspectorPanel", () => {
  it("shows the component and analysis configuration tabs", () => {
    const store = createEditorStore(dashboard);
    render(
      <AppProviders>
        <InspectorPanel store={store} registry={createDefaultRegistry()} collapsed={false} onToggleCollapsed={() => undefined} />
      </AppProviders>,
    );

    expect(screen.getByRole("tab", { name: "字段" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "分析" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "主题" })).not.toBeInTheDocument();
  });

  it("keeps the data panel available when only configuration is collapsed", () => {
    const store = createEditorStore(dashboard);
    render(
      <AppProviders>
        <InspectorPanel store={store} registry={createDefaultRegistry()} collapsed onToggleCollapsed={() => undefined} />
      </AppProviders>,
    );

    expect(screen.getByRole("button", { name: "展开配置栏" })).toBeInTheDocument();
    expect(screen.getByText("数据")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起数据栏" })).toBeInTheDocument();
  });

  it("shows bar-line display optimization switches in the display tab", async () => {
    const selectedDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "bar-line-1", x: 0, y: 0, w: 7, h: 5 }],
      components: [{
        id: "bar-line-1",
        type: "barLine",
        title: "柱状折线组合图",
        props: { aggregation: "sum", barColor: "#2f62dc", hideZeroValues: true, lineColor: "#ff7417", showLegend: true, smartLineScale: true, smooth: false },
      }],
    });
    const store = createEditorStore(selectedDashboard);
    store.getState().select("bar-line-1");
    render(<AppProviders><InspectorPanel store={store} registry={createDefaultRegistry()} collapsed={false} onToggleCollapsed={() => undefined} /></AppProviders>);

    await userEvent.click(screen.getByRole("tab", { name: "显示" }));

    expect(screen.getByRole("switch", { name: "隐藏全零类目" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "折线轴智能缩放" })).toBeChecked();
  });

  it("provides analysis-group container controls in the display tab", async () => {
    const selectedDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "group-1", x: 0, y: 0, w: 12, h: 8 }],
      components: [{
        id: "group-1",
        type: "analysisGroup",
        title: "复合分析",
        props: { description: "按商品查看库存与销量。", columns: 12, gap: 12, showSurface: true, queryFilters: [] },
      }],
    });
    const store = createEditorStore(selectedDashboard);
    store.getState().select("group-1");
    render(<AppProviders><InspectorPanel store={store} registry={createDefaultRegistry()} collapsed={false} onToggleCollapsed={() => undefined} /></AppProviders>);

    await userEvent.click(screen.getByRole("tab", { name: "显示" }));

    expect(screen.getByRole("textbox", { name: "图表标题" })).toHaveValue("复合分析");
    expect(screen.getByRole("textbox", { name: "复合分析说明" })).toHaveValue("按商品查看库存与销量。");
    expect(screen.getByRole("spinbutton", { name: "内部栅格列数" })).toHaveValue("12");
    expect(screen.getByRole("spinbutton", { name: "图表间距" })).toHaveValue("12");
    expect(screen.getByRole("switch", { name: "显示容器边框" })).toBeChecked();

    await userEvent.click(screen.getByRole("switch", { name: "显示容器边框" }));
    expect(store.getState().history.present.components[0]?.props.showSurface).toBe(false);
  });

  it("explains that a chart must be selected before configuring data interaction", async () => {
    const store = createEditorStore(dashboard);
    render(
      <AppProviders>
        <InspectorPanel store={store} registry={createDefaultRegistry()} collapsed={false} onToggleCollapsed={() => undefined} />
      </AppProviders>,
    );

    await userEvent.click(screen.getByRole("tab", { name: "分析" }));
    await userEvent.click(screen.getByText("数据交互"));

    expect(screen.getByText("选择图表后配置日期筛选。")).toBeInTheDocument();
    expect(screen.queryByText("高级设置")).not.toBeInTheDocument();
    expect(document.querySelector(".inspector-analysis")).toBeInTheDocument();
  });

  it("groups linkage and chart jumps into separate collapsible sections", async () => {
    const selectedDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
      components: [{
        id: "bar-1", type: "bar", title: "销售额", props: { color: "#1677ff", showLegend: true },
      }],
    });
    const store = createEditorStore(selectedDashboard);
    store.getState().select("bar-1");
    render(<AppProviders><InspectorPanel store={store} registry={createDefaultRegistry()} collapsed={false} onToggleCollapsed={() => undefined} /></AppProviders>);

    await userEvent.click(screen.getByRole("tab", { name: "分析" }));
    expect(screen.getByText("联动")).toBeInTheDocument();
    expect(screen.getByText("跳转")).toBeInTheDocument();
    expect(screen.getByText("日期筛选")).toBeVisible();
    expect(screen.getByText("筛选条件配置")).toBeVisible();
    expect(screen.queryByText("请先在“字段”页绑定数据源，再配置图表跳转。")).not.toBeInTheDocument();

    await userEvent.click(screen.getByText("跳转"));
    await waitFor(() => expect(screen.getByText("图表跳转")).toBeVisible());
    await waitFor(() => expect(screen.getByText("请先在“字段”页绑定数据源，再配置图表跳转。")).toBeVisible());
  });

  it("opens the standalone KPI insight configuration in a bottom drawer", async () => {
    const selectedDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "insight-1", x: 0, y: 0, w: 3, h: 3 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "insight-1",
        type: "kpiInsight",
        title: "GMV 洞察",
        props: {
          aggregation: "sum",
          prefix: "¥",
          suffix: "",
          decimals: 0,
          insightRows: [{ type: "comparison", prefix: "环比", tone: "auto" }],
        },
        binding: { datasetId: "sales", slots: { measure: [{ fieldKey: "gmv" }] } },
      }],
    });
    const store = createEditorStore(selectedDashboard);
    store.getState().select("insight-1");
    render(
      <AppProviders>
        <InspectorPanel store={store} registry={createDefaultRegistry()} collapsed={false} onToggleCollapsed={() => undefined} />
      </AppProviders>,
    );

    expect(screen.getByRole("button", { name: "打开指标洞察设置" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "指标洞察配置" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "打开指标洞察设置" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("指标洞察设置");
    expect(screen.getByRole("row", { name: "gmv聚合设置" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "gmv聚合方式" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新" })).toBeInTheDocument();
    expect(screen.queryByText("展示内容")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "收起看板指标/度量" }));
    expect(screen.queryByRole("row", { name: "gmv聚合设置" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开看板指标/度量" })).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(screen.getByRole("button", { name: "展开看板指标/度量" }));
    await userEvent.click(screen.getByRole("combobox", { name: "gmv聚合方式" }));
    await userEvent.click(screen.getByText("平均值"));
    expect(store.getState().history.present.components[0]?.binding?.slots.measure).toEqual([{ fieldKey: "gmv", aggregation: "avg" }]);
  });

  it("configures a dashboard header from its dedicated settings tab", async () => {
    const selectedDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "header-1", x: 0, y: 0, w: 12, h: 3 }],
      components: [{
        id: "header-1", type: "dashboardHeader", title: "",
        props: {
          headline: "经营数据看板", description: "用于快速掌握经营表现与关键指标。", updatedAt: "更新时间：2026-08-05 10:00",
          date: "2026-08-05", dateRange: { start: "2026-08-05", end: "2026-08-05" }, globalFilters: [],
        },
      }],
    });
    const store = createEditorStore(selectedDashboard);
    store.getState().select("header-1");
    render(<AppProviders><InspectorPanel store={store} registry={createDefaultRegistry()} collapsed={false} onToggleCollapsed={() => undefined} /></AppProviders>);

    expect(screen.getByText("看板信息栏配置")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "设置" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "分析" })).not.toBeInTheDocument();
    await userEvent.clear(screen.getByRole("textbox", { name: "看板信息栏标题" }));
    await userEvent.type(screen.getByRole("textbox", { name: "看板信息栏标题" }), "小米旗舰店经营看板");
    expect(store.getState().history.present.components[0]!.props.headline).toBe("小米旗舰店经营看板");
    expect(screen.getByLabelText("全局筛选条件状态")).toHaveTextContent("未配置");
    expect(screen.queryByLabelText("全局日期筛选状态")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "编辑全局日期筛选" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "编辑全局筛选条件" })).toBeInTheDocument();
  });

  it("removes a legacy KPI insight dimension binding", async () => {
    const selectedDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "insight-legacy", x: 0, y: 0, w: 3, h: 3 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "insight-legacy",
        type: "kpiInsight",
        title: "GMV 洞察",
        props: { aggregation: "sum", prefix: "¥", suffix: "", decimals: 0, displayName: "", insightRows: [{ type: "comparison", prefix: "环比", tone: "auto" }] },
        binding: { datasetId: "sales", slots: { dimension: { fieldKey: "store" }, measure: { fieldKey: "gmv" } } },
      }],
    });
    const store = createEditorStore(selectedDashboard);
    store.getState().select("insight-legacy");
    render(
      <AppProviders>
        <InspectorPanel store={store} registry={createDefaultRegistry()} collapsed={false} onToggleCollapsed={() => undefined} />
      </AppProviders>,
    );

    await waitFor(() => expect(store.getState().history.present.components[0]?.binding?.slots.dimension).toBeUndefined());
  });

  it("saves a selected chart's date-filter control in its binding", async () => {
    const selectedDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: { year: 2026, fromDate: "2026-01-01" } }],
      components: [{
        id: "bar-1", type: "bar", title: "销售额", props: { color: "#1677ff", showLegend: true },
        binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measure: { fieldKey: "revenue" } } },
      }],
    });
    const store = createEditorStore(selectedDashboard);
    store.getState().select("bar-1");
    render(
      <AppProviders>
        <InspectorPanel store={store} registry={createDefaultRegistry()} collapsed={false} onToggleCollapsed={() => undefined} />
      </AppProviders>,
    );

    await userEvent.click(screen.getByRole("tab", { name: "分析" }));
    await userEvent.click(screen.getByText("数据交互"));
    const dateFilterStatus = await screen.findByLabelText("日期筛选配置状态");
    expect(within(dateFilterStatus).getByText("未配置")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "业务日期" }));

    expect(store.getState().history.present.components[0]!.binding?.dateFilter).toEqual({
      fieldKey: "businessDate", defaultPreset: "all", allowCustom: true, timezone: "Asia/Shanghai",
    });
    expect(within(screen.getByLabelText("日期筛选配置状态")).getByText("已配置")).toBeInTheDocument();
    expect(screen.getByLabelText("日期筛选帮助")).toBeInTheDocument();
    expect(screen.queryByText("启用日期筛选")).not.toBeInTheDocument();
  });
});
