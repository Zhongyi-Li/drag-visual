import { DashboardSchema, type Dashboard } from "./dashboard.js";

export function migrateDashboard(input: unknown): Dashboard {
  if (typeof input !== "object" || input === null || !("schemaVersion" in input)) {
    throw new Error("DASHBOARD_SCHEMA_VERSION_MISSING");
  }
  const version = (input as { schemaVersion: unknown }).schemaVersion;
  if (version !== 1) {
    throw new Error(`DASHBOARD_SCHEMA_VERSION_UNSUPPORTED:${String(version)}`);
  }
  return DashboardSchema.parse(input);
}
