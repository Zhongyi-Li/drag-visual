import { DashboardSchema, type Dashboard } from "./dashboard.js";

export function migrateDashboard(input: unknown): Dashboard {
  if (typeof input !== "object" || input === null || !("schemaVersion" in input)) {
    throw new Error("DASHBOARD_SCHEMA_VERSION_MISSING");
  }
  const version = (input as { schemaVersion: unknown }).schemaVersion;
  if (version !== 1) {
    throw new Error(`DASHBOARD_SCHEMA_VERSION_UNSUPPORTED:${String(version)}`);
  }

  // `progressIndicator` was replaced by the configurable goal-task table.
  // Existing dashboards are stored as JSON and keep schemaVersion 1, so they
  // need this compatibility step before the current schema validates them.
  const draft = input as Record<string, unknown>;
  const components = Array.isArray(draft.components)
    ? draft.components.map((component) => {
      if (
        typeof component === "object" &&
        component !== null &&
        "type" in component &&
        component.type === "progressIndicator"
      ) {
        return { ...component, type: "goalTaskProgress" };
      }
      return component;
    })
    : draft.components;

  return DashboardSchema.parse({ ...draft, components });
}
