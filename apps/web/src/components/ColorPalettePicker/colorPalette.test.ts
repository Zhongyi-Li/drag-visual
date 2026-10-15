// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { readRecentColors, recentColorsKey, rememberColor, shadeColor } from "./colorPalette.js";
beforeEach(() => localStorage.clear());
it("interpolates dark, base and light shades without changing hue endpoints", () => {
  expect(shadeColor("#9254de", 0)).toBe("#000000");
  expect(shadeColor("#9254de", 50)).toBe("#9254de");
  expect(shadeColor("#9254de", 100)).toBe("#ffffff");
  expect(shadeColor("#9254de", 25)).toBe("#492a6f");
});
it("shares recent colors and transparency, deduplicates them and limits history", () => {
  rememberColor({ color: "#9254de", opacity: 0.5 });
  rememberColor({ color: "#9254DE", opacity: 0.5 });
  rememberColor({ color: "#9254de", opacity: 1 });
  expect(readRecentColors()).toEqual([{ color: "#9254de", opacity: 1 }, { color: "#9254de", opacity: 0.5 }]);
  for (let index = 0; index < 20; index++) rememberColor({ color: `#${index.toString(16).padStart(6, "0")}`, opacity: 1 });
  expect(readRecentColors()).toHaveLength(12);
});
it("reads legacy history and ignores invalid storage", () => {
  localStorage.setItem("drag-visual.table-text-recent-colors", JSON.stringify(["#9254DE"]));
  expect(readRecentColors()).toEqual([{ color: "#9254de", opacity: 1 }]);
  localStorage.setItem(recentColorsKey, JSON.stringify([{ color: "bad", opacity: 1 }, { color: "#9254de", opacity: -1 }]));
  expect(readRecentColors()).toEqual([]);
  localStorage.setItem(recentColorsKey, "broken");
  expect(readRecentColors()).toEqual([]);
});
