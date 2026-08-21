// @vitest-environment jsdom

import { barDefinition, barLineDefinition, kpiDefinition, metricAlertDefinition } from "@drag-visual/component-registry";
import { DashboardSchema } from "@drag-visual/contracts";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { ComponentStylePanel } from "./ComponentStylePanel.js";
import { createEditorStore } from "./store/editorStore.js";

const dashboard = DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
  components: [{ id: "bar-1", type: "bar", title: "柱图", props: { color: "#1677ff", showLegend: true } }],
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
});

describe("ComponentStylePanel", () => {
  it("hides chart color and legend controls", () => {
    const store = createEditorStore(dashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><ComponentStylePanel store={store} component={component} definition={barDefinition} /></AppProviders>);

    expect(screen.queryByLabelText("主题颜色")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "显示图例" })).not.toBeInTheDocument();
    expect(store.getState().history.present.components[0]!.props).toEqual({ color: "#1677ff", showLegend: true });
  });

  it("supports numeric formatting controls for metric components", async () => {
    const kpiDashboard = DashboardSchema.parse({
      ...dashboard,
      components: [{ id: "bar-1", type: "kpi", title: "指标卡", props: { aggregation: "first", prefix: "", suffix: "", decimals: 0 } }],
    });
    const store = createEditorStore(kpiDashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><ComponentStylePanel store={store} component={component} definition={kpiDefinition} /></AppProviders>);

    const prefix = screen.getByRole("textbox", { name: "数值前缀" });
    await userEvent.type(prefix, "¥");
    const decimals = screen.getByRole("spinbutton", { name: "小数位数" });
    await userEvent.clear(decimals);
    await userEvent.type(decimals, "2");
    fireEvent.blur(decimals);

    expect(store.getState().history.present.components[0]!.props).toMatchObject({ prefix: "¥", decimals: 2 });
  });

  it("configures metric-alert decimals and commits alert copy after the author pauses editing", async () => {
    const alertDashboard = DashboardSchema.parse({
      ...dashboard,
      components: [{
        id: "bar-1",
        type: "metricAlert",
        title: "库存预警",
        props: {
          aggregation: "sum",
          operator: "gte",
          threshold: 200,
          decimals: 0,
          alertLabel: "指标预警 {{count}} 项",
          scopeText: "全部范围",
          headlineTemplate: "{{metric}}触发预警",
          messageTemplate: "{{scope}}｜共 {{count}} 个{{dimensionLabel}}命中预警。",
          detailTemplate: "{{dimension}}的{{metric}}当前值为 {{value}}。",
        },
      }],
    });
    const store = createEditorStore(alertDashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><ComponentStylePanel store={store} component={component} definition={metricAlertDefinition} /></AppProviders>);

    const decimals = screen.getByRole("spinbutton", { name: "小数位数" });
    fireEvent.change(decimals, { target: { value: "2" } });
    expect(store.getState().history.present.components[0]!.props.decimals).toBe(2);
    expect(screen.getByText("效果预览")).toBeInTheDocument();
    expect(screen.getByText("插入变量")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "编辑预警标签" }));
    const label = screen.getByRole("textbox", { name: "预警标签" });
    fireEvent.change(label, { target: { value: "库存风险 {{count}} 项" } });
    expect(store.getState().history.present.components[0]!.props.alertLabel).toBe("指标预警 {{count}} 项");
    fireEvent.blur(label);
    expect(store.getState().history.present.components[0]!.props.alertLabel).toBe("库存风险 {{count}} 项");

    await userEvent.click(screen.getByRole("button", { name: "编辑适用范围" }));
    const scope = screen.getByRole("textbox", { name: "适用范围" });
    await userEvent.clear(scope);
    await userEvent.type(scope, "华东仓");
    fireEvent.blur(scope);
    expect(store.getState().history.present.components[0]!.props.scopeText).toBe("华东仓");

    await userEvent.click(screen.getByText("弹窗文案"));
    await userEvent.click(screen.getByRole("button", { name: "编辑详情文案" }));
    const detail = screen.getByRole("textbox", { name: "详情文案" });
    fireEvent.focus(detail);
    await userEvent.click(screen.getByRole("button", { name: /当前值当前实际值/ }));
    fireEvent.blur(detail);
    expect(store.getState().history.present.components[0]!.props.detailTemplate).toContain("{{value}}");
  });

  it("updates bar-line switches while preserving hidden runtime props", async () => {
    const barLineDashboard = DashboardSchema.parse({
      ...dashboard,
      components: [{
        id: "bar-1",
        type: "barLine",
        title: "柱状折线组合图",
        props: {
          aggregation: "sum",
          appliedResultLimit: 100,
          barColor: "#2f62dc",
          dataRefreshVersion: 11,
          hideZeroValues: true,
          lineColor: "#ff7417",
          resultLimit: 100,
          showLegend: true,
          smartLineScale: true,
          smooth: true,
        },
      }],
    });
    const store = createEditorStore(barLineDashboard);
    const component = store.getState().history.present.components[0]!;
    const { rerender } = render(<AppProviders><ComponentStylePanel store={store} component={component} definition={barLineDefinition} /></AppProviders>);

    expect(screen.queryByRole("spinbutton", { name: "resultLimit" })).not.toBeInTheDocument();
    expect(screen.queryByText("dataRefreshVersion")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("switch", { name: "隐藏全零类目" }));
    await userEvent.click(screen.getByRole("switch", { name: "折线轴智能缩放" }));
    await userEvent.click(screen.getByRole("switch", { name: "平滑曲线" }));

    expect(store.getState().history.present.components[0]!.props).toMatchObject({
      hideZeroValues: false,
      smartLineScale: false,
      smooth: false,
      resultLimit: 100,
      appliedResultLimit: 100,
      dataRefreshVersion: 11,
    });
    rerender(<AppProviders><ComponentStylePanel store={store} component={store.getState().history.present.components[0]!} definition={barLineDefinition} /></AppProviders>);
    expect(screen.getByLabelText("柱状颜色")).toBeInTheDocument();
  });
});
