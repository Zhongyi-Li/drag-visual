// @vitest-environment jsdom

import { createDefaultRegistry } from "@drag-visual/component-registry";
import { DashboardSchema } from "@drag-visual/contracts";
import { render, screen } from "@testing-library/react";
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
    expect(screen.getByText("高级设置")).toBeInTheDocument();
    expect(document.querySelector(".inspector-analysis")).toBeInTheDocument();
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
    await userEvent.click(await screen.findByRole("switch", { name: "启用日期筛选" }));

    expect(store.getState().history.present.components[0]!.binding?.dateFilter).toEqual({
      fieldKey: "businessDate", defaultPreset: "all", allowCustom: true, timezone: "Asia/Shanghai",
    });
    expect(screen.getByText("范围")).toBeInTheDocument();
    expect(screen.getByText("从右侧点击或拖入日期字段")).toBeInTheDocument();
    expect(screen.queryByLabelText("日期筛选字段")).not.toBeInTheDocument();
  });
});
