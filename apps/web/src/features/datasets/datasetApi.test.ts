import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { createApiClient } from "../../api/client.js";
import { datasetFixtures, datasetSummaryFixtures, salesQueryResultFixture } from "../../mocks/fixtures.js";
import { server } from "../../mocks/server.js";
import { deleteUploadedDataset, getDataset, getDatasetDraft, listDatasetProcessingRecords, listDatasetProcessingTasks, listDatasets, previewDatasetDraft, publishDatasetDraft, queryDataset, queryDatasetRequest, updateDatasetDraft, uploadDataset } from "./datasetApi.js";

const client = createApiClient("http://localhost");

describe("datasetApi", () => {
  it("lists and parses dataset summaries", async () => {
    await expect(listDatasets(client)).resolves.toEqual(datasetSummaryFixtures);
  });

  it("loads and parses a dataset schema", async () => {
    await expect(getDataset("sales", client)).resolves.toEqual(datasetFixtures[0]);
  });

  it("persists, previews, and publishes calculated dataset fields", async () => {
    const draft = {
      dataset: datasetFixtures[0]!,
      calculatedFields: [{ id: "profit", label: "利润", leftField: "revenue", operator: "-" as const, rightField: "discount" }],
      combine: null,
      filters: [],
      selectedFields: null,
      version: 1,
      publishedVersion: 0,
      publishedAt: null,
    };
    let updateBody: unknown;
    server.use(
      http.get("http://localhost/datasets/uploaded-1/draft", () => HttpResponse.json(draft)),
      http.put("http://localhost/datasets/uploaded-1/draft", async ({ request }) => { updateBody = await request.json(); return HttpResponse.json(draft); }),
      http.post("http://localhost/datasets/uploaded-1/draft/preview", () => HttpResponse.json(salesQueryResultFixture)),
      http.post("http://localhost/datasets/uploaded-1/publish", () => HttpResponse.json({
        draft: { ...draft, publishedVersion: 1 },
        resultDataset: { id: "processed-1", name: "销售加工结果", sourceName: "销售数据", schemaVersion: "processed-v1" },
        record: { id: "record-1", sourceDatasetId: "uploaded-1", sourceDatasetName: "销售数据", resultDatasetId: "processed-1", resultDatasetName: "销售加工结果", status: "published", version: 1, calculatedFieldCount: 1, combineKind: null, rowCount: 1, errorMessage: null, createdAt: "2026-09-18T08:00:00.000Z" },
      })),
    );
    await expect(getDatasetDraft("uploaded-1", client)).resolves.toEqual(draft);
    await updateDatasetDraft("uploaded-1", draft.calculatedFields, client);
    expect(updateBody).toEqual({ calculatedFields: draft.calculatedFields, combine: null });
    await expect(previewDatasetDraft("uploaded-1", { parameters: {}, calculatedFields: draft.calculatedFields }, client)).resolves.toEqual(salesQueryResultFixture);
    await expect(publishDatasetDraft("uploaded-1", "销售加工结果", client)).resolves.toMatchObject({ draft: { publishedVersion: 1 }, resultDataset: { id: "processed-1" } });
  });

  it("loads processing tasks and immutable publish records", async () => {
    server.use(
      http.get("http://localhost/datasets/processing/tasks", () => HttpResponse.json([{ id: "uploaded-1", sourceDatasetId: "uploaded-1", sourceDatasetName: "销售数据", status: "draft", draftVersion: 2, publishedVersion: 0, calculatedFieldCount: 1, combineKind: null, updatedAt: "2026-09-18T08:00:00.000Z", publishedAt: null }])),
      http.get("http://localhost/datasets/processing/records", () => HttpResponse.json([{ id: "record-1", sourceDatasetId: "uploaded-1", sourceDatasetName: "销售数据", resultDatasetId: "processed-1", resultDatasetName: "销售加工结果", status: "published", version: 1, calculatedFieldCount: 1, combineKind: null, rowCount: 10, errorMessage: null, createdAt: "2026-09-18T08:30:00.000Z" }])),
    );
    await expect(listDatasetProcessingTasks(client)).resolves.toMatchObject([{ status: "draft", calculatedFieldCount: 1 }]);
    await expect(listDatasetProcessingRecords(client)).resolves.toMatchObject([{ resultDatasetId: "processed-1", status: "published" }]);
  });

  it("submits only the parameters envelope and parses the query result", async () => {
    let body: unknown;
    server.use(http.post("http://localhost/datasets/sales/query", async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(salesQueryResultFixture);
    }));

    await expect(queryDataset("sales", { year: 2026, fromDate: "2026-01-01" }, client)).resolves.toEqual(salesQueryResultFixture);
    expect(body).toEqual({ parameters: { year: 2026, fromDate: "2026-01-01" } });
  });

  it("submits optional grouped aggregation in the same query envelope", async () => {
    let body: unknown;
    server.use(http.post("http://localhost/datasets/sales/query", async ({ request }) => {
      body = await request.json();
      return HttpResponse.json(salesQueryResultFixture);
    }));

    await queryDatasetRequest("sales", {
      parameters: { year: 2026, fromDate: "2026-01-01" },
      aggregation: { groupBy: ["month"], measures: [{ fieldKey: "revenue", aggregation: "sum" }] },
    }, client);

    expect(body).toEqual({
      parameters: { year: 2026, fromDate: "2026-01-01" },
      aggregation: { groupBy: ["month"], measures: [{ fieldKey: "revenue", aggregation: "sum" }] },
    });
  });

  it("rejects invalid gateway payloads", async () => {
    server.use(http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales" }])));
    await expect(listDatasets(client)).rejects.toThrow();
  });

  it("uploads the original file with parsed schema and result as multipart form data", async () => {
    let body: FormData | undefined;
    const uploaded = {
      dataset: { ...datasetFixtures[0]!, id: "uploaded-1" },
      result: { ...salesQueryResultFixture, datasetName: "uploaded sales" },
    };
    server.use(http.post("http://localhost/datasets/uploads", async ({ request }) => {
      body = await request.formData();
      return HttpResponse.json(uploaded);
    }));

    const file = new File(["month,revenue\\n2026-07,10"], "sales.csv", { type: "text/csv" });
    await expect(uploadDataset(file, {
      schema: datasetFixtures[0]!,
      result: salesQueryResultFixture,
    }, client)).resolves.toEqual(uploaded);
    expect(body?.get("file")).toBeInstanceOf(File);
    expect(body?.get("schema")).toBe(JSON.stringify(datasetFixtures[0]));
    expect(body?.get("result")).toBe(JSON.stringify(salesQueryResultFixture));
  });

  it("deletes a persisted upload", async () => {
    let method: string | undefined;
    server.use(http.delete("http://localhost/datasets/uploads/uploaded-1", ({ request }) => {
      method = request.method;
      return new HttpResponse(null, { status: 204 });
    }));

    await expect(deleteUploadedDataset("uploaded-1", client)).resolves.toBeUndefined();
    expect(method).toBe("DELETE");
  });
});
