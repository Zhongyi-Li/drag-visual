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
  // Older editor builds stored the generic sans-serif choice as `sans`.
  // Keep those persisted dashboards readable after the font-family enum was
  // expanded to the web-font identifiers used by the current editor.
  const theme = typeof draft.theme === "object" && draft.theme !== null
    ? { ...(draft.theme as Record<string, unknown>) }
    : draft.theme;
  // Saved dashboards may retain the flag from the removed theme-reset row.
  // Drop it before strict validation without changing the persisted input.
  if (theme && typeof theme === "object" && "presetAdjusted" in theme) {
    delete theme.presetAdjusted;
  }
  if (theme && typeof theme === "object" && "fontFamily" in theme) {
    const legacyFont = theme.fontFamily;
    if (legacyFont === "sans" || legacyFont === "serif") {
      theme.fontFamily = legacyFont === "serif" ? "source-han-serif" : "system";
    }
  }
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
      // The first dual-axis release persisted this default as an instance
      // title. Updating the registry alone cannot rename saved dashboards.
      // Match only that retired default; leave authored and empty titles alone.
      if (
        typeof component === "object" &&
        component !== null &&
        "type" in component &&
        component.type === "dualAxisLine" &&
        "title" in component &&
        component.title === "金额与比率双轴折线图"
      ) {
        return { ...component, title: "双轴折线图" };
      }
      return component;
    })
    : draft.components;

  return DashboardSchema.parse({ ...draft, theme, components });
}
