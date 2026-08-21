import type { GridItem } from "@drag-visual/contracts";

export const GRID_COLUMNS = 12;
export const GRID_ROW_HEIGHT = 44;
export const GRID_MARGIN = 12;
export const GRID_PADDING = 12;
export const RESIZABLE_ITEM_MINIMUM = Object.freeze({ w: 2, h: 2 });

interface ClientPoint { readonly clientX: number; readonly clientY: number }
interface CanvasRect { readonly left: number; readonly top: number; readonly width: number }
interface MinimumSize { readonly w: number; readonly h: number }

export const pointToGrid = (point: ClientPoint, rect: CanvasRect): { x: number; y: number } => {
  const columnWidth = Math.max(1, (rect.width - GRID_PADDING * 2 - GRID_MARGIN * (GRID_COLUMNS - 1)) / GRID_COLUMNS);
  const x = Math.round((point.clientX - rect.left - GRID_PADDING) / (columnWidth + GRID_MARGIN));
  const y = Math.round((point.clientY - rect.top - GRID_PADDING) / (GRID_ROW_HEIGHT + GRID_MARGIN));
  return {
    x: Math.max(0, Math.min(GRID_COLUMNS - 1, x)),
    y: Math.max(0, y),
  };
};

export const clampLayoutItem = (item: GridItem, minimum: MinimumSize): GridItem => {
  const w = Math.min(GRID_COLUMNS, Math.max(minimum.w, item.w));
  const h = Math.max(minimum.h, item.h);
  return {
    i: item.i,
    ...(item.parentId === undefined ? {} : { parentId: item.parentId }),
    x: Math.max(0, Math.min(GRID_COLUMNS - w, item.x)),
    y: Math.max(0, item.y),
    w,
    h,
  };
};

const overlaps = (left: GridItem, right: GridItem): boolean =>
  left.x < right.x + right.w &&
  left.x + left.w > right.x &&
  left.y < right.y + right.h &&
  left.y + left.h > right.y;

const overlapArea = (left: GridItem, right: GridItem): number => {
  const width = Math.max(0, Math.min(left.x + left.w, right.x + right.w) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y));
  return width * height;
};

const sweptArea = (origin: GridItem, active: GridItem): GridItem => {
  const x = Math.min(origin.x, active.x);
  const y = Math.min(origin.y, active.y);
  return {
    i: active.i,
    x,
    y,
    w: Math.max(origin.x + origin.w, active.x + active.w) - x,
    h: Math.max(origin.y + origin.h, active.y + active.h) - y,
  };
};

const distanceToCenter = (left: GridItem, right: GridItem): number => {
  const x = left.x + left.w / 2 - (right.x + right.w / 2);
  const y = left.y + left.h / 2 - (right.y + right.h / 2);
  return x * x + y * y;
};

export const hasLayoutCollision = (layout: readonly GridItem[], candidate: GridItem, ignoreId?: string): boolean =>
  layout.some((item) => item.i !== ignoreId && overlaps(item, candidate));

/**
 * Removes gaps from one grid while preserving each component's current size.
 *
 * Items are processed in their current reading order (top-to-bottom, then
 * left-to-right) and placed into the first available grid cell. Callers pass
 * only the layout scope they want to arrange, so an analysis group's children
 * are never mixed with the dashboard canvas.
 */
export const compactLayout = (layout: readonly GridItem[]): GridItem[] => {
  const ordered = layout
    .map((item) => clampLayoutItem(item, { w: 1, h: 1 }))
    .sort((left, right) => left.y - right.y || left.x - right.x || left.i.localeCompare(right.i));
  const placed: GridItem[] = [];
  const maximumRows = ordered.reduce((rows, item) => rows + item.h, 0);

  ordered.forEach((item) => {
    for (let y = 0; y <= maximumRows; y += 1) {
      for (let x = 0; x <= GRID_COLUMNS - item.w; x += 1) {
        const candidate = { ...item, x, y };
        if (!hasLayoutCollision(placed, candidate)) {
          placed.push(candidate);
          return;
        }
      }
    }
  });

  const byId = new Map(placed.map((item) => [item.i, item]));
  return layout.map((item) => byId.get(item.i) ?? item);
};

