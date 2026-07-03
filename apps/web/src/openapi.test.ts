import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  DashboardSchema,
  Dataset,
  DatasetQueryRequest,
  DatasetQueryResult,
  DatasetSummary,
  ErrorResponse,
} from "@drag-visual/contracts";
import { bundle, compileErrors, validate } from "@readme/openapi-parser";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const specificationPath = fileURLToPath(new URL("../../../openapi/bi-mvp.yaml", import.meta.url));
type JsonObject = Record<string, any>;

const loadDocument = async (): Promise<JsonObject> =>
  parse(await readFile(specificationPath, "utf8")) as JsonObject;

describe("OpenAPI BI MVP contract", () => {
  it("is a valid, fully resolvable OpenAPI 3.1 document with exactly eight operations", async () => {
    const validation = await validate(specificationPath);
    expect(validation.valid, validation.valid ? "" : compileErrors(validation)).toBe(true);
    await expect(bundle(specificationPath)).resolves.toBeDefined();

    const document = await loadDocument();
    expect(document.openapi).toBe("3.1.0");
    expect(Object.keys(document.paths)).toEqual([
      "/dashboards",
      "/dashboards/{dashboardId}",
      "/dashboards/{dashboardId}/publish",
      "/published-dashboards/{dashboardId}",
      "/datasets",
      "/datasets/{datasetId}/schema",
      "/datasets/{datasetId}/query",
    ]);
    const operations = (Object.values(document.paths) as JsonObject[]).flatMap((path) =>
      Object.keys(path).filter((key) => ["get", "post", "put", "delete", "patch"].includes(key)),
    );
    expect(operations).toHaveLength(8);
  });

  it("declares UUIDs, strict fixed objects, JSON open maps, typed slots, and size/count limits", async () => {
    const { components } = await loadDocument();
    const schemas = components.schemas;
    expect(schemas.Dashboard.properties.id.format).toBe("uuid");
    expect(schemas.Dashboard.additionalProperties).toBe(false);
    expect(schemas.Dashboard.properties.components.maxItems).toBe(100);
    expect(schemas.Dashboard.properties.layout.maxItems).toBe(100);
    expect(schemas.Dashboard.properties.datasets.maxItems).toBe(20);
    expect(schemas.ComponentInstance.properties.props.additionalProperties.$ref).toBe("#/components/schemas/JsonValue");
    expect(schemas.DashboardDataset.properties.parameters.additionalProperties.$ref).toBe("#/components/schemas/JsonValue");
    expect(schemas.DataBinding.properties.slots.additionalProperties.oneOf).toHaveLength(2);
  });

  it("provides a schema-valid example for every response and body-bearing request", async () => {
    const document = await loadDocument();
    const successParsers: Record<string, { parse(value: unknown): unknown }> = {
      createDashboard: DashboardSchema,
      getDashboard: DashboardSchema,
      updateDashboard: DashboardSchema,
      publishDashboard: DashboardSchema,
      getPublishedDashboard: DashboardSchema,
      listDatasets: DatasetSummary.array(),
      getDatasetSchema: Dataset,
      queryDataset: DatasetQueryResult,
    };

    for (const path of Object.values(document.paths) as JsonObject[]) {
      for (const method of ["get", "post", "put"] as const) {
        const operation = path[method] as JsonObject | undefined;
        if (!operation) continue;
        if (operation.requestBody) {
          const example = operation.requestBody.content["application/json"].example;
          expect(example, `${operation.operationId} request example`).toBeDefined();
          if (operation.operationId === "updateDashboard") DashboardSchema.parse(example);
          if (operation.operationId === "queryDataset") DatasetQueryRequest.parse(example);
        }
        for (const [status, response] of Object.entries(operation.responses) as Array<[string, JsonObject]>) {
          const media = response.content["application/json"];
          const namedExamples = Object.values(media.examples ?? {}) as JsonObject[];
          const example = media.example ?? namedExamples[0]?.value;
          expect(example, `${operation.operationId} ${status} example`).toBeDefined();
          if (status.startsWith("2")) successParsers[operation.operationId]!.parse(example);
          else ErrorResponse.parse(example);
        }
      }
    }
  });

  it("documents all stable error codes and distinguishes publish failure classes", async () => {
    const document = await loadDocument();
    const examples = Object.values(document.paths).flatMap((path: any) =>
      [path.get, path.post, path.put].filter(Boolean).flatMap((operation: any) =>
        Object.entries(operation.responses)
          .filter(([status]) => !status.startsWith("2"))
          .flatMap(([, response]: any) => {
            const media = response.content["application/json"];
            return [media.example, ...Object.values(media.examples ?? {}).map((entry: any) => entry.value)].filter(Boolean);
          }),
      ),
    );
    examples.forEach((example) => ErrorResponse.parse(example));
    expect(new Set(examples.map((example: any) => example.code))).toEqual(new Set([
      "DASHBOARD_SCHEMA_INVALID", "DASHBOARD_NOT_FOUND", "PUBLISHED_DASHBOARD_NOT_FOUND",
      "DASHBOARD_ID_MISMATCH", "DASHBOARD_VERSION_CONFLICT", "DATASET_QUERY_INVALID",
      "DATASET_NOT_FOUND", "DATASET_INVALID_RESPONSE", "DATASET_UPSTREAM_ERROR",
      "DATASET_TIMEOUT", "PUBLISH_FAILED", "INTERNAL_ERROR",
    ]));
    const publish = document.paths["/dashboards/{dashboardId}/publish"].post;
    expect(publish.requestBody).toBeUndefined();
    expect(publish.responses["500"].content["application/json"].examples).toMatchObject({
      corruptDraft: { value: { code: "INTERNAL_ERROR" } },
      persistenceFailure: { value: { code: "PUBLISH_FAILED" } },
    });
  });

  it("documents PUT as one optimistic revision increment with a later server timestamp", async () => {
    const document = await loadDocument();
    const update = document.paths["/dashboards/{dashboardId}"].put;
    const request = DashboardSchema.parse(update.requestBody.content["application/json"].example);
    const response = DashboardSchema.parse(update.responses["200"].content["application/json"].example);

    expect(response.revision).toBe(request.revision + 1);
    expect(Date.parse(response.updatedAt)).toBeGreaterThan(Date.parse(request.updatedAt));
  });
});
