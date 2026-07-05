import type { Dashboard } from "@drag-visual/contracts";

import { getDashboard, getPublishedDashboard } from "../dashboards/dashboardApi.js";

export const getPreviewDashboard = (id: string): Promise<Dashboard> => getDashboard(id);

export const getPublishedViewerDashboard = (id: string): Promise<Dashboard> =>
  getPublishedDashboard(id);
