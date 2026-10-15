import type { DashboardTableTextStyle } from "@drag-visual/contracts";
import type { CSSProperties } from "react";
import type { ChartTheme } from "./chartTheme.js";

const fontFamilies = {
  system: "inherit",
  "source-han-sans": "Source Han Sans SC, sans-serif",
  "source-han-serif": "Source Han Serif SC, serif",
  "alibaba-puhuiti": "Alibaba PuHuiTi, sans-serif",
  "harmonyos-sans": "HarmonyOS Sans, sans-serif",
  "lxgw-wenkai": "LXGW WenKai, serif",
};

const tint = (color: string, base: string, amount: number) => {
  const channels = [1, 3, 5].map((offset) => Math.round(
    Number.parseInt(color.slice(offset, offset + 2), 16) * amount
    + Number.parseInt(base.slice(offset, offset + 2), 16) * (1 - amount),
  ));
  return `rgb(${channels.join(", ")})`;
};

const textStyle = (value: DashboardTableTextStyle, fallback: string): CSSProperties => ({
  color: (value.opacity ?? 1) < 1
    ? `rgba(${[1, 3, 5].map((offset) => parseInt((value.color ?? fallback).slice(offset, offset + 2), 16)).join(", ")}, ${value.opacity})`
    : value.color ?? fallback,
  fontFamily: fontFamilies[value.fontFamily],
  fontSize: value.fontSize,
  fontWeight: value.bold ? 700 : 400,
  fontStyle: value.italic ? "italic" : "normal",
});

/** An absent setting preserves the presentation of existing dashboards. */
interface TablePresentation {
  readonly table: CSSProperties;
  readonly header: CSSProperties;
  readonly body: CSSProperties;
  readonly heatmap: CSSProperties;
  readonly bottomRule: CSSProperties | undefined;
  readonly row: (index: number) => CSSProperties;
}

export const tablePresentation = (theme: ChartTheme | undefined): TablePresentation | undefined => {
  const settings = theme?.tableStyle;
  if (settings === undefined) return undefined;
  const dark = theme?.mode === "dark";
  const base = dark ? "#1e293b" : "#ffffff";
  const text = dark ? "#e2e8f0" : "#1e293b";
  const accent = settings.colorScheme === "gray" ? "#8c8c8c" : settings.colorScheme === "custom" ? settings.customColor : theme!.primaryColor;
  const opacity = settings.colorScheme === "custom" ? settings.customOpacity ?? 1 : 1;
  const accentPaint = opacity < 1 ? `rgba(${[1, 3, 5].map((offset) => parseInt(accent.slice(offset, offset + 2), 16)).join(", ")}, ${opacity})` : accent;
  const line = dark ? "#475569" : "#d9d9d9";
  const grid = settings.preset === "grid";
  const simple = settings.preset === "simple";
  const minimal = settings.preset === "minimal";
  const header: CSSProperties = {
    ...textStyle(settings.header, dark ? text : "#334155"),
    padding: "7px 12px",
    background: grid ? accentPaint : base,
    borderBottom: minimal ? "none" : `1px solid ${grid ? line : accentPaint}`,
    borderRight: grid ? `1px solid ${line}` : "none",
  };
  const body: CSSProperties = {
    ...textStyle(settings.body, text),
    padding: "7px 12px",
    background: "inherit",
    borderBottom: grid ? `1px solid ${line}` : "none",
    borderRight: grid ? `1px solid ${line}` : "none",
  };
  return {
    table: {
      background: base,
      border: grid ? `1px solid ${line}` : "none",
      borderTop: simple ? `1px solid ${accentPaint}` : grid ? `1px solid ${line}` : "none",
      borderBottom: simple ? `1px solid ${accentPaint}` : grid ? `1px solid ${line}` : "none",
    } satisfies CSSProperties,
    header,
    body,
    // Heat intensity owns background and contrast, typography still inherits.
    heatmap: { ...textStyle(settings.body, text), borderRight: body.borderRight, borderBottom: body.borderBottom } satisfies CSSProperties,
    // Keep the bottom rule visible when rows extend beyond the scroll viewport.
    bottomRule: grid || simple ? { position: "sticky", bottom: 0, height: 1, marginTop: -1, background: grid ? line : accentPaint, zIndex: 3 } : undefined,
    row: (index: number): CSSProperties => ({
      background: index % 2 === 1 ? tint(accent, base, (dark ? 0.1 : 0.06) * opacity) : base,
    }),
  };
};
