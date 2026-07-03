import { describe, expect, it } from "vitest";

import {
  clampLayoutItem,
  findAvailableLayout,
  pointToGrid,
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
});
