// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppProviders } from "./AppProviders.js";
import { appRoutes } from "./router.js";

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<AppProviders><RouterProvider router={router} /></AppProviders>);
};

describe("application routes", () => {
  it.each([
    ["/editor/abc", "看板编辑", "abc"],
    ["/preview/def", "看板预览", "def"],
    ["/view/ghi", "看板查看", "ghi"],
  ])("resolves lazy route %s", async (path, title, dashboardId) => {
    renderRoute(path);
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText(`看板 ID：${dashboardId}`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回看板首页" })).toHaveAttribute("href", "/");
  });

  it("renders an accessible fallback for an unknown route", async () => {
    renderRoute("/missing");
    expect(await screen.findByRole("heading", { name: "页面未找到" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回看板首页" })).toHaveAttribute("href", "/");
  });
});
