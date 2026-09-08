import type { ComponentInstance } from "@drag-visual/contracts";
import { expect, it } from "vitest";

import { applyComponentFieldStyle } from "./fieldStyle.js";

it("applies dimension, metric name, and metric value styles to chart semantics", () => {
  const component: ComponentInstance = {
    id: "bar-1",
    type: "bar",
    title: "销售额",
    props: {},
    fieldStyle: {
      enabled: true,
      dimension: { color: "#123456", fontSize: 11, fontWeight: "bold", fontStyle: "italic" },
      metricName: { color: "#234567", fontSize: 13, fontWeight: "normal", fontStyle: "italic" },
      metricValue: { color: "#345678", fontSize: 18, fontWeight: "bold", fontStyle: "normal" },
    },
  };
  const option = applyComponentFieldStyle({
    xAxis: { type: "category", axisLabel: { rotate: 30 } },
    yAxis: { type: "value", axisLabel: { formatter: "{value}" } },
    legend: { textStyle: { lineHeight: 18 } },
    series: [{ type: "bar", label: { show: true } }],
  }, component) as Record<string, any>;

  expect(option.xAxis.axisLabel).toMatchObject({ color: "#123456", fontSize: 11, fontWeight: "bold", fontStyle: "italic", rotate: 30 });
  expect(option.yAxis.axisLabel).toMatchObject({ color: "#345678", fontSize: 18, fontWeight: "bold", formatter: "{value}" });
  expect(option.legend.textStyle).toMatchObject({ color: "#234567", fontSize: 13, fontStyle: "italic", lineHeight: 18 });
  expect(option.series[0].label).toMatchObject({ color: "#345678", fontSize: 18, fontWeight: "bold", show: true });
});
