import type { ComponentType } from "@drag-visual/contracts";

import { pointToGrid } from "./canvasLayout.js";

export const PALETTE_DROP_ID = "editor-canvas-drop-zone";
const ANALYSIS_GROUP_DROP_PREFIX = "analysis-group-drop-zone:";

export const analysisGroupDropId = (componentId: string): string => `${ANALYSIS_GROUP_DROP_PREFIX}${componentId}`;

export const parseAnalysisGroupDropId = (dropId: string): string | null => {
  if (!dropId.startsWith(ANALYSIS_GROUP_DROP_PREFIX)) return null;
  const componentId = dropId.slice(ANALYSIS_GROUP_DROP_PREFIX.length);
  return componentId.length > 0 ? componentId : null;
};

export interface PaletteDragData {
  readonly type: ComponentType;
  readonly title?: string;
}

export const getPaletteDragData = (type: ComponentType, title?: string): PaletteDragData =>
  title === undefined ? { type } : { type, title };

interface DropRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

interface ClientPoint { readonly clientX: number; readonly clientY: number }

export const resolvePaletteDrop = (type: ComponentType, point: ClientPoint, rect: DropRect): { type: ComponentType; x: number; y: number } | null => {
  if (
    point.clientX < rect.left || point.clientX > rect.left + rect.width ||
    point.clientY < rect.top || point.clientY > rect.top + rect.height
  ) return null;
  return { type, ...pointToGrid(point, rect) };
};
