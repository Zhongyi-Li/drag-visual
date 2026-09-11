import { createContext } from "react";

export const defaultLightPalette = ["#1677ff", "#36cfc9", "#9254de", "#fa8c16", "#13c2c2", "#eb2f96"];
export const defaultDarkPalette = ["#5b8ff9", "#5ad8a6", "#9270ca", "#f6bd16", "#5dc5d5", "#e8684a"];

export type ChartTheme = {
  readonly primaryColor: string;
  readonly backgroundColor: string;
  readonly mode?: "light" | "dark" | undefined;
  readonly chartPalette?: readonly string[] | undefined;
  readonly chartGradient?: boolean | undefined;
  readonly semanticColors?: Readonly<{ positive: string; negative: string; neutral: string }> | undefined;
};

export const ChartThemeContext = createContext<ChartTheme | undefined>(undefined);

const darkText = "#dbe7f5";
const darkMuted = "#94a3b8";
const darkGrid = "#334155";

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

export const applyChartTheme = (option: unknown, theme: ChartTheme | undefined): unknown => {
  if (!isObject(option) || theme === undefined) return option;
  const palette = theme.chartPalette ?? (theme.mode === "dark" ? defaultDarkPalette : defaultLightPalette);
  const dark = theme.mode === "dark";
  const visit = (value: unknown, path: readonly string[] = [], seriesIndex?: number): unknown => {
    if (Array.isArray(value)) return value.map((entry, index) => visit(entry, path, index));
    if (!isObject(value)) return value;
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === "color" && (path.at(-1) === "series" || path.length === 0 || path.at(-1) === "itemStyle" || path.at(-1) === "lineStyle" || path.at(-1) === "areaStyle")) {
        // ECharts gauges use an array of [stop, color] tuples for axisLine.
        // Treating that array as a series palette produces invalid gauge
        // colors and makes the track/ticks disappear entirely.
        const color = palette[(seriesIndex ?? 0) % palette.length];
        const fill = path.at(-1) === "itemStyle" || path.at(-1) === "areaStyle";
        result[key] = Array.isArray(entry) ? (path.length === 0 ? [...palette] : entry) : fill && (theme.chartGradient ?? true)
          ? { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color }, { offset: 1, color: `${color}80` }] }
          : color;
      } else if (dark && key === "backgroundColor") {
        result[key] = "transparent";
      } else if (dark && key === "color" && typeof entry === "string") {
        result[key] = darkMuted;
      } else if (dark && key === "textStyle" && isObject(entry)) {
        const themed = visit(entry, [...path, key], seriesIndex);
        result[key] = { ...(isObject(themed) ? themed : {}), color: darkText };
      } else if (dark && key === "axisLine" && isObject(entry)) {
        const themed = visit(entry, [...path, key], seriesIndex);
        result[key] = { ...(isObject(themed) ? themed : {}), lineStyle: { ...(isObject(entry.lineStyle) ? entry.lineStyle : {}), color: darkGrid } };
      } else if (dark && key === "splitLine" && isObject(entry)) {
        const themed = visit(entry, [...path, key], seriesIndex);
        result[key] = { ...(isObject(themed) ? themed : {}), lineStyle: { ...(isObject(entry.lineStyle) ? entry.lineStyle : {}), color: darkGrid } };
      } else {
        result[key] = visit(entry, [...path, key], seriesIndex);
      }
    }
    return result;
  };
  return visit(option);
};
