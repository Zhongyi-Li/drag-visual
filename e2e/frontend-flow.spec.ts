import { expect, test } from "@playwright/test";

test("creates, saves, and publishes a dashboard to a read-only page", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "新建看板" }).click();
  await page.getByRole("button", { name: "添加柱图" }).click();
  await expect(page.getByText("已添加 1 个组件", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("status", { name: "保存状态" })).toContainText("已保存");

  await page.getByRole("button", { name: "发布", exact: true }).click();
  const publishedLink = page.getByRole("link", { name: "打开发布页" });
  await expect(publishedLink).toBeVisible();
  const publishedPath = await publishedLink.getAttribute("href");
  expect(publishedPath).toMatch(/^\/view\//);
  await publishedLink.evaluate((link, path) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      window.history.pushState(null, "", path);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, { once: true });
    (link as HTMLElement).click();
  }, publishedPath);

  await expect(page.getByRole("heading", { name: "未命名看板" })).toBeVisible();
  await expect(page.getByRole("button", { name: /删除/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "保存", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "发布", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "添加柱图" })).toHaveCount(0);
});
