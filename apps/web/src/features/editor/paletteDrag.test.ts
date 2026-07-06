import { describe, expect, it } from "vitest";

import { getPaletteDragData, resolvePaletteDrop } from "./paletteDrag.js";

describe("palette drag", () => {
  it("carries the registry component type as dnd-kit active data", () => {
    expect(getPaletteDragData("bar")).toEqual({ type: "bar" });
    expect(getPaletteDragData("line", "趋势分析")).toEqual({ type: "line", title: "趋势分析" });
  });

  it("resolves a drop point inside the canvas and ignores an outside drop", () => {
    const rect = { left: 100, top: 50, width: 900, height: 700 };
    expect(resolvePaletteDrop("bar", { clientX: 540, clientY: 270 }, rect)).toEqual({ type: "bar", x: 6, y: 4 });
    expect(resolvePaletteDrop("bar", { clientX: 99, clientY: 270 }, rect)).toBeNull();
    expect(resolvePaletteDrop("bar", { clientX: 540, clientY: 751 }, rect)).toBeNull();
  });
});
