// @vitest-environment jsdom

import { barDefinition } from "@drag-visual/component-registry";
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
  it("keeps a chart condition as a draft until the author applies it", async () => {
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

    await screen.findByRole("button", { name: "配置筛选条件" });
    fireEvent.click(screen.getByRole("button", { name: "配置筛选条件" }));
    fireEvent.click(await screen.findByRole("button", { name: "添加筛选条件" }));
    expect(store.getState().history.present.components[0]!.props.queryFilters).toBeUndefined();
    fireEvent.change(screen.getByRole("textbox", { name: "查询值1" }), { target: { value: "小米" } });
    fireEvent.click(screen.getByRole("button", { name: "完成编辑" }));
    fireEvent.click(screen.getByRole("button", { name: "查询" }));

    await waitFor(() => expect(store.getState().history.present.components[0]!.props.queryFilters).toEqual([
      { kind: "fieldText", fieldKey: "product", value: "小米" },
    ]));
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

    await screen.findByRole("button", { name: "配置筛选条件" });
    fireEvent.click(screen.getByRole("button", { name: "配置筛选条件" }));
    fireEvent.click(await screen.findByRole("button", { name: "添加筛选条件" }));
    fireEvent.click(screen.getByRole("button", { name: "添加筛选条件" }));
    fireEvent.click(screen.getByRole("button", { name: "完成编辑" }));
    expect(screen.getByRole("button", { name: "删除已选条件1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除已选条件2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "删除已选条件1" }));
    expect(screen.queryByRole("button", { name: "删除已选条件2" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除已选条件1" })).toBeInTheDocument();
    expect(store.getState().history.present.components[0]!.props.queryFilters).toEqual([
      { kind: "fieldText", fieldKey: "product", value: "" },
      { kind: "fieldText", fieldKey: "product", value: "" },
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

    await screen.findByRole("button", { name: "配置筛选条件" });
    fireEvent.click(screen.getByRole("button", { name: "配置筛选条件" }));
    fireEvent.click(await screen.findByRole("button", { name: "添加筛选条件" }));
    fireEvent.click(screen.getByRole("button", { name: "完成编辑" }));
    fireEvent.click(screen.getByRole("button", { name: "查询" }));

    await waitFor(() => expect(store.getState().history.present.components[0]!.props.queryFilters).toEqual([
      { kind: "fieldText", fieldKey: "product", value: "" },
    ]));
  });
});
