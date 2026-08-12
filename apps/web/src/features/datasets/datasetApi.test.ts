import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { createApiClient } from "../../api/client.js";
import { datasetFixtures, datasetSummaryFixtures, salesQueryResultFixture } from "../../mocks/fixtures.js";
import { server } from "../../mocks/server.js";
import { getDataset, listDatasets, queryDataset, queryDatasetRequest, uploadDataset } from "./datasetApi.js";

const client = createApiClient("http://localhost");

describe("datasetApi", () => {
  it("lists and parses dataset summaries", async () => {
    await expect(listDatasets(client)).resolves.toEqual(datasetSummaryFixtures);
  });

  it("loads and parses a dataset schema", async () => {
    await expect(getDataset("sales", client)).resolves.toEqual(datasetFixtures[0]);
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
});
