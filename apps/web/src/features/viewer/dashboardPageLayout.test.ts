import { describe, expect, it } from "vitest";

import { pageSurfaceStyle } from "./dashboardPageLayout.js";

const dashboard = {
  name: "测试看板",
  revision: 1,
  theme: {
    backgroundColor: "#f5f7fa",
    pageLayout: {
      backgroundColorEnabled: true,
      backgroundImageEnabled: true,
      backgroundImage: "data:image/png;base64,ZmFrZQ==",
    },
  },
};

describe("pageSurfaceStyle", () => {
  it("renders background colors and images together for every theme source", () => {
    for (const preset of ["default", "deepBlue", "technology", "minimal", "custom"]) {
      const themed = { ...dashboard, theme: { ...dashboard.theme, preset, backgroundColor: "#eefbfc", pageLayout: { ...dashboard.theme.pageLayout, backgroundColorEnabled: true } } };
      expect(pageSurfaceStyle(themed)).toMatchObject({ backgroundColor: "#eefbfc", backgroundImage: 'url("data:image/png;base64,ZmFrZQ==")' });
    }
  });
  it("uses a cover image with the configured base color", () => {
    expect(pageSurfaceStyle(dashboard)).toMatchObject({
      backgroundColor: "#f5f7fa",
      backgroundImage: 'url("data:image/png;base64,ZmFrZQ==")',
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
    });
  });

  it("uses a transparent page surface when both background choices are disabled", () => {
    expect(pageSurfaceStyle({
      ...dashboard,
      theme: {
        ...dashboard.theme,
        pageLayout: { backgroundColorEnabled: false, backgroundImageEnabled: false },
      },
    })).toMatchObject({
      backgroundColor: "transparent",
      backgroundImage: undefined,
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

 it("renders the built-in activity decoration as the page image", () => {
   expect(pageSurfaceStyle({ ...dashboard, theme: { backgroundColor: "#ff8844", preset: "activity", pageLayout: { backgroundImageEnabled: true, backgroundImage: "/theme-backgrounds/activity.svg" } } }).backgroundImage).toBe('url("/theme-backgrounds/activity.svg")');
 });
