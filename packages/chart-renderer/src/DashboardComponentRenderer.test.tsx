// @vitest-environment jsdom

import type { ComponentInstance, DatasetField } from "@drag-visual/contracts";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { DashboardComponentRenderer } from "./DashboardComponentRenderer.js";

vi.mock("./EChart.js", () => {
  return {
    EChart: ({ ariaLabel }: { readonly ariaLabel: string }) => <div role="img" aria-label={ariaLabel} />,
  };
});

afterEach(cleanup);

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
    { key: "revenueTarget", label: "销售目标", type: "number", nullable: false },
  ];
  const rows = [
    { region: "华东", revenue: 82, revenueTarget: 100 },
    { region: "华北", revenue: 72, revenueTarget: 90 },
    { region: "华南", revenue: 64, revenueTarget: 80 },
    { region: "华中", revenue: 53, revenueTarget: 70 },
  ];
  render(<>
    <DashboardComponentRenderer component={{
      id: "ring-1", type: "ringBar", title: "区域达成", props: { decimals: 1, showValue: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "revenue" }, target: { fieldKey: "revenueTarget" } } },
    }} fields={fields} rows={rows} />
    <DashboardComponentRenderer component={{
      id: "ranking-1", type: "ranking", title: "区域销售排行榜", props: { color: "#1677ff", maxItems: 10, showValue: true },
      binding: { datasetId: "sales", slots: { dimension: { fieldKey: "region" }, measure: { fieldKey: "revenue" } } },
    }} fields={fields} rows={rows} />
  </>);

  expect(screen.getByRole("img", { name: "区域达成图表" })).toBeTruthy();
  expect(screen.getByTestId("ranking-surface")).toBeTruthy();
  expect(screen.getByLabelText("第1名").textContent).toBe("1");
  expect(screen.getByLabelText("第2名").textContent).toBe("2");
  expect(screen.getByLabelText("第3名").textContent).toBe("3");
  expect(screen.getByText("华中")).toBeTruthy();
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
  expect(screen.getByLabelText("销售额合计").textContent).toBe("1,000.0");
  expect(screen.getByText("企业版")).toBeTruthy();
  expect(screen.getByLabelText("企业版贡献条")).toBeTruthy();
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
  expect(screen.getByLabelText("总收入指标值").textContent).toContain("¥30");
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

  expect(screen.getByLabelText("总收入指标值").textContent).toContain("¥120");
  expect(screen.getByText("较对比 +20.0%")).toBeTruthy();
  expect(screen.getByText("目标达成 60.0%")).toBeTruthy();
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
  expect(screen.getByText("实际 1228万 | 目标 1228万")).toBeTruthy();
  expect(screen.getByText("实际 41.16万 | 目标 41.16万")).toBeTruthy();
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
  expect(screen.getByText("15.0万")).toBeTruthy();
  expect(screen.getAllByText("revenueTarget")).toHaveLength(2);
  expect(screen.getAllByText("18.0万")).toHaveLength(2);
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

  fireEvent.click(screen.getByRole("button", { name: "下一页" }));

  expect(screen.getByText("第 2 / 2 页")).toBeTruthy();
  expect(screen.getByText("510G")).toBeTruthy();
});

it("renders detail tables inside a polished data surface with row and column context", () => {
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

  expect(screen.getByTestId("detail-table-surface")).toBeTruthy();
  expect(screen.queryByText("明细表")).toBeNull();
  expect(screen.queryByText("订单明细表")).toBeNull();
  expect(screen.getAllByText("1 行").length).toBeGreaterThan(0);
  expect(screen.getAllByText("3 列").length).toBeGreaterThan(0);
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
  expect(screen.getByText("1,000")).toBeTruthy();
  expect(screen.getByText("2,300")).toBeTruthy();
  expect(screen.getByRole("rowheader", { name: "合计" })).toBeTruthy();
  expect(screen.getByText("5,300")).toBeTruthy();
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
  expect(screen.getByText("120")).toBeTruthy();
  expect(screen.getByText("较上一期")).toBeTruthy();
  expect(screen.getByText("-20.0%")).toBeTruthy();
  expect(screen.getByText("峰值")).toBeTruthy();
  expect(screen.getByText("150")).toBeTruthy();
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
  expect(screen.getByText("收入")).toBeTruthy();
  expect(screen.getByText("订单数")).toBeTruthy();
  expect(screen.getByRole("button", { name: "关注指标 收入" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "关注指标 订单数" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "关注指标 收入" }).style.border).toBe("0px");
  expect(screen.getByRole("button", { name: "关注指标 订单数" }).style.border).toBe("0px");
  expect(screen.getByRole("button", { name: "关注指标 收入" }).style.textAlign).toBe("center");
  expect(screen.getByText("120")).toBeTruthy();
  expect(screen.getByText("12")).toBeTruthy();
  expect(screen.queryByText("+20.0%")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "关注指标 订单数" }));

  expect(screen.getByRole("button", { name: "关注指标 收入" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "关注指标 订单数" }).getAttribute("aria-pressed")).toBe("true");
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
  expect(screen.getByText("1,500")).toBeTruthy();
  expect(screen.getByText("2,700")).toBeTruthy();
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
  expect(screen.getByText("多维分析")).toBeTruthy();
  expect(screen.getByText("3 个维度")).toBeTruthy();
  expect(screen.getByText("2 个指标")).toBeTruthy();
  expect(screen.getByText("维度")).toBeTruthy();
  expect(screen.getByText("度量")).toBeTruthy();
});
