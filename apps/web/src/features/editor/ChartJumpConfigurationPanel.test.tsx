// @vitest-environment jsdom

import { DashboardSchema } from "@drag-visual/contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ChartJumpConfigurationPanel } from "./ChartJumpConfigurationPanel.js";
import { createEditorStore } from "./store/editorStore.js";

const fields = [
  { key: "region", label: "区域", type: "string" as const, nullable: false },
  { key: "revenue", label: "销售额", type: "number" as const, nullable: false },
];

vi.mock("../datasets/LocalDatasetProvider.js", () => ({
  useLocalDatasets: () => ({
    getDataset: (datasetId: string) => datasetId === "sales"
      ? { id: "sales", name: "销售数据", schemaVersion: "v1", fields, parameters: [] }
      : undefined,
  }),
}));

const targetDashboard = DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174999",
  name: "区域销售明细",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "target-header", x: 0, y: 0, w: 12, h: 3 }, { i: "target-bar", x: 0, y: 3, w: 6, h: 5 }],
  components: [{
    id: "target-header", type: "dashboardHeader", title: "", props: {
      headline: "区域销售明细", description: "", updatedAt: "", date: "", globalFilters: [{
        id: "target-region", fieldKey: "region", label: "区域", controlType: "select", targets: [{ componentId: "target-bar", fieldKey: "region" }],
      }],
    },
  }, {
    id: "target-bar", type: "bar", title: "区域明细图", props: { color: "#1677ff", showLegend: true },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "revenue" } } },
  }],
  datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
  revision: 1,
  updatedAt: "2026-08-17T08:00:00.000Z",
});

vi.mock("../dashboards/dashboardApi.js", () => ({
  listDashboards: () => Promise.resolve([targetDashboard]),
}));

const sourceDashboard = DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "销售总览",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "source-bar", x: 0, y: 0, w: 6, h: 5 }],
  components: [{
    id: "source-bar", type: "bar", title: "区域销售额", props: { color: "#1677ff", showLegend: true },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "revenue" } } },
  }],
  datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
  revision: 1,
  updatedAt: "2026-08-17T08:00:00.000Z",
});

describe("ChartJumpConfigurationPanel", () => {
  it("saves a metric jump rule with a target dashboard", async () => {
    const user = userEvent.setup();
    const store = createEditorStore(sourceDashboard);
    const component = store.getState().history.present.components[0]!;
    render(<QueryClientProvider client={new QueryClient()}><ChartJumpConfigurationPanel component={component} store={store} /></QueryClientProvider>);

    expect(screen.getByText("未配置")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "编辑跳转规则" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveClass("chart-jump-modal");
    expect(dialog).toHaveTextContent("图表跳转设置");
    expect(screen.getByRole("button", { name: /销售额/ })).toBeInTheDocument();

    await user.click(screen.getByLabelText("目标看板"));
    await user.click(await screen.findByText("区域销售明细"));
    await user.click(screen.getByRole("button", { name: /确\s*认/ }));

    await waitFor(() => expect(store.getState().history.present.components[0]?.interaction).toEqual({
      jumpRules: [expect.objectContaining({ triggerFieldKey: "revenue", targetDashboardId: targetDashboard.id, openMode: "current", parameterMappings: [] })],
    }));
    expect(screen.getByText("已配置")).toBeInTheDocument();
  });

  it("stores a target chart when locating the jump position", async () => {
    const user = userEvent.setup();
    const store = createEditorStore(sourceDashboard);
    const component = store.getState().history.present.components[0]!;
    render(<QueryClientProvider client={new QueryClient()}><ChartJumpConfigurationPanel component={component} store={store} /></QueryClientProvider>);

    await user.click(screen.getByRole("button", { name: "编辑跳转规则" }));
    await user.click(screen.getByLabelText("目标看板"));
    await user.click(await screen.findByText("区域销售明细"));
    await user.click(screen.getByRole("radio", { name: "定位到图表" }));
    await user.click(await screen.findByLabelText("目标图表"));
    await user.click(await screen.findByText("区域明细图"));
    await user.click(screen.getByRole("button", { name: /确\s*认/ }));

    await waitFor(() => expect(store.getState().history.present.components[0]?.interaction).toEqual({
      jumpRules: [expect.objectContaining({ targetPosition: "component", targetComponentId: "target-bar" })],
    }));
  });
});
