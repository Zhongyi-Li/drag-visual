import type { Page } from "@playwright/test";

const waitForMockWorker = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () => navigator.serviceWorker?.controller != null,
    undefined,
    { timeout: 5_000 },
  );
};

export const navigateClientSide = async (page: Page, path: string): Promise<void> => {
  await page.goto(path);
  await waitForMockWorker(page);
};

export const setScenario = async (page: Page, scenario: string): Promise<void> => {
  await waitForMockWorker(page);
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
  await waitForMockWorker(page);
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
