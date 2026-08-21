// @vitest-environment jsdom

import type { ComponentInstance, DatasetField } from "@drag-visual/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { DashboardComponentRenderer } from "./DashboardComponentRenderer.js";

vi.mock("./EChart.js", () => {
  return {
    EChart: ({ ariaLabel, onPointClick }: {
      readonly ariaLabel: string;
      readonly onPointClick?: ((point: { readonly dataIndex?: number; readonly name?: string; readonly seriesName?: string }) => void) | undefined;
    }) => <div role="img" aria-label={ariaLabel} onClick={() => onPointClick?.({ dataIndex: 0, name: "华东", seriesName: "销售额" })} />,
  };
});

vi.stubGlobal("ResizeObserver", class {
  observe() {}
  unobserve() {}
  disconnect() {}
});

afterEach(cleanup);

it("renders the target task progress table and persists goal configuration", () => {
  const onComponentPropsChange = vi.fn();
  render(<DashboardComponentRenderer
    component={{
      id: "target-task-progress-1", type: "goalTaskProgress", title: "目标任务进度",
      props: {
        aggregation: "sum", decimals: 1, periodYear: 2026, periodMonth: 8, maxEmployees: 8, employeeSettings: [],
        metricSettings: [{ measureKey: "gmv", targetKey: "gmvTarget", label: "GMV", color: "#2f6bff", weight: 100, includeInScore: true }],
      },
      binding: { datasetId: "sales", slots: { employeeDimension: { fieldKey: "employee" }, measure: [{ fieldKey: "gmv" }], target: [{ fieldKey: "gmvTarget" }] } },
    }}
    fields={[
      { key: "employee", label: "员工", type: "string", nullable: false },
      { key: "gmv", label: "GMV", type: "number", nullable: false },
      { key: "gmvTarget", label: "GMV目标", type: "number", nullable: false },
    ]}
    rows={[{ employee: "王雨晨", gmv: 80, gmvTarget: 100 }]}
    onComponentPropsChange={onComponentPropsChange}
  />);

  expect(screen.getByLabelText("目标任务进度图表")).toBeTruthy();
  expect(screen.getByText("GMV（实际 / 目标）")).toBeTruthy();
  expect(screen.getByText("GMV完成率")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "自定义目标" }));
  expect(screen.getByText("目标配置")).toBeTruthy();
  const monthlyGmvInput = screen.getByRole("spinbutton", { name: "月度GMV目标" }) as HTMLInputElement;
  fireEvent.change(monthlyGmvInput, { target: { value: "" } });
  expect(monthlyGmvInput.value).toBe("");
  fireEvent.change(monthlyGmvInput, { target: { value: "120" } });
  expect(monthlyGmvInput.value).toBe("120");
  fireEvent.click(screen.getByRole("button", { name: "保存目标" }));
  expect(onComponentPropsChange).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "评分权重设置" }));
  expect(screen.getByText("评分权重配置")).toBeTruthy();
});

const dataComponents = [
  {
    id: "bar-1",
    type: "bar",
    title: "销售额",
    props: { color: "#1677ff", showLegend: true },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measure: { fieldKey: "revenue" } } },
  },
  {
    id: "stacked-bar-1",
    type: "stackedBar",
    title: "销售构成",
    props: { color: "#1677ff", showLegend: true },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "date" }, measures: [{ fieldKey: "revenue" }, { fieldKey: "visitors" }] } },
  },
  {
    id: "line-1",
    type: "line",
    title: "访问趋势",
    props: { color: "#1677ff", showLegend: true, smooth: false, area: false },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "date" }, measures: { fieldKey: "visitors" } } },
  },
  {
    id: "area-1",
    type: "area",
    title: "访问量走势",
    props: { color: "#1677ff", showLegend: true, smooth: true, area: true },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "date" }, measures: { fieldKey: "visitors" } } },
  },
  {
    id: "stacked-area-1",
    type: "stackedArea",
    title: "渠道构成",
    props: { color: "#1677ff", showLegend: true, smooth: true, area: true },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "date" }, measures: [{ fieldKey: "visitors" }, { fieldKey: "revenue" }] } },
  },
  {
    id: "percent-area-1",
    type: "percentArea",
    title: "渠道占比",
    props: { color: "#1677ff", showLegend: true, smooth: true, area: true },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "date" }, measures: [{ fieldKey: "visitors" }, { fieldKey: "revenue" }] } },
  },
  {
    id: "percent-bar-1",
    type: "percentBar",
    title: "渠道占比柱图",
    props: { color: "#1677ff", showLegend: true, smooth: true, area: true },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "date" }, measures: [{ fieldKey: "visitors" }, { fieldKey: "revenue" }] } },
  },
  {
    id: "trend-1",
    type: "trend",
    title: "销售趋势分析",
    props: { aggregation: "sum", showSummary: true, timeGranularity: "day" },
    binding: { datasetId: "sales", slots: { timeDimension: { fieldKey: "date" }, measure: { fieldKey: "revenue" } } },
  },
  {
    id: "multi-1",
    type: "multidimensional",
    title: "多维分析",
    props: { aggregation: "sum", showTotals: true, timeGranularity: "day" },
    binding: {
      datasetId: "sales",
      slots: {
        dateDimension: { fieldKey: "date" },
        dimensions: [{ fieldKey: "region" }, { fieldKey: "category" }],
        measures: [{ fieldKey: "revenue" }, { fieldKey: "orders" }],
      },
    },
  },
  {
    id: "pie-1",
    type: "pie",
    title: "渠道占比",
    props: { color: "#1677ff", showLegend: true },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "channel" }, measure: { fieldKey: "revenue" } } },
  },
  {
    id: "donut-1",
    type: "donut",
    title: "商品构成",
    props: { color: "#1677ff", showLegend: true },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "channel" }, measure: { fieldKey: "revenue" } } },
  },
  {
    id: "ring-1",
    type: "ringBar",
    title: "区域达成",
    props: { decimals: 1, showValue: true },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "revenue" }, target: { fieldKey: "revenueTarget" } } },
  },
  {
    id: "ranking-1",
    type: "ranking",
    title: "区域销售排行榜",
    props: { color: "#1677ff", maxItems: 10, showValue: true },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "revenue" } } },
  },
  {
    id: "kpi-1",
    type: "kpi",
    title: "总收入",
    props: { aggregation: "sum", prefix: "¥", suffix: "", decimals: 0 },
    binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" } } },
  },
  {
    id: "gauge-1",
    type: "gauge",
    title: "销售达成仪表盘",
    props: { aggregation: "sum", decimals: 1 },
    binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" }, target: { fieldKey: "revenueTarget" } } },
  },
  {
    id: "liquid-1",
    type: "liquid",
    title: "销售达成水波图",
    props: { aggregation: "sum", decimals: 1 },
    binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" }, target: { fieldKey: "revenueTarget" } } },
  },
  {
    id: "breakdown-1",
    type: "metricBreakdown",
    title: "销售额拆解",
    props: { aggregation: "sum", decimals: 1 },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "productLine" }, measure: { fieldKey: "revenue" } } },
  },
  {
    id: "crosstab-1",
    type: "crosstab",
    title: "交叉表",
    props: { aggregation: "sum", showTotals: true },
    binding: {
      datasetId: "sales",
      slots: {
        rowDimension: { fieldKey: "region" },
        columnDimension: { fieldKey: "category" },
        measure: { fieldKey: "revenue" },
      },
    },
  },
  {
    id: "heatmap-1",
    type: "heatmap",
    title: "热力图",
    props: { aggregation: "sum", showValues: true },
    binding: {
      datasetId: "traffic",
      slots: {
        rowDimension: { fieldKey: "weekday" },
        columnDimension: { fieldKey: "hourBucket" },
        measure: { fieldKey: "visitors" },
      },
    },
  },
  {
    id: "table-1",
    type: "table",
    title: "明细",
    props: { pageSize: 20, striped: false },
    binding: { datasetId: "sales", slots: { columns: [{ fieldKey: "month" }, { fieldKey: "revenue" }] } },
  },
  {
    id: "flip-empty-1",
    type: "flipNumber",
    title: "翻牌器",
    props: { aggregation: "sum", prefix: "", suffix: "", decimals: 0 },
    binding: { datasetId: "sales", slots: { measure: [{ fieldKey: "revenue" }] } },
  },
  {
    id: "progress-empty-1",
    type: "progressBar",
    title: "进度条",
    props: { aggregation: "sum", decimals: 1, showValue: true },
    binding: { datasetId: "sales", slots: { measure: [{ fieldKey: "revenue" }] } },
  },
] satisfies ComponentInstance[];

