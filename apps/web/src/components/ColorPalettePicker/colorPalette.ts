export interface PaletteColor { readonly color: string; readonly opacity: number }
export const paletteColors = ["#4080ff", "#36bfc9", "#a18bfa", "#ffc069", "#8080a6", "#36c99a", "#2878c8", "#ff85a1", "#28876c", "#cf8068", "#4b9bb0", "#c58bf2"];
export const recentColorsKey = "drag-visual.recent-colors";
export const shadeColor = (base: string, position: number): string => {
  const amount = Math.min(100, Math.max(0, position)) / 100;
  return `#${[1, 3, 5].map((offset) => {
    const channel = parseInt(base.slice(offset, offset + 2), 16);
    return Math.round(amount <= 0.5 ? channel * amount * 2 : channel + (255 - channel) * (amount - 0.5) * 2).toString(16).padStart(2, "0");
  }).join("")}`;
};
export const readRecentColors = (): PaletteColor[] => {
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(recentColorsKey) ?? localStorage.getItem("drag-visual.table-text-recent-colors") ?? "[]");
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((entry: unknown) => {
      const value = typeof entry === "string" ? { color: entry, opacity: 1 } : entry;
      if (typeof value !== "object" || value === null) return [];
      const { color, opacity } = value as Record<string, unknown>;
      return typeof color === "string" && /^#[\da-f]{6}$/i.test(color) && typeof opacity === "number" && opacity >= 0 && opacity <= 1 ? [{ color: color.toLowerCase(), opacity }] : [];
    }).slice(0, 12);
  } catch { return []; }
};
export const rememberColor = (value: PaletteColor): PaletteColor[] => {
  const normalized = { ...value, color: value.color.toLowerCase() };
  const recent = [normalized, ...readRecentColors().filter((item) => item.color !== normalized.color || item.opacity !== normalized.opacity)].slice(0, 12);
  try { localStorage.setItem(recentColorsKey, JSON.stringify(recent)); } catch { /* The picker works without storage. */ }
  return recent;
};
