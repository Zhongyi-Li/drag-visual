import {
  DashboardSchema,
  DatasetQueryRequest,
  DatasetQueryResult,
  type Dashboard,
  type Dataset,
  type ErrorCode,
} from "@drag-visual/contracts";
import { http, HttpResponse, type RequestHandler } from "msw";

import {
  datasetFixtures,
  datasetSummaryFixtures,
  salesQueryResultFixture,
  salesRowsFixture,
} from "./fixtures.js";
import { getMockScenario, resetMockScenario, setMockScenario } from "./scenarios.js";

const DASHBOARD_BODY_LIMIT = 2_097_152;
const DATASET_BODY_LIMIT = 5_242_880;
const DRAFTS_STORAGE_KEY = "drag-visual:mock-drafts";
const PUBLISHED_STORAGE_KEY = "drag-visual:mock-published";
const encoder = new TextEncoder();
const drafts = new Map<string, unknown>();
const published = new Map<string, Dashboard>();

const errors = {
  DASHBOARD_SCHEMA_INVALID: "Dashboard schema is invalid",
  DASHBOARD_NOT_FOUND: "Dashboard was not found",
  PUBLISHED_DASHBOARD_NOT_FOUND: "Published dashboard was not found",
  DASHBOARD_ID_MISMATCH: "Dashboard ID does not match request path",
  DASHBOARD_VERSION_CONFLICT: "Dashboard revision is stale",
  DATASET_QUERY_INVALID: "Dataset query is invalid",
  DATASET_NOT_FOUND: "Dataset was not found",
  DATASET_INVALID_RESPONSE: "Dataset response is invalid",
  DATASET_UPSTREAM_ERROR: "Dataset upstream request failed",
  DATASET_TIMEOUT: "Dataset request timed out",
  PUBLISH_FAILED: "Dashboard publish failed",
  INTERNAL_ERROR: "Internal server error",
} satisfies Record<ErrorCode, string>;

const apiError = (status: number, code: ErrorCode, message = errors[code]) =>
  HttpResponse.json({ code, message }, { status });

const clone = <T>(value: T): T => structuredClone(value);
const validUuid = (value: string): boolean => DashboardSchema.shape.id.safeParse(value).success;

const readStorageMap = <T>(key: string): Map<string, T> | null => {
  try {
    const stored = globalThis.localStorage?.getItem(key);
    if (stored === undefined || stored === null) return null;
    const entries = JSON.parse(stored) as unknown;
    if (!Array.isArray(entries)) return null;
    return new Map(entries.filter((entry): entry is [string, T] =>
      Array.isArray(entry) && entry.length === 2 && typeof entry[0] === "string"));
  } catch {
    return null;
  }
};

const writeStorageMap = (key: string, value: Map<string, unknown>): void => {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify([...value.entries()]));
  } catch {
    // In-memory state is enough when storage is unavailable.
  }
};

const clearStorageMap = (key: string): void => {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // In-memory state is enough when storage is unavailable.
  }
};

const syncDraftsFromStorage = (): void => {
  const stored = readStorageMap<unknown>(DRAFTS_STORAGE_KEY);
  if (stored === null) return;
  drafts.clear();
  for (const [id, value] of stored) drafts.set(id, value);
};

const syncPublishedFromStorage = (): void => {
  const stored = readStorageMap<Dashboard>(PUBLISHED_STORAGE_KEY);
  if (stored === null) return;
  published.clear();
  for (const [id, value] of stored) published.set(id, value);
};

const getDraft = (id: string): unknown | undefined => {
  syncDraftsFromStorage();
  return drafts.get(id);
};

const setDraft = (id: string, dashboard: unknown): void => {
  syncDraftsFromStorage();
  drafts.set(id, clone(dashboard));
  writeStorageMap(DRAFTS_STORAGE_KEY, drafts);
};

const setPublished = (id: string, dashboard: Dashboard): void => {
  syncPublishedFromStorage();
  published.set(id, clone(dashboard));
  writeStorageMap(PUBLISHED_STORAGE_KEY, published);
};

