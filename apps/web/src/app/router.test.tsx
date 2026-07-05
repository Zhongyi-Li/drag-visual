// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppProviders } from "./AppProviders.js";
import { appRoutes } from "./router.js";
import { server } from "../mocks/server.js";

const dashboard = {
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "经营看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
  components: [{ id: "bar-1", type: "bar", title: "月收入", props: { color: "#1677ff", showLegend: true } }],
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
};

const renderRoute = (path: string) => {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<AppProviders><RouterProvider router={router} /></AppProviders>);
};

describe("application routes", () => {
  it("loads a preview route from the draft dashboard API", async () => {
    server.use(http.get(`http://localhost/dashboards/${dashboard.id}`, () => HttpResponse.json(dashboard)));

    renderRoute(`/preview/${dashboard.id}`);

    expect(await screen.findByRole("heading", { name: "经营看板" })).toBeInTheDocument();
    expect(screen.getByText("月收入")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回看板首页" })).toHaveAttribute("href", "/");
  });

  it("loads a published route from the published snapshot API", async () => {
    server.use(http.get(`http://localhost/published-dashboards/${dashboard.id}`, () => HttpResponse.json({ ...dashboard, name: "发布看板" })));

    renderRoute(`/view/${dashboard.id}`);

    expect(await screen.findByRole("heading", { name: "发布看板" })).toBeInTheDocument();
    expect(screen.getByText("月收入")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回看板首页" })).toHaveAttribute("href", "/");
  });

  it("renders an accessible fallback for an unknown route", async () => {
    renderRoute("/missing");
    expect(await screen.findByRole("heading", { name: "页面未找到" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回看板首页" })).toHaveAttribute("href", "/");
  });
});