it.each(dataComponents)("renders a demo with an empty-data notice for empty $type rows", (component) => {

  render(<DashboardComponentRenderer component={component} rows={[]} />);

  expect(screen.getByText("当前图表无数据")).toBeTruthy();
});

it.each([
  ["水波图", "empty-demo-liquid"],
  ["仪表盘", "empty-demo-gauge"],
  ["漏斗图", "empty-demo-funnel"],
  ["热力图", "empty-demo-heatmap"],
] as const)("renders a tailored empty-data demo for %s", (title, testId) => {
  const type = title === "水波图" ? "kpi" : title === "仪表盘" ? "gauge" : title === "热力图" ? "heatmap" : "bar";
  const component: ComponentInstance = {
    id: `${type}-1`,
    type,
    title,
    props: type === "kpi"
      ? { aggregation: "sum", prefix: "", suffix: "", decimals: 0 }
      : type === "gauge"
        ? { aggregation: "sum", decimals: 1 }
      : type === "heatmap"
        ? { aggregation: "sum", showValues: true }
        : { color: "#1677ff", showLegend: true },
  };

  render(<DashboardComponentRenderer component={component} rows={[]} />);

  expect(screen.getByTestId(testId)).toBeTruthy();
  expect(screen.getByText("当前图表无数据")).toBeTruthy();
});

it("renders tailored empty-data demos for flip number and progress bar", () => {
  const flipNumber: ComponentInstance = {
    id: "flip-empty-1",
    type: "flipNumber",
    title: "翻牌器",
    props: { aggregation: "sum", prefix: "", suffix: "", decimals: 0 },
    binding: { datasetId: "sales", slots: { measure: [{ fieldKey: "revenue" }] } },
  };
  const progressBar: ComponentInstance = {
    id: "progress-empty-1",
    type: "progressBar",
    title: "进度条",
    props: { aggregation: "sum", decimals: 1, showValue: true },
    binding: { datasetId: "sales", slots: { measure: [{ fieldKey: "revenue" }] } },
  };

  render(<DashboardComponentRenderer component={flipNumber} rows={[]} />);
  expect(screen.getByTestId("empty-demo-flip-number")).toBeTruthy();
  cleanup();

  render(<DashboardComponentRenderer component={progressBar} rows={[]} />);
  expect(screen.getByTestId("empty-demo-progress")).toBeTruthy();
  expect(screen.getByText("当前图表无数据")).toBeTruthy();
});

it("keeps empty-data demo SVGs proportional when the component is resized", () => {
  const component: ComponentInstance = {
    id: "liquid-1",
    type: "kpi",
    title: "水波图",
    props: { aggregation: "sum", prefix: "", suffix: "", decimals: 0 },
  };

  render(<DashboardComponentRenderer component={component} rows={[]} />);

  expect(screen.getByTestId("empty-demo-liquid").getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
});

it("does not render an empty-data notice when chart rows are available", () => {
  const component: ComponentInstance = {
    id: "bar-1",
    type: "bar",
    title: "销售额",
    props: { color: "#1677ff", showLegend: true },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measure: { fieldKey: "revenue" } } },
  };

  render(<DashboardComponentRenderer component={component} rows={[{ month: "1月", revenue: 10 }]} />);

  expect(screen.queryByText("当前图表无数据")).toBeNull();
});

it("forwards a configured metric click with the matching point row", () => {
  const onChartJump = vi.fn();
  const rule = {
    id: "jump-sales", triggerFieldKey: "revenue", targetDashboardId: "detail-dashboard", openMode: "current" as const,
    parameterMappings: [{ sourceFieldKey: "region", targetFilterId: "target-region" }],
  };
  render(<DashboardComponentRenderer
    component={{
      id: "bar-jump", type: "bar", title: "区域销售", props: { color: "#1677ff", showLegend: true }, interaction: { jumpRules: [rule] },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "revenue" } } },
    }}
    fields={[{ key: "region", label: "区域", type: "string", nullable: false }, { key: "revenue", label: "销售额", type: "number", nullable: false }]}
    rows={[{ region: "华东", revenue: 12800 }]}
    onChartJump={onChartJump}
  />);

  fireEvent.click(screen.getByRole("img", { name: "区域销售图表" }));
  expect(onChartJump).toHaveBeenCalledWith(rule, { region: "华东", revenue: 12800 });
});

it("forwards a configured heatmap cell click", () => {
  const onChartJump = vi.fn();
  const rule = {
    id: "jump-visitors", triggerFieldKey: "visitors", targetDashboardId: "detail-dashboard", openMode: "newTab" as const,
    parameterMappings: [{ sourceFieldKey: "weekday", targetFilterId: "target-weekday" }],
  };
  render(<DashboardComponentRenderer
    component={{
      id: "heatmap-jump", type: "heatmap", title: "访问热力", props: { aggregation: "sum", showValues: true }, interaction: { jumpRules: [rule] },
      binding: { datasetId: "traffic", slots: { rowDimension: { fieldKey: "weekday" }, columnDimension: { fieldKey: "hour" }, measure: { fieldKey: "visitors" } } },
    }}
    fields={[
      { key: "weekday", label: "星期", type: "string", nullable: false }, { key: "hour", label: "小时", type: "string", nullable: false }, { key: "visitors", label: "访客数", type: "number", nullable: false },
    ]}
    rows={[{ weekday: "周一", hour: "10时", visitors: 36 }]}
    onChartJump={onChartJump}
  />);

  fireEvent.click(screen.getByRole("button", { name: "周一 10时 访客数 36" }));
  expect(onChartJump).toHaveBeenCalledWith(rule, { weekday: "周一", hour: "10时", visitors: 36 });
});

it("renders a gauge chart from actual and target values", () => {
  const component: ComponentInstance = {
    id: "gauge-1",
    type: "gauge",
    title: "销售达成仪表盘",
    props: { aggregation: "sum", decimals: 1 },
    binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" }, target: { fieldKey: "revenueTarget" } } },
  };

  render(<DashboardComponentRenderer component={component} rows={[{ revenue: 865000, revenueTarget: 1000000 }]} />);

  expect(screen.getByRole("img", { name: "销售达成仪表盘图表" })).toBeTruthy();
  expect(screen.queryByText("当前图表无数据")).toBeNull();
});

it("renders a ring bar and a ranked table with top-three star badges", () => {
  const fields: readonly DatasetField[] = [
    { key: "region", label: "区域", type: "string", nullable: false },
    { key: "revenue", label: "销售额", type: "number", nullable: false },
  ];
  const rows = [
    { region: "华东", revenue: 82 },
    { region: "华北", revenue: 72 },
    { region: "华南", revenue: 64 },
    { region: "华中", revenue: 53 },
  ];
  render(<>
    <DashboardComponentRenderer component={{
      id: "ring-1", type: "ringBar", title: "区域销售", props: { aggregation: "sum", color: "#1677ff", showLegend: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "revenue" } } },
    }} fields={fields} rows={rows} />
    <DashboardComponentRenderer component={{
      id: "ranking-1", type: "ranking", title: "区域销售排行榜", props: { color: "#1677ff", maxItems: 10, showValue: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "revenue" } } },
    }} fields={fields} rows={rows} />
  </>);

  expect(screen.getByRole("img", { name: "区域销售图表" })).toBeTruthy();
  expect(screen.getByTestId("ranking-surface")).toBeTruthy();
  expect(screen.getByLabelText("第1名").textContent).toBe("1");
  expect(screen.getByLabelText("第2名").textContent).toBe("2");
  expect(screen.getByLabelText("第3名").textContent).toBe("3");
  expect(screen.getByText("华中")).toBeTruthy();
  expect(screen.queryByText("排序")).toBeNull();
  expect(screen.queryByText("区域")).toBeNull();
});

