import { migrateDashboard, type Dashboard } from "@drag-visual/contracts";

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
  return migrateDashboard(response);
};

export const getDashboard = async (
  id: string,
  client: ApiClient = apiClient,
): Promise<Dashboard> => {
  const response = await client.request(`dashboards/${encodeURIComponent(id)}`);
  return migrateDashboard(response);
};

export const saveDashboard = async (
  dashboard: Dashboard,
  client: ApiClient = apiClient,
): Promise<Dashboard> => {
  const response = await client.request(`dashboards/${encodeURIComponent(dashboard.id)}`, {
    method: "PUT",
    body: JSON.stringify(dashboard),
  });
  return migrateDashboard(response);
};

export const publishDashboard = async (
  id: string,
  client: ApiClient = apiClient,
): Promise<Dashboard> => {
  const response = await client.request(`dashboards/${encodeURIComponent(id)}/publish`, {
    method: "POST",
  });
  return migrateDashboard(response);
};

export const getPublishedDashboard = async (
  id: string,
  client: ApiClient = apiClient,
): Promise<Dashboard> => {
  const response = await client.request(`published-dashboards/${encodeURIComponent(id)}`);
  return migrateDashboard(response);
};
