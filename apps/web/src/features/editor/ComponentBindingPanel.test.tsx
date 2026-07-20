// @vitest-environment jsdom

import {
  barDefinition,
  crosstabDefinition,
  flipNumberDefinition,
  gaugeDefinition,
  kpiDefinition,
  liquidDefinition,
  metricBreakdownDefinition,
  metricTrendDefinition,
  multidimensionalDefinition,
  progressBarDefinition,
  trendDefinition,
} from "@drag-visual/component-registry";
import { DashboardSchema } from "@drag-visual/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { server } from "../../mocks/server.js";
import { ComponentBindingPanel, fieldOptionsForSlot } from "./ComponentBindingPanel.js";
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
  it("keeps local imported datasets usable when the remote dataset list fails", async () => {
    server.use(
      http.get("http://localhost/datasets", () =>
        HttpResponse.json({ code: "DATASET_UPSTREAM_ERROR", message: "failed" }, { status: 502 }),
      ),
    );
    window.localStorage.setItem("drag-visual.local-datasets.v1", JSON.stringify([{
      schema: {
        id: "local-metric-dashboard",
        name: "metric_dashboard_upload_ready",
        fields: [
          { key: "month", label: "month", type: "string", nullable: false },
          { key: "revenue", label: "revenue", type: "number", nullable: false },
        ],
        parameters: [],
        schemaVersion: "file-test",
      },
      result: {
        columns: [
          { key: "month", label: "month", type: "string", nullable: false },
          { key: "revenue", label: "revenue", type: "number", nullable: false },
        ],
        rows: [{ month: "2026-01", revenue: 120000 }],
        total: 1,
        sampledAt: "2026-07-09T00:00:00.000Z",
      },
    }]));
    const kpiDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "kpi-1", x: 0, y: 0, w: 6, h: 4 }],
      components: [{
        id: "kpi-1",
        type: "kpi",
        title: "指标看板",
        props: { aggregation: "sum", prefix: "", suffix: "", decimals: 0 },
      }],
    });
    const store = createEditorStore(kpiDashboard);
    const component = store.getState().history.present.components[0]!;

    render(
      <AppProviders>
        <ComponentBindingPanel store={store} component={component} definition={kpiDefinition} />
      </AppProviders>,
    );

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "数据集" }));

    expect(await screen.findByText("metric_dashboard_upload_ready")).toBeInTheDocument();
    expect(screen.queryByText("加载数据集失败")).not.toBeInTheDocument();
  });

  it("shows KPI metrics as one multi-select control", async () => {
    server.use(
      http.get("http://localhost/datasets", () =>
        HttpResponse.json([{
          id: "sales",
          name: "销售数据",
          schemaVersion: "v1",
        }]),
      ),
      http.get("http://localhost/datasets/sales/schema", () =>
        HttpResponse.json({
          id: "sales",
          name: "销售数据",
          fields: [
            { key: "month", label: "month", type: "string", nullable: false },
            { key: "revenue", label: "revenue", type: "number", nullable: false },
            { key: "orders", label: "orders", type: "number", nullable: false },
          ],
          parameters: [],
          schemaVersion: "v1",
        }),
      ),
    );
    const kpiDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "kpi-1", x: 0, y: 0, w: 6, h: 4 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "kpi-1",
        type: "kpi",
        title: "指标看板",
        props: { aggregation: "sum", prefix: "", suffix: "", decimals: 0 },
        binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" } } },
      }],
    });
    const store = createEditorStore(kpiDashboard);
    const component = store.getState().history.present.components[0]!;

    render(
      <AppProviders>
        <ComponentBindingPanel store={store} component={component} definition={kpiDefinition} />
      </AppProviders>,
    );

    expect(await screen.findByText("指标/容量")).toBeInTheDocument();
    expect(screen.queryByText("目标值")).not.toBeInTheDocument();
    expect(screen.queryByText("对比值")).not.toBeInTheDocument();
    expect(screen.queryByText("辅助指标")).not.toBeInTheDocument();

    const metricSelector = screen.getByRole("combobox", { name: "指标/容量" });
    expect(metricSelector.closest(".ant-select")).toHaveClass("ant-select-multiple");
  });

  it("shows dedicated binding slots for flip number and progress bar", async () => {
    const fields = [
      { key: "month", label: "month", type: "string", nullable: false },
      { key: "revenue", label: "revenue", type: "number", nullable: false },
      { key: "revenueTarget", label: "revenueTarget", type: "number", nullable: false },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () =>
        HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }]),
      ),
      http.get("http://localhost/datasets/sales/schema", () =>
        HttpResponse.json({
          id: "sales",
          name: "销售数据",
          fields,
          parameters: [],
          schemaVersion: "v1",
        }),
      ),
    );
    const flipDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "flip-1", x: 0, y: 0, w: 3, h: 2 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "flip-1",
        type: "flipNumber",
        title: "翻牌器",
        props: { aggregation: "sum", prefix: "", suffix: "", decimals: 0 },
        binding: { datasetId: "sales", slots: { measure: [{ fieldKey: "revenue" }, { fieldKey: "revenueTarget" }] } },
      }],
    });
    const flipStore = createEditorStore(flipDashboard);
    const flipComponent = flipStore.getState().history.present.components[0]!;
    const { unmount } = render(
      <AppProviders>
        <ComponentBindingPanel store={flipStore} component={flipComponent} definition={flipNumberDefinition} />
      </AppProviders>,
    );

    expect(await screen.findByText("指标/度量")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "指标/度量" }).closest(".ant-select")).toHaveClass("ant-select-multiple");
    expect(fieldOptionsForSlot(fields, flipNumberDefinition.dataSlots[0]!)).toEqual([
      { label: "revenue", value: "revenue" },
      { label: "revenueTarget", value: "revenueTarget" },
    ]);

    unmount();
    const progressDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "progress-1", x: 0, y: 0, w: 6, h: 3 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "progress-1",
        type: "progressBar",
        title: "进度条",
        props: { aggregation: "sum", decimals: 1, showValue: true },
        binding: { datasetId: "sales", slots: { measure: [{ fieldKey: "revenue" }, { fieldKey: "revenueTarget" }] } },
      }],
    });
    const progressStore = createEditorStore(progressDashboard);
    const progressComponent = progressStore.getState().history.present.components[0]!;
    render(
      <AppProviders>
        <ComponentBindingPanel store={progressStore} component={progressComponent} definition={progressBarDefinition} />
      </AppProviders>,
    );

    expect(await screen.findByText("指标/度量")).toBeInTheDocument();
    expect(screen.getByText("目标值")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "指标/度量" }).closest(".ant-select")).toHaveClass("ant-select-multiple");
    expect(screen.getByRole("combobox", { name: "目标值" }).closest(".ant-select")).toHaveClass("ant-select-multiple");
  });

  it("shows required actual and target metric controls for a gauge", async () => {
    const fields = [
      { key: "revenue", label: "实际销售额", type: "number", nullable: false },
      { key: "revenueTarget", label: "销售目标", type: "number", nullable: false },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () =>
        HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }]),
      ),
      http.get("http://localhost/datasets/sales/schema", () =>
        HttpResponse.json({ id: "sales", name: "销售数据", fields, parameters: [], schemaVersion: "v1" }),
      ),
    );
    const gaugeDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "gauge-1", x: 0, y: 0, w: 4, h: 4 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "gauge-1",
        type: "gauge",
        title: "仪表盘",
        props: { aggregation: "sum", decimals: 1 },
        binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" }, target: { fieldKey: "revenueTarget" } } },
      }],
    });
    const store = createEditorStore(gaugeDashboard);
    const component = store.getState().history.present.components[0]!;

    render(
      <AppProviders>
        <ComponentBindingPanel store={store} component={component} definition={gaugeDefinition} />
      </AppProviders>,
    );

    expect(await screen.findByText("实际值")).toBeInTheDocument();
    expect(screen.getByText("目标值")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "实际值" }).closest(".ant-select")).not.toHaveClass("ant-select-multiple");
    expect(screen.getByRole("combobox", { name: "目标值" }).closest(".ant-select")).not.toHaveClass("ant-select-multiple");
  });

  it("shows required actual and target metric controls for a liquid chart", async () => {
    const fields = [
      { key: "revenue", label: "实际销售额", type: "number", nullable: false },
      { key: "revenueTarget", label: "销售目标", type: "number", nullable: false },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({ id: "sales", name: "销售数据", fields, parameters: [], schemaVersion: "v1" })),
    );
    const liquidDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "liquid-1", x: 0, y: 0, w: 4, h: 4 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{ id: "liquid-1", type: "liquid", title: "水波图", props: { aggregation: "sum", decimals: 1 }, binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" }, target: { fieldKey: "revenueTarget" } } } }],
    });
    const store = createEditorStore(liquidDashboard);
    const component = store.getState().history.present.components[0]!;

    render(<AppProviders><ComponentBindingPanel store={store} component={component} definition={liquidDefinition} /></AppProviders>);

    expect(await screen.findByText("实际值")).toBeInTheDocument();
    expect(screen.getByText("目标值")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "实际值" }).closest(".ant-select")).not.toHaveClass("ant-select-multiple");
  });

  it("shows required dimension and metric controls for metric breakdown", async () => {
    const fields = [
      { key: "productLine", label: "产品线", type: "string", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({ id: "sales", name: "销售数据", fields, parameters: [], schemaVersion: "v1" })),
    );
    const breakdownDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "breakdown-1", x: 0, y: 0, w: 6, h: 4 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{ id: "breakdown-1", type: "metricBreakdown", title: "指标拆解", props: { aggregation: "sum", decimals: 1 }, binding: { datasetId: "sales", slots: { dimension: { fieldKey: "productLine" }, measure: { fieldKey: "revenue" } } } }],
    });
    const store = createEditorStore(breakdownDashboard);
    const component = store.getState().history.present.components[0]!;

    render(<AppProviders><ComponentBindingPanel store={store} component={component} definition={metricBreakdownDefinition} /></AppProviders>);

    expect(await screen.findByText("拆解维度")).toBeInTheDocument();
    expect(screen.getByText("拆解指标")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "拆解维度" }).closest(".ant-select")).not.toHaveClass("ant-select-multiple");
    expect(screen.getByRole("combobox", { name: "拆解指标" }).closest(".ant-select")).not.toHaveClass("ant-select-multiple");
  });

  it("explains crosstab binding controls with visible labels and help affordances", async () => {
    const crosstabDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "crosstab-1", x: 0, y: 0, w: 10, h: 7 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "crosstab-1",
        type: "crosstab",
        title: "交叉表",
        props: { aggregation: "sum", showTotals: true },
        binding: {
          datasetId: "sales",
          slots: {
            rowDimension: { fieldKey: "region" },
            columnDimension: { fieldKey: "month" },
            measure: { fieldKey: "revenue" },
          },
        },
      }],
    });
    const store = createEditorStore(crosstabDashboard);
    const component = store.getState().history.present.components[0]!;

    render(
      <AppProviders>
        <ComponentBindingPanel store={store} component={component} definition={crosstabDefinition} />
      </AppProviders>,
    );

    expect(await screen.findByText("数据集")).toBeInTheDocument();
    expect(screen.getByText("行维度")).toBeInTheDocument();
    expect(screen.getByText("列维度")).toBeInTheDocument();
    expect(screen.getByText("指标")).toBeInTheDocument();
    expect(screen.getByText("清除数据绑定")).toBeInTheDocument();
    expect(screen.getByLabelText("数据集说明")).toBeInTheDocument();
    expect(screen.getByLabelText("行维度说明")).toBeInTheDocument();
    expect(screen.getByLabelText("列维度说明")).toBeInTheDocument();
    expect(screen.getByLabelText("指标说明")).toBeInTheDocument();
    expect(screen.getByLabelText("清除数据绑定说明")).toBeInTheDocument();
  });

  it("shows date and time granularity controls for multidimensional analysis", async () => {
    const multidimensionalDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "multi-1", x: 0, y: 0, w: 10, h: 7 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "multi-1",
        type: "multidimensional",
        title: "多维分析",
        props: { aggregation: "sum", showTotals: true, timeGranularity: "day" },
        binding: {
          datasetId: "sales",
          slots: {
            dateDimension: { fieldKey: "businessDate" },
            dimensions: [{ fieldKey: "region" }],
            measures: [{ fieldKey: "revenue" }],
          },
        },
      }],
    });
    const store = createEditorStore(multidimensionalDashboard);
    const component = store.getState().history.present.components[0]!;

    render(
      <AppProviders>
        <ComponentBindingPanel store={store} component={component} definition={multidimensionalDefinition} />
      </AppProviders>,
    );

    expect(await screen.findByText("数据集")).toBeInTheDocument();
    expect(screen.getByText("日期")).toBeInTheDocument();
    expect(screen.getByText("维度字段")).toBeInTheDocument();
    expect(screen.getByText("指标字段")).toBeInTheDocument();
    expect(screen.getByText("时间粒度")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "时间粒度" }));
    fireEvent.click(await screen.findByText("月"));

    expect(store.getState().history.present.components[0]!.props).toMatchObject({
      aggregation: "sum",
      showTotals: true,
      timeGranularity: "month",
    });
  });

  it("shows metric trend as one date dimension plus multiple metric measures", async () => {
    const fields = [
      { key: "businessDate", label: "业务日期", type: "date", nullable: false },
      { key: "month", label: "month", type: "string", nullable: false },
      { key: "revenue", label: "收入", type: "number", nullable: false },
      { key: "orders", label: "订单数", type: "number", nullable: false },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () =>
        HttpResponse.json([{
          id: "sales",
          name: "销售数据",
          schemaVersion: "v1",
        }]),
      ),
      http.get("http://localhost/datasets/sales/schema", () =>
        HttpResponse.json({
          id: "sales",
          name: "销售数据",
          fields,
          parameters: [],
          schemaVersion: "v1",
        }),
      ),
    );
    const metricTrendDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "metric-trend-1", x: 0, y: 0, w: 8, h: 5 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "metric-trend-1",
        type: "metricTrend",
        title: "指标趋势",
        props: { aggregation: "sum", showSummary: true, timeGranularity: "month" },
        binding: {
          datasetId: "sales",
          slots: {
            timeDimension: { fieldKey: "businessDate" },
            measure: [{ fieldKey: "revenue" }, { fieldKey: "orders" }],
          },
        },
      }],
    });
    const store = createEditorStore(metricTrendDashboard);
    const component = store.getState().history.present.components[0]!;

    render(
      <AppProviders>
        <ComponentBindingPanel store={store} component={component} definition={metricTrendDefinition} />
      </AppProviders>,
    );

    expect(await screen.findByText("日期/维度")).toBeInTheDocument();
    expect(screen.getByText("指标/度量")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "指标/度量" }).closest(".ant-select")).toHaveClass("ant-select-multiple");
    expect(screen.getByText("时间粒度")).toBeInTheDocument();

    const timeDimensionSlot = metricTrendDefinition.dataSlots.find((slot) => slot.key === "timeDimension")!;
    expect(fieldOptionsForSlot(fields, timeDimensionSlot)).toEqual([
      { label: "业务日期", value: "businessDate" },
      { label: "month", value: "month" },
    ]);
  });

  it("shows time granularity for legacy multidimensional components without the new prop", async () => {
    const legacyDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "multi-legacy", x: 0, y: 0, w: 10, h: 7 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "multi-legacy",
        type: "multidimensional",
        title: "多维分析",
        props: { aggregation: "sum", showTotals: true },
        binding: {
          datasetId: "sales",
          slots: {
            dimensions: [{ fieldKey: "region" }],
            measures: [{ fieldKey: "revenue" }],
          },
        },
      }],
    });
    const store = createEditorStore(legacyDashboard);
    const component = store.getState().history.present.components[0]!;

    render(
      <AppProviders>
        <ComponentBindingPanel store={store} component={component} definition={multidimensionalDefinition} />
      </AppProviders>,
    );

    expect(await screen.findByText("日期")).toBeInTheDocument();
    expect(screen.getByText("时间粒度")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "时间粒度" }));
    fireEvent.click(await screen.findByText("季度"));

    expect(store.getState().history.present.components[0]!.props).toMatchObject({
      aggregation: "sum",
      showTotals: true,
      timeGranularity: "quarter",
    });
  });

  it("shows time granularity for legacy trend components without the new prop", async () => {
    const legacyTrendDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "trend-legacy", x: 0, y: 0, w: 10, h: 7 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "trend-legacy",
        type: "trend",
        title: "趋势分析",
        props: { aggregation: "sum", showSummary: true },
        binding: {
          datasetId: "sales",
          slots: {
            timeDimension: { fieldKey: "businessDate" },
            measure: { fieldKey: "revenue" },
          },
        },
      }],
    });
    const store = createEditorStore(legacyTrendDashboard);
    const component = store.getState().history.present.components[0]!;

    render(
      <AppProviders>
        <ComponentBindingPanel store={store} component={component} definition={trendDefinition} />
      </AppProviders>,
    );

    expect(await screen.findByText("日期")).toBeInTheDocument();
    expect(screen.getByText("时间粒度")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "时间粒度" }));
    fireEvent.click(await screen.findByText("年"));

    expect(store.getState().history.present.components[0]!.props).toMatchObject({
      aggregation: "sum",
      showSummary: true,
      timeGranularity: "year",
    });
  });

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
          measure: [{ fieldKey: "revenue" }],
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
        measure: [{ fieldKey: "revenue" }],
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