const getPublished = (id: string): Dashboard | undefined => {
  syncPublishedFromStorage();
  return published.get(id);
};

const readJson = async (request: Request, maxBytes: number | null = DASHBOARD_BODY_LIMIT): Promise<unknown> => {
  const text = await request.text();
  if (maxBytes !== null && encoder.encode(text).byteLength > maxBytes) throw new Error("body-limit");
  return JSON.parse(text) as unknown;
};

const dashboardId = (params: Record<string, string | readonly string[] | undefined>): string =>
  String(params.dashboardId ?? "");

const timestampAfter = (previous?: string): string => {
  const now = Date.now();
  const prior = previous === undefined ? 0 : Date.parse(previous);
  return new Date(Math.max(now, prior + 1)).toISOString();
};

const findDataset = (id: string): Dataset | undefined =>
  datasetFixtures.find((dataset) => dataset.id === id);

const calendarDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const parameterMatches = (value: unknown, type: Dataset["parameters"][number]["type"]): boolean => {
  if (type === "date") return typeof value === "string" && calendarDate(value);
  return typeof value === type;
};

const validQueryParameters = (dataset: Dataset, value: unknown): boolean => {
  const parsed = DatasetQueryRequest.safeParse(value);
  if (!parsed.success) return false;
  const known = new Map(dataset.parameters.map((parameter) => [parameter.key, parameter]));
  for (const key of Object.keys(parsed.data.parameters)) {
    const parameter = known.get(key);
    const parameterValue = parsed.data.parameters[key];
    if (!parameter || parameterValue === null || !parameterMatches(parameterValue, parameter.type)) return false;
  }
  return dataset.parameters.every(
    (parameter) => !parameter.required ||
      (Object.hasOwn(parsed.data.parameters, parameter.key) && parsed.data.parameters[parameter.key] !== null),
  );
};

const validDatasetResult = (value: unknown): value is DatasetQueryResult => {
  const parsed = DatasetQueryResult.safeParse(value);
  if (!parsed.success) return false;
  return parsed.data.rows.every((row) => parsed.data.columns.every((column) => {
    const cell = row[column.key];
    if (cell === null) return column.nullable;
    return parameterMatches(cell, column.type);
  }));
};

