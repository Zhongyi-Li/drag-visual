// @vitest-environment jsdom

import { analysisGroupDefinition, barDefinition } from "@drag-visual/component-registry";
import { DashboardSchema } from "@drag-visual/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { server } from "../../mocks/server.js";
import { QueryFiltersPanel } from "./QueryFiltersPanel.js";
import { createEditorStore } from "./store/editorStore.js";

const dashboard = DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
  components: [{
    id: "bar-1", type: "bar", title: "销售额", props: { aggregation: "sum", color: "#1677ff", showLegend: true },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "product" }, measure: { fieldKey: "amount" } } },
  }],
  datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
});

describe("QueryFiltersPanel", () => {
  it("saves a chart condition after the author completes editing", async () => {
    server.use(http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({
      id: "sales", name: "销售数据", schemaVersion: "v1", parameters: [],
      fields: [
        { key: "product", label: "商品", type: "string", nullable: false },
        { key: "amount", label: "销售额", type: "number", nullable: false },
      ],
    })));
    const store = createEditorStore(dashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><QueryFiltersPanel component={component} definition={barDefinition} scope="component" store={store} /></AppProviders>);

    await screen.findByRole("button", { name: "编辑筛选条件" });
    expect(screen.getByText("未配置")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "编辑筛选条件" }));
    fireEvent.click(await screen.findByRole("button", { name: "添加筛选条件" }));
    expect(store.getState().history.present.components[0]!.props.queryFilters).toBeUndefined();
    fireEvent.change(screen.getByRole("textbox", { name: "查询值1" }), { target: { value: "小米" } });
    fireEvent.click(screen.getByRole("button", { name: "完成编辑" }));

    await waitFor(() => expect(store.getState().history.present.components[0]!.props.queryFilters).toEqual([
      { kind: "fieldText", fieldKey: "product", operator: "contains", value: "小米" },
    ]));
    expect(screen.getByText("已配置")).toBeInTheDocument();
  });

  it("lets authors remove one draft condition without clearing the others", async () => {
    server.use(http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({
      id: "sales", name: "销售数据", schemaVersion: "v1", parameters: [],
      fields: [
        { key: "product", label: "商品", type: "string", nullable: false },
        { key: "amount", label: "销售额", type: "number", nullable: false },
      ],
    })));
    const store = createEditorStore(dashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><QueryFiltersPanel component={component} definition={barDefinition} scope="component" store={store} /></AppProviders>);

    await screen.findByRole("button", { name: "编辑筛选条件" });
    fireEvent.click(screen.getByRole("button", { name: "编辑筛选条件" }));
    fireEvent.click(await screen.findByRole("button", { name: "添加筛选条件" }));
    fireEvent.click(screen.getByRole("button", { name: "添加筛选条件" }));
    fireEvent.click(screen.getByRole("button", { name: "完成编辑" }));

    fireEvent.click(screen.getByRole("button", { name: "编辑筛选条件" }));
    fireEvent.click(screen.getByRole("button", { name: "删除配置条件1" }));
    fireEvent.click(screen.getByRole("button", { name: "完成编辑" }));
    expect(store.getState().history.present.components[0]!.props.queryFilters).toEqual([
      { kind: "fieldText", fieldKey: "product", operator: "contains", value: "" },
    ]);
  });

  it("saves an empty condition as a viewer control without applying it to the data request", async () => {
    server.use(http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({
      id: "sales", name: "销售数据", schemaVersion: "v1", parameters: [],
      fields: [{ key: "product", label: "商品", type: "string", nullable: false }],
    })));
    const store = createEditorStore(dashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><QueryFiltersPanel component={component} definition={barDefinition} scope="component" store={store} /></AppProviders>);

    await screen.findByRole("button", { name: "编辑筛选条件" });
    fireEvent.click(screen.getByRole("button", { name: "编辑筛选条件" }));
    fireEvent.click(await screen.findByRole("button", { name: "添加筛选条件" }));
    fireEvent.click(screen.getByRole("button", { name: "完成编辑" }));

    await waitFor(() => expect(store.getState().history.present.components[0]!.props.queryFilters).toEqual([
      { kind: "fieldText", fieldKey: "product", operator: "contains", value: "" },
    ]));
  });

  it("provides an exact-value selector for values shared by every chart in an analysis group", async () => {
    server.use(
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({
        id: "sales", name: "销售数据", schemaVersion: "v1", parameters: [],
        fields: [{ key: "category", label: "类目", type: "string", nullable: false }],
      })),
      http.get("http://localhost/datasets/inventory/schema", () => HttpResponse.json({
        id: "inventory", name: "库存数据", schemaVersion: "v1", parameters: [],
        fields: [{ key: "category", label: "类目", type: "string", nullable: false }],
      })),
      http.get("http://localhost/datasets/sales/fields/category/options", () => HttpResponse.json({ options: ["家电", "手机"] })),
      http.get("http://localhost/datasets/inventory/fields/category/options", () => HttpResponse.json({ options: ["手机", "配件"] })),
    );
    const groupDashboard = DashboardSchema.parse({
      ...dashboard,
      datasets: [
        { datasetId: "sales", schemaVersion: "v1", parameters: {} },
        { datasetId: "inventory", schemaVersion: "v1", parameters: {} },
      ],
      layout: [
        { i: "group-1", x: 0, y: 0, w: 12, h: 9 },
        { i: "sales-chart", parentId: "group-1", x: 0, y: 0, w: 6, h: 5 },
        { i: "inventory-chart", parentId: "group-1", x: 6, y: 0, w: 6, h: 5 },
      ],
      components: [
        {
          id: "group-1", type: "analysisGroup", title: "商品分析",
          props: {
            description: "用于组织同一业务主题下的多个图表与明细。", columns: 12, gap: 12, showSurface: true,
            queryFilters: [{ kind: "fieldValue", fieldKey: "category", values: [""] }], dateFilter: null,
          },
        },
        { id: "sales-chart", parentId: "group-1", type: "bar", title: "销售", props: {}, binding: { datasetId: "sales", slots: {} } },
        { id: "inventory-chart", parentId: "group-1", type: "bar", title: "库存", props: {}, binding: { datasetId: "inventory", slots: {} } },
      ],
    });
    const store = createEditorStore(groupDashboard);
    const group = store.getState().history.present.components[0]!;
    render(<AppProviders><QueryFiltersPanel component={group} definition={analysisGroupDefinition} scope="analysisGroup" store={store} /></AppProviders>);

    await screen.findByRole("button", { name: "编辑筛选条件" });
    fireEvent.click(screen.getByRole("button", { name: "编辑筛选条件" }));
    const valueSelector = await screen.findByRole("combobox", { name: "查询值1" });
    fireEvent.mouseDown(valueSelector);

    expect(await screen.findByRole("option", { name: "手机" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "家电" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "配件" })).not.toBeInTheDocument();
  });
});
