import {
  Dataset,
  DatasetFieldOptions,
  DatasetQueryResult,
  DatasetSummary,
  type Dataset as DatasetValue,
  type DatasetQueryRequest,
  type DatasetQueryResult as DatasetQueryResultValue,
  type DatasetSummary as DatasetSummaryValue,
} from "@drag-visual/contracts";

import { apiClient, type ApiClient } from "../../api/client.js";

export interface UploadedDatasetResponse {
  readonly dataset: DatasetValue;
  readonly result: DatasetQueryResultValue;
}

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
): Promise<DatasetQueryResultValue> => queryDatasetRequest(id, { parameters }, client);

export const queryDatasetRequest = async (
  id: string,
  request: DatasetQueryRequest,
  client: ApiClient = apiClient,
): Promise<DatasetQueryResultValue> => DatasetQueryResult.parse(
  await client.request(`datasets/${encodeURIComponent(id)}/query`, {
    method: "POST",
    body: JSON.stringify(request),
  }),
);

export const getDatasetFieldOptions = async (
  id: string,
  fieldKey: string,
  search?: string,
  client: ApiClient = apiClient,
): Promise<string[]> => {
  const parameters = new URLSearchParams({ limit: "200" });
  if (search?.trim()) parameters.set("search", search.trim());
  const payload = DatasetFieldOptions.parse(await client.request(
    `datasets/${encodeURIComponent(id)}/fields/${encodeURIComponent(fieldKey)}/options?${parameters.toString()}`,
  ));
  return payload.options;
};

/**
 * Persists the original upload plus its browser-validated schema and preview
 * result. The server allocates the final dataset id, so callers must use the
 * returned snapshot instead of the temporary client-side id.
 */
export const uploadDataset = async (
  file: File,
  dataset: { readonly schema: DatasetValue; readonly result: DatasetQueryResultValue },
  client: ApiClient = apiClient,
): Promise<UploadedDatasetResponse> => {
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("schema", JSON.stringify(dataset.schema));
  formData.append("result", JSON.stringify(dataset.result));

  const response = await client.request<unknown>("datasets/uploads", {
    method: "POST",
    body: formData,
  });
  const parsed = DatasetQueryResult.safeParse(
    typeof response === "object" && response !== null && "result" in response
      ? response.result
      : undefined,
  );
  const schema = Dataset.safeParse(
    typeof response === "object" && response !== null && "dataset" in response
      ? response.dataset
      : undefined,
  );
  if (!schema.success || !parsed.success) throw new Error("上传接口返回的数据集格式无效");
  return { dataset: schema.data, result: parsed.data };
};
