import type { Page } from "@playwright/test";

export const setScenario = async (page: Page, scenario: string): Promise<void> => {
  const response = await page.evaluate(async (value) => {
    const result = await fetch("/__mock/scenario", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario: value }),
    });
    return { ok: result.ok, status: result.status };
  }, scenario);
  if (!response.ok) throw new Error(`SCENARIO_SETUP_FAILED: ${response.status}`);
};

export const seedDashboard = async (page: Page, dashboard: unknown): Promise<void> => {
  const response = await page.evaluate(async (value) => {
    const result = await fetch("/__mock/dashboards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
    return { ok: result.ok, status: result.status };
  }, dashboard);
  if (!response.ok) throw new Error(`DASHBOARD_SEED_FAILED: ${response.status}`);
};
