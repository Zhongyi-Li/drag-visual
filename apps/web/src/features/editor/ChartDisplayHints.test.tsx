// @vitest-environment jsdom

import type { ComponentInstance } from "@drag-visual/contracts";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { chartTopLeftHint, ChartDisplayHints } from "./ChartDisplayHints.js";

const component = (displayAnnotations: ComponentInstance["displayAnnotations"]): ComponentInstance => ({
  id: "bar-1",
  type: "bar",
  title: "库存分析",
  props: { color: "#1677ff", showLegend: true },
  binding: {
    datasetId: "inventory",
    slots: { measure: [{ fieldKey: "stockQty" }, { fieldKey: "turnoverDays" }] },
  },
  displayAnnotations,
});

it("renders the configured right-side annotation", () => {
  render(<ChartDisplayHints component={component({ annotations: [{ position: "topRight", text: "数量 / 天数" }], unitText: "" })} />);

  expect(screen.getByLabelText("图表辅助说明")).toHaveTextContent("数量 / 天数");
});

it("exposes a left-top annotation for the chart heading instead of the plot overlay", () => {
  const chart = component({ annotations: [{ position: "topLeft", text: "统计口径：已完成订单" }], unitText: "" });
  render(<ChartDisplayHints component={chart} />);

  expect(chartTopLeftHint(chart)).toBe("统计口径：已完成订单");
  expect(screen.queryByText("统计口径：已完成订单")).not.toBeInTheDocument();
});

it("does not render when every configured annotation is empty", () => {
  render(<ChartDisplayHints component={component({ annotations: [{ position: "bottomRight", text: "" }], unitText: "" })} />);

  expect(screen.queryByLabelText("图表辅助说明")).not.toBeInTheDocument();
});

it("renders annotations in all four supported positions", () => {
  render(<ChartDisplayHints component={component({
    annotations: [
      { position: "topLeft", text: "库存看板" },
      { position: "topRight", text: "数量 / 天数" },
      { position: "bottomRight", text: "最高 1,660 件" },
      { position: "bottomLeft", text: "统计口径：已完成订单" },
    ],
    unitText: "",
  })} />);

  const hints = screen.getByLabelText("图表辅助说明");
  expect(hints).not.toHaveTextContent("库存看板");
  expect(hints).toHaveTextContent("数量 / 天数");
  expect(hints).toHaveTextContent("最高 1,660 件");
  expect(hints).toHaveTextContent("统计口径：已完成订单");
});
