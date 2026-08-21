// @vitest-environment jsdom

import { DashboardSchema } from "@drag-visual/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { AnalysisGroupDateFilterConfigurationPanel } from "./AnalysisGroupDateFilterConfigurationPanel.js";
import { createEditorStore } from "./store/editorStore.js";

const dashboard = DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "group-1", x: 0, y: 0, w: 12, h: 8 }],
  components: [{
    id: "group-1",
    type: "analysisGroup",
    title: "复合分析",
    props: { description: "按主题汇总图表。", columns: 12, gap: 12, showSurface: true, queryFilters: [], dateFilter: null },
  }],
  datasets: [],
  revision: 1,
  updatedAt: "2026-08-18T08:00:00.000Z",
});

describe("AnalysisGroupDateFilterConfigurationPanel", () => {
  it("uses the same configured-status and edit-entry pattern as a chart date filter", async () => {
    const store = createEditorStore(dashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><AnalysisGroupDateFilterConfigurationPanel component={component} store={store} /></AppProviders>);

    expect(screen.getByText("未配置")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑复合分析日期筛选" }));

    await waitFor(() => expect(store.getState().history.present.components[0]!.props.dateFilter).toMatchObject({ defaultPreset: "all", targets: [] }));
    expect(screen.getByText("日期筛选设置")).toBeInTheDocument();
    expect(screen.getByText("已配置")).toBeInTheDocument();
    expect(screen.getByText("未关联图表")).toBeInTheDocument();
  });
});
