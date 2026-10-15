import { DashboardTableStyle } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";
import { tablePresentation } from "./tablePresentation.js";

const theme = { primaryColor: "#1677ff", backgroundColor: "#ffffff" };

describe("page table presentation", () => {
  it("applies text transparency independently without fading row backgrounds", () => {
    const result = tablePresentation({ ...theme, tableStyle: DashboardTableStyle.parse({ header: { color: "#9254de", opacity: 0.5 }, body: { opacity: 0 } }) })!;
    expect(result.header.color).toBe("rgba(146, 84, 222, 0.5)");
    expect(result.body.color).toBe("rgba(30, 41, 59, 0)");
    expect(result.row(0)).toEqual({ background: "#ffffff" });
  });
  it("uses custom palette opacity for table accents without fading content", () => {
    const result = tablePresentation({ ...theme, tableStyle: DashboardTableStyle.parse({ preset: "grid", colorScheme: "custom", customColor: "#36c99a", customOpacity: 0.5 }) })!;
    expect(result.header.background).toBe("rgba(54, 201, 154, 0.5)");
    expect(result.body.color).toBe("#1e293b");
    expect(result.row(1).background).toBe("rgb(249, 253, 252)");
  });
  it("leaves dashboards without table configuration unchanged", () => {
    expect(tablePresentation(theme)).toBeUndefined();
    expect(tablePresentation(undefined)).toBeUndefined();
  });
  it("provides distinct borders and fills for all four presets", () => {
    const get = (preset: string) => tablePresentation({ ...theme, tableStyle: DashboardTableStyle.parse({ preset }) })!;
    expect(get("default").header.background).toBe("#ffffff");
    expect(get("default").header.borderBottom).toBe("1px solid #1677ff");
    expect(get("default").body.borderBottom).toBe("none");
    expect(get("grid").header.background).toBe("#1677ff");
    expect(get("grid").body.borderRight).toContain("1px solid");
    expect(get("grid").table.border).toContain("1px solid");
    expect(get("default").row(0)).not.toEqual(get("default").row(1));
    expect(get("simple").table.borderTop).toBe("1px solid #1677ff");
    expect(get("simple").body.borderBottom).toBe("none");
    expect(get("simple").body.borderRight).toBe("none");
    expect(get("simple").row(0)).not.toEqual(get("simple").row(1));
    expect(get("grid").row(0)).not.toEqual(get("grid").row(1));
    expect(get("minimal").header.borderBottom).toBe("none");
    expect(get("minimal").body.borderRight).toBe("none");
    expect(get("minimal").row(0)).not.toEqual(get("minimal").row(1));
  });
  it("inherits theme color live while gray and custom colors stay independent", () => {
    const get = (primaryColor: string, colorScheme: string) => tablePresentation({ ...theme, primaryColor, tableStyle: DashboardTableStyle.parse({ preset: "simple", colorScheme, customColor: "#36c99a" }) })!;
    expect(get("#ff0000", "theme").table.borderTop).toBe("1px solid #ff0000");
    expect(get("#ff0000", "gray").table.borderTop).toBe("1px solid #8c8c8c");
    expect(get("#ff0000", "custom").table.borderTop).toBe("1px solid #36c99a");
  });
  it("keeps header and content typography independent and adapts to dark mode", () => {
    const result = tablePresentation({ ...theme, mode: "dark", tableStyle: DashboardTableStyle.parse({ header: { color: "#112233", fontSize: 18, italic: true }, body: { fontSize: 14, bold: true } }) })!;
    expect(result.header).toMatchObject({ color: "#112233", fontSize: 18, fontStyle: "italic", fontWeight: 400 });
    expect(result.body).toMatchObject({ color: "#e2e8f0", fontSize: 14, fontWeight: 700 });
    expect(result.heatmap).not.toHaveProperty("background");
  });
});
