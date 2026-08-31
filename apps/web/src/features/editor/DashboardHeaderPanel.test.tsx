// @vitest-environment jsdom

import { barDefinition, dashboardHeaderDefinition } from "@drag-visual/component-registry";
import { DashboardSchema } from "@drag-visual/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { DashboardHeaderPanel } from "./DashboardHeaderPanel.js";
import { createEditorStore } from "./store/editorStore.js";

const dashboard = DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [
    { i: "header-1", x: 0, y: 0, w: 12, h: 3 },
    { i: "bar-1", x: 0, y: 3, w: 6, h: 5 },
  ],
  components: [
    { id: "header-1", type: "dashboardHeader", title: "", props: dashboardHeaderDefinition.createDefaults() },
    {
      id: "bar-1",
      type: "bar",
      title: "销售趋势",
      props: barDefinition.createDefaults(),
      binding: {
        datasetId: "sales-local",
        slots: { dimension: { fieldKey: "store" }, measure: { fieldKey: "sales" } },
      },
    },
  ],
  datasets: [{ datasetId: "sales-local", schemaVersion: "sales-local-v1", parameters: {} }],
  revision: 1,
  updatedAt: "2026-08-26T08:00:00.000Z",
});

describe("DashboardHeaderPanel", () => {
  it("creates a filter from an available field and switches its control type", async () => {
    window.localStorage.setItem("drag-visual.local-datasets.v1", JSON.stringify([{
      schema: {
        id: "sales-local",
        name: "本地销售数据",
        fields: [
          { key: "store", label: "门店", type: "string", nullable: false },
          { key: "orderDate", label: "订单日期", type: "date", nullable: false },
          { key: "sales", label: "销售额", type: "number", nullable: false },
        ],
        parameters: [],
        schemaVersion: "sales-local-v1",
      },
      result: {
        columns: [],
        rows: [],
        total: 0,
        sampledAt: "2026-08-26T08:00:00.000Z",
      },
    }]));
    const store = createEditorStore(dashboard);
    const component = store.getState().history.present.components[0]!;

    render(<AppProviders><DashboardHeaderPanel component={component} definition={dashboardHeaderDefinition} store={store} /></AppProviders>);

    fireEvent.click(screen.getByRole("button", { name: "编辑全局筛选条件" }));
    fireEvent.click(await screen.findByText("新增筛选条件"));
    fireEvent.click(await screen.findByRole("button", { name: /门店.*下拉选择/ }));

    await waitFor(() => expect(store.getState().history.present.components[0]!.props).toMatchObject({
      globalFilters: [{ fieldKey: "store", label: "门店", controlType: "select", targets: [] }],
    }));

    fireEvent.click(screen.getByRole("button", { name: /输入框.*输入筛选关键词/ }));
    expect(store.getState().history.present.components[0]!.props).toMatchObject({
      globalFilters: [{ fieldKey: "store", controlType: "input", operator: "contains" }],
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "已表联动 0 / 1" }));
    expect(store.getState().history.present.components[0]!.props).toMatchObject({
      globalFilters: [{ targets: [{ componentId: "bar-1", fieldKey: "store" }] }],
    });
  });
});