export const findAvailableLayout = (layout: readonly GridItem[], candidate: GridItem): GridItem => {
  let next = candidate;
  while (layout.some((item) => overlaps(item, next))) {
    next = { ...next, y: Math.max(...layout.filter((item) => overlaps(item, next)).map((item) => item.y + item.h)) };
  }
  return next;
};

export const resolveLayoutCollisions = (layout: readonly GridItem[], activeId: string): GridItem[] => {
  const active = layout.find((item) => item.i === activeId);
  if (!active) return [...layout];

  const settled: GridItem[] = [active];
  const pending = layout
    .filter((item) => item.i !== activeId)
    .sort((left, right) => left.y - right.y || left.x - right.x);

  pending.forEach((item) => {
    let next = item;
    let blockers = settled.filter((candidate) => overlaps(candidate, next));
    while (blockers.length > 0) {
      next = { ...next, y: Math.max(...blockers.map((candidate) => candidate.y + candidate.h)) };
      blockers = settled.filter((candidate) => overlaps(candidate, next));
    }
    settled.push(next);
  });

  const byId = new Map(settled.map((item) => [item.i, item]));
  return layout.map((item) => byId.get(item.i) ?? item);
};

/**
 * Builds the temporary layout shown while a chart is dragged.
 *
 * When the dragged chart lands on another chart, move that chart into the
 * dragged chart's old slot. This gives authors the familiar reordering cue:
 * the occupied chart moves out of the way immediately while RGL renders its
 * native placeholder at the potential drop location. If the two cards cannot
 * safely exchange slots (for example, a wide chart would overflow the old
 * narrow slot), retain the collision-resolution fallback instead.
 */
export const createShadowLayout = (baseline: readonly GridItem[], active: GridItem): GridItem[] => {
  const origin = baseline.find((item) => item.i === active.i);
  if (!origin) return resolveLayoutCollisions([...baseline, active], active.i);

  const crossedArea = sweptArea(origin, active);
  const dropTarget = baseline
    .filter((item) => item.i !== active.i)
    .map((item) => ({
      item,
      area: overlapArea(item, active),
      isCrossed: overlapArea(item, crossedArea) > 0,
    }))
    // Pointer move events can skip over a smaller target. The swept area
    // makes that target eligible too, so fast downward and horizontal drags
    // still produce the same swap as slower ones.
    .filter((candidate) => candidate.area > 0 || candidate.isCrossed)
    .sort((left, right) => {
      const currentHit = Number(right.area > 0) - Number(left.area > 0);
      if (currentHit !== 0) return currentHit;
      return right.area - left.area || distanceToCenter(left.item, active) - distanceToCenter(right.item, active) || left.item.i.localeCompare(right.item.i);
    })[0]?.item;

  if (dropTarget) {
    const displaced = { ...dropTarget, x: origin.x, y: origin.y };
    // Persist the real target slot rather than the raw pointer coordinate;
    // otherwise dropping near the lower edge of a card leaves a visible gap
    // and feels like a push instead of a swap.
    const settledActive = { ...active, x: dropTarget.x, y: dropTarget.y };
    const swapped = baseline.map((item) => {
      if (item.i === active.i) return settledActive;
      if (item.i === dropTarget.i) return displaced;
      return item;
    });
    const staysInGrid = displaced.x >= 0 && displaced.x + displaced.w <= GRID_COLUMNS && displaced.y >= 0;
    const hasCollision = swapped.some((item, index) => swapped.some((candidate, candidateIndex) => candidateIndex > index && overlaps(item, candidate)));
    if (staysInGrid && !hasCollision) return swapped;
  }

  return resolveLayoutCollisions(baseline.map((item) => item.i === active.i ? active : item), active.i);
};
