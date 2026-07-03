// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { appRoutes } from "../../app/router.js";
import { server } from "../../mocks/server.js";

const id = "123e4567-e89b-42d3-a456-426614174000";
const dashboard = {
  schemaVersion: 1, id, name: "经营看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [], components: [], datasets: [], revision: 1, updatedAt: "2026-07-03T08:00:00.000Z",
};

const renderEditor = () => {
  const router = createMemoryRouter(appRoutes, { initialEntries: [`/editor/${id}`] });
  render(<AppProviders><RouterProvider router={router} /></AppProviders>);
};

const secondId = "223e4567-e89b-42d3-a456-426614174001";

describe("EditorRoute", () => {
  it("shows loading then the loaded editor", async () => {
    server.use(http.get(`http://localhost/dashboards/${id}`, async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return HttpResponse.json(dashboard);
    }));
    renderEditor();
    expect(await screen.findByRole("status", { name: "正在加载看板" })).toBeInTheDocument();
    expect(await screen.findByText("经营看板")).toBeInTheDocument();
  });

  it("shows an accessible not-found error", async () => {
    server.use(http.get(`http://localhost/dashboards/${id}`, () =>
      HttpResponse.json({ code: "DASHBOARD_NOT_FOUND", message: "missing" }, { status: 404 })));
    renderEditor();
    expect(await screen.findByRole("heading", { name: "看板不存在" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回看板首页" })).toHaveAttribute("href", "/");
  });

  it("offers retry after a server error", async () => {
    let attempts = 0;
    server.use(http.get(`http://localhost/dashboards/${id}`, () => {
      attempts += 1;
      return attempts <= 2
        ? HttpResponse.json({ code: "INTERNAL_ERROR", message: "failed" }, { status: 500 })
        : HttpResponse.json(dashboard);
    }));
    renderEditor();
    expect(await screen.findByRole("heading", { name: "加载看板失败" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText("经营看板")).toBeInTheDocument();
    expect(attempts).toBe(3);
  });

  it("creates a fresh editor store when navigating between cached dashboard ids", async () => {
    const second = { ...dashboard, id: secondId, name: "库存看板" };
    server.use(
      http.get(`http://localhost/dashboards/${id}`, () => HttpResponse.json(dashboard)),
      http.get(`http://localhost/dashboards/${secondId}`, () => HttpResponse.json(second)),
    );
    const router = createMemoryRouter(appRoutes, { initialEntries: [`/editor/${id}`] });
    render(<AppProviders><RouterProvider router={router} /></AppProviders>);
    expect(await screen.findByText("经营看板")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "添加柱图" }));
    expect(screen.getByText("已添加 1 个组件")).toBeInTheDocument();

    await router.navigate(`/editor/${secondId}`);

    expect(await screen.findByText("库存看板")).toBeInTheDocument();
    expect(screen.getByText("从左侧添加图表")).toBeInTheDocument();
    await router.navigate(`/editor/${id}`);
    expect(await screen.findByText("经营看板")).toBeInTheDocument();
  });
});
