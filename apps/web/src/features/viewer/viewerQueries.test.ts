// @vitest-environment jsdom

import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";

import { server } from "../../mocks/server.js";
import { clearPreviewSnapshot, writePreviewSnapshot } from "../preview/previewSnapshotStore.js";
import { getPreviewDashboard } from "./viewerQueries.js";

const id = "123e4567-e89b-42d3-a456-426614174000";
const dashboard = {
  schemaVersion: 1 as const,
  id,
  name: "保存草稿",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [],
  components: [],
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
};

describe("viewerQueries", () => {
  afterEach(() => clearPreviewSnapshot(id));

  it("uses the local preview snapshot before the saved draft", async () => {
    let requestedDraft = false;
    server.use(http.get(`http://localhost/dashboards/${id}`, () => {
      requestedDraft = true;
      return HttpResponse.json(dashboard);
    }));
    writePreviewSnapshot({
      ...dashboard,
      name: "实时预览",
      components: [{ id: "kpi-1", type: "kpi", title: "指标看板", props: {} }],
      layout: [{ i: "kpi-1", x: 0, y: 0, w: 3, h: 3 }],
    });

    await expect(getPreviewDashboard(id)).resolves.toMatchObject({ name: "实时预览", components: [{ type: "kpi" }] });
    expect(requestedDraft).toBe(false);
  });

  it("falls back to the saved draft when no local preview snapshot exists", async () => {
    server.use(http.get(`http://localhost/dashboards/${id}`, () => HttpResponse.json(dashboard)));

    await expect(getPreviewDashboard(id)).resolves.toMatchObject({ name: "保存草稿" });
  });
});
