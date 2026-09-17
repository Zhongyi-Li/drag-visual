import { describe, expect, it } from "vitest";

import { pageSurfaceStyle } from "./dashboardPageLayout.js";

const dashboard = {
  name: "测试看板",
  revision: 1,
  theme: {
    backgroundColor: "#f5f7fa",
    pageLayout: {
      backgroundImageEnabled: true,
      backgroundImage: "data:image/png;base64,ZmFrZQ==",
    },
  },
};

describe("pageSurfaceStyle", () => {
  it("uses the image as the exclusive, cover background when enabled", () => {
    expect(pageSurfaceStyle(dashboard)).toMatchObject({
      backgroundColor: "transparent",
      backgroundImage: 'url("data:image/png;base64,ZmFrZQ==")',
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
    });
  });

  it("uses the wide preset and custom four-sided margins", () => {
    expect(pageSurfaceStyle({ ...dashboard, theme: { ...dashboard.theme, pageLayout: { marginPreset: "wide" } } })).toHaveProperty("padding", "8px");
    expect(pageSurfaceStyle({ ...dashboard, theme: { ...dashboard.theme, pageLayout: { marginPreset: "custom", customMargins: { top: 40, right: 12, bottom: 10, left: 12 } } } })).toHaveProperty("padding", "40px 12px 10px 12px");
  });

  it("keeps the page background as tall as the visible canvas in content mode", () => {
    expect(pageSurfaceStyle({
      ...dashboard,
      theme: { ...dashboard.theme, pageLayout: { layoutMode: "fitContent" } },
    })).toHaveProperty("minHeight", "calc(100vh - 48px)");
    expect(pageSurfaceStyle({
      ...dashboard,
      theme: { ...dashboard.theme, pageLayout: { layoutMode: "fitContent" } },
    }, { editor: true })).toHaveProperty("minHeight", "calc(100vh - 96px)");
  });
});
