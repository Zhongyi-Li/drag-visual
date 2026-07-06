import { expect, test } from "@playwright/test";

import { navigateClientSide, seedDashboard, setScenario } from "./helpers.js";

const dashboardId = "123e4567-e89b-42d3-a456-426614174000";

const boundDashboard = {
  schemaVersion: 1,
  id: dashboardId,
  name: "销售看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "kpi-1", x: 0, y: 0, w: 3, h: 3 }],
  components: [{
    id: "kpi-1",
    type: "kpi",
    title: "总收入",
    props: { aggregation: "first", prefix: "¥", suffix: "", decimals: 0 },
    binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" } } },
  }],
  datasets: [{
    datasetId: "sales",
    schemaVersion: "v1",
    parameters: { year: 2026, fromDate: "2026-01-01" },
  }],
  revision: 1,
  updatedAt: "2026-07-05T08:00:00.000Z",
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("keeps preview visible when a component query times out", async ({ page }) => {
  await seedDashboard(page, boundDashboard);
  await setScenario(page, "dataset-timeout");

  await navigateClientSide(page, `/preview/${dashboardId}`);

  await expect(page.getByRole("heading", { name: "销售看板" })).toBeVisible();
  await expect(page.getByText("查询组件数据失败")).toBeVisible();
});

test("preserves local edits when saving hits a revision conflict", async ({ page }) => {
  await page.getByRole("button", { name: "新建看板" }).click();
  await page.getByRole("button", { name: "添加柱图" }).click();
  await setScenario(page, "revision-conflict");

  await page.getByRole("button", { name: "保存", exact: true }).click();

  await expect(page.getByRole("dialog", { name: "保存冲突" })).toBeVisible();
  await expect(page.getByRole("status", { name: "保存状态" })).toContainText("保存失败");
  await expect(page.getByText("已添加 1 个组件", { exact: true })).toBeVisible();
});

test("warns when a saved binding references a removed field", async ({ page }) => {
  await seedDashboard(page, boundDashboard);
  await setScenario(page, "schema-v2");

  await navigateClientSide(page, `/preview/${dashboardId}`);

  await expect(page.getByText("数据绑定需要检查")).toBeVisible();
  await expect(page.getByText("字段 revenue 已不存在")).toBeVisible();
});

test("keeps the previous published snapshot after a later publish fails", async ({ page }) => {
  await seedDashboard(page, boundDashboard);
  await navigateClientSide(page, `/editor/${dashboardId}`);

  await page.getByRole("button", { name: "发布", exact: true }).click();
  const publishedLink = page.getByRole("link", { name: "打开发布页" });
  await expect(publishedLink).toBeVisible();
  const publishedPath = await publishedLink.getAttribute("href");
  expect(publishedPath).toBe(`/view/${dashboardId}`);

  await page.getByRole("button", { name: "添加柱图" }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status", { name: "保存状态" })).toContainText("已保存");
  await setScenario(page, "publish-failure");
  await page.getByRole("button", { name: "发布", exact: true }).click();

  await expect(page.getByText("发布失败")).toBeVisible();
  await publishedLink.click();
  await expect(page.getByRole("heading", { name: "销售看板" })).toBeVisible();
});

test("restores saved components after a reload", async ({ page }) => {
  await page.getByRole("button", { name: "新建看板" }).click();
  await page.getByRole("button", { name: "添加柱图" }).click();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status", { name: "保存状态" })).toContainText("已保存");

  await page.reload();

  await expect(page.getByText("已添加 1 个组件", { exact: true })).toBeVisible();
});
