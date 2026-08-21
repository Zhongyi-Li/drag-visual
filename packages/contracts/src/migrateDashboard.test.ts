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

  it("requires an explicit schema version", () => {
    const { schemaVersion: _schemaVersion, ...withoutVersion } = dashboard;

    expect(() => migrateDashboard(withoutVersion)).toThrow("DASHBOARD_SCHEMA_VERSION_MISSING");
  });

  it("rejects unsupported schema versions before parsing shape details", () => {
    expect(() => migrateDashboard({ ...dashboard, schemaVersion: 2 })).toThrow("DASHBOARD_SCHEMA_VERSION_UNSUPPORTED:2");
  });
});
