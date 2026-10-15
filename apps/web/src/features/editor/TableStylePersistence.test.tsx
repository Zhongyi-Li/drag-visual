// @vitest-environment jsdom

import { DashboardSchema } from "@drag-visual/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { appRoutes } from "../../app/router.js";
import { server } from "../../mocks/server.js";
import { clearPreviewSnapshot, readPreviewSnapshot } from "../preview/previewSnapshotStore.js";
import { saveAuthSession } from "../auth/authSession.js";

const id = "123e4567-e89b-42d3-a456-426614174000";
const dashboard = {
  schemaVersion: 1, id, name: "经营看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [], components: [], datasets: [], revision: 1, updatedAt: "2026-07-03T08:00:00.000Z",
};

const renderEditor = () => {
  saveAuthSession({ user: { id: "test-user", username: "test", displayName: null, avatarUrl: null } });
  const router = createMemoryRouter(appRoutes, { initialEntries: [`/editor/${id}`] });
  render(<AppProviders><RouterProvider router={router} /></AppProviders>);
  return router;
};

const secondId = "223e4567-e89b-42d3-a456-426614174001";

afterEach(() => { clearPreviewSnapshot(id); vi.restoreAllMocks(); });

it("keeps saved table styles when returning to a cached editor and creating a preview", async () => {
  let saved = DashboardSchema.parse(dashboard);
  server.use(
    http.get(`http://localhost/dashboards/${id}`, () => HttpResponse.json(saved)),
    http.get(`http://localhost/dashboards/${secondId}`, () => HttpResponse.json({ ...dashboard, id: secondId, name: "另一个看板" })),
    http.put(`http://localhost/dashboards/${id}`, async ({ request }) => {
      saved = DashboardSchema.parse({ ...await request.json() as object, revision: saved.revision + 1 });
      return HttpResponse.json(saved);
    }),
  );
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  const router = renderEditor();
  await userEvent.click(await screen.findByRole("button", { name: /通用内容样式/ }, { timeout: 10000 }));
  await userEvent.click(screen.getByRole("button", { name: "简版表格样式" }));
  await userEvent.click(screen.getByRole("button", { name: "表头文字颜色" }));
    await userEvent.click(await screen.findByRole("button", { name: "选择颜色 #a18bfa" }));
    await userEvent.click(screen.getByRole("button", { name: "表头文字颜色" }));
  await userEvent.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(saved.theme.tableStyle?.header.color).toBe("#a18bfa"));
  await router.navigate(`/editor/${secondId}`);
  await screen.findAllByText("另一个看板", {}, { timeout: 10000 });
  await router.navigate(`/editor/${id}`);
  await waitFor(() => expect(screen.queryAllByText("另一个看板")).toHaveLength(0));
  await userEvent.click(await screen.findByRole("button", { name: /通用内容样式/ }, { timeout: 10000 }));
  expect(await screen.findByRole("button", { name: "表头文字颜色" })).toHaveAttribute("data-color", "#a18bfa");
  await userEvent.click(screen.getByRole("button", { name: "预览" }));
  expect(open).toHaveBeenCalled();
  expect(readPreviewSnapshot(id)?.theme.tableStyle?.header.color).toBe("#a18bfa");
});

