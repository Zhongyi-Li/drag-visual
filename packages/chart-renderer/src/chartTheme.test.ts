import { describe, expect, it } from "vitest";

import { applyChartTheme } from "./chartTheme.js";

describe("applyChartTheme", () => {
  it("replaces series palette and darkens chart chrome", () => {
    const result = applyChartTheme({
      color: ["#old"],
      backgroundColor: "#fff",
      textStyle: { color: "#475569" },
      series: [{ itemStyle: { color: "#old" } }, { lineStyle: { color: "#old" } }],
    }, { primaryColor: "#5b8ff9", backgroundColor: "#0f172a", mode: "dark", chartPalette: ["#112233", "#445566"] });
    expect(result).toMatchObject({
      color: ["#112233", "#445566"],
      backgroundColor: "transparent",
      textStyle: { color: "#dbe7f5" },
      series: [{ itemStyle: { color: "#112233" } }, { lineStyle: { color: "#445566" } }],
    });
  });
});
