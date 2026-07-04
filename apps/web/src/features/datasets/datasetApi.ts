import {
  Dataset,
  DatasetQueryResult,
  DatasetSummary,
  type Dataset as DatasetValue,
  type DatasetQueryRequest,
  type DatasetQueryResult as DatasetQueryResultValue,
  type DatasetSummary as DatasetSummaryValue,
} from "@drag-visual/contracts";

import { apiClient, type ApiClient } from "../../api/client.js";

export const listDatasets = async (
  client: ApiClient = apiClient,
): Promise<DatasetSummaryValue[]> => DatasetSummary.array().parse(
  await client.request("datasets"),
);

export const getDataset = async (
  id: string,
  client: ApiClient = apiClient,
): Promise<DatasetValue> => Dataset.parse(
  await client.request(`datasets/${encodeURIComponent(id)}/schema`),
);

export const queryDataset = async (
  id: string,
  parameters: DatasetQueryRequest["parameters"],
  client: ApiClient = apiClient,
): Promise<DatasetQueryResultValue> => DatasetQueryResult.parse(
  await client.request(`datasets/${encodeURIComponent(id)}/query`, {
    method: "POST",
    body: JSON.stringify({ parameters }),
  }),
);
