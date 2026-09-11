import { describe, expect, it } from "vitest";

import { applyChartTheme } from "./chartTheme.js";

describe("applyChartTheme", () => {
  it("switches gradient fills to solid colors", () => {
    const option = { series: [{ itemStyle: { color: "#000000" } }] };
    const theme = { primaryColor: "#1677ff", backgroundColor: "#ffffff", chartPalette: ["#112233"] };
    expect(applyChartTheme(option, { ...theme, chartGradient: true })).toMatchObject({ series: [{ itemStyle: { color: { type: "linear" } } }] });
    expect(applyChartTheme(option, { ...theme, chartGradient: false })).toMatchObject({ series: [{ itemStyle: { color: "#112233" } }] });
  });
  it("replaces series palette and darkens chart chrome", () => {
    const result = applyChartTheme({
      color: ["#old"],
      backgroundColor: "#fff",
      textStyle: { color: "#475569" },
      series: [{ itemStyle: { color: "#old" } }, { lineStyle: { color: "#old" } }],
    }, { primaryColor: "#5b8ff9", backgroundColor: "#0f172a", mode: "dark", chartPalette: ["#112233", "#445566"], chartGradient: false });
    expect(result).toMatchObject({
      color: ["#112233", "#445566"],
      backgroundColor: "transparent",
      textStyle: { color: "#dbe7f5" },
      series: [{ itemStyle: { color: "#112233" } }, { lineStyle: { color: "#445566" } }],
    });
  });
});
