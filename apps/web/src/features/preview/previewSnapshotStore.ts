import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";

const previewSnapshotKey = (id: string): string => `drag-visual:preview-snapshot:${id}`;

export const writePreviewSnapshot = (dashboard: Dashboard): void => {
  try {
    globalThis.localStorage?.setItem(previewSnapshotKey(dashboard.id), JSON.stringify(dashboard));
  } catch {
    // Preview can still fall back to the saved draft when local storage is unavailable.
  }
};

export const readPreviewSnapshot = (id: string): Dashboard | null => {
  try {
    const raw = globalThis.localStorage?.getItem(previewSnapshotKey(id));
    if (raw === undefined || raw === null) return null;
    return DashboardSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const clearPreviewSnapshot = (id: string): void => {
  try {
    globalThis.localStorage?.removeItem(previewSnapshotKey(id));
  } catch {
    // Nothing to clear when storage is unavailable.
  }
};
