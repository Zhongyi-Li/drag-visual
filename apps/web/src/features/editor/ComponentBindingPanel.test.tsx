// @vitest-environment jsdom

import { barDefinition } from "@drag-visual/component-registry";
import { DashboardSchema } from "@drag-visual/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { server } from "../../mocks/server.js";
import { ComponentBindingPanel } from "./ComponentBindingPanel.js";
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

const activeOptionTexts = (): string[] => Array.from(
  document.querySelectorAll<HTMLElement>(
    ".ant-select-dropdown:not(.ant-slide-up-leave) .ant-select-item-option-content",
  ),
).map((element) => element.textContent ?? "");

describe("ComponentBindingPanel", () => {
  it("binds a bar component to dataset fields and registers required dataset parameters", async () => {
    const store = createEditorStore(dashboard);
    store.getState().select("bar-1");
    const component = store.getState().history.present.components[0]!;

    render(
      <AppProviders>
        <ComponentBindingPanel store={store} component={component} definition={barDefinition} />
      </AppProviders>,
    );

    expect(await screen.findByRole("combobox", { name: "数据集" })).toBeInTheDocument();
    expect(screen.getByLabelText("维度")).toBeInTheDocument();
    expect(screen.getByLabelText("指标")).toBeInTheDocument();

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "数据集" }));
    fireEvent.click(await screen.findByText("销售数据"));

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "维度" }));
    expect(await screen.findByText("月份")).toBeInTheDocument();
    expect(activeOptionTexts()).toContain("月份");
    expect(activeOptionTexts()).not.toContain("收入");
    fireEvent.click(await screen.findByText("月份"));

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "指标" }));
    expect(await screen.findByText("收入")).toBeInTheDocument();
    expect(activeOptionTexts()).toContain("收入");
    expect(activeOptionTexts()).not.toContain("业务日期");
    fireEvent.click(await screen.findByText("收入"));

    await waitFor(() => {
      const updated = store.getState().history.present.components[0]!;
      expect(updated.binding).toEqual({
        datasetId: "sales",
        slots: {
          dimension: { fieldKey: "month" },
          measure: { fieldKey: "revenue" },
        },
      });
      expect(store.getState().history.present.datasets).toContainEqual({
        datasetId: "sales",
        schemaVersion: "v1",
        parameters: {
          year: 0,
          fromDate: "2026-01-01",
        },
      });
    });
  });

  it("shows schema errors that happen while choosing a dataset", async () => {
    server.use(
      http.get("http://localhost/datasets/inventory/schema", () =>
        HttpResponse.json({ code: "DATASET_UPSTREAM_ERROR", message: "failed" }, { status: 502 }),
      ),
    );
    const store = createEditorStore(dashboard);
    const component = store.getState().history.present.components[0]!;

    render(
      <AppProviders>
        <ComponentBindingPanel store={store} component={component} definition={barDefinition} />
      </AppProviders>,
    );

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "数据集" }));
    fireEvent.click(await screen.findByText("库存数据"));

    expect(await screen.findByText("加载 Schema 失败")).toBeInTheDocument();
    expect(store.getState().history.present.components[0]!.binding).toBeUndefined();
  });

  it("shows required slot validation, clears binding, and resets slots when switching datasets", async () => {
    const store = createEditorStore(dashboard);
    store.getState().select("bar-1");
    const component = store.getState().history.present.components[0]!;

    render(
      <AppProviders>
        <ComponentBindingPanel store={store} component={component} definition={barDefinition} />
      </AppProviders>,
    );

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "数据集" }));
    fireEvent.click(await screen.findByText("销售数据"));

    expect(await screen.findByText("数据绑定需要检查")).toBeInTheDocument();
    expect(screen.getByText("请配置指标")).toBeInTheDocument();

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "维度" }));
    fireEvent.click(await screen.findByText("月份"));
    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "指标" }));
    fireEvent.click(await screen.findByText("收入"));

    await waitFor(() => {
      expect(store.getState().history.present.components[0]!.binding?.slots).toEqual({
        dimension: { fieldKey: "month" },
        measure: { fieldKey: "revenue" },
      });
    });

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "数据集" }));
    fireEvent.click(await screen.findByText("库存数据"));

    await waitFor(() => {
      expect(store.getState().history.present.components[0]!.binding).toEqual({
        datasetId: "inventory",
        slots: {},
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "清除数据绑定" }));
    expect(store.getState().history.present.components[0]!.binding).toBeUndefined();
  });

  it("shows a schema load failure for an existing binding", async () => {
    server.use(
      http.get("http://localhost/datasets/sales/schema", () =>
        HttpResponse.json({ code: "DATASET_UPSTREAM_ERROR", message: "failed" }, { status: 502 }),
      ),
    );
    const boundDashboard = DashboardSchema.parse({
      ...dashboard,
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        ...dashboard.components[0]!,
        binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" } } },
      }],
    });
    const store = createEditorStore(boundDashboard);
    const component = store.getState().history.present.components[0]!;

    render(
      <AppProviders>
        <ComponentBindingPanel store={store} component={component} definition={barDefinition} />
      </AppProviders>,
    );

    expect(await screen.findByText("加载 Schema 失败")).toBeInTheDocument();
  });
});