it("renders horizontal bar and bar-line components", () => {
  render(<>
    <DashboardComponentRenderer component={{
      id: "horizontal-bar-1", type: "horizontalBar", title: "商品库存排行", props: { aggregation: "sum", color: "#5b6ff0", maxItems: 10, showValue: true },
      binding: { datasetId: "inventory", slots: { dimension: { fieldKey: "product" }, measure: { fieldKey: "inventoryAmount" } } },
    }} fields={[
      { key: "product", label: "商品", type: "string", nullable: false },
      { key: "inventoryAmount", label: "库存金额", type: "number", nullable: false },
    ]} rows={[{ product: "K80", inventoryAmount: 1420 }]} />
    <DashboardComponentRenderer component={{
      id: "bar-line-1", type: "barLine", title: "库存金额与数量", props: { aggregation: "sum", barColor: "#2f62dc", lineColor: "#ff7417", showLegend: true, smooth: false },
      binding: { datasetId: "inventory", slots: { dimension: { fieldKey: "product" }, barMeasure: { fieldKey: "inventoryAmount" }, lineMeasure: { fieldKey: "inventoryQuantity" } } },
    }} fields={[
      { key: "product", label: "商品", type: "string", nullable: false },
      { key: "inventoryAmount", label: "库存金额", type: "number", nullable: false },
      { key: "inventoryQuantity", label: "库存数量", type: "number", nullable: false },
    ]} rows={[{ product: "K80", inventoryAmount: 1420, inventoryQuantity: 80 }]} />
  </>);

  expect(screen.getByRole("img", { name: "商品库存排行图表" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "库存金额与数量图表" })).toBeTruthy();
  expect(screen.getByRole("radiogroup", { name: "切换图表展示方式" })).toBeTruthy();
  fireEvent.click(screen.getByText("仅曲线"));
  expect(screen.getByRole("img", { name: "库存金额与数量图表" })).toBeTruthy();
});

it("places long ranking dimension labels above their progress bars", () => {
  const longLabel = "小米电视 A32 电视智能高清全面屏超长商品名称";
  render(<DashboardComponentRenderer component={{
    id: "ranking-long-label", type: "ranking", title: "商品供货价排行榜", props: { color: "#1677ff", maxItems: 10, showValue: true },
    binding: { datasetId: "products", slots: { dimension: { fieldKey: "product" }, measure: { fieldKey: "supplyPrice" } } },
  }} fields={[
    { key: "product", label: "商品", type: "string", nullable: false },
    { key: "supplyPrice", label: "供货价", type: "number", nullable: false },
  ]} rows={[
    { product: longLabel, supplyPrice: 82 },
    { product: "短名称商品", supplyPrice: 72 },
  ]} />);

  const label = screen.getByText(longLabel);
  const progress = screen.getByLabelText(`${longLabel}排名进度`);
  const measureHeader = screen.getByText("供货价");
  expect(label.style.whiteSpace).not.toBe("nowrap");
  expect(label.parentElement?.contains(progress)).toBe(true);
  expect(measureHeader.parentElement?.children).toHaveLength(3);
  expect(measureHeader.style.textAlign).toBe("right");
  expect(measureHeader.style.whiteSpace).toBe("nowrap");
});

it("uses a direct weighted result for ranking without adding a result column", () => {
  const fields: readonly DatasetField[] = [
    { key: "region", label: "区域", type: "string", nullable: false },
    { key: "revenue", label: "销售额", type: "number", nullable: false },
    { key: "profit", label: "毛利额", type: "number", nullable: false },
  ];
  render(<DashboardComponentRenderer component={{
    id: "ranking-weighted", type: "ranking", title: "综合排行榜",
    props: {
      aggregation: "sum", color: "#1677ff", maxItems: 10,
      metricWeights: { revenue: 30, profit: 70 }, rankingMode: "weighted", showValue: true,
    },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: [{ fieldKey: "revenue" }, { fieldKey: "profit" }] } },
  }} fields={fields} rows={[
    { region: "华东", revenue: 1000, profit: 100 },
    { region: "华北", revenue: 800, profit: 300 },
    { region: "华南", revenue: 500, profit: 400 },
  ]} />);

  expect(screen.getByTestId("ranking-surface").textContent).not.toContain("加权结果");
  expect(screen.getByLabelText("第1名").parentElement?.textContent).toContain("华北");
});

it("renders a liquid chart from actual and target values", () => {
  const component: ComponentInstance = {
    id: "liquid-1",
    type: "liquid",
    title: "销售达成水波图",
    props: { aggregation: "sum", decimals: 1 },
    binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" }, target: { fieldKey: "revenueTarget" } } },
  };

  render(<DashboardComponentRenderer component={component} rows={[{ revenue: 865000, revenueTarget: 1000000 }]} />);

  expect(screen.getByRole("img", { name: "销售达成水波图图表" })).toBeTruthy();
  expect(screen.getByText("86.5%")).toBeTruthy();
  expect(screen.queryByText("当前图表无数据")).toBeNull();
});

it("renders a ranked metric breakdown from a dimension and metric", () => {
  const component: ComponentInstance = {
    id: "breakdown-1",
    type: "metricBreakdown",
    title: "销售额拆解",
    props: { aggregation: "sum", decimals: 1 },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "productLine" }, measure: { fieldKey: "revenue" } } },
  };

  render(<DashboardComponentRenderer component={component} fields={[
    { key: "productLine", label: "产品线", type: "string", nullable: false },
    { key: "revenue", label: "销售额", type: "number", nullable: false },
  ]} rows={[
    { productLine: "企业版", revenue: 600 },
    { productLine: "标准版", revenue: 240 },
    { productLine: "基础版", revenue: 160 },
  ]} />);

  expect(screen.getByTestId("metric-breakdown-surface")).toBeTruthy();
  expect(screen.getByLabelText("销售额合计").textContent).toBe("1,000.0 ¥");
  expect(screen.getByText("企业版")).toBeTruthy();
  expect(screen.getByLabelText("企业版贡献条")).toBeTruthy();
});

it("renders target completion rows separately from multi-metric progress bars", () => {
  render(<DashboardComponentRenderer component={{
    id: "target-progress-1", type: "targetProgress", title: "日销售目标完成率", props: { aggregation: "sum", color: "#f57c00", decimals: 0, showValue: true, suffix: "件" },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "product" }, measure: { fieldKey: "completed" }, target: { fieldKey: "target" } } },
  }} fields={[
    { key: "product", label: "商品", type: "string", nullable: false },
    { key: "completed", label: "完成", type: "number", nullable: false },
    { key: "target", label: "目标", type: "number", nullable: false },
  ]} rows={[
    { product: "小米加湿器 2", completed: 1, target: 50 },
    { product: "小米电视 A32", completed: 8, target: 150 },
  ]} />);

  expect(screen.getByTestId("target-progress-surface")).toBeTruthy();
  expect(screen.getByLabelText("小米加湿器 2完成率进度")).toBeTruthy();
  expect(screen.getByText("1 / 50件")).toBeTruthy();
  const list = screen.getByTestId("target-progress-surface").firstElementChild as HTMLElement;
  expect(list.style.flex).toBe("1 1 auto");
  expect(list.style.justifyContent).toBe("space-between");
  expect(screen.getByText("2%")).toBeTruthy();
});

it("renders one gauge for each value of its grouping dimension", () => {
  const component: ComponentInstance = {
    id: "gauge-1",
    type: "gauge",
    title: "销售达成仪表盘",
    props: { aggregation: "sum", decimals: 1 },
    binding: {
      datasetId: "sales",
      slots: {
        dimension: { fieldKey: "month" },
        measure: { fieldKey: "revenue" },
        target: { fieldKey: "revenueTarget" },
      },
    },
  };

  render(<DashboardComponentRenderer component={component} rows={[
    { month: "2026-04", revenue: 120, revenueTarget: 200 },
    { month: "2026-05", revenue: 270, revenueTarget: 300 },
  ]} />);

  expect(screen.getByTestId("gauge-chart-grid")).toBeTruthy();
  expect(screen.getByRole("img", { name: "销售达成仪表盘 2026-04图表" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "销售达成仪表盘 2026-05图表" })).toBeTruthy();
});

it("renders one liquid chart for each value of its grouping dimension", () => {
  const component: ComponentInstance = {
    id: "liquid-1",
    type: "liquid",
    title: "销售达成水波图",
    props: { aggregation: "sum", decimals: 1 },
    binding: {
      datasetId: "sales",
      slots: {
        dimension: { fieldKey: "month" },
        measure: { fieldKey: "revenue" },
        target: { fieldKey: "revenueTarget" },
      },
    },
  };

  render(<DashboardComponentRenderer component={component} rows={[
    { month: "2026-04", revenue: 120, revenueTarget: 200 },
    { month: "2026-05", revenue: 270, revenueTarget: 300 },
  ]} />);

  expect(screen.getByTestId("liquid-chart-grid")).toBeTruthy();
  expect(screen.getByRole("img", { name: "销售达成水波图 2026-04图表" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "销售达成水波图 2026-05图表" })).toBeTruthy();
});

it("renders plain text without interpreting HTML", () => {
  const component: ComponentInstance = {
    id: "text-1",
    type: "text",
    title: "说明",
    props: { content: "<strong>安全文本</strong>", color: "#1f1f1f", fontSize: 16, fontWeight: "normal", textAlign: "left" },
  };
  render(<DashboardComponentRenderer component={component} rows={[]} />);
  expect(screen.getByText("<strong>安全文本</strong>")).toBeTruthy();
  expect(document.querySelector("strong")).toBeNull();
});

