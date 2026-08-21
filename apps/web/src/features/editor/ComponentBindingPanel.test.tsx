// @vitest-environment jsdom

import {
  barDefinition,
  crosstabDefinition,
  flipNumberDefinition,
  gaugeDefinition,
  kpiDefinition,
  lineDefinition,
  liquidDefinition,
  metricAlertDefinition,
  metricBreakdownDefinition,
  metricTrendDefinition,
  multidimensionalDefinition,
  percentBarDefinition,
  progressBarDefinition,
  rankingDefinition,
  targetProgressDefinition,
  trendDefinition,
} from "@drag-visual/component-registry";
import { DashboardSchema } from "@drag-visual/contracts";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("configures normalized metric weights for a ranking component", async () => {
    const fields = [
      { key: "region", label: "区域", type: "string", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
      { key: "profit", label: "毛利额", type: "number", nullable: false },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({ id: "sales", name: "销售数据", fields, parameters: [], schemaVersion: "v1" })),
    );
    const rankingDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "ranking-1", x: 0, y: 0, w: 7, h: 5 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "ranking-1",
        type: "ranking",
        title: "综合排行榜",
        props: { aggregation: "sum", color: "#1677ff", maxItems: 10, metricWeights: {}, rankingMode: "primary", showValue: true },
        binding: {
          datasetId: "sales",
          slots: { dimension: { fieldKey: "region" }, measure: [{ fieldKey: "revenue" }, { fieldKey: "profit" }] },
        },
      }],
    });
    const store = createEditorStore(rankingDashboard);
    const component = store.getState().history.present.components[0]!;

    render(<AppProviders><ComponentBindingPanel store={store} component={component} definition={rankingDefinition} /></AppProviders>);

    const calculation = await screen.findByRole("combobox", { name: "排序计算" });
    expect(await screen.findByLabelText("销售额权重")).toBeInTheDocument();
    expect(calculation.closest(".ant-select")?.textContent).toContain("按主指标排序（当前：销售额）");
    expect(screen.getByText("填写任一权重后，会自动切换为综合加权排序。")).toBeInTheDocument();
    fireEvent.mouseDown(calculation);
    fireEvent.click(await screen.findByText("按综合加权得分排序"));

    await waitFor(() => {
      expect(store.getState().history.present.components[0]!.props).toMatchObject({
        rankingMode: "weighted",
      });
    });
    expect(await screen.findByText("权重以百分比填写，建议合计为 100%。结果按各指标原始数值 × 权重直接求和。")).toBeInTheDocument();
    expect(screen.getByLabelText("销售额权重")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "排序字段" })).toBeNull();
    expect(screen.queryByRole("spinbutton", { name: "Top N" })).toBeNull();
  });

  it("saves sort and Top N settings with the component binding", async () => {
    const fields = [
      { key: "month", label: "月份", type: "string", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({ id: "sales", name: "销售数据", fields, parameters: [], schemaVersion: "v1" })),
    );
    const sortableDashboard = DashboardSchema.parse({
      ...dashboard,
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "bar-1",
        type: "bar",
        title: "柱图",
        props: { color: "#1677ff", showLegend: true },
        binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measure: { fieldKey: "revenue" } } },
      }],
    });
    const store = createEditorStore(sortableDashboard);
    const component = store.getState().history.present.components[0]!;

    render(<AppProviders><ComponentBindingPanel store={store} component={component} definition={barDefinition} /></AppProviders>);

    const sortField = await screen.findByRole("combobox", { name: "排序字段" });
    await userEvent.click(sortField);
    const sortOption = (await screen.findAllByText("销售额")).find((element) => element.closest(".ant-select-item-option"));
    expect(sortOption).toBeDefined();
    await userEvent.click(sortOption!);
    await userEvent.click(screen.getByRole("combobox", { name: "排序方式" }));
    await userEvent.click(await screen.findByText("升序"));
    const topN = screen.getByRole("spinbutton", { name: "Top N" });
    await userEvent.type(topN, "5");
    expect(store.getState().history.present.components[0]!.binding?.limit).toBeUndefined();
    fireEvent.blur(topN);

    expect(store.getState().history.present.components[0]!.binding).toMatchObject({
      sort: { fieldKey: "revenue", direction: "asc" },
      limit: 5,
    });
  });

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

    expect(screen.queryByRole("combobox", { name: "指标/容量" })).not.toBeInTheDocument();
    expect(screen.getByText("从右侧数据栏双击或拖入字段")).toBeInTheDocument();
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
    expect(screen.queryByRole("combobox", { name: "指标/度量" })).not.toBeInTheDocument();
    expect(screen.getByText("从右侧数据栏双击或拖入字段，添加指标")).toBeInTheDocument();
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

    expect(await screen.findByText("指标与目标配对")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "进度 1实际指标" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "进度 1目标值" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "进度 1实际指标聚合方式" })).toHaveTextContent("求和");
    expect(screen.queryByRole("combobox", { name: "添加进度指标" })).not.toBeInTheDocument();
    expect(screen.getByText("从右侧数据栏双击或拖入度量，添加进度")).toBeInTheDocument();
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
    expect(screen.queryByRole("combobox", { name: "实际值" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "目标值" })).not.toBeInTheDocument();
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
    expect(screen.queryByRole("combobox", { name: "实际值" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "目标值" })).not.toBeInTheDocument();
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
    expect(screen.queryByRole("combobox", { name: "拆解维度" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "拆解指标" })).not.toBeInTheDocument();
  });

  it("configures a metric alert comparison and threshold directly below its bindings", async () => {
    const fields = [
      { key: "productName", label: "商品名称", type: "string", nullable: false },
      { key: "turnoverDays", label: "周转天数", type: "number", nullable: false },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "inventory", name: "库存数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/inventory/schema", () => HttpResponse.json({ id: "inventory", name: "库存数据", fields, parameters: [], schemaVersion: "v1" })),
    );
    const alertDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "alert-1", x: 0, y: 0, w: 12, h: 2 }],
      datasets: [{ datasetId: "inventory", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "alert-1",
        type: "metricAlert",
        title: "库存预警",
        props: {
          aggregation: "sum",
          operator: "gte",
          threshold: 10,
          decimals: 0,
          alertLabel: "库存风险 {{count}} 项",
          scopeText: "全部范围",
          headlineTemplate: "{{metric}}触发预警",
          messageTemplate: "{{scope}}｜共 {{count}} 个{{dimensionLabel}}命中预警。",
          detailTemplate: "{{dimension}}的{{metric}}当前值为 {{value}}。",
        },
        binding: { datasetId: "inventory", slots: { dimension: { fieldKey: "productName" }, measure: { fieldKey: "turnoverDays", aggregation: "sum" } } },
      }],
    });
    const store = createEditorStore(alertDashboard);
    const component = store.getState().history.present.components[0]!;

    render(<AppProviders><ComponentBindingPanel store={store} component={component} definition={metricAlertDefinition} /></AppProviders>);

    expect(await screen.findByText("商品名称", { selector: ".dimension-binding-item__name" })).toBeInTheDocument();
    expect(screen.getByText("预警规则")).toBeInTheDocument();
    expect(screen.getByText("达到阈值后自动展示预警面板")).toBeInTheDocument();
    expect(screen.getByText("按商品名称逐项高亮命中的周转天数")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "预警条件" }));
    await userEvent.click(await screen.findByText("小于等于"));
    await waitFor(() => expect(store.getState().history.present.components[0]!.props.operator).toBe("lte"));

    fireEvent.change(screen.getByRole("spinbutton", { name: "预警阈值" }), { target: { value: "7" } });
    await waitFor(() => expect(store.getState().history.present.components[0]!.props.threshold).toBe(7));
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
    expect(screen.getByText("指标/列")).toBeInTheDocument();
    expect(screen.getByLabelText("数据集说明")).toBeInTheDocument();
    expect(screen.getByLabelText("行维度说明")).toBeInTheDocument();
    expect(screen.getByLabelText("列维度说明")).toBeInTheDocument();
    expect(screen.getByLabelText("指标/列说明")).toBeInTheDocument();
    expect(screen.queryByText("清除数据绑定")).toBeNull();
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
    expect(screen.queryByRole("combobox", { name: "指标/度量" })).not.toBeInTheDocument();
    expect(screen.getByText("从右侧数据栏双击或拖入字段，添加指标")).toBeInTheDocument();
    expect(screen.getByText("时间粒度")).toBeInTheDocument();

    const timeDimensionSlot = metricTrendDefinition.dataSlots.find((slot) => slot.key === "timeDimension")!;
    expect(fieldOptionsForSlot(fields, timeDimensionSlot)).toEqual([
      { label: "业务日期", value: "businessDate" },
      { label: "month", value: "month" },
    ]);
  });

  it("hides metric trend time granularity for a normal category dimension", async () => {
    const fields = [
      { key: "productName", label: "商品名称", type: "string", nullable: false },
      { key: "revenue", label: "销售金额", type: "number", nullable: false },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({ id: "sales", name: "销售数据", fields, parameters: [], schemaVersion: "v1" })),
    );
    const categoryTrend = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "metric-trend-category", x: 0, y: 0, w: 8, h: 5 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "metric-trend-category",
        type: "metricTrend",
        title: "指标趋势",
        props: { aggregation: "sum", showSummary: true, timeGranularity: "month" },
        binding: { datasetId: "sales", slots: { timeDimension: { fieldKey: "productName" }, measure: [{ fieldKey: "revenue" }] } },
      }],
    });
    const store = createEditorStore(categoryTrend);

    render(<AppProviders><ComponentBindingPanel store={store} component={store.getState().history.present.components[0]!} definition={metricTrendDefinition} /></AppProviders>);

    expect(await screen.findByText("日期/维度")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("时间粒度")).not.toBeInTheDocument());
    expect(screen.queryByRole("combobox", { name: "时间粒度" })).not.toBeInTheDocument();
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

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "数据集" }));
    fireEvent.click(await screen.findByText("销售数据"));

    expect((await screen.findAllByText("从右侧数据栏双击或拖入字段")).length).toBeGreaterThan(0);
    expect(screen.queryByRole("combobox", { name: "维度" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "指标/列" })).not.toBeInTheDocument();

    await act(async () => {
      store.getState().dispatch({
        type: "component.binding.update",
        componentId: "bar-1",
        nextBinding: {
          datasetId: "sales",
          slots: {
            dimension: { fieldKey: "month" },
            measure: [{ fieldKey: "revenue" }],
          },
        },
      });
    });

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
    expect(screen.getByText("月份").closest(".dimension-binding-item")).toBeInTheDocument();
    expect(screen.getByText("收入（求和）")).toBeInTheDocument();
  });

  it("updates saved dataset query parameters from the component binding panel", async () => {
    const store = createEditorStore(dashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><ComponentBindingPanel store={store} component={component} definition={barDefinition} /></AppProviders>);

    fireEvent.mouseDown(await screen.findByRole("combobox", { name: "数据集" }));
    fireEvent.click(await screen.findByText("销售数据"));

    fireEvent.change(await screen.findByRole("spinbutton", { name: "年份" }), { target: { value: "2025" } });
    const dateInput = screen.getByLabelText("开始日期");
    fireEvent.change(dateInput, { target: { value: "2025-01-01" } });
    fireEvent.keyDown(dateInput, { key: "Enter", code: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "应用参数" }));

    await waitFor(() => expect(store.getState().history.present.datasets).toContainEqual({
      datasetId: "sales",
      schemaVersion: "v1",
      parameters: { year: 2025, fromDate: "2025-01-01" },
    }));
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
    expect(screen.getByText("请配置指标/列")).toBeInTheDocument();

    await act(async () => {
      store.getState().dispatch({
        type: "component.binding.update",
        componentId: "bar-1",
        nextBinding: {
          datasetId: "sales",
          slots: {
            dimension: { fieldKey: "month" },
            measure: [{ fieldKey: "revenue" }],
          },
        },
      });
    });

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

  it("stores aggregation on an individual metric from its hover menu", async () => {
    const fields = [
      { key: "month", label: "月份", type: "string", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({ id: "sales", name: "销售数据", fields, parameters: [], schemaVersion: "v1" })),
    );
    const boundDashboard = DashboardSchema.parse({
      ...dashboard,
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        ...dashboard.components[0]!,
        binding: {
          datasetId: "sales",
          slots: { dimension: { fieldKey: "month" }, measure: [{ fieldKey: "revenue" }] },
        },
      }],
    });
    const store = createEditorStore(boundDashboard);
    const component = store.getState().history.present.components[0]!;

    render(<AppProviders><ComponentBindingPanel store={store} component={component} definition={barDefinition} /></AppProviders>);

    expect(await screen.findByText("销售额（求和）")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "销售额更多操作" }));
    expect(await screen.findByText("聚合方式")).toBeInTheDocument();
    await userEvent.click(await screen.findByText("平均值"));

    await waitFor(() => {
      expect(store.getState().history.present.components[0]!.binding?.slots.measure).toEqual([
        { fieldKey: "revenue", aggregation: "avg" },
      ]);
    });
    expect(screen.getByText("销售额（平均值）")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "更新" }));
    expect(store.getState().history.present.components[0]!.props).toMatchObject({
      dataRefreshVersion: 1,
    });

    await userEvent.click(screen.getByRole("button", { name: "销售额更多操作" }));
    await userEvent.click(await screen.findByText("移除指标"));
    await waitFor(() => expect(store.getState().history.present.components[0]!.binding?.slots.measure).toBeUndefined());
  });

  it("binds target-progress fields through the data panel and aggregates actual and target fields", async () => {
    const fields = [
      { key: "product", label: "商品名称", type: "string", nullable: false },
      { key: "completed", label: "完成值", type: "number", nullable: false },
      { key: "targetValue", label: "目标值", type: "number", nullable: false },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({ id: "sales", name: "销售数据", fields, parameters: [], schemaVersion: "v1" })),
    );
    const targetProgressDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "target-progress-1", x: 0, y: 0, w: 9, h: 5 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "target-progress-1",
        type: "targetProgress",
        title: "目标完成率",
        props: { aggregation: "sum", color: "#f57c00", decimals: 0, showValue: true, suffix: "" },
        binding: { datasetId: "sales", slots: { dimension: { fieldKey: "product" }, measure: { fieldKey: "completed" } } },
      }],
    });
    const store = createEditorStore(targetProgressDashboard);
    const component = store.getState().history.present.components[0]!;

    render(<AppProviders><ComponentBindingPanel store={store} component={component} definition={targetProgressDefinition} /></AppProviders>);

    expect(await screen.findByText("完成值（求和）")).toBeInTheDocument();
    expect(screen.getByText("商品名称").closest(".dimension-binding-item")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "完成值" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "目标值" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "完成值更多操作" }));
    await userEvent.click(await screen.findByText("平均值"));
    await waitFor(() => {
      expect(store.getState().history.present.components[0]!.binding?.slots.measure).toEqual({ fieldKey: "completed", aggregation: "avg" });
    });

    const targetDropZone = screen.getByText("目标值", { selector: "strong" }).closest(".binding-field");
    expect(targetDropZone).not.toBeNull();
    const dataTransfer = {
      types: ["application/x-drag-visual-field"],
      getData: (type: string) => type === "application/x-drag-visual-field" ? "targetValue" : "",
    };
    fireEvent.dragEnter(targetDropZone!, { dataTransfer });
    fireEvent.dragOver(targetDropZone!, { dataTransfer });
    fireEvent.drop(targetDropZone!, { dataTransfer });
    await waitFor(() => {
      expect(store.getState().history.present.components[0]!.binding?.slots.target).toEqual({ fieldKey: "targetValue" });
    });

    expect(screen.getByText("目标值（最大值）")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "目标值更多操作" }));
    await userEvent.click(screen.getAllByText("求和").at(-1)!);
    await waitFor(() => {
      expect(store.getState().history.present.components[0]!.binding?.slots.target).toEqual({ fieldKey: "targetValue", aggregation: "sum" });
    });
  });

  it("blocks percentage-bar updates when selected metrics use different aggregations", async () => {
    const fields = [
      { key: "warehouse", label: "仓库", type: "string", nullable: false },
      { key: "supplyPrice", label: "供货价", type: "number", nullable: false },
      { key: "productTotal", label: "产品总金额", type: "number", nullable: false },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({ id: "sales", name: "销售数据", fields, parameters: [], schemaVersion: "v1" })),
    );
    const percentBarDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "percent-bar-1", x: 0, y: 0, w: 6, h: 5 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "percent-bar-1",
        type: "percentBar",
        title: "百分比",
        props: { aggregation: "sum", color: "#1677ff", showLegend: true, smooth: true, area: true },
        binding: {
          datasetId: "sales",
          slots: {
            dimension: { fieldKey: "warehouse" },
            measures: [
              { fieldKey: "supplyPrice", aggregation: "count" },
              { fieldKey: "productTotal", aggregation: "sum" },
            ],
          },
        },
      }],
    });
    const store = createEditorStore(percentBarDashboard);

    render(<AppProviders><ComponentBindingPanel store={store} component={percentBarDashboard.components[0]!} definition={percentBarDefinition} /></AppProviders>);

    expect(await screen.findByText("百分比图的所有指标必须使用相同聚合方式；“计数”和“求和”等不同量纲不能直接计算构成占比。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "更新" }));
    expect(store.getState().history.present.components[0]!.props.dataRefreshVersion).toBeUndefined();
  });

  it("keeps the chart result cap beside 更新 and applies it only on update", async () => {
    const fields = [
      { key: "month", label: "月份", type: "string", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "retail", name: "零售发货单", schemaVersion: "v2" }])),
      http.get("http://localhost/datasets/retail/schema", () => HttpResponse.json({
        id: "retail", name: "零售发货单", fields,
        parameters: [{ key: "limit", label: "结果展示", type: "number", required: false, defaultValue: 1000 }],
        schemaVersion: "v2",
      })),
    );
    const boundDashboard = DashboardSchema.parse({
      ...dashboard,
      datasets: [{ datasetId: "retail", schemaVersion: "v2", parameters: {} }],
      components: [{
        ...dashboard.components[0]!,
        binding: { datasetId: "retail", slots: { dimension: { fieldKey: "month" }, measure: { fieldKey: "revenue" } } },
      }],
    });
    const store = createEditorStore(boundDashboard);
    render(<AppProviders><ComponentBindingPanel store={store} component={boundDashboard.components[0]!} definition={barDefinition} /></AppProviders>);

    const resultLimit = await screen.findByRole("spinbutton", { name: "结果展示" });
    expect(resultLimit).toHaveValue("1000");
    await userEvent.clear(resultLimit);
    await userEvent.type(resultLimit, "500");
    expect(store.getState().history.present.components[0]!.props.resultLimit).toBeUndefined();
    expect(store.getState().history.present.components[0]!.props.appliedResultLimit).toBeUndefined();

    await userEvent.click(screen.getByRole("button", { name: "更新" }));
    expect(store.getState().history.present.components[0]!.props).toMatchObject({
      resultLimit: 500,
      appliedResultLimit: 500,
      dataRefreshVersion: 1,
    });
  });

  it("uses the metric-row presentation but disables aggregation for raw-value charts", async () => {
    const fields = [
      { key: "month", label: "月份", type: "string", nullable: false },
      { key: "revenue", label: "销售额", type: "number", nullable: false },
    ] as const;
    server.use(
      http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales", name: "销售数据", schemaVersion: "v1" }])),
      http.get("http://localhost/datasets/sales/schema", () => HttpResponse.json({ id: "sales", name: "销售数据", fields, parameters: [], schemaVersion: "v1" })),
    );
    const rawValueDashboard = DashboardSchema.parse({
      ...dashboard,
      layout: [{ i: "line-1", x: 0, y: 0, w: 6, h: 5 }],
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      components: [{
        id: "line-1",
        type: "line",
        title: "折线图",
        props: { color: "#1677ff", showLegend: true, smooth: false, area: false },
        binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measures: [{ fieldKey: "revenue" }] } },
      }],
    });
    const store = createEditorStore(rawValueDashboard);
    const component = store.getState().history.present.components[0]!;

    render(<AppProviders><ComponentBindingPanel store={store} component={component} definition={lineDefinition} /></AppProviders>);

    expect(await screen.findByText("销售额（原始值）")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "销售额更多操作" }));
    expect(await screen.findByText("聚合方式（当前图表不支持）")).toBeInTheDocument();
  });
});
