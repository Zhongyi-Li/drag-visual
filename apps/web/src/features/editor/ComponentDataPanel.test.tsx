// @vitest-environment jsdom

import { createDefaultRegistry } from "@drag-visual/component-registry";
import { DashboardSchema } from "@drag-visual/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { server } from "../../mocks/server.js";
import { ComponentDataPanel } from "./ComponentDataPanel.js";
import { createEditorStore } from "./store/editorStore.js";

const fields = [
  { key: "orderTime", label: "订单时间", type: "date", nullable: true },
  { key: "productName", label: "商品名称", type: "string", nullable: true },
  { key: "orderAmount", label: "订单金额", type: "number", nullable: true },
] as const;

const dashboard = DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "trend-1", x: 0, y: 0, w: 6, h: 5 }],
  components: [{
    id: "trend-1",
    type: "trend",
    title: "趋势分析",
    props: { aggregation: "sum", showSummary: true, timeGranularity: "day" },
    binding: { datasetId: "sales", slots: { measure: { fieldKey: "orderAmount" } } },
  }],
  datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
});

describe("ComponentDataPanel", () => {
  it("uses the same collapse affordance as the configuration panel", () => {
    const onToggleCollapsed = vi.fn();
    const store = createEditorStore(dashboard);

    const { rerender } = render(
      <AppProviders><ComponentDataPanel store={store} registry={createDefaultRegistry()} onToggleCollapsed={onToggleCollapsed} /></AppProviders>,
    );

    fireEvent.click(screen.getByRole("button", { name: "收起数据栏" }));
    expect(onToggleCollapsed).toHaveBeenCalledOnce();

    rerender(
      <AppProviders><ComponentDataPanel store={store} registry={createDefaultRegistry()} collapsed onToggleCollapsed={onToggleCollapsed} /></AppProviders>,
    );
    expect(screen.getByRole("button", { name: "展开数据栏" })).toBeInTheDocument();
    expect(screen.queryByText("数据")).not.toBeInTheDocument();
  });

  it("groups date, dimension, and metric fields and double-clicks into the best slot", async () => {
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({ id: "sales", name: "销售数据", fields, parameters: [], schemaVersion: "v1" })),
    );
    const store = createEditorStore(dashboard);
    store.getState().select("trend-1");

    render(<AppProviders><ComponentDataPanel store={store} registry={createDefaultRegistry()} /></AppProviders>);

    expect(await screen.findByRole("region", { name: "日期" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "维度" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "度量" })).toBeInTheDocument();
    fireEvent.doubleClick(screen.getByRole("button", { name: "订单时间" }));

    await waitFor(() => expect(store.getState().history.present.components[0]!.binding?.slots).toMatchObject({
      timeDimension: { fieldKey: "orderTime" },
    }));
  });

  it("clicks a date field to replace the active chart's date-filter field", async () => {
    const dateFilterFields = [
      { key: "orderTime", label: "订单时间", type: "date", nullable: true },
      { key: "paymentTime", label: "支付时间", type: "date", nullable: true },
      { key: "orderAmount", label: "订单金额", type: "number", nullable: true },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({ id: "sales", name: "销售数据", fields: dateFilterFields, parameters: [], schemaVersion: "v1" })),
    );
    const filterDashboard = DashboardSchema.parse({
      ...dashboard,
      components: [{
        ...dashboard.components[0]!,
        binding: {
          ...dashboard.components[0]!.binding!,
          dateFilter: { fieldKey: "orderTime", defaultPreset: "all", allowCustom: true, timezone: "Asia/Shanghai" },
        },
      }],
    });
    const store = createEditorStore(filterDashboard);
    store.getState().select("trend-1");

    render(<AppProviders><ComponentDataPanel store={store} registry={createDefaultRegistry()} /></AppProviders>);

    const paymentField = await screen.findByRole("button", { name: "支付时间" });
    expect(screen.getByText("点击设为筛选字段")).toBeInTheDocument();
    fireEvent.click(paymentField);

    await waitFor(() => expect(store.getState().history.present.components[0]!.binding?.dateFilter?.fieldKey).toBe("paymentTime"));
  });

  it("adds a second ring-bar metric to tooltip measures instead of replacing its main metric", async () => {
    const ringFields = [
      { key: "productName", label: "商品名称", type: "string", nullable: true },
      { key: "price", label: "价格", type: "number", nullable: true },
      { key: "costPrice", label: "成本价", type: "number", nullable: true },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({ id: "sales", name: "销售数据", fields: ringFields, parameters: [], schemaVersion: "v1" })),
    );
    const ringDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "ring-1", x: 0, y: 0, w: 7, h: 4 }],
      components: [{
        id: "ring-1",
        type: "ringBar",
        title: "环形柱图",
        props: { aggregation: "sum", color: "#1677ff", showLegend: true },
        binding: { datasetId: "sales", slots: { dimension: { fieldKey: "productName" } } },
      }],
    });
    const store = createEditorStore(ringDashboard);
    store.getState().select("ring-1");

    render(<AppProviders><ComponentDataPanel store={store} registry={createDefaultRegistry()} /></AppProviders>);

    await screen.findByRole("button", { name: "价格" });
    fireEvent.doubleClick(screen.getByRole("button", { name: "价格" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "成本价" }));

    await waitFor(() => expect(store.getState().history.present.components[0]!.binding?.slots).toMatchObject({
      dimension: { fieldKey: "productName" },
      measure: { fieldKey: "price" },
      tooltipMeasures: [{ fieldKey: "costPrice" }],
    }));
  });

  it("binds target-progress fields from double-clicked data entries", async () => {
    const targetProgressFields = [
      { key: "productName", label: "商品名称", type: "string", nullable: true },
      { key: "completed", label: "完成值", type: "number", nullable: true },
      { key: "targetValue", label: "目标值", type: "number", nullable: true },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({ id: "sales", name: "销售数据", schemaVersion: "v1", fields: targetProgressFields, parameters: [] })),
    );
    const targetProgressDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "target-progress-1", x: 0, y: 0, w: 9, h: 5 }],
      components: [{
        id: "target-progress-1",
        type: "targetProgress",
        title: "目标完成率",
        props: { aggregation: "sum", color: "#f57c00", decimals: 0, showValue: true, suffix: "" },
        binding: { datasetId: "sales", slots: {} },
      }],
    });
    const store = createEditorStore(targetProgressDashboard);
    store.getState().select("target-progress-1");

    render(<AppProviders><ComponentDataPanel store={store} registry={createDefaultRegistry()} /></AppProviders>);

    await screen.findByRole("button", { name: "商品名称" });
    fireEvent.doubleClick(screen.getByRole("button", { name: "商品名称" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "完成值" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "目标值" }));

    await waitFor(() => expect(store.getState().history.present.components[0]!.binding?.slots).toEqual({
      dimension: { fieldKey: "productName" },
      measure: { fieldKey: "completed" },
      target: { fieldKey: "targetValue" },
    }));
  });

  it("routes gauge actual and target values from the data panel", async () => {
    const gaugeFields = [
      { key: "actualSales", label: "实际销售额", type: "number", nullable: true },
      { key: "salesTarget", label: "销售目标", type: "number", nullable: true },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({ id: "sales", name: "销售数据", schemaVersion: "v1", fields: gaugeFields, parameters: [] })),
    );
    const gaugeDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "gauge-1", x: 0, y: 0, w: 4, h: 4 }],
      components: [{
        id: "gauge-1",
        type: "gauge",
        title: "仪表盘",
        props: { aggregation: "sum", decimals: 1 },
        binding: { datasetId: "sales", slots: {} },
      }],
    });
    const store = createEditorStore(gaugeDashboard);
    store.getState().select("gauge-1");

    render(<AppProviders><ComponentDataPanel store={store} registry={createDefaultRegistry()} /></AppProviders>);

    fireEvent.doubleClick(await screen.findByRole("button", { name: "实际销售额" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "销售目标" }));

    await waitFor(() => expect(store.getState().history.present.components[0]!.binding?.slots).toEqual({
      measure: { fieldKey: "actualSales" },
      target: { fieldKey: "salesTarget" },
    }));
  });

  it("routes heatmap row, column, and metric fields from the data panel", async () => {
    const heatmapFields = [
      { key: "region", label: "地区", type: "string", nullable: true },
      { key: "channel", label: "渠道", type: "string", nullable: true },
      { key: "orderAmount", label: "订单金额", type: "number", nullable: true },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({ id: "sales", name: "销售数据", schemaVersion: "v1", fields: heatmapFields, parameters: [] })),
    );
    const heatmapDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "heatmap-1", x: 0, y: 0, w: 7, h: 5 }],
      components: [{
        id: "heatmap-1",
        type: "heatmap",
        title: "热力图",
        props: { aggregation: "sum", color: "#1677ff" },
        binding: { datasetId: "sales", slots: {} },
      }],
    });
    const store = createEditorStore(heatmapDashboard);
    store.getState().select("heatmap-1");

    render(<AppProviders><ComponentDataPanel store={store} registry={createDefaultRegistry()} /></AppProviders>);

    fireEvent.doubleClick(await screen.findByRole("button", { name: "地区" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "渠道" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "订单金额" }));

    await waitFor(() => expect(store.getState().history.present.components[0]!.binding?.slots).toEqual({
      rowDimension: { fieldKey: "region" },
      columnDimension: { fieldKey: "channel" },
      measure: { fieldKey: "orderAmount" },
    }));
  });
});