it("renders an aggregated KPI value", () => {
  const component: ComponentInstance = {
    id: "kpi-1",
    type: "kpi",
    title: "总收入",
    props: { aggregation: "sum", prefix: "¥", suffix: "", decimals: 0 },
    binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" } } },
  };
  render(<DashboardComponentRenderer component={component} rows={[{ revenue: 10 }, { revenue: 20 }]} />);
  expect(screen.getByLabelText("总收入指标值").textContent).toContain("30 ¥");
});

it("renders KPI target progress and comparison change when optional slots are bound", () => {
  const component: ComponentInstance = {
    id: "kpi-1",
    type: "kpi",
    title: "总收入",
    props: { aggregation: "sum", prefix: "¥", suffix: "", decimals: 0 },
    binding: {
      datasetId: "sales",
      slots: {
        measure: { fieldKey: "revenue" },
        target: { fieldKey: "revenueTarget" },
        comparison: { fieldKey: "priorRevenue" },
      },
    },
  };

  render(<DashboardComponentRenderer component={component} rows={[{ revenue: 120, revenueTarget: 200, priorRevenue: 100 }]} />);

  expect(screen.getByLabelText("总收入指标值").textContent).toContain("120 ¥");
  expect(screen.getByText("较对比 +20.0%")).toBeTruthy();
  expect(screen.getByText("目标达成 60.0%")).toBeTruthy();
});

it("keeps the original KPI presentation when a dashboard contains experimental insight rows", () => {
  const component: ComponentInstance = {
    id: "kpi-insight-1",
    type: "kpi",
    title: "GMV",
    props: {
      aggregation: "sum",
      prefix: "¥",
      suffix: "",
      decimals: 0,
      insightRows: [
        { type: "comparison", prefix: "环比", tone: "auto" },
        { type: "target", prefix: "目标完成", tone: "positive" },
        { type: "notice", prefix: "不应展示", tone: "warning", text: "不应展示" },
      ],
    },
    binding: {
      datasetId: "sales",
      slots: {
        measure: { fieldKey: "revenue" },
        target: { fieldKey: "revenueTarget" },
        comparison: { fieldKey: "priorRevenue" },
      },
    },
  };

  render(<DashboardComponentRenderer component={component} rows={[{ revenue: 120, revenueTarget: 200, priorRevenue: 100 }]} />);

  expect(screen.getByLabelText("GMV指标值").textContent).toContain("120 ¥");
  expect(screen.getByText("较对比 +20.0%")).toBeTruthy();
  expect(screen.getByText("目标达成 60.0%")).toBeTruthy();
  expect(screen.queryByTestId("kpi-insight-surface")).toBeNull();
  expect(screen.queryByText("不应展示")).toBeNull();
});

it("renders a standalone KPI insight card without manual comparison configuration", () => {
  const component: ComponentInstance = {
    id: "kpi-insight-1",
    type: "kpiInsight",
    title: "GMV 洞察",
    props: {
      aggregation: "sum",
      prefix: "¥",
      suffix: "",
      decimals: 0,
      insightRows: [
        { type: "comparison", prefix: "环比", tone: "auto" },
        { type: "target", prefix: "目标完成", tone: "positive" },
      ],
    },
    binding: {
      datasetId: "sales",
      slots: {
        measure: { fieldKey: "revenue", aggregation: "sum" },
        target: { fieldKey: "revenueTarget" },
        comparison: { fieldKey: "priorRevenue" },
      },
    },
  };

  render(<DashboardComponentRenderer component={component} rows={[{ revenue: 120, revenueTarget: 200, priorRevenue: 100 }]} />);

  expect(screen.getByTestId("kpi-insight-surface")).toBeTruthy();
  expect(screen.getByLabelText("GMV 洞察指标值").textContent).toContain("120 ¥");
  expect(screen.getByText("GMV 洞察")).toBeTruthy();
  expect(screen.queryByText("环比 +20.0%")).toBeNull();
  expect(screen.queryByText("目标完成 60.0%")).toBeNull();
});

it("adds the item unit to quantity and qty metrics across KPI insight cards", () => {
  const component: ComponentInstance = {
    id: "kpi-insight-quantity",
    type: "kpiInsight",
    title: "发货洞察",
    props: { aggregation: "sum", prefix: "", suffix: "", decimals: 0 },
    binding: { datasetId: "sales", slots: { measure: [{ fieldKey: "quantity" }, { fieldKey: "order_qty" }] } },
  };

  render(
    <DashboardComponentRenderer
      component={component}
      fields={[
        { key: "quantity", label: "数量", type: "number", nullable: false },
        { key: "order_qty", label: "下单数量", type: "number", nullable: false },
      ]}
      rows={[{ quantity: 2517, order_qty: 20 }]}
    />,
  );

  expect(screen.getByLabelText("数量指标值").textContent).toContain("2517 件");
  expect(screen.getByLabelText("下单数量指标值").textContent).toContain("20 件");
});

it("aggregates each KPI insight metric using its own aggregation setting", () => {
  const component: ComponentInstance = {
    id: "kpi-insight-multiple",
    type: "kpiInsight",
    title: "经营洞察",
    props: {
      aggregation: "sum",
      prefix: "",
      suffix: "",
      decimals: 0,
    },
    binding: {
      datasetId: "sales",
      slots: {
        measure: [{ fieldKey: "revenue", aggregation: "avg" }, { fieldKey: "orders", aggregation: "max" }],
      },
    },
  };

  render(<DashboardComponentRenderer component={component} rows={[
    { revenue: 120, orders: 36 },
    { revenue: 80, orders: 54 },
  ]} />);

  expect(screen.getByLabelText("revenue指标值").textContent).toContain("100 ¥");
  expect(screen.getByLabelText("orders指标值").textContent).toContain("54");
  expect(screen.queryByText(/环比/)).toBeNull();
  expect(screen.queryByText(/目标完成/)).toBeNull();
});

it("does not render experimental KPI secondary or notice content", () => {
  const component: ComponentInstance = {
    id: "kpi-insight-2",
    type: "kpi",
    title: "库存周转",
    props: {
      aggregation: "sum",
      prefix: "",
      suffix: "天",
      decimals: 1,
      insightRows: [
        { type: "secondary", prefix: "缺货 SKU", tone: "warning", secondaryIndex: 1 },
        { type: "notice", prefix: "", tone: "negative", text: "存在缺货风险" },
      ],
    },
    binding: {
      datasetId: "inventory",
      slots: {
        measure: { fieldKey: "turnoverDays" },
        secondaryMeasures: [{ fieldKey: "availableSkuCount" }, { fieldKey: "stockoutSkuCount" }],
      },
    },
  };

  render(
    <DashboardComponentRenderer
      component={component}
      fields={[
        { key: "turnoverDays", label: "库存周转", type: "number", nullable: false },
        { key: "availableSkuCount", label: "可售 SKU", type: "number", nullable: false },
        { key: "stockoutSkuCount", label: "缺货 SKU", type: "number", nullable: false },
      ]}
      rows={[{ turnoverDays: 24.5, availableSkuCount: 30, stockoutSkuCount: 3 }]}
    />,
  );

  expect(screen.getByLabelText("库存周转指标值").textContent).toContain("24.5天");
  expect(screen.queryByText("缺货 SKU 3")).toBeNull();
  expect(screen.queryByText("存在缺货风险")).toBeNull();
});

it("renders flip number as rolling cards for multiple selected metrics", async () => {
  const component: ComponentInstance = {
    id: "flip-1",
    type: "flipNumber",
    title: "成交额",
    props: { aggregation: "sum", prefix: "¥", suffix: "", decimals: 0 },
    binding: { datasetId: "sales", slots: { measure: [{ fieldKey: "revenue" }, { fieldKey: "orderTarget" }] } },
  };

  const { rerender } = render(
    <DashboardComponentRenderer
      component={component}
      rows={[{ revenue: 100, orderTarget: 442300 }, { revenue: 50, orderTarget: 0 }]}
    />,
  );

  expect(screen.getByTestId("flip-number-surface")).toBeTruthy();
  expect(screen.getByText("revenue")).toBeTruthy();
  expect(screen.getByText("orderTarget")).toBeTruthy();
  expect(screen.getByLabelText("revenue翻牌器数值").textContent).toContain("¥150");
  expect(screen.getByLabelText("orderTarget翻牌器数值").textContent).toContain("¥44.23万");
  expect(screen.getAllByTestId("flip-number-rolling-value")).toHaveLength(2);

  rerender(
    <DashboardComponentRenderer
      component={component}
      rows={[{ revenue: 200, orderTarget: 552300 }, { revenue: 50, orderTarget: 0 }]}
    />,
  );

  await waitFor(() => expect(screen.getByLabelText("revenue翻牌器数值").getAttribute("data-rolling")).toBe("true"));
});

