// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { appRoutes } from "../../app/router.js";
import { server } from "../../mocks/server.js";

const id = "123e4567-e89b-42d3-a456-426614174000";
const dashboard = {
  schemaVersion: 1,
  id,
  name: "未命名看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [], components: [], datasets: [], revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
};

const renderHome = () => {
  window.localStorage.setItem("zhbi.auth.session", JSON.stringify({
    accessToken: "test-token",
    user: { id: "test-user", username: "hello_user" },
  }));
  const router = createMemoryRouter(appRoutes, { initialEntries: ["/"] });
  render(<AppProviders><RouterProvider router={router} /></AppProviders>);
  return router;
};

describe("DashboardHome", () => {
  it("renders the workspace controls without a page title and keeps create enabled", () => {
    renderHome();
    expect(screen.queryByRole("heading", { name: "仪表板" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "新建看板" })).toBeEnabled();
  });

  it("shows account actions and signs out from the account menu", async () => {
    const router = renderHome();

    await userEvent.click(screen.getByRole("button", { name: "打开 hello_user 的账号菜单" }));
    expect(await screen.findByText("账号设置")).toBeInTheDocument();
    expect(screen.getByText("切换账号")).toBeInTheDocument();
    await userEvent.click(screen.getByText("退出登录"));

    await waitFor(() => expect(router.state.location.pathname).toBe("/auth"));
    expect(window.localStorage.getItem("zhbi.auth.session")).toBeNull();
  });

  it("creates the default dashboard with pending state then navigates", async () => {
    let body: unknown;
    server.use(http.post("http://localhost/dashboards", async ({ request }) => {
      body = await request.json();
      await new Promise((resolve) => setTimeout(resolve, 50));
      return HttpResponse.json(dashboard, { status: 201 });
    }));
    const router = renderHome();

    await userEvent.click(screen.getByRole("button", { name: "新建看板" }));

    expect(screen.getByRole("button", { name: "正在创建看板" })).toBeDisabled();
    await waitFor(() => expect(router.state.location.pathname).toBe(`/editor/${id}`));
    expect(body).toEqual({ name: "未命名看板" });
  });

  it("retries one 500, shows an alert, then manual retry succeeds", async () => {
    let attempts = 0;
    server.use(http.post("http://localhost/dashboards", () => {
      attempts += 1;
      return attempts <= 2
        ? HttpResponse.json({ code: "INTERNAL_ERROR", message: "failed" }, { status: 500 })
        : HttpResponse.json(dashboard, { status: 201 });
    }));
    const router = renderHome();

    await userEvent.click(screen.getByRole("button", { name: "新建看板" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("创建看板失败");
    expect(attempts).toBe(2);
    await userEvent.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/editor/${id}`));
    expect(attempts).toBe(3);
  });

  it("does not retry a 4xx response", async () => {
    let attempts = 0;
    server.use(http.post("http://localhost/dashboards", () => {
      attempts += 1;
      return HttpResponse.json({ code: "DASHBOARD_SCHEMA_INVALID", message: "bad" }, { status: 400 });
    }));
    renderHome();

    await userEvent.click(screen.getByRole("button", { name: "新建看板" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(attempts).toBe(1);
  });
});
