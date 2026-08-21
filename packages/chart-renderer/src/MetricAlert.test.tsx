// @vitest-environment jsdom

import type { ComponentInstance } from "@drag-visual/contracts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { DashboardComponentRenderer } from "./DashboardComponentRenderer.js";

afterEach(cleanup);

const riskAlert: ComponentInstance = {
  id: "inventory-risk",
  type: "metricAlert",
  title: "",
  props: {
    aggregation: "sum",
    operator: "gte",
    threshold: 10,
    decimals: 0,
    alertLabel: "库存风险 {{count}} 项",
    scopeText: "全部店铺｜全部员工",
    headlineTemplate: "{{metric}}偏高",
    messageTemplate: "{{scope}}｜{{dimension}}等 {{count}} 个{{dimensionLabel}}命中预警。",
    detailTemplate: "{{dimension}}的{{metric}}当前值 {{value}}，需要优先处理。",
  },
  binding: {
    datasetId: "inventory",
    slots: {
      dimension: { fieldKey: "store" },
      measure: { fieldKey: "riskCount", aggregation: "sum" },
    },
  },
};

it("highlights a triggered metric alert and resolves its live copy variables in the detail", () => {
  render(<DashboardComponentRenderer
    component={riskAlert}
    fields={[
      { key: "store", label: "店铺", type: "string", nullable: false },
      { key: "riskCount", label: "库存周转与滞销风险", type: "number", nullable: false },
    ]}
    rows={[{ store: "华东店", riskCount: 12 }, { store: "华南店", riskCount: 15 }, { store: "华北店", riskCount: 8 }]}
  />);

  expect(screen.getByText("库存风险 2 项")).toBeTruthy();
  expect(screen.getByText("库存周转与滞销风险偏高")).toBeTruthy();
  expect(screen.getByText("全部店铺｜全部员工｜华东店、华南店等 2 个店铺命中预警。")).toBeTruthy();

  fireEvent.click(screen.getByTestId("metric-alert-surface"));

  expect(screen.getByRole("dialog", { name: "库存风险 2 项详情" })).toBeTruthy();
  expect(screen.getByText("华东店、华南店的库存周转与滞销风险当前值 12，需要优先处理。")).toBeTruthy();
  expect(screen.getByText("华东店")).toBeTruthy();
  expect(screen.getByText("华南店")).toBeTruthy();
  expect(screen.getByText("全部店铺｜全部员工")).toBeTruthy();
});

it("keeps long alert details in a vertically scrollable region", () => {
  render(<DashboardComponentRenderer
    component={riskAlert}
    fields={[
      { key: "store", label: "店铺", type: "string", nullable: false },
      { key: "riskCount", label: "库存周转与滞销风险", type: "number", nullable: false },
    ]}
    rows={Array.from({ length: 36 }, (_, index) => ({ store: `门店 ${index + 1}`, riskCount: index + 12 }))}
  />);

  fireEvent.click(screen.getByTestId("metric-alert-surface"));

  const details = screen.getByTestId("metric-alert-detail-content");
  const tableScroll = screen.getByTestId("metric-alert-triggered-table-scroll");
  expect(details.getAttribute("aria-label")).toBe("预警详情内容");
  expect(details.style.overflow).toBe("hidden");
  expect(details.style.height).toBe("68vh");
  expect(details.style.maxHeight).toBe("560px");
  expect(tableScroll.getAttribute("aria-label")).toBe("命中预警项，可纵向滚动");
  expect(tableScroll.style.overflowY).toBe("auto");
  expect(screen.getByText("门店 36")).toBeTruthy();
});

it("does not render an alert panel when no dimension matches the rule", () => {
  render(<DashboardComponentRenderer
    component={riskAlert}
    fields={[
      { key: "store", label: "店铺", type: "string", nullable: false },
      { key: "riskCount", label: "库存周转与滞销风险", type: "number", nullable: false },
    ]}
    rows={[{ store: "华东店", riskCount: 8 }, { store: "华南店", riskCount: 3 }]}
  />);

  expect(screen.queryByTestId("metric-alert-surface")).toBeNull();
  expect(screen.queryByRole("button", { name: "查看库存周转与滞销风险预警详情" })).toBeNull();
});
