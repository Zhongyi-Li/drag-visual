import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";

import { apiClient, type ApiClient } from "../../api/client.js";

export const createDashboard = async (
  name?: string | null,
  client: ApiClient = apiClient,
): Promise<Dashboard> => {
  const body = name === undefined ? {} : { name };
  const response = await client.request("dashboards", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return DashboardSchema.parse(response);
};

export const getDashboard = async (
  id: string,
  client: ApiClient = apiClient,
): Promise<Dashboard> => {
  const response = await client.request(`dashboards/${encodeURIComponent(id)}`);
  return DashboardSchema.parse(response);
};
