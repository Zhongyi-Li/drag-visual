// @vitest-environment jsdom

import type { ComponentInstance } from "@drag-visual/contracts";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { DashboardComponentRenderer } from "./DashboardComponentRenderer.js";

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
