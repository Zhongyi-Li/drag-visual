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

  it("requires an explicit schema version", () => {
    const { schemaVersion: _schemaVersion, ...withoutVersion } = dashboard;

    expect(() => migrateDashboard(withoutVersion)).toThrow("DASHBOARD_SCHEMA_VERSION_MISSING");
  });

  it("rejects unsupported schema versions before parsing shape details", () => {
    expect(() => migrateDashboard({ ...dashboard, schemaVersion: 2 })).toThrow("DASHBOARD_SCHEMA_VERSION_UNSUPPORTED:2");
  });
});
