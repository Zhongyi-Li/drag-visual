import { DashboardSchema, Dataset, DatasetQueryResult, DatasetSummary, ErrorResponse } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import { ApiError } from "../api/ApiError.js";
import { createApiClient } from "../api/client.js";

const client = createApiClient("http://api.test");

const request = <T = unknown>(path: string, init?: RequestInit) => client.request<T>(path, init);
const jsonRequest = (method: string, body: unknown, headers?: HeadersInit): RequestInit => ({
  method,
  ...(headers === undefined ? {} : { headers }),
  body: JSON.stringify(body),
});

describe("stateful dashboard mock contract", () => {
  it.each([{}, { name: null }, { name: "   " }])("creates a complete default dashboard from %j", async (body) => {
    const dashboard = await request("dashboards", jsonRequest("POST", body));
    const parsed = DashboardSchema.parse(dashboard);
    expect(parsed).toMatchObject({
      name: "未命名看板",
      revision: 1,
      theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
      layout: [], components: [], datasets: [],
    });
  });

  it("trims a nonblank create name", async () => {
    const dashboard = DashboardSchema.parse(await request("dashboards", jsonRequest("POST", { name: "  销售  " })));
    expect(dashboard.name).toBe("销售");
  });

  it("rejects malformed dashboard IDs before store access and distinguishes a missing UUID", async () => {
    await expect(request("dashboards/not-a-uuid")).rejects.toMatchObject({
      status: 400, code: "DASHBOARD_SCHEMA_INVALID",
    });
    await expect(request("dashboards/6c614d7a-386b-4f36-a9ad-f9305b255b40")).rejects.toMatchObject({
      status: 404, code: "DASHBOARD_NOT_FOUND",
    });
  });

  it("saves once, rejects stale revisions, and rejects a valid route/body UUID mismatch", async () => {
    const created = DashboardSchema.parse(await request("dashboards", jsonRequest("POST", { name: "初始" })));
    const saved = DashboardSchema.parse(await request(`dashboards/${created.id}`, jsonRequest("PUT", { ...created, name: "新版" })));
    expect(saved.revision).toBe(2);
    expect(saved.updatedAt).not.toBe(created.updatedAt);

    await expect(request(`dashboards/${created.id}`, jsonRequest("PUT", created))).rejects.toMatchObject({
      status: 409, code: "DASHBOARD_VERSION_CONFLICT",
    });
    await expect(request("dashboards/6c614d7a-386b-4f36-a9ad-f9305b255b4f", jsonRequest("PUT", saved))).rejects.toMatchObject({
      status: 409, code: "DASHBOARD_ID_MISMATCH",
    });
  });

  it("allows exactly one of two concurrent saves with the same revision", async () => {
    const created = DashboardSchema.parse(await request("dashboards", jsonRequest("POST", { name: "初始" })));
    const save = (name: string) => fetch(`http://api.test/dashboards/${created.id}`, jsonRequest("PUT", { ...created, name }));

    const responses = await Promise.all([save("并发 A"), save("并发 B")]);

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 409]);
    const conflict = responses.find(({ status }) => status === 409)!;
    expect(await conflict.json()).toEqual({
      code: "DASHBOARD_VERSION_CONFLICT",
      message: "Dashboard revision is stale",
    });
    const final = DashboardSchema.parse(await request(`dashboards/${created.id}`));
    expect(final.revision).toBe(2);
  });

  it("accepts collection boundaries and rejects the first value beyond each", async () => {
    const created = DashboardSchema.parse(await request("dashboards", jsonRequest("POST", {})));
    const acceptedComponents = Array.from({ length: 100 }, (_, index) => ({ id: `c${index}`, type: "text", props: {} }));
    const acceptedLayout = acceptedComponents.map((component, index) => ({ i: component.id, x: 0, y: index, w: 1, h: 1 }));
    const withComponents = DashboardSchema.parse(await request(`dashboards/${created.id}`, jsonRequest("PUT", { ...created, components: acceptedComponents, layout: acceptedLayout })));

    const acceptedDatasets = Array.from({ length: 20 }, (_, index) => ({ datasetId: `d${index}`, schemaVersion: "v1", parameters: {} }));
    const withDatasets = DashboardSchema.parse(await request(`dashboards/${created.id}`, jsonRequest("PUT", { ...withComponents, components: [], layout: [], datasets: acceptedDatasets })));

    const components = Array.from({ length: 101 }, (_, index) => ({ id: `c${index}`, type: "text", props: {} }));
    const layout = components.map((component, index) => ({ i: component.id, x: 0, y: index, w: 1, h: 1 }));
    await expect(request(`dashboards/${created.id}`, jsonRequest("PUT", { ...withDatasets, components, layout, datasets: [] }))).rejects.toMatchObject({ status: 400, code: "DASHBOARD_SCHEMA_INVALID" });

    const datasets = Array.from({ length: 21 }, (_, index) => ({ datasetId: `d${index}`, schemaVersion: "v1", parameters: {} }));
    await expect(request(`dashboards/${created.id}`, jsonRequest("PUT", { ...withDatasets, datasets }))).rejects.toMatchObject({ status: 400, code: "DASHBOARD_SCHEMA_INVALID" });
  });

  it("accepts exactly 2 MiB UTF-8 and rejects the next byte", async () => {
    const created = DashboardSchema.parse(await request("dashboards", jsonRequest("POST", {})));
    const template = {
      ...created,
      components: [{ id: "text", type: "text", props: { padding: "" } }],
      layout: [{ i: "text", x: 0, y: 0, w: 1, h: 1 }],
    };
    const empty = JSON.stringify(template);
    const body = JSON.stringify({
      ...template,
      components: [{ ...template.components[0], props: { padding: "x".repeat(2_097_152 - new TextEncoder().encode(empty).byteLength) } }],
    });
    expect(new TextEncoder().encode(body).byteLength).toBe(2_097_152);
    await expect(request(`dashboards/${created.id}`, { method: "PUT", body })).resolves.toMatchObject({ revision: 2 });
    await expect(request(`dashboards/${created.id}`, { method: "PUT", body: `${body} ` })).rejects.toMatchObject({ status: 400, code: "DASHBOARD_SCHEMA_INVALID" });
  });

  it("keeps published snapshots isolated and protects the old snapshot on both publish failures", async () => {
    const created = DashboardSchema.parse(await request("dashboards", jsonRequest("POST", { name: "v1" })));
    await request(`dashboards/${created.id}/publish`, { method: "POST" });
    const saved = DashboardSchema.parse(await request(`dashboards/${created.id}`, jsonRequest("PUT", { ...created, name: "v2" })));
    expect((await request<{ name: string }>(`published-dashboards/${created.id}`)).name).toBe("v1");

    await expect(request(`dashboards/${created.id}/publish`, { method: "POST", headers: { "x-msw-scenario": "persistence-failure" } })).rejects.toMatchObject({ status: 500, code: "PUBLISH_FAILED" });
    expect((await request<{ name: string }>(`published-dashboards/${created.id}`)).name).toBe("v1");

    await expect(request(`dashboards/${saved.id}/publish`, { method: "POST", headers: { "x-msw-scenario": "corrupt-draft" } })).rejects.toMatchObject({ status: 500, code: "INTERNAL_ERROR" });
    expect((await request<{ name: string }>(`published-dashboards/${created.id}`)).name).toBe("v1");
  });

  it("returns the published-not-found code before first publish", async () => {
    const created = DashboardSchema.parse(await request("dashboards", jsonRequest("POST", {})));
    await expect(request(`published-dashboards/${created.id}`)).rejects.toMatchObject({ status: 404, code: "PUBLISHED_DASHBOARD_NOT_FOUND" });
  });
});