it("renders legacy KPI instances titled flip number with flip number presentation", () => {
  const component: ComponentInstance = {
    id: "legacy-flip-1",
    type: "kpi",
    title: "翻牌器",
    props: { aggregation: "sum", prefix: "", suffix: "", decimals: 0 },
    binding: {
      datasetId: "sales",
      slots: {
        dimension: { fieldKey: "region" },
        measure: [{ fieldKey: "revenueTarget" }],
      },
    },
  };

  render(<DashboardComponentRenderer component={component} rows={[
    { region: "华北", revenueTarget: 445000 },
    { region: "华东", revenueTarget: 547000 },
  ]} />);

  expect(screen.getByTestId("flip-number-surface")).toBeTruthy();
  expect(screen.queryByTestId("kpi-board-surface")).toBeNull();
  expect(screen.queryByText("指标看板")).toBeNull();
  expect(screen.getByLabelText("revenueTarget翻牌器数值").textContent).toContain("99.2万");
});

it("renders progress bar rows for multiple selected metrics", () => {
  const component: ComponentInstance = {
    id: "progress-1",
    type: "progressBar",
    title: "核心指标进度",
    props: { aggregation: "sum", decimals: 1, showValue: true },
    binding: {
      datasetId: "sales",
      slots: {
        measure: [{ fieldKey: "revenue" }, { fieldKey: "orders" }, { fieldKey: "activeUsers" }],
      },
    },
  };

  render(<DashboardComponentRenderer component={component} rows={[
    { revenue: 12_280_000, orders: 411_600, activeUsers: 5_538_000 },
  ]} />);

  const surface = screen.getByTestId("progress-bar-surface");
  expect(surface).toBeTruthy();
  expect((surface as HTMLElement).style.border).toBe("");
  expect(screen.getByText("revenue")).toBeTruthy();
  expect(screen.getByText("orders")).toBeTruthy();
  expect(screen.getByText("activeUsers")).toBeTruthy();
  expect(screen.getAllByText("100.0%")).toHaveLength(3);
  expect(screen.getByText("实际 1228万 ¥ | 目标 1228万")).toBeTruthy();
  expect(screen.getByText("实际 41.16万 | 目标 41.16万")).toBeTruthy();
  expect(screen.getByLabelText("revenue进度条").querySelector("span")?.getAttribute("style")).toContain("display: block");
  expect(screen.getByLabelText("revenue进度条").querySelector("span")?.getAttribute("style")).toContain("width: 100%");
});

it("keeps KPI comparison rate readable when the comparison value is zero", () => {
  const component: ComponentInstance = {
    id: "kpi-1",
    type: "kpi",
    title: "总收入",
    props: { aggregation: "sum", prefix: "¥", suffix: "", decimals: 0 },
    binding: {
      datasetId: "sales",
      slots: {
        measure: { fieldKey: "revenue" },
        comparison: { fieldKey: "priorRevenue" },
      },
    },
  };

  render(<DashboardComponentRenderer component={component} rows={[{ revenue: 120, priorRevenue: 0 }]} />);

  expect(screen.getByText("较对比 —")).toBeTruthy();
});

it("renders a grouped KPI board when a dimension and secondary measures are bound", () => {
  const component: ComponentInstance = {
    id: "kpi-1",
    type: "kpi",
    title: "指标看板",
    props: { aggregation: "sum", prefix: "", suffix: "", decimals: 0 },
    binding: {
      datasetId: "sales",
      slots: {
        dimension: { fieldKey: "month" },
        measure: { fieldKey: "revenue" },
        target: { fieldKey: "revenueTarget" },
        comparison: { fieldKey: "priorRevenue" },
        secondaryMeasures: [{ fieldKey: "orders" }, { fieldKey: "orderTarget" }],
      },
    },
  };

  render(
    <DashboardComponentRenderer
      component={component}
      fields={[
        { key: "month", label: "月份", type: "string", nullable: false },
        { key: "revenue", label: "revenue", type: "number", nullable: false },
        { key: "revenueTarget", label: "revenueTarget", type: "number", nullable: false },
        { key: "priorRevenue", label: "priorRevenue", type: "number", nullable: false },
        { key: "orders", label: "orders", type: "number", nullable: false },
        { key: "orderTarget", label: "orderTarget", type: "number", nullable: false },
      ]}
      rows={[
        { month: "2026-01", revenue: 100000, revenueTarget: 120000, priorRevenue: 90000, orders: 1000, orderTarget: 1200 },
        { month: "2026-01", revenue: 50000, revenueTarget: 60000, priorRevenue: 40000, orders: 500, orderTarget: 600 },
        { month: "2026-02", revenue: 200000, revenueTarget: 250000, priorRevenue: 180000, orders: 2000, orderTarget: 2500 },
      ]}
    />,
  );

  expect(screen.getByTestId("kpi-board-surface")).toBeTruthy();
  expect(screen.getByText("2026-01")).toBeTruthy();
  expect(screen.getByText("15万 ¥")).toBeTruthy();
  expect(screen.getAllByText("revenueTarget")).toHaveLength(2);
  expect(screen.getAllByText("18万 ¥")).toHaveLength(2);
  expect(screen.getAllByText("orders")).toHaveLength(2);
  expect(screen.getByText("1,500")).toBeTruthy();
});

it("renders table headers from dataset field labels and paginates rows", () => {
  const component: ComponentInstance = {
    id: "table-1",
    type: "table",
    title: "明细表",
    props: { pageSize: 2, striped: false },
    binding: {
      datasetId: "inventory",
      slots: {
        columns: [
          { fieldKey: "field3" },
          { fieldKey: "field2" },
          { fieldKey: "month" },
        ],
      },
    },
  };
  const fields: DatasetField[] = [
    { key: "field3", label: "商品规格", type: "string", nullable: false },
    { key: "field2", label: "商品名称", type: "string", nullable: false },
    { key: "month", label: "月份", type: "date", nullable: false },
  ];

  render(
    <DashboardComponentRenderer
      component={component}
      fields={fields}
      rows={[
        { field3: "1050G", field2: "PUBG G币", month: "2026-04" },
        { field3: "100G", field2: "CDK", month: "2026-05" },
        { field3: "510G", field2: "弱水", month: "2026-06" },
      ]}
    />,
  );

  expect(screen.getByRole("columnheader", { name: "商品规格" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "商品名称" })).toBeTruthy();
  expect(screen.queryByRole("columnheader", { name: "field3" })).toBeNull();
  expect(screen.getByText("第 1 / 2 页")).toBeTruthy();
  expect(screen.queryByText("510G")).toBeNull();
  const footer = screen.getByLabelText("表格分页").closest("footer") as HTMLElement;
  expect(footer.style.flex).toBe("0 0 auto");
  expect(footer.style.boxSizing).toBe("border-box");

  fireEvent.click(screen.getByRole("button", { name: "下一页" }));

  expect(screen.getByText("第 2 / 2 页")).toBeTruthy();
  expect(screen.getByText("510G")).toBeTruthy();
});

it("aggregates repeated detail-table dimensions when row aggregation is enabled", () => {
  const component: ComponentInstance = {
    id: "table-aggregation",
    type: "table",
    title: "商品汇总",
    props: { aggregateRows: true, aggregation: "sum", pageSize: 20, striped: false },
    binding: {
      datasetId: "inventory",
      slots: {
        columns: [
          { fieldKey: "product" },
          { fieldKey: "units", aggregation: "sum" },
        ],
      },
    },
  };
  render(<DashboardComponentRenderer
    component={component}
    fields={[
      { key: "product", label: "商品名称", type: "string", nullable: false },
      { key: "units", label: "数量", type: "number", nullable: false },
    ]}
    rows={[
      { product: "小米电视机 A32", units: 2 },
      { product: "小米电视机 A32", units: 3 },
      { product: "小米路由器", units: 1 },
    ]}
  />);

  expect(screen.getAllByText("小米电视机 A32")).toHaveLength(1);
  expect(screen.getByText("5")).toBeTruthy();
  expect(screen.getAllByText("2 行").length).toBeGreaterThan(0);
});