export const handlers: RequestHandler[] = [
  http.post("*/__mock/scenario", async ({ request }) => {
    try {
      const body = await readJson(request, null);
      if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error("schema");
      const keys = Object.keys(body);
      if (keys.length !== 1 || keys[0] !== "scenario") throw new Error("schema");
      const scenario = (body as { scenario?: unknown }).scenario;
      if (typeof scenario !== "string") throw new Error("schema");
      setMockScenario(scenario);
      return new HttpResponse(null, { status: 204 });
    } catch {
      return HttpResponse.json(
        { code: "MOCK_SCENARIO_INVALID", message: "Mock scenario is invalid" },
        { status: 400 },
      );
    }
  }),

  http.post("*/__mock/dashboards", async ({ request }) => {
    try {
      const dashboard = DashboardSchema.parse(await readJson(request));
      setDraft(dashboard.id, dashboard);
      return HttpResponse.json(clone(dashboard), { status: 201 });
    } catch {
      return apiError(400, "DASHBOARD_SCHEMA_INVALID");
    }
  }),

  http.post("*/dashboards", async ({ request }) => {
    try {
      const body = await readJson(request);
      if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error("schema");
      const keys = Object.keys(body);
      if (keys.some((key) => key !== "name")) throw new Error("schema");
      const nameValue = (body as { name?: unknown }).name;
      if (nameValue !== undefined && nameValue !== null && typeof nameValue !== "string") throw new Error("schema");
      if (typeof nameValue === "string" && nameValue.length > 100) throw new Error("schema");
      const id = crypto.randomUUID();
      const dashboard = DashboardSchema.parse({
        schemaVersion: 1,
        id,
        name: typeof nameValue === "string" && nameValue.trim() ? nameValue.trim() : "未命名看板",
        theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
        layout: [],
        components: [],
        datasets: [],
        revision: 1,
        updatedAt: timestampAfter(),
      });
      setDraft(id, dashboard);
      return HttpResponse.json(dashboard, { status: 201 });
    } catch {
      return apiError(400, "DASHBOARD_SCHEMA_INVALID");
    }
  }),

  http.get("*/dashboards/:dashboardId", ({ params }) => {
    const id = dashboardId(params);
    if (!validUuid(id)) return apiError(400, "DASHBOARD_SCHEMA_INVALID");
    const draft = getDraft(id);
    if (draft === undefined) return apiError(404, "DASHBOARD_NOT_FOUND");
    const parsed = DashboardSchema.safeParse(draft);
    return parsed.success
      ? HttpResponse.json(clone(parsed.data))
      : apiError(500, "INTERNAL_ERROR");
  }),

  http.put("*/dashboards/:dashboardId", async ({ params, request }) => {
    const id = dashboardId(params);
    if (!validUuid(id)) return apiError(400, "DASHBOARD_SCHEMA_INVALID");
    let incoming: Dashboard;
    try {
      incoming = DashboardSchema.parse(await readJson(request));
    } catch {
      return apiError(400, "DASHBOARD_SCHEMA_INVALID");
    }
    if (incoming.id !== id) return apiError(409, "DASHBOARD_ID_MISMATCH");
    const draft = getDraft(id);
    if (draft === undefined) return apiError(404, "DASHBOARD_NOT_FOUND");
    const current = DashboardSchema.safeParse(draft);
    if (!current.success) return apiError(500, "INTERNAL_ERROR");
    if (getMockScenario() === "revision-conflict") return apiError(409, "DASHBOARD_VERSION_CONFLICT");
    if (current.data.revision !== incoming.revision) return apiError(409, "DASHBOARD_VERSION_CONFLICT");
    const next = DashboardSchema.parse({
      ...incoming,
      revision: incoming.revision + 1,
      updatedAt: timestampAfter(current.data.updatedAt),
    });
    setDraft(id, next);
    return HttpResponse.json(next);
  }),

  http.post("*/dashboards/:dashboardId/publish", ({ params, request }) => {
    const id = dashboardId(params);
    if (!validUuid(id)) return apiError(400, "DASHBOARD_SCHEMA_INVALID");
    const draft = getDraft(id);
    if (draft === undefined) return apiError(404, "DASHBOARD_NOT_FOUND");
    const scenario = request.headers.get("x-msw-scenario");
    const candidate = scenario === "corrupt-draft"
      ? { ...(draft as object), schemaVersion: 2 }
      : draft;
    const parsed = DashboardSchema.safeParse(candidate);
    if (!parsed.success) return apiError(500, "INTERNAL_ERROR");
    if (scenario === "persistence-failure" || getMockScenario() === "publish-failure") {
      return apiError(500, "PUBLISH_FAILED");
    }
    const snapshot = clone(parsed.data);
    setPublished(id, snapshot);
    return HttpResponse.json(clone(snapshot));
  }),

  http.get("*/published-dashboards/:dashboardId", ({ params }) => {
    const id = dashboardId(params);
    if (!validUuid(id)) return apiError(400, "DASHBOARD_SCHEMA_INVALID");
    const snapshot = getPublished(id);
    return snapshot === undefined
      ? apiError(404, "PUBLISHED_DASHBOARD_NOT_FOUND")
      : HttpResponse.json(clone(snapshot));
  }),

  http.get("*/datasets", () => HttpResponse.json(clone(datasetSummaryFixtures))),

  http.get("*/datasets/:datasetId/schema", ({ params, request }) => {
    const dataset = findDataset(String(params.datasetId ?? ""));
    if (dataset === undefined) return apiError(404, "DATASET_NOT_FOUND");
    if (
      (request.headers.get("x-msw-scenario") === "schema-v2" || getMockScenario() === "schema-v2") &&
      dataset.id === "sales"
    ) {
      return HttpResponse.json({
        ...clone(dataset),
        fields: dataset.fields.filter((field) => field.key !== "revenue"),
        schemaVersion: "v2",
      });
    }
    return HttpResponse.json(clone(dataset));
  }),

  http.post("*/datasets/:datasetId/query", async ({ params, request }) => {
    const dataset = findDataset(String(params.datasetId ?? ""));
    if (dataset === undefined) return apiError(404, "DATASET_NOT_FOUND");
    let body: unknown;
    try {
      body = await readJson(request, null);
    } catch {
      return apiError(400, "DATASET_QUERY_INVALID");
    }
    if (!validQueryParameters(dataset, body)) return apiError(400, "DATASET_QUERY_INVALID");

    const scenario = request.headers.get("x-msw-scenario");
    if (scenario === "upstream-error") return apiError(502, "DATASET_UPSTREAM_ERROR");
    if (scenario === "timeout" || getMockScenario() === "dataset-timeout") {
      return apiError(504, "DATASET_TIMEOUT");
    }
    let result: unknown = dataset.id === "sales"
      ? { ...clone(salesQueryResultFixture), rows: clone(salesRowsFixture), total: salesRowsFixture.length }
      : {
          columns: clone(dataset.fields),
          rows: [{ sku: "SKU-001", quantity: 42 }],
          total: 1,
          sampledAt: salesQueryResultFixture.sampledAt,
        };
    if (scenario === "empty" && dataset.id === "sales") {
      result = { ...clone(salesQueryResultFixture), rows: [], total: 0 };
    }
    if (scenario === "invalid-response" && dataset.id === "sales") {
      result = { ...clone(salesQueryResultFixture), rows: [{ ...salesQueryResultFixture.rows[0], businessDate: "2026-02-29" }] };
    }
    if (scenario === "malformed-response" && dataset.id === "sales") {
      result = { ...clone(salesQueryResultFixture), rows: "not-an-array" };
    }
    if (scenario === "non-nullable-null" && dataset.id === "sales") {
      result = { ...clone(salesQueryResultFixture), rows: [{ ...salesQueryResultFixture.rows[0], revenue: null }] };
    }
    if ((scenario === "max-rows" || scenario === "too-many-rows" || scenario === "10001-rows") && dataset.id === "sales") {
      const count = scenario === "max-rows" ? 10_000 : 10_001;
      result = { ...clone(salesQueryResultFixture), rows: Array.from({ length: count }, () => clone(salesQueryResultFixture.rows[0]!)), total: count };
    }
    if (
      (scenario === "max-bytes" || scenario === "first-byte-over" || scenario === "oversized-response" || scenario === "over-5-mib") &&
      dataset.id === "sales"
    ) {
      const template = {
        ...clone(salesQueryResultFixture),
        rows: [{ ...salesQueryResultFixture.rows[0], payload: "" }],
      };
      const templateBytes = encoder.encode(JSON.stringify(template)).byteLength;
      const extraByte = scenario === "max-bytes" ? 0 : 1;
      result = {
        ...template,
        rows: [{ ...template.rows[0], payload: "x".repeat(DATASET_BODY_LIMIT - templateBytes + extraByte) }],
      };
    }
    if (
      typeof result === "object" && result !== null && "rows" in result &&
      Array.isArray((result as { rows: unknown }).rows) &&
      (result as { rows: unknown[] }).rows.length > 10_000
    ) {
      return apiError(502, "DATASET_INVALID_RESPONSE", "Dataset response exceeds the supported limit");
    }
    if (!validDatasetResult(result)) return apiError(502, "DATASET_INVALID_RESPONSE");
    if (encoder.encode(JSON.stringify(result)).byteLength > DATASET_BODY_LIMIT) {
      return apiError(502, "DATASET_INVALID_RESPONSE", "Dataset response exceeds the supported limit");
    }
    return HttpResponse.json(result);
  }),
];

/** Tests reset state between cases; application feature code must not import this. */
export const resetMockStore = (): void => {
  drafts.clear();
  published.clear();
  clearStorageMap(DRAFTS_STORAGE_KEY);
  clearStorageMap(PUBLISHED_STORAGE_KEY);
  resetMockScenario();
};