describe("dataset gateway mock contract", () => {
  it("executes list, schema, and query endpoints through shared schemas", async () => {
    const summaries = DatasetSummary.array().parse(await request("datasets"));
    expect(summaries.map(({ id }) => id)).toEqual(["sales", "inventory"]);
    Dataset.parse(await request("datasets/sales/schema"));
    DatasetQueryResult.parse(await request("datasets/sales/query", jsonRequest("POST", { parameters: { year: 2026, fromDate: "2026-01-01" } })));
  });

  it.each([
    [{ year: 2026 }, "missing required"],
    [{ year: 2026, fromDate: null }, "required null"],
    [{ year: 2026, fromDate: "2026-02-29" }, "invalid calendar date"],
    [{ year: 2026, fromDate: "2026-01-01", region: null }, "optional null"],
    [{ year: "2026", fromDate: "2026-01-01" }, "wrong type"],
    [{ year: 2026, fromDate: "2026-01-01", unknown: true }, "unknown parameter"],
  ])("rejects %s parameters (%s)", async (parameters, _label) => {
    await expect(request("datasets/sales/query", jsonRequest("POST", { parameters }))).rejects.toMatchObject({ status: 400, code: "DATASET_QUERY_INVALID" });
  });

  it("maps allow-list, upstream, timeout, and invalid response scenarios to stable errors", async () => {
    await expect(request("datasets/private/schema")).rejects.toMatchObject({ status: 404, code: "DATASET_NOT_FOUND" });
    for (const [scenario, status, code] of [
      ["upstream-error", 502, "DATASET_UPSTREAM_ERROR"],
      ["timeout", 504, "DATASET_TIMEOUT"],
      ["invalid-response", 502, "DATASET_INVALID_RESPONSE"],
      ["non-nullable-null", 502, "DATASET_INVALID_RESPONSE"],
      ["too-many-rows", 502, "DATASET_INVALID_RESPONSE"],
      ["first-byte-over", 502, "DATASET_INVALID_RESPONSE"],
    ] as const) {
      try {
        await request("datasets/sales/query", jsonRequest("POST", { parameters: { year: 2026, fromDate: "2026-01-01" } }, { "x-msw-scenario": scenario }));
        expect.fail("request should fail");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect(error).toMatchObject({ status, code });
        ErrorResponse.parse({ code: (error as ApiError).code, message: (error as Error).message });
      }
    }
  });

  it("accepts 10,000 normalized rows and rejects 10,001", async () => {
    const parameters = { year: 2026, fromDate: "2026-01-01" };
    const result = DatasetQueryResult.parse(await request("datasets/sales/query", jsonRequest("POST", { parameters }, { "x-msw-scenario": "max-rows" })));
    expect(result.rows).toHaveLength(10_000);
    await expect(request("datasets/sales/query", jsonRequest("POST", { parameters }, { "x-msw-scenario": "too-many-rows" }))).rejects.toMatchObject({ status: 502, code: "DATASET_INVALID_RESPONSE" });
  });

  it("accepts exactly 5 MiB normalized JSON and rejects the next byte", async () => {
    const parameters = { year: 2026, fromDate: "2026-01-01" };
    const result = DatasetQueryResult.parse(await request("datasets/sales/query", jsonRequest("POST", { parameters }, { "x-msw-scenario": "max-bytes" })));
    expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBe(5_242_880);
    await expect(request("datasets/sales/query", jsonRequest("POST", { parameters }, { "x-msw-scenario": "first-byte-over" }))).rejects.toMatchObject({
      status: 502,
      code: "DATASET_INVALID_RESPONSE",
      message: "Dataset response exceeds the supported limit",
    });
  });

  it("does not apply the dashboard 2 MiB request limit to a valid dataset query", async () => {
    const region = "x".repeat(2_097_153);
    const body = JSON.stringify({ parameters: { year: 2026, fromDate: "2026-01-01", region } });
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(2_097_152);

    await expect(request("datasets/sales/query", { method: "POST", body })).resolves.toSatisfy(
      (result) => DatasetQueryResult.safeParse(result).success,
    );
  });

  it("rejects null in a non-nullable upstream column", async () => {
    await expect(request("datasets/sales/query", jsonRequest("POST", {
      parameters: { year: 2026, fromDate: "2026-01-01" },
    }, { "x-msw-scenario": "non-nullable-null" }))).rejects.toMatchObject({
      status: 502,
      code: "DATASET_INVALID_RESPONSE",
    });
  });
});