it("renders detail tables without row and column chips in the header", () => {
  const component: ComponentInstance = {
    id: "table-1",
    type: "table",
    title: "订单明细表",
    props: { pageSize: 20, striped: true },
    binding: {
      datasetId: "inventory",
      slots: { columns: [{ fieldKey: "field3" }, { fieldKey: "field2" }, { fieldKey: "month" }] },
    },
  };
  const fields: DatasetField[] = [
    { key: "field3", label: "商品规格", type: "string", nullable: false },
    { key: "field2", label: "商品名称", type: "string", nullable: false },
    { key: "month", label: "月份", type: "date", nullable: false },
  ];

  render(<DashboardComponentRenderer component={component} fields={fields} rows={[{ field3: "1050G", field2: "PUBG G币", month: "2026-04" }]} />);

  const surface = screen.getByTestId("detail-table-surface");
  expect(surface).toBeTruthy();
  expect(surface.style.borderStyle).toBe("none");
  expect(surface.querySelector("header")).toBeNull();
  expect(screen.queryByText("明细表")).toBeNull();
  expect(screen.queryByText("订单明细表")).toBeNull();
  expect(screen.getAllByText("1 行").length).toBeGreaterThan(0);
  expect(screen.getAllByText("3 列").length).toBeGreaterThan(0);
  const tableScroller = screen.getByRole("table").parentElement as HTMLElement;
  expect(tableScroller.style.margin).toBe("0px 14px");
  expect(tableScroller.style.flex).toBe("1 1 auto");
  expect(tableScroller.style.minHeight).toBe("0px");
  expect(tableScroller.style.overflow).toBe("auto");
});

it("renders a two-dimensional crosstab matrix with totals", () => {
  const component = {
    id: "crosstab-1",
    type: "crosstab",
    title: "销售交叉表",
    props: { aggregation: "sum", showTotals: true },
    binding: {
      datasetId: "sales",
      slots: {
        rowDimension: { fieldKey: "region" },
        columnDimension: { fieldKey: "category" },
        measure: { fieldKey: "revenue" },
      },
    },
  } as ComponentInstance;
  const fields: DatasetField[] = [
    { key: "region", label: "地区", type: "string", nullable: false },
    { key: "category", label: "品类", type: "string", nullable: false },
    { key: "revenue", label: "销售额", type: "number", nullable: false },
  ];

  render(
    <DashboardComponentRenderer
      component={component}
      fields={fields}
      rows={[
        { region: "华东", category: "手机", revenue: 1000 },
        { region: "华东", category: "电脑", revenue: 2000 },
        { region: "华南", category: "手机", revenue: 800 },
        { region: "华南", category: "电脑", revenue: 1500 },
      ]}
    />,
  );

  expect(screen.getByRole("table", { name: "销售交叉表二维交叉表" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "地区 \\ 品类" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "手机" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "电脑" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "合计" })).toBeTruthy();
  expect(screen.getByRole("rowheader", { name: "华东" })).toBeTruthy();
  expect(screen.getByText("1,000 ¥")).toBeTruthy();
  expect(screen.getByText("0.23万 ¥")).toBeTruthy();
  expect(screen.getByRole("rowheader", { name: "合计" })).toBeTruthy();
  expect(screen.getByText("0.53万 ¥")).toBeTruthy();
});

it("renders crosstabs with modern matrix chrome and binding context", () => {
  const component = {
    id: "crosstab-1",
    type: "crosstab",
    title: "销售交叉表",
    props: { aggregation: "sum", showTotals: true },
    binding: {
      datasetId: "sales",
      slots: {
        rowDimension: { fieldKey: "region" },
        columnDimension: { fieldKey: "category" },
        measure: { fieldKey: "revenue" },
      },
    },
  } as ComponentInstance;
  const fields: DatasetField[] = [
    { key: "region", label: "地区", type: "string", nullable: false },
    { key: "category", label: "品类", type: "string", nullable: false },
    { key: "revenue", label: "销售额", type: "number", nullable: false },
  ];

  render(<DashboardComponentRenderer component={component} fields={fields} rows={[{ region: "华东", category: "手机", revenue: 1000 }]} />);

  expect(screen.getByTestId("crosstab-surface")).toBeTruthy();
  expect(screen.getByTestId("crosstab-surface").style.borderStyle).toBe("none");
  expect(screen.getByText("二维交叉表")).toBeTruthy();
  expect(screen.getByText("行：地区")).toBeTruthy();
  expect(screen.getByText("列：品类")).toBeTruthy();
  expect(screen.getByText("指标：销售额")).toBeTruthy();
});

it("renders a heatmap intensity matrix with selected row, column, and metric fields", () => {
  const component = {
    id: "heatmap-1",
    type: "heatmap",
    title: "访问热力图",
    props: { aggregation: "sum", showValues: true },
    binding: {
      datasetId: "traffic",
      slots: {
        rowDimension: { fieldKey: "weekday" },
        columnDimension: { fieldKey: "hourBucket" },
        measure: { fieldKey: "visitors" },
      },
    },
  } as ComponentInstance;
  const fields: DatasetField[] = [
    { key: "weekday", label: "星期", type: "string", nullable: false },
    { key: "hourBucket", label: "时段", type: "string", nullable: false },
    { key: "visitors", label: "访客数", type: "number", nullable: false },
  ];

  render(
    <DashboardComponentRenderer
      component={component}
      fields={fields}
      rows={[
        { weekday: "周一", hourBucket: "09:00", visitors: 120 },
        { weekday: "周一", hourBucket: "09:00", visitors: 30 },
        { weekday: "周一", hourBucket: "10:00", visitors: 80 },
        { weekday: "周二", hourBucket: "09:00", visitors: 40 },
        { weekday: "周二", hourBucket: "10:00", visitors: 200 },
      ]}
    />,
  );

  expect(screen.getByRole("table", { name: "访问热力图热力矩阵" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "星期 \\ 时段" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "09:00" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "10:00" })).toBeTruthy();
  expect(screen.getByRole("rowheader", { name: "周一" })).toBeTruthy();
  expect(screen.getByLabelText("周二 10:00 访客数 200")).toBeTruthy();
  expect(screen.getByText("150")).toBeTruthy();
});

it("renders heatmaps with a color legend and metric context", () => {
  const component = {
    id: "heatmap-1",
    type: "heatmap",
    title: "访问热力图",
    props: { aggregation: "sum", showValues: true },
    binding: {
      datasetId: "traffic",
      slots: {
        rowDimension: { fieldKey: "weekday" },
        columnDimension: { fieldKey: "hourBucket" },
        measure: { fieldKey: "visitors" },
      },
    },
  } as ComponentInstance;
  const fields: DatasetField[] = [
    { key: "weekday", label: "星期", type: "string", nullable: false },
    { key: "hourBucket", label: "时段", type: "string", nullable: false },
    { key: "visitors", label: "访客数", type: "number", nullable: false },
  ];

  render(<DashboardComponentRenderer component={component} fields={fields} rows={[
    { weekday: "周一", hourBucket: "09:00", visitors: 120 },
    { weekday: "周二", hourBucket: "10:00", visitors: 200 },
  ]} />);

  expect(screen.getByTestId("heatmap-surface")).toBeTruthy();
  expect(screen.getByTestId("heatmap-surface").style.borderStyle).toBe("none");
  expect(screen.getByLabelText("热力值图例")).toBeTruthy();
  expect(screen.getByText("低")).toBeTruthy();
  expect(screen.getByText("高")).toBeTruthy();
  expect(screen.getByText("访客数")).toBeTruthy();
});

it("defaults a sunburst to its first metric and exposes a top-right metric switcher", () => {
  const component = {
    id: "sunburst-1",
    type: "sunburst",
    title: "月度销售构成",
    props: { color: "#1677ff", showLegend: true },
    binding: {
      datasetId: "sales",
      slots: {
        dimension: { fieldKey: "month" },
        measure: [{ fieldKey: "revenue" }, { fieldKey: "profit" }],
      },
    },
  } as ComponentInstance;
  const fields: DatasetField[] = [
    { key: "month", label: "月份", type: "string", nullable: false },
    { key: "revenue", label: "销售额", type: "number", nullable: false },
    { key: "profit", label: "毛利", type: "number", nullable: false },
  ];

  render(<DashboardComponentRenderer component={component} fields={fields} rows={[{ month: "1月", revenue: 100, profit: 20 }]} />);

  expect(screen.getByLabelText("旭日图维度图例").textContent).toContain("1月");
  const selector = screen.getByRole("combobox", { name: "切换旭日图指标" });
  expect((selector as HTMLSelectElement).value).toBe("revenue");
  expect(screen.getByRole("img", { name: "月度销售构成 销售额图表" })).toBeTruthy();

  fireEvent.change(selector, { target: { value: "profit" } });
  expect((selector as HTMLSelectElement).value).toBe("profit");
  expect(screen.getByRole("img", { name: "月度销售构成 毛利图表" })).toBeTruthy();
});

