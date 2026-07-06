import type { Dashboard } from "@drag-visual/contracts";

import { getDashboard, getPublishedDashboard } from "../dashboards/dashboardApi.js";
import { readPreviewSnapshot } from "../preview/previewSnapshotStore.js";

export const getPreviewDashboard = async (id: string): Promise<Dashboard> =>
  readPreviewSnapshot(id) ?? getDashboard(id);

export const getPublishedViewerDashboard = (id: string): Promise<Dashboard> =>
  getPublishedDashboard(id);
