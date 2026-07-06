// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("saves editor changes through the toolbar", async () => {
    let savedBody: unknown;
    server.use(
      http.get(`http://localhost/dashboards/${id}`, () => HttpResponse.json(dashboard)),
      http.put(`http://localhost/dashboards/${id}`, async ({ request }) => {
        savedBody = await request.json();
        return HttpResponse.json({ ...(savedBody as object), revision: 2, updatedAt: "2026-07-03T09:00:00.000Z" });
      }),
    );
    renderEditor();
    expect(await screen.findByText("经营看板")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "添加柱图" }));
    expect(screen.getByRole("status", { name: "保存状态" })).toHaveTextContent("有未保存更改");

    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("status", { name: "保存状态" })).toHaveTextContent("已保存");
    expect(savedBody).toMatchObject({
      id,
      revision: 1,
      components: [{ id: expect.any(String), type: "bar" }],
    });
  });

  it("shows a revision conflict modal without overwriting local edits", async () => {
    server.use(
      http.get(`http://localhost/dashboards/${id}`, () => HttpResponse.json(dashboard)),
      http.put(`http://localhost/dashboards/${id}`, () =>
        HttpResponse.json({ code: "DASHBOARD_VERSION_CONFLICT", message: "stale" }, { status: 409 })),
    );
    renderEditor();
    expect(await screen.findByText("经营看板")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "添加柱图" }));

    await userEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("dialog", { name: "保存冲突" })).toBeInTheDocument();
    expect(screen.getByText("服务端已有更新，本地未保存内容仍保留。")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "保存状态" })).toHaveTextContent("保存失败");
  });

  it("publishes only after the dirty draft is saved", async () => {
    let published = false;
    server.use(
      http.get(`http://localhost/dashboards/${id}`, () => HttpResponse.json(dashboard)),
      http.put(`http://localhost/dashboards/${id}`, async ({ request }) => {
        const body = await request.json();
        return HttpResponse.json({ ...(body as object), revision: 2, updatedAt: "2026-07-03T09:00:00.000Z" });
      }),
      http.post(`http://localhost/dashboards/${id}/publish`, () => {
        published = true;
        return HttpResponse.json({ ...dashboard, revision: 2, updatedAt: "2026-07-03T09:00:00.000Z" });
      }),
    );
    renderEditor();
    expect(await screen.findByText("经营看板")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "添加柱图" }));

    await userEvent.click(screen.getByRole("button", { name: "发布" }));

    expect(await screen.findByText("发布成功")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开发布页" })).toHaveAttribute("href", `/view/${id}`);
    expect(published).toBe(true);
  });

  it("shows a sanitized alert when publishing fails", async () => {
    server.use(
      http.get(`http://localhost/dashboards/${id}`, () => HttpResponse.json(dashboard)),
      http.post(`http://localhost/dashboards/${id}/publish`, () =>
        HttpResponse.json({ code: "PUBLISH_FAILED", message: "sensitive upstream detail" }, { status: 500 })),
    );
    renderEditor();
    expect(await screen.findByText("经营看板")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "发布" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("发布失败");
    expect(screen.queryByText("sensitive upstream detail")).not.toBeInTheDocument();
  });

  it("saves before opening preview", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    let saved = false;
    server.use(
      http.get(`http://localhost/dashboards/${id}`, () => HttpResponse.json(dashboard)),
      http.put(`http://localhost/dashboards/${id}`, async ({ request }) => {
        const body = await request.json();
        saved = true;
        return HttpResponse.json({ ...(body as object), revision: 2, updatedAt: "2026-07-03T09:00:00.000Z" });
      }),
    );
    renderEditor();
    expect(await screen.findByText("经营看板")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "添加柱图" }));

    await userEvent.click(screen.getByRole("button", { name: "预览" }));

    expect(open).toHaveBeenCalledWith(`/preview/${id}`, "_blank", "noopener,noreferrer");
    expect(saved).toBe(true);
  });

  it("does not open preview when saving the dirty draft fails", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    server.use(
      http.get(`http://localhost/dashboards/${id}`, () => HttpResponse.json(dashboard)),
      http.put(`http://localhost/dashboards/${id}`, () =>
        HttpResponse.json({ code: "INTERNAL_ERROR", message: "save failed" }, { status: 500 })),
    );
    renderEditor();
    expect(await screen.findByText("经营看板")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "添加柱图" }));

    await userEvent.click(screen.getByRole("button", { name: "预览" }));

    await screen.findByText("保存失败");
    expect(open).not.toHaveBeenCalled();
  });

  it("does not publish when saving the dirty draft fails", async () => {
    let publishRequests = 0;
    server.use(
      http.get(`http://localhost/dashboards/${id}`, () => HttpResponse.json(dashboard)),
      http.put(`http://localhost/dashboards/${id}`, () =>
        HttpResponse.json({ code: "INTERNAL_ERROR", message: "save failed" }, { status: 500 })),
      http.post(`http://localhost/dashboards/${id}/publish`, () => {
        publishRequests += 1;
        return HttpResponse.json(dashboard);
      }),
    );
    renderEditor();
    expect(await screen.findByText("经营看板")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "添加柱图" }));

    await userEvent.click(screen.getByRole("button", { name: "发布" }));

    await screen.findByText("保存失败");
    expect(publishRequests).toBe(0);
    expect(screen.queryByText("发布成功")).not.toBeInTheDocument();
  });
});