it("renders first-class radar and treemap components through ECharts", () => {
  const fields: DatasetField[] = [
    { key: "month", label: "月份", type: "string", nullable: false },
    { key: "online", label: "电商销售", type: "number", nullable: false },
    { key: "dealer", label: "经销商销售", type: "number", nullable: false },
  ];
  const rows = [{ month: "202606", online: 120, dealer: 80 }, { month: "202605", online: 80, dealer: 60 }];

  const { rerender } = render(<DashboardComponentRenderer component={{
    id: "radar-1", type: "radar", title: "渠道销售对比", props: { color: "#4b7cf5", showLegend: true },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measure: [{ fieldKey: "online" }, { fieldKey: "dealer" }] } },
  }} fields={fields} rows={rows} />);
  expect(screen.getByRole("img", { name: "渠道销售对比图表" })).toBeTruthy();
  expect(screen.getByLabelText("雷达图指标图例").textContent).toContain("电商销售");
  expect(screen.getByLabelText("雷达图指标图例").textContent).toContain("经销商销售");

  rerender(<DashboardComponentRenderer component={{
    id: "treemap-1", type: "treemap", title: "月度销售占比", props: { color: "#4b7cf5", showLegend: false },
    binding: { datasetId: "sales", slots: { dimension: { fieldKey: "month" }, measure: [{ fieldKey: "online" }, { fieldKey: "dealer" }] } },
  }} fields={fields} rows={rows} />);
  expect(screen.getByRole("img", { name: "月度销售占比 电商销售图表" })).toBeTruthy();

  const treemapSelector = screen.getByRole("combobox", { name: "切换矩形树图指标" });
  expect((treemapSelector as HTMLSelectElement).value).toBe("online");
  fireEvent.change(treemapSelector, { target: { value: "dealer" } });
  expect(screen.getByRole("img", { name: "月度销售占比 经销商销售图表" })).toBeTruthy();
});

it("keeps legacy pie-based sunbursts on the metric-switching renderer", () => {
  const component = {
    id: "legacy-sunburst-1",
    type: "pie",
    title: "旭日图",
    props: { color: "#1677ff", showLegend: true },
    binding: {
      datasetId: "sales",
      slots: {
        dimension: { fieldKey: "month" },
        measure: [{ fieldKey: "revenue" }, { fieldKey: "profit" }],
      },
    },
  } as ComponentInstance;

  render(<DashboardComponentRenderer component={component} fields={[
    { key: "month", label: "月份", type: "string", nullable: false },
    { key: "revenue", label: "销售额", type: "number", nullable: false },
    { key: "profit", label: "毛利", type: "number", nullable: false },
  ]} rows={[{ month: "1月", revenue: 100, profit: 20 }]} />);

  expect(screen.getByRole("combobox", { name: "切换旭日图指标" })).toBeTruthy();
});

it("renders trend analysis summaries alongside the trend chart", () => {
  const component = {
    id: "trend-1",
    type: "trend",
    title: "销售趋势分析",
    props: { aggregation: "sum", showSummary: true, timeGranularity: "day" },
    binding: {
      datasetId: "sales",
      slots: {
        timeDimension: { fieldKey: "businessDate" },
        measure: { fieldKey: "revenue" },
      },
    },
  } as ComponentInstance;
  const fields: DatasetField[] = [
    { key: "businessDate", label: "业务日期", type: "date", nullable: false },
    { key: "revenue", label: "销售额", type: "number", nullable: false },
  ];

  render(
    <DashboardComponentRenderer
      component={component}
      fields={fields}
      rows={[
        { businessDate: "2026-01-01", revenue: 80 },
        { businessDate: "2026-02-01", revenue: 100 },
        { businessDate: "2026-02-01", revenue: 50 },
        { businessDate: "2026-03-01", revenue: 120 },
      ]}
    />,
  );

  expect(screen.getByRole("img", { name: "销售趋势分析趋势图表" })).toBeTruthy();
  expect(screen.getByText("最新值")).toBeTruthy();
  expect(screen.getByText("120 ¥")).toBeTruthy();
  expect(screen.getByText("较上一期")).toBeTruthy();
  expect(screen.getByText("-20.0%")).toBeTruthy();
  expect(screen.getByText("峰值")).toBeTruthy();
  expect(screen.getByText("150 ¥")).toBeTruthy();
  expect((screen.getByText("最新值").parentElement as HTMLElement).style.boxShadow).toContain("#1677ff");
  expect((screen.getByText("较上一期").parentElement as HTMLElement).style.boxShadow).toContain("#e05252");
});

it("renders trend analysis as a modern analytics card with period and metric context", () => {
  const component = {
    id: "trend-1",
    type: "trend",
    title: "销售趋势分析",
    props: { aggregation: "sum", showSummary: true, timeGranularity: "month" },
    binding: {
      datasetId: "sales",
      slots: {
        timeDimension: { fieldKey: "businessDate" },
        measure: { fieldKey: "revenue" },
      },
    },
  } as ComponentInstance;
  const fields: DatasetField[] = [
    { key: "businessDate", label: "业务日期", type: "date", nullable: false },
    { key: "revenue", label: "销售额", type: "number", nullable: false },
  ];

  render(<DashboardComponentRenderer component={component} fields={fields} rows={[
    { businessDate: "2026-01-01", revenue: 80 },
    { businessDate: "2026-02-01", revenue: 120 },
  ]} />);

  expect(screen.getByTestId("trend-analysis-surface")).toBeTruthy();
  expect(screen.getByText("趋势分析")).toBeTruthy();
  expect(screen.getByText("业务日期 → 销售额")).toBeTruthy();
  expect(screen.getByText("2 个周期")).toBeTruthy();
});

it("removes trend surface chrome when the editor provides the component title", () => {
  const component = {
    id: "trend-1",
    type: "trend",
    title: "销售趋势分析",
    props: { aggregation: "sum", showSummary: true, timeGranularity: "month" },
    binding: {
      datasetId: "sales",
      slots: {
        timeDimension: { fieldKey: "businessDate" },
        measure: { fieldKey: "revenue" },
      },
    },
  } as ComponentInstance;

  render(<DashboardComponentRenderer component={component} hideSurfaceHeaders fields={[
    { key: "businessDate", label: "业务日期", type: "date", nullable: false },
    { key: "revenue", label: "销售额", type: "number", nullable: false },
  ]} rows={[
    { businessDate: "2026-01-01", revenue: 80 },
    { businessDate: "2026-02-01", revenue: 120 },
  ]} />);

  const surface = screen.getByTestId("trend-analysis-surface");
  expect(surface.style.borderStyle).toBe("none");
  expect(surface.querySelector("header")).toBeNull();
});

it("renders metric trend as a multi-metric trend panel", () => {
  const component = {
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
  } as ComponentInstance;
  const fields: DatasetField[] = [
    { key: "businessDate", label: "业务日期", type: "date", nullable: false },
    { key: "revenue", label: "收入", type: "number", nullable: false },
    { key: "orders", label: "订单数", type: "number", nullable: false },
  ];

  render(<DashboardComponentRenderer component={component} fields={fields} rows={[
    { businessDate: "2026-01-01", revenue: 100, orders: 10 },
    { businessDate: "2026-02-01", revenue: 120, orders: 12 },
  ]} />);

  expect(screen.getByTestId("metric-trend-surface")).toBeTruthy();
  expect(screen.getByTestId("metric-trend-surface").style.borderStyle).toBe("none");
  expect(screen.getByText("收入")).toBeTruthy();
  expect(screen.getByText("订单数")).toBeTruthy();
  expect(screen.getByRole("button", { name: "关注指标 收入" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "关注指标 订单数" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "关注指标 收入" }).style.borderBottomWidth).toBe("2px");
  expect(screen.getByRole("button", { name: "关注指标 收入" }).style.borderBottomColor).toBe("rgb(22, 119, 255)");
  expect(screen.getByRole("button", { name: "关注指标 订单数" }).style.borderBottomColor).toBe("transparent");
  expect(screen.getByRole("button", { name: "关注指标 收入" }).style.textAlign).toBe("left");
  expect(screen.getByRole("img", { name: "指标趋势趋势图表" }).parentElement?.style.borderTop).toBe("");
  expect(screen.getByText("汇总值 · 收入")).toBeTruthy();
  expect(screen.queryByText(/较上一期|暂无上一期对比/)).toBeNull();
  expect(screen.getAllByText("220 ¥")).toHaveLength(2);
  expect(screen.getByText("22")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "关注指标 订单数" }));

  expect(screen.getByRole("button", { name: "关注指标 收入" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "关注指标 订单数" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("汇总值 · 订单数")).toBeTruthy();
  expect(screen.getByRole("img", { name: "指标趋势趋势图表" })).toBeTruthy();
});

