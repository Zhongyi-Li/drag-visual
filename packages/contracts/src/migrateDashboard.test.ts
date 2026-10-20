import { describe, expect, it } from "vitest";

import { migrateDashboard } from "./migrateDashboard.js";

const dashboard = {
  schemaVersion: 1 as const,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "经营看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [],
  components: [],
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
};

describe("migrateDashboard", () => {
  it("accepts the current v1 schema", () => {
    expect(migrateDashboard(dashboard)).toEqual(dashboard);
  });

  it.each([true, false])("reads saved dashboards with the retired adjustment flag %s", (presetAdjusted) => {
    const input = { ...dashboard, theme: { ...dashboard.theme, preset: "technology", presetAdjusted } };
    const migrated = migrateDashboard(input);
    expect(migrated.theme).toEqual({ ...dashboard.theme, preset: "technology" });
    expect(input.theme.presetAdjusted).toBe(presetAdjusted);
    expect(migrateDashboard(migrated)).toEqual(migrated);
  });

  it("upgrades the retired progress indicator component", () => {
    const migrated = migrateDashboard({
      ...dashboard,
      layout: [{ i: "legacy-progress", x: 0, y: 0, w: 6, h: 4 }],
      components: [{
        id: "legacy-progress",
        type: "progressIndicator",
        title: "目标任务进度",
        props: { color: "#1677ff" },
      }],
    });

    expect(migrated.components[0]?.type).toBe("goalTaskProgress");
    expect(migrated.components[0]?.props).toEqual({ color: "#1677ff" });
  });

  it("maps legacy font family values to the current identifiers", () => {
    expect(migrateDashboard({ ...dashboard, theme: { ...dashboard.theme, fontFamily: "sans" } }).theme.fontFamily).toBe("system");
    expect(migrateDashboard({ ...dashboard, theme: { ...dashboard.theme, fontFamily: "serif" } }).theme.fontFamily).toBe("source-han-serif");
  });

  it("renames the retired dual-axis default on saved dashboards without changing their data", () => {
    const original = {
      ...dashboard,
      datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
      layout: [{ i: "dual-axis", x: 0, y: 0, w: 12, h: 6 }],
      components: [{
        id: "dual-axis", type: "dualAxisLine", title: "金额与比率双轴折线图",
        props: { rateUnit: "fraction" },
        binding: { datasetId: "sales", slots: { amountMeasure: { fieldKey: "orders" }, rateMeasure: { fieldKey: "conversion" } } },
      }],
    };
    const migrated = migrateDashboard(original);
    expect(migrated.components[0]).toEqual({ ...original.components[0], title: "双轴折线图" });
    expect(original.components[0]?.title).toBe("金额与比率双轴折线图");
    expect(migrateDashboard(migrated)).toEqual(migrated);
  });

  it("preserves custom, empty and omitted dual-axis titles and other component types", () => {
    for (const title of ["订单与转化趋势", "双轴折线图", "", undefined]) {
      const input = { ...dashboard, layout: [{ i: "chart", x: 0, y: 0, w: 12, h: 6 }], components: [{ id: "chart", type: "dualAxisLine", title, props: {} }] };
      expect(migrateDashboard(input).components[0]?.title).toBe(title);
    }
    const otherType = { ...dashboard, layout: [{ i: "chart", x: 0, y: 0, w: 6, h: 5 }], components: [{ id: "chart", type: "line", title: "金额与比率双轴折线图", props: {} }] };
    expect(migrateDashboard(otherType).components[0]?.title).toBe("金额与比率双轴折线图");
  });

  it("requires an explicit schema version", () => {
    const { schemaVersion: _schemaVersion, ...withoutVersion } = dashboard;

    expect(() => migrateDashboard(withoutVersion)).toThrow("DASHBOARD_SCHEMA_VERSION_MISSING");
  });

  it("rejects unsupported schema versions before parsing shape details", () => {
    expect(() => migrateDashboard({ ...dashboard, schemaVersion: 2 })).toThrow("DASHBOARD_SCHEMA_VERSION_UNSUPPORTED:2");
  });
});
