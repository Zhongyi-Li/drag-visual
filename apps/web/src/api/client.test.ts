import { DashboardSchema } from "@drag-visual/contracts";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, it } from "vitest";

import { ApiError } from "./ApiError.js";
import { createApiClient } from "./client.js";
import { server } from "../mocks/server.js";

describe("API client", () => {
  afterEach(() => server.resetHandlers());

  it("normalizes the base URL and request path while preserving and defaulting headers", async () => {
    let captured: Request | undefined;
    server.use(
      http.post("http://api.test/dashboards", async ({ request }) => {
        captured = request;
        return HttpResponse.json({ ok: true });
      }),
    );

    const client = createApiClient("http://api.test///");
    await client.request("///dashboards", {
      method: "POST",
      headers: { "X-Trace": "trace", Accept: "application/problem+json" },
      body: JSON.stringify({ name: "test" }),
    });

    expect(captured?.url).toBe("http://api.test/dashboards");
    expect(captured?.headers.get("x-trace")).toBe("trace");
    expect(captured?.headers.get("accept")).toBe("application/problem+json");
    expect(captured?.headers.get("content-type")).toBe("application/json");
  });

  it("does not add Content-Type to bodyless requests or replace a caller value", async () => {
    const contentTypes: Array<string | null> = [];
    server.use(
      http.all("http://api.test/headers", ({ request }) => {
        contentTypes.push(request.headers.get("content-type"));
        return HttpResponse.json({ ok: true });
      }),
    );
    const client = createApiClient("http://api.test");

    await client.request("headers");
    await client.request("headers", {
      method: "POST",
      body: "plain",
      headers: { "Content-Type": "text/plain" },
    });

    expect(contentTypes).toEqual([null, "text/plain"]);
  });

  it.each([200, 502])("maps malformed JSON at status %s without leaking SyntaxError", async (status) => {
    server.use(
      http.get("http://api.test/broken", () =>
        new HttpResponse("not-json", { status, headers: { "Content-Type": "application/json" } }),
      ),
    );

    await expect(createApiClient("http://api.test").request("broken")).rejects.toMatchObject({
      status,
      code: "INTERNAL_ERROR",
      message: "Response was not valid JSON",
    });
  });

  it("maps a non-JSON non-empty successful response", async () => {
    server.use(http.get("http://api.test/plain", () => new HttpResponse("okay", { status: 200, headers: { "Content-Type": "text/plain" } })));

    await expect(createApiClient("http://api.test").request("plain")).rejects.toMatchObject({
      status: 200,
      code: "INTERNAL_ERROR",
      message: "Response was not JSON",
    });
  });

  it.each([
    ["valid JSON with the wrong shape", "application/json", JSON.stringify({ error: "secret" })],
    ["non-JSON", "text/html", "upstream secret"],
  ])("maps an invalid error body: %s", async (_label, type, body) => {
    server.use(http.get("http://api.test/invalid-error", () => new HttpResponse(body, { status: 503, headers: { "Content-Type": type } })));

    await expect(createApiClient("http://api.test").request("invalid-error")).rejects.toMatchObject({
      status: 503,
      code: "INTERNAL_ERROR",
      message: "Request failed",
    });
  });

  it("returns null for an empty successful response", async () => {
    server.use(http.post("http://api.test/empty-success", () => new HttpResponse(null, { status: 204 })));

    await expect(createApiClient("http://api.test").request("empty-success", { method: "POST" })).resolves.toBeNull();
  });

  it("maps an empty failed response", async () => {
    server.use(http.get("http://api.test/empty-error", () => new HttpResponse(null, { status: 504 })));

    await expect(createApiClient("http://api.test").request("empty-error")).rejects.toMatchObject({
      status: 504,
      code: "INTERNAL_ERROR",
      message: "Request failed",
    });
  });

  it("preserves a valid API error status, code, and message", async () => {
    server.use(
      http.get("http://api.test/missing", () =>
        HttpResponse.json(
          { code: "DASHBOARD_NOT_FOUND", message: "Dashboard was not found" },
          { status: 404 },
        ),
      ),
    );

    await expect(createApiClient("http://api.test").request("missing")).rejects.toMatchObject({
      status: 404,
      code: "DASHBOARD_NOT_FOUND",
      message: "Dashboard was not found",
    });
  });

  it("returns JSON that the endpoint boundary parses as DashboardSchema", async () => {
    const dashboard = {
      schemaVersion: 1,
      id: "6c614d7a-386b-4f36-a9ad-f9305b255b4f",
      name: "销售看板",
      theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
      layout: [], components: [], datasets: [], revision: 1,
      updatedAt: "2026-07-02T08:00:00.000Z",
    };
    server.use(http.get("http://api.test/dashboards/1", () => HttpResponse.json(dashboard)));

    const result = await createApiClient("http://api.test").request("dashboards/1");

    expect(DashboardSchema.parse(result)).toEqual(dashboard);
  });
});