it("renders a multidimensional analysis table with selected dimensions and measures", () => {
  const component = {
    id: "multi-1",
    type: "multidimensional",
    title: "多维分析",
    props: { aggregation: "sum", showTotals: true, timeGranularity: "month" },
    binding: {
      datasetId: "sales",
      slots: {
        dateDimension: { fieldKey: "businessDate" },
        dimensions: [{ fieldKey: "region" }, { fieldKey: "category" }],
        measures: [{ fieldKey: "revenue" }, { fieldKey: "orders" }],
      },
    },
  } as ComponentInstance;
  const fields: DatasetField[] = [
    { key: "businessDate", label: "业务日期", type: "date", nullable: false },
    { key: "region", label: "地区", type: "string", nullable: false },
    { key: "category", label: "品类", type: "string", nullable: false },
    { key: "revenue", label: "销售额", type: "number", nullable: false },
    { key: "orders", label: "订单数", type: "number", nullable: false },
  ];

  render(
    <DashboardComponentRenderer
      component={component}
      fields={fields}
      rows={[
        { businessDate: "2026-01-01", region: "华东", category: "手机", revenue: 1000, orders: 5 },
        { businessDate: "2026-01-15", region: "华东", category: "手机", revenue: 500, orders: 2 },
        { businessDate: "2026-02-01", region: "华南", category: "电脑", revenue: 1200, orders: 3 },
      ]}
    />,
  );

  expect(screen.getByRole("table", { name: "多维分析多维分析表" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "业务日期" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "地区" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "品类" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "销售额" })).toBeTruthy();
  expect(screen.getByRole("columnheader", { name: "订单数" })).toBeTruthy();
  expect(screen.getByRole("rowheader", { name: "合计" })).toBeTruthy();
  expect(screen.getByText("2026-01")).toBeTruthy();
  expect(screen.getByText("2026-02")).toBeTruthy();
  expect(screen.getByText("0.15万 ¥")).toBeTruthy();
  expect(screen.getByText("0.27万 ¥")).toBeTruthy();
  expect(screen.getByText("10")).toBeTruthy();
});

it("renders multidimensional analysis with grouped dimension and measure context", () => {
  const component = {
    id: "multi-1",
    type: "multidimensional",
    title: "客户多维分析",
    props: { aggregation: "sum", showTotals: true, timeGranularity: "month" },
    binding: {
      datasetId: "sales",
      slots: {
        dateDimension: { fieldKey: "businessDate" },
        dimensions: [{ fieldKey: "region" }, { fieldKey: "category" }],
        measures: [{ fieldKey: "revenue" }, { fieldKey: "orders" }],
      },
    },
  } as ComponentInstance;
  const fields: DatasetField[] = [
    { key: "businessDate", label: "业务日期", type: "date", nullable: false },
    { key: "region", label: "地区", type: "string", nullable: false },
    { key: "category", label: "品类", type: "string", nullable: false },
    { key: "revenue", label: "销售额", type: "number", nullable: false },
    { key: "orders", label: "订单数", type: "number", nullable: false },
  ];

  render(<DashboardComponentRenderer component={component} fields={fields} rows={[
    { businessDate: "2026-01-01", region: "华东", category: "手机", revenue: 1000, orders: 5 },
  ]} />);

  expect(screen.getByTestId("multidimensional-surface")).toBeTruthy();
  expect(screen.getByTestId("multidimensional-surface").style.borderStyle).toBe("none");
  expect(screen.getByText("多维分析")).toBeTruthy();
  expect(screen.getByText("3 个维度")).toBeTruthy();
  expect(screen.getByText("2 个指标")).toBeTruthy();
  expect(screen.getByText("维度")).toBeTruthy();
  expect(screen.getByText("度量")).toBeTruthy();
});

it("hides renderer-owned multidimensional headers inside an editor frame", () => {
  const component = {
    id: "multi-1",
    type: "multidimensional",
    title: "客户多维分析",
    props: { aggregation: "sum", showTotals: true, timeGranularity: "month" },
    binding: {
      datasetId: "sales",
      slots: {
        dateDimension: { fieldKey: "businessDate" },
        dimensions: [{ fieldKey: "region" }, { fieldKey: "category" }],
        measures: [{ fieldKey: "revenue" }, { fieldKey: "orders" }],
      },
    },
  } as ComponentInstance;

  render(<DashboardComponentRenderer component={component} hideSurfaceHeaders fields={[
    { key: "businessDate", label: "业务日期", type: "date", nullable: false },
    { key: "region", label: "地区", type: "string", nullable: false },
    { key: "category", label: "品类", type: "string", nullable: false },
    { key: "revenue", label: "销售额", type: "number", nullable: false },
    { key: "orders", label: "订单数", type: "number", nullable: false },
  ]} rows={[
    { businessDate: "2026-01-01", region: "华东", category: "手机", revenue: 1000, orders: 5 },
  ]} />);

  expect(screen.getByTestId("multidimensional-surface")).toBeTruthy();
  expect(screen.queryByText("客户多维分析")).toBeNull();
  expect(screen.queryByText("多维分析")).toBeNull();
  expect(screen.queryByText("3 个维度")).toBeNull();
  expect(screen.getByText("维度")).toBeTruthy();
  expect(screen.getByText("度量")).toBeTruthy();
});

it("applies and resets dashboard header filters only through explicit actions", async () => {
  const component = {
    id: "header-1",
    type: "dashboardHeader",
    title: "",
    props: {
      headline: "小米官方旗舰店经营看板",
      description: "用于快速掌握经营表现与关键指标。",
      updatedAt: "更新时间：2026-08-05 10:00",
      date: "2026-08-05",
      dateRange: { start: "2026-08-05", end: "2026-08-05" },
      globalFilters: [
        { id: "filter-orderDate", fieldKey: "orderDate", label: "订单时间", controlType: "dateRange", targets: [] },
        { id: "filter-store", fieldKey: "store", label: "店铺", controlType: "select", targets: [] },
      ],
    },
  } as ComponentInstance;

  const onDashboardFilterChange = vi.fn();
  const onDashboardFiltersApply = vi.fn();
  render(<DashboardComponentRenderer component={component} rows={[{ store: "小米官方旗舰店" }]} onDashboardFilterChange={onDashboardFilterChange} onDashboardFiltersApply={onDashboardFiltersApply} />);

  expect(screen.getByRole("region", { name: "看板信息栏与全局筛选" }).getAttribute("data-layout")).toBe("inline");
  expect(screen.getByText("小米官方旗舰店经营看板")).toBeTruthy();
  expect(screen.getAllByLabelText("全局筛选日期范围")).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "月度" })).toBeNull();
  const storeFilter = screen.getByRole("combobox", { name: "全局筛选店铺" });
  expect(storeFilter.closest(".ant-select")).toBeTruthy();
  fireEvent.mouseDown(storeFilter);
  const storeOption = (await screen.findAllByText("小米官方旗舰店")).find((element) => element.classList.contains("ant-select-item-option-content"));
  expect(storeOption).toBeTruthy();
  fireEvent.click(storeOption!);
  await waitFor(() => expect(storeFilter.closest(".ant-select")?.textContent).toContain("小米官方旗舰店"));
  expect(onDashboardFilterChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "应用筛选" }));
  expect(onDashboardFilterChange).toHaveBeenCalledWith("filter-orderDate", { start: "2026-08-05", end: "2026-08-05" });
  expect(onDashboardFilterChange).toHaveBeenCalledWith("filter-store", "小米官方旗舰店");
  expect(onDashboardFiltersApply).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "重置筛选" }));
  expect(onDashboardFilterChange).toHaveBeenCalledWith("filter-store", "");
  expect(onDashboardFiltersApply).toHaveBeenCalledTimes(2);
});

it("hides dashboard header filter actions until a filter is configured", () => {
  const component = {
    id: "header-1",
    type: "dashboardHeader",
    title: "",
    props: {
      headline: "经营数据看板",
      description: "用于快速掌握经营表现与关键指标。",
      updatedAt: "更新时间：2026-08-05 10:00",
      date: "2026-08-05",
      dateRange: { start: "2026-08-05", end: "2026-08-05" },
      globalFilters: [],
    },
  } as ComponentInstance;

  render(<DashboardComponentRenderer component={component} rows={[]} />);

  expect(screen.queryByLabelText("全局筛选器")).toBeNull();
  expect(screen.queryByRole("button", { name: "重置筛选" })).toBeNull();
  expect(screen.queryByRole("button", { name: "应用筛选" })).toBeNull();
});
