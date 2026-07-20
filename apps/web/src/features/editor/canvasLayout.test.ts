import { describe, expect, it } from "vitest";

import {
  clampLayoutItem,
  createShadowLayout,
  findAvailableLayout,
  hasLayoutCollision,
  pointToGrid,
  resolveLayoutCollisions,
} from "./canvasLayout.js";

describe("canvas layout helpers", () => {
  it("converts a client drop point to clamped 12-column coordinates", () => {
    expect(pointToGrid({ clientX: 540, clientY: 270 }, { left: 100, top: 50, width: 900 })).toEqual({ x: 6, y: 4 });
    expect(pointToGrid({ clientX: 2_000, clientY: 20 }, { left: 100, top: 50, width: 900 })).toEqual({ x: 11, y: 0 });
  });

  it("clamps width and x while honoring registry minimum sizes", () => {
    expect(clampLayoutItem({ i: "bar", x: 10, y: -1, w: 8, h: 1 }, { w: 3, h: 2 })).toEqual({
      i: "bar", x: 4, y: 0, w: 8, h: 2,
    });
  });

  it("places a duplicate on a non-overlapping row", () => {
    expect(findAvailableLayout(
      [{ i: "one", x: 0, y: 0, w: 6, h: 5 }],
      { i: "two", x: 0, y: 0, w: 6, h: 5 },
    )).toEqual({ i: "two", x: 0, y: 5, w: 6, h: 5 });
  });

  it("detects collisions against the existing layout while ignoring the active item", () => {
    const layout = [
      { i: "one", x: 0, y: 0, w: 6, h: 5 },
      { i: "two", x: 6, y: 0, w: 6, h: 5 },
    ];
    expect(hasLayoutCollision(layout, { i: "one", x: 6, y: 0, w: 6, h: 5 }, "one")).toBe(true);
    expect(hasLayoutCollision(layout, { i: "one", x: 0, y: 5, w: 6, h: 5 }, "one")).toBe(false);
  });

  it("pushes lower overlapping items down when a resized item grows into their space", () => {
    expect(resolveLayoutCollisions([
      { i: "trend", x: 0, y: 0, w: 12, h: 8 },
      { i: "multi", x: 0, y: 5, w: 6, h: 4 },
      { i: "heatmap", x: 6, y: 6, w: 6, h: 4 },
    ], "trend")).toEqual([
      { i: "trend", x: 0, y: 0, w: 12, h: 8 },
      { i: "multi", x: 0, y: 8, w: 6, h: 4 },
      { i: "heatmap", x: 6, y: 8, w: 6, h: 4 },
    ]);
  });

  it("does not move side-by-side items when a resized item only overlaps vertically", () => {
    expect(resolveLayoutCollisions([
      { i: "trend", x: 0, y: 0, w: 6, h: 8 },
      { i: "side", x: 6, y: 3, w: 6, h: 4 },
    ], "trend")).toEqual([
      { i: "trend", x: 0, y: 0, w: 6, h: 8 },
      { i: "side", x: 6, y: 3, w: 6, h: 4 },
    ]);
  });

  it("creates drag shadow layout from the original layout and active candidate", () => {
    expect(createShadowLayout([
      { i: "trend", x: 0, y: 0, w: 12, h: 5 },
      { i: "detail", x: 6, y: 5, w: 6, h: 4 },
    ], { i: "detail", x: 6, y: 0, w: 6, h: 4 })).toEqual([
      { i: "trend", x: 0, y: 4, w: 12, h: 5 },
      { i: "detail", x: 6, y: 0, w: 6, h: 4 },
    ]);
  });
});
