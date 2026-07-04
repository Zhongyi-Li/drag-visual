import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { createApiClient } from "../../api/client.js";
import { datasetFixtures, datasetSummaryFixtures, salesQueryResultFixture } from "../../mocks/fixtures.js";
import { server } from "../../mocks/server.js";
import { getDataset, listDatasets, queryDataset } from "./datasetApi.js";

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

  it("rejects invalid gateway payloads", async () => {
    server.use(http.get("http://localhost/datasets", () => HttpResponse.json([{ id: "sales" }])));
    await expect(listDatasets(client)).rejects.toThrow();
  });
});
