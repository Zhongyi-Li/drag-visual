import type { ComponentType } from "@drag-visual/contracts";

import { pointToGrid } from "./canvasLayout.js";

export const PALETTE_DROP_ID = "editor-canvas-drop-zone";

export const getPaletteDragData = (type: ComponentType): { type: ComponentType } => ({ type });

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
