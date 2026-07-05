// @vitest-environment jsdom

import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import { Dataset } from "@drag-visual/contracts";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { DashboardViewer } from "./DashboardViewer.js";

const dashboard = (overrides: Partial<Dashboard> = {}): Dashboard => DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "经营看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
  components: [{ id: "bar-1", type: "bar", title: "月收入", props: { color: "#1677ff", showLegend: true } }],
  datasets: [],
  revision: 2,
  updatedAt: "2026-07-03T09:00:00.000Z",
  ...overrides,
});

it("renders component titles without editor controls", () => {
  render(<DashboardViewer dashboard={dashboard()} />);

  expect(screen.getByRole("heading", { name: "经营看板" })).toBeInTheDocument();
  expect(screen.getByText("月收入")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /删除/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /复制/ })).not.toBeInTheDocument();
});

it("shows an empty read-only state", () => {
  render(<DashboardViewer dashboard={dashboard({ layout: [], components: [] })} />);

  expect(screen.getByText("该看板还没有组件")).toBeInTheDocument();
});

it("isolates unsupported component render failures", () => {
  const broken = dashboard({
    layout: [
      { i: "bad", x: 0, y: 0, w: 6, h: 5 },
      { i: "bar-1", x: 6, y: 0, w: 6, h: 5 },
    ],
    components: [
      { id: "bad", type: "bar", title: "坏图表", props: { throwInViewer: true } },
      { id: "bar-1", type: "bar", title: "月收入", props: { color: "#1677ff", showLegend: true } },
    ],
  });

  render(<DashboardViewer dashboard={broken} mode="preview" />);

  expect(screen.getByText("坏图表渲染失败")).toBeInTheDocument();
  expect(screen.getByText("月收入")).toBeInTheDocument();
});

it("shows dataset schema drift near affected components", () => {
  const currentDataset = Dataset.parse({
    id: "sales",
    name: "销售数据",
    schemaVersion: "v2",
    fields: [{ key: "month", label: "月份", type: "string", nullable: false }],
    parameters: [],
  });
  const bound = dashboard({
    components: [{
      id: "bar-1",
      type: "bar",
      title: "月收入",
      props: { color: "#1677ff", showLegend: true },
      binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" } } },
    }],
    datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
  });

  render(<DashboardViewer dashboard={bound} mode="preview" currentDatasets={new Map([["sales", currentDataset]])} />);

  expect(screen.getByText("数据绑定需要检查")).toBeInTheDocument();
  expect(screen.getByText("数据集 sales 已从 v1 更新到 v2")).toBeInTheDocument();
});

it("queries saved dataset parameters and renders a real KPI value", async () => {
  const bound = dashboard({
    layout: [{ i: "kpi-1", x: 0, y: 0, w: 3, h: 3 }],
    components: [{
      id: "kpi-1",
      type: "kpi",
      title: "总收入",
      props: { aggregation: "first", prefix: "¥", suffix: "", decimals: 0 },
      binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" } } },
    }],
    datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: { year: 2026, fromDate: "2026-01-01" } }],
  });

  render(<AppProviders><DashboardViewer dashboard={bound} mode="preview" /></AppProviders>);

  expect(await screen.findByLabelText("总收入指标值")).toHaveTextContent("¥120000");
  expect(screen.queryByText("组件类型：kpi")).not.toBeInTheDocument();
});
