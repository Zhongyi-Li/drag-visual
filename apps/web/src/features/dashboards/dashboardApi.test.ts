import { DashboardSchema } from "@drag-visual/contracts";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { createApiClient } from "../../api/client.js";
import { server } from "../../mocks/server.js";
import {
  createDashboard,
  getDashboard,
  getPublishedDashboard,
  publishDashboard,
  saveDashboard,
} from "./dashboardApi.js";

const dashboard = {
  schemaVersion: 1 as const,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "测试看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [],
  components: [],
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
};

describe("dashboardApi", () => {
  it.each([
    [undefined, {}],
    [null, { name: null }],
    ["销售概览", { name: "销售概览" }],
  ])("posts the correct create body for %s", async (name, expectedBody) => {
    let body: unknown;
    server.use(http.post("http://localhost/dashboards", async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(dashboard, { status: 201 });
    }));

    const result = await createDashboard(name, createApiClient("http://localhost"));

    expect(body).toEqual(expectedBody);
    expect(result).toEqual(DashboardSchema.parse(dashboard));
  });

  it("loads and parses a dashboard", async () => {
    server.use(http.get(`http://localhost/dashboards/${dashboard.id}`, () => HttpResponse.json(dashboard)));

    await expect(getDashboard(dashboard.id, createApiClient("http://localhost"))).resolves.toEqual(dashboard);
  });

  it("rejects an invalid dashboard response", async () => {
    server.use(http.get(`http://localhost/dashboards/${dashboard.id}`, () => HttpResponse.json({ ...dashboard, revision: 0 })));

    await expect(getDashboard(dashboard.id, createApiClient("http://localhost"))).rejects.toThrow();
  });

  it("saves a dashboard with PUT and parses the incremented revision", async () => {
    let body: unknown;
    server.use(http.put(`http://localhost/dashboards/${dashboard.id}`, async ({ request }) => {
      body = await request.json();
      return HttpResponse.json({ ...dashboard, revision: 2 });
    }));

    await expect(saveDashboard(dashboard, createApiClient("http://localhost"))).resolves.toMatchObject({ revision: 2 });
    expect(body).toEqual(dashboard);
  });

  it("publishes and reads the published dashboard snapshot", async () => {
    server.use(
      http.post(`http://localhost/dashboards/${dashboard.id}/publish`, () => HttpResponse.json(dashboard)),
      http.get(`http://localhost/published-dashboards/${dashboard.id}`, () => HttpResponse.json({ ...dashboard, name: "发布快照" })),
    );

    await expect(publishDashboard(dashboard.id, createApiClient("http://localhost"))).resolves.toEqual(dashboard);
    await expect(getPublishedDashboard(dashboard.id, createApiClient("http://localhost"))).resolves.toMatchObject({ name: "发布快照" });
  });
});
