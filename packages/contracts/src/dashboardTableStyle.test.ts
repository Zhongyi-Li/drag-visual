import { describe, expect, it } from "vitest";
import { DashboardSchema, DashboardTableStyle } from "./dashboard.js";

const dashboard = {
  schemaVersion: 1, id: "123e4567-e89b-42d3-a456-426614174000", name: "表格测试",
  theme: { primaryColor: "#1677ff", backgroundColor: "#ffffff" },
  layout: [], components: [], datasets: [], revision: 1, updatedAt: "2026-07-03T08:00:00.000Z",
};
describe("dashboard table configuration", () => {
  it("keeps old dashboards compatible and round trips saved table settings", () => {
    expect(DashboardSchema.parse(dashboard).theme.tableStyle).toBeUndefined();
    const settings = DashboardTableStyle.parse({ preset: "simple", colorScheme: "custom", header: { fontSize: 18, bold: true } });
    const saved = DashboardSchema.parse({ ...dashboard, theme: { ...dashboard.theme, tableStyle: settings } });
    expect(DashboardSchema.parse(JSON.parse(JSON.stringify(saved))).theme.tableStyle).toEqual(settings);
  });
  it("rejects invalid colors, fonts, presets and font sizes", () => {
    for (const input of [{ preset: "invalid" }, { customColor: "red" }, { body: { fontSize: 49 } }, { header: { fontFamily: "arbitrary" } }]) {
      expect(DashboardTableStyle.safeParse(input).success).toBe(false);
    }
  });
});
