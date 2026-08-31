// @vitest-environment jsdom

import { DashboardSchema } from "@drag-visual/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { FIELD_DRAG_TYPE } from "./fieldDrag.js";
import { DateFilterConfigurationPanel } from "./DateFilterConfigurationPanel.js";
import { createEditorStore } from "./store/editorStore.js";

const fields = [
  { key: "orderTime", label: "订单时间", type: "date", nullable: false },
  { key: "paymentTime", label: "支付时间", type: "date", nullable: false },
] as const;

vi.mock("../datasets/LocalDatasetProvider.js", () => ({
  LocalDatasetProvider: ({ children }: { readonly children: React.ReactNode }) => children,
  useLocalDatasets: () => ({
    getDataset: (datasetId: string) => datasetId === "sales" ? {
      id: "sales", name: "销售数据", schemaVersion: "v1", fields, parameters: [],
    } : undefined,
  }),
}));

const dashboard = DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
  components: [{
    id: "bar-1", type: "bar", title: "销售额", props: { color: "#1677ff", showLegend: true },
    binding: {
      datasetId: "sales", slots: {},
      dateFilter: { fieldKey: "orderTime", defaultPreset: "all", allowCustom: true, timezone: "Asia/Shanghai" },
    },
  }],
  datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
});

describe("DateFilterConfigurationPanel", () => {
  it("accepts a date field dropped from the data panel", async () => {
    const store = createEditorStore(dashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><DateFilterConfigurationPanel store={store} component={component} /></AppProviders>);

    const dropZone = await screen.findByLabelText("筛选字段拖放区域");
    expect(screen.getByText("日期筛选已就绪")).toBeInTheDocument();
    expect(screen.getByText("订单时间")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "显示日期选择控件" })).toBeChecked();
    expect(screen.queryByRole("switch", { name: "启用日期筛选" })).not.toBeInTheDocument();
    const dataTransfer = {
      types: { 0: FIELD_DRAG_TYPE, length: 1 },
      getData: vi.fn(() => "paymentTime"),
    };
    fireEvent.dragEnter(dropZone, { dataTransfer });
    expect(fireEvent.dragOver(dropZone, { dataTransfer })).toBe(false);
    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => expect(store.getState().history.present.components[0]!.binding?.dateFilter?.fieldKey).toBe("paymentTime"));
    expect(screen.getByText("支付时间")).toBeInTheDocument();
  });

  it("creates a date-filter configuration when a date field is dropped", async () => {
    const unconfiguredDashboard = DashboardSchema.parse({
      ...dashboard,
      components: [{
        ...dashboard.components[0]!,
        binding: { datasetId: "sales", slots: {} },
      }],
    });
    const store = createEditorStore(unconfiguredDashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><DateFilterConfigurationPanel store={store} component={component} /></AppProviders>);

    const dropZone = await screen.findByLabelText("筛选字段拖放区域");
    fireEvent.drop(dropZone, { dataTransfer: { types: [FIELD_DRAG_TYPE], getData: vi.fn(() => "paymentTime") } });

    await waitFor(() => expect(store.getState().history.present.components[0]!.binding?.dateFilter).toMatchObject({ fieldKey: "paymentTime", defaultPreset: "all" }));
  });

  it("removes the selected date field from the configured filter", async () => {
    const store = createEditorStore(dashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><DateFilterConfigurationPanel store={store} component={component} /></AppProviders>);

    fireEvent.click(await screen.findByRole("button", { name: "移除日期筛选" }));

    await waitFor(() => expect(store.getState().history.present.components[0]!.binding?.dateFilter).toBeUndefined());
    expect(screen.getByText("未绑定日期字段")).toBeInTheDocument();
    expect(screen.getByText("从右侧数据面板选择日期字段后，可设置默认展示范围。")).toBeInTheDocument();
  });

  it("sets a default date preset inline without opening a configuration drawer", async () => {
    const store = createEditorStore(dashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><DateFilterConfigurationPanel store={store} component={component} /></AppProviders>);

    const thisMonth = await screen.findByRole("button", { name: "本月" });
    fireEvent.click(thisMonth);

    await waitFor(() => expect(store.getState().history.present.components[0]!.binding?.dateFilter).toMatchObject({ defaultPreset: "thisMonth" }));
    expect(screen.getByRole("button", { name: "本月" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("dialog", { name: /图表日期筛选器/ })).not.toBeInTheDocument();
  });

  it("opens the custom range picker inline", async () => {
    const store = createEditorStore(dashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><DateFilterConfigurationPanel store={store} component={component} /></AppProviders>);

    fireEvent.click(await screen.findByRole("button", { name: "自定义" }));

    expect(await screen.findByText("自定义日期范围")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /图表日期筛选器/ })).not.toBeInTheDocument();
  });

  it("hides the date picker by default for the goal-task board while retaining its date field", async () => {
    const goalTaskDashboard = DashboardSchema.parse({
      ...dashboard,
      components: [{
        ...dashboard.components[0]!,
        type: "goalTaskProgress",
        props: { aggregation: "sum", decimals: 1, periodYear: 2026, periodMonth: 8, periodMode: "month", maxEmployees: 12, metricSettings: [], employeeSettings: [] },
      }],
    });
    const store = createEditorStore(goalTaskDashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><DateFilterConfigurationPanel store={store} component={component} /></AppProviders>);

    const visibility = await screen.findByRole("switch", { name: "显示日期选择控件" });
    expect(visibility).not.toBeChecked();
    fireEvent.click(visibility);
    await waitFor(() => expect(store.getState().history.present.components[0]!.binding?.dateFilter?.showControl).toBe(true));
  });
});
