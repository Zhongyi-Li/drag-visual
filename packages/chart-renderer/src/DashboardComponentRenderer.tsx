import type { ComponentInstance, DatasetField } from "@drag-visual/contracts";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { EChart } from "./EChart.js";
import {
  buildBarOption,
  buildCrosstabModel,
  buildFlipNumberModel,
  buildGaugeModel,
  buildGaugeModels,
  buildGaugeOption,
  buildHeatmapModel,
  buildKpiBoardModel,
  buildKpiModel,
  buildLineOption,
  buildLiquidModel,
  buildLiquidModels,
  buildMetricTrendModel,
  buildMetricTrendOption,
  buildMetricBreakdownModel,
  buildMultidimensionalModel,
  buildPieOption,
  buildRadarOption,
  buildSunburstOption,
  buildRankingModel,
  buildRingBarOption,
  buildProgressBarModel,
  buildTableModel,
  buildTrendModel,
  buildTrendOption,
  buildTreemapOption,
} from "./options.js";

interface Props {
  readonly component: ComponentInstance;
  readonly fields?: readonly DatasetField[] | undefined;
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  readonly activeSunburstMeasure?: string | undefined;
  readonly onSunburstMeasureChange?: ((measure: string) => void) | undefined;
  readonly activeTreemapMeasure?: string | undefined;
  readonly onTreemapMeasureChange?: ((measure: string) => void) | undefined;
}

type Row = Readonly<Record<string, unknown>>;
type BindingSlots = NonNullable<ComponentInstance["binding"]>["slots"];

const bindingFieldKeys = (component: ComponentInstance, slot: keyof BindingSlots): string[] => {
  const value = component.binding?.slots[slot];
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map((binding) => binding.fieldKey);
};

const EMPTY_DATA_NOTICE = "当前图表无数据";

const emptyDataWrapperStyle: CSSProperties = {
  height: "100%",
  minHeight: "min(160px, 100%)",
  overflow: "hidden",
  position: "relative",
};

const emptyDataDemoStyle: CSSProperties = {
  color: "#b8b8b8",
  height: "100%",
  minHeight: 0,
  opacity: 0.52,
  pointerEvents: "none",
};

const emptyDataNoticeStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.72)",
  border: "1px solid rgba(215, 215, 215, 0.8)",
  color: "#777",
  fontSize: 12,
  left: "50%",
  lineHeight: 1,
  boxSizing: "border-box",
  maxWidth: "calc(100% - 24px)",
  overflow: "hidden",
  padding: "10px clamp(16px, 12%, 48px)",
  position: "absolute",
  textOverflow: "ellipsis",
  top: "50%",
  transform: "translate(-50%, -50%)",
  whiteSpace: "nowrap",
};

const stringProp = (component: ComponentInstance, key: string, fallback: string): string =>
  typeof component.props[key] === "string" ? component.props[key] : fallback;

const numberProp = (component: ComponentInstance, key: string, fallback: number): number =>
  typeof component.props[key] === "number" ? component.props[key] : fallback;

const renderEmptyDataDemo = (content: React.ReactNode) => (
  <div style={emptyDataWrapperStyle}>
    <div aria-hidden="true" style={emptyDataDemoStyle}>{content}</div>
    <div role="status" style={emptyDataNoticeStyle}>{EMPTY_DATA_NOTICE}</div>
  </div>
);

const svgStyle: CSSProperties = {
  display: "block",
  height: "100%",
  maxHeight: "100%",
  minHeight: 0,
  width: "100%",
};

const tableShellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
};

const sunburstShellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
  position: "relative",
};

const sunburstLegendStyle: CSSProperties = {
  alignContent: "flex-start",
  display: "flex",
  flex: "0 0 auto",
  flexWrap: "wrap",
  gap: "6px 16px",
  maxHeight: 42,
  overflow: "hidden",
  padding: "2px 12px 6px",
};

const sunburstLegendItemStyle: CSSProperties = {
  alignItems: "center",
  color: "#64748b",
  display: "inline-flex",
  fontSize: 12,
  gap: 5,
  lineHeight: "16px",
  whiteSpace: "nowrap",
};

const sunburstChartStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  overflow: "hidden",
};

const radarLegendStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  flex: "0 0 auto",
  flexWrap: "wrap",
  gap: "6px 16px",
  maxHeight: 42,
  overflow: "hidden",
  padding: "2px 12px 6px",
};

const radarLegendItemStyle: CSSProperties = {
  alignItems: "center",
  color: "#64748b",
  display: "inline-flex",
  fontSize: 12,
  gap: 5,
  lineHeight: "16px",
  whiteSpace: "nowrap",
};

const sunburstLegendColors = [
  "#4b7cf5", "#41c4d5", "#9587e7", "#ffb675", "#7e829f", "#3fc59d",
  "#2d83ca", "#f77aa2", "#138b78", "#d48368", "#5599ac", "#b68de9",
];

const sunburstMetricSelectStyle: CSSProperties = {
  appearance: "auto",
  background: "rgba(255, 255, 255, 0.94)",
  border: "1px solid #dbe5f0",
  borderRadius: 4,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  color: "#334155",
  fontSize: 12,
  maxWidth: "calc(100% - 24px)",
  padding: "4px 26px 4px 8px",
  position: "absolute",
  right: 12,
  top: 10,
  zIndex: 1,
};

const dataSurfaceStyle: CSSProperties = {
  background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
  border: "1px solid #e5edf7",
  borderRadius: 8,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  display: "flex",
  flexDirection: "column",
  height: "100%",
  minHeight: 0,
  overflow: "hidden",
};

const dataSurfaceHeaderStyle: CSSProperties = {
  alignItems: "flex-start",
  borderBottom: "1px solid #edf2f7",
  display: "flex",
  flex: "0 0 auto",
  gap: 10,
  justifyContent: "space-between",
  minWidth: 0,
  padding: "10px 12px 9px",
};

const dataSurfaceTitleBlockStyle: CSSProperties = {
  minWidth: 0,
};

const dataSurfaceEyebrowStyle: CSSProperties = {
  color: "#64748b",
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0,
  lineHeight: 1.3,
};

const dataSurfaceTitleStyle: CSSProperties = {
  color: "#0f172a",
  display: "block",
  fontSize: 13,
  fontWeight: 650,
  lineHeight: 1.45,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const chipRailStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  flex: "0 0 auto",
  flexWrap: "wrap",
  gap: 6,
  justifyContent: "flex-end",
  maxWidth: "58%",
};

const chipStyle: CSSProperties = {
  alignItems: "center",
  background: "#f4f8ff",
  border: "1px solid #dbeafe",
  borderRadius: 999,
  color: "#245996",
  display: "inline-flex",
  fontSize: 11,
  fontWeight: 600,
  lineHeight: "18px",
  maxWidth: 180,
  minWidth: 0,
  overflow: "hidden",
  padding: "0 8px",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const tableScrollStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
  overflow: "auto",
  scrollbarColor: "#cbd5e1 transparent",
};

const dataTableStyle: CSSProperties = {
  borderCollapse: "separate",
  borderSpacing: 0,
  fontSize: 12,
  minWidth: "100%",
  tableLayout: "auto",
};

const tableHeaderCellStyle: CSSProperties = {
  background: "#f8fafc",
  borderBottom: "1px solid #e8eef6",
  color: "#475569",
  fontWeight: 650,
  padding: "9px 12px",
  position: "sticky",
  textAlign: "left",
  top: 0,
  whiteSpace: "nowrap",
  zIndex: 2,
};

const tableCellStyle: CSSProperties = {
  borderBottom: "1px solid #eef2f7",
  color: "#1e293b",
  maxWidth: 260,
  overflow: "hidden",
  padding: "8px 12px",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const tableNumericCellStyle: CSSProperties = {
  ...tableCellStyle,
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
};

const tableRowHeaderCellStyle: CSSProperties = {
  ...tableCellStyle,
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 650,
  left: 0,
  position: "sticky",
  zIndex: 1,
};

const tableTotalHeaderCellStyle: CSSProperties = {
  ...tableHeaderCellStyle,
  background: "#eef6ff",
  color: "#1d4ed8",
};

const tableTotalCellStyle: CSSProperties = {
  ...tableNumericCellStyle,
  background: "#f8fbff",
  color: "#0f172a",
  fontWeight: 700,
};

const heatmapCellBaseStyle: CSSProperties = {
  ...tableNumericCellStyle,
  borderBottom: "2px solid #fff",
  borderLeft: "2px solid #fff",
  color: "#0f172a",
  fontWeight: 600,
  minWidth: 82,
  textAlign: "center",
};

const tableFooterStyle: CSSProperties = {
  alignItems: "center",
  background: "#fbfdff",
  borderTop: "1px solid #edf2f7",
  color: "#64748b",
  display: "flex",
  flex: "0 0 auto",
  fontSize: 11,
  gap: 8,
  justifyContent: "space-between",
  minHeight: 34,
  padding: "7px 12px",
};

const tableStatusStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  minWidth: 0,
};

const tablePaginationStyle: CSSProperties = {
  alignItems: "center",
  borderTop: "1px solid #f0f0f0",
  color: "#595959",
  display: "flex",
  flex: "0 0 auto",
  fontSize: 12,
  gap: 8,
  justifyContent: "flex-end",
  padding: "8px 12px",
};

const tablePagerButtonStyle: CSSProperties = {
  background: "#fff",
  border: "1px solid #d9d9d9",
  borderRadius: 4,
  color: "#262626",
  cursor: "pointer",
  font: "inherit",
  height: 26,
  padding: "0 8px",
};

const trendShellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  height: "100%",
  minHeight: 0,
};

const trendSummaryStyle: CSSProperties = {
  display: "grid",
  flex: "0 0 auto",
  gap: 8,
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
};

const trendSummaryItemStyle: CSSProperties = {
  background: "linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)",
  border: "1px solid #e2eaf4",
  borderRadius: 8,
  minWidth: 0,
  padding: "9px 10px",
};

const trendSummaryLabelStyle: CSSProperties = {
  color: "#64748b",
  display: "block",
  fontSize: 11,
  lineHeight: 1.4,
};

const trendSummaryValueStyle: CSSProperties = {
  color: "#0f172a",
  display: "block",
  fontSize: 19,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 750,
  lineHeight: 1.35,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const trendChartStyle: CSSProperties = {
  flex: "1 1 auto",
  minHeight: 0,
};

const metricTrendShellStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto minmax(150px, 1fr)",
  height: "100%",
  minHeight: 0,
  padding: 12,
  rowGap: 12,
};

const metricTrendCardsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  minWidth: 0,
  overflowX: "auto",
  paddingBottom: 2,
  scrollbarWidth: "thin",
};

const metricTrendCardStyle: CSSProperties = {
  alignItems: "center",
  appearance: "none",
  background: "#f8fafc",
  border: 0,
  borderRadius: 6,
  boxShadow: "none",
  cursor: "pointer",
  display: "flex",
  flex: "0 0 clamp(176px, 24%, 360px)",
  flexDirection: "column",
  font: "inherit",
  justifyContent: "center",
  minHeight: 80,
  minWidth: 0,
  outline: 0,
  padding: "12px 16px",
  textAlign: "center",
};

const metricTrendPrimaryCardStyle: CSSProperties = {
  ...metricTrendCardStyle,
  background: "#e8f1ff",
};

const metricTrendLabelStyle: CSSProperties = {
  color: "#1f2937",
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metricTrendValueStyle: CSSProperties = {
  color: "#020617",
  display: "block",
  fontSize: 24,
  fontWeight: 760,
  lineHeight: 1.2,
  marginTop: 8,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metricTrendChartStyle: CSSProperties = {
  minHeight: 150,
  minWidth: 0,
};

const kpiShellStyle: CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  height: "100%",
  justifyContent: "center",
  minHeight: 0,
  overflow: "hidden",
  padding: "10px 12px",
};

const kpiValueStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 32,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
  lineHeight: 1.1,
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const kpiMetaStackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  width: "100%",
};

const kpiMetaRowStyle: CSSProperties = {
  alignItems: "center",
  color: "#64748b",
  display: "flex",
  fontSize: 12,
  fontWeight: 600,
  gap: 8,
  justifyContent: "space-between",
  lineHeight: 1.4,
  minWidth: 0,
};

const kpiPositiveStyle: CSSProperties = {
  color: "#08705d",
};

const kpiNegativeStyle: CSSProperties = {
  color: "#b42318",
};

const kpiProgressTrackStyle: CSSProperties = {
  background: "#e8eef6",
  borderRadius: 999,
  height: 6,
  overflow: "hidden",
  width: "100%",
};

const kpiProgressBarStyle: CSSProperties = {
  background: "#1677ff",
  borderRadius: 999,
  height: "100%",
};

const flipNumberShellStyle: CSSProperties = {
  ...kpiShellStyle,
  alignItems: "stretch",
  background: "#ffffff",
  borderRadius: 6,
  padding: "14px 16px",
  textAlign: "center",
};

const flipNumberGridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  minHeight: 0,
  width: "100%",
};

const flipNumberCardStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  minHeight: 112,
  minWidth: 0,
};

const flipNumberTitleStyle: CSSProperties = {
  color: "#1f2937",
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.35,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  width: "100%",
};

const flipNumberValueStyle: CSSProperties = {
  ...kpiValueStyle,
  fontSize: 28,
  fontWeight: 800,
  textAlign: "center",
};

const flipNumberRollingTrackStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  transition: "transform 360ms cubic-bezier(0.22, 1, 0.36, 1)",
  willChange: "transform",
};

const flipNumberRollingLineStyle: CSSProperties = {
  display: "block",
  height: "1.1em",
  lineHeight: 1.1,
};

const progressBarShellStyle: CSSProperties = {
  ...kpiShellStyle,
  background: "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
  borderRadius: 8,
  padding: "16px 18px",
};

const progressBarListStyle: CSSProperties = {
  columnGap: 24,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  overflow: "auto",
  rowGap: 14,
  width: "100%",
};

const progressBarItemStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  minWidth: 0,
};

const progressBarHeaderStyle: CSSProperties = {
  alignItems: "center",
  color: "#0f172a",
  display: "flex",
  fontSize: 13,
  gap: 12,
  justifyContent: "space-between",
  lineHeight: 1.35,
  minWidth: 0,
};

const progressBarLabelStyle: CSSProperties = {
  fontWeight: 500,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const progressBarPercentStyle: CSSProperties = {
  fontSize: 16,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const progressBarValueStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 600,
  lineHeight: 1.35,
};

const metricBreakdownShellStyle: CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: 12,
  height: "auto",
  minHeight: 0,
  overflow: "hidden",
  padding: "8px 14px 14px",
};

const metricBreakdownSummaryStyle: CSSProperties = {
  alignItems: "flex-end",
  display: "flex",
  gap: 16,
  justifyContent: "space-between",
  minWidth: 0,
  padding: "0 0 4px",
};

const metricBreakdownSummaryLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 600,
  lineHeight: 1.3,
};

const metricBreakdownSummaryValueStyle: CSSProperties = {
  color: "#0f172a",
  display: "block",
  fontSize: 27,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 800,
  letterSpacing: 0,
  lineHeight: 1.15,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metricBreakdownSummaryMetaStyle: CSSProperties = {
  color: "#94a3b8",
  flex: "0 0 auto",
  fontSize: 12,
  lineHeight: 1.3,
  paddingBottom: 3,
};

const metricBreakdownListStyle: CSSProperties = {
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: 9,
  minHeight: 0,
  overflow: "auto",
  paddingRight: 2,
};

const metricBreakdownColumnHeaderStyle: CSSProperties = {
  color: "#94a3b8",
  display: "grid",
  fontSize: 11,
  fontWeight: 600,
  gap: 12,
  gridTemplateColumns: "minmax(116px, 0.9fr) minmax(130px, 1.75fr) minmax(118px, 0.85fr)",
  lineHeight: 1.2,
  minWidth: 0,
  paddingBottom: 1,
};

const metricBreakdownRowStyle: CSSProperties = {
  alignItems: "center",
  borderRadius: 4,
  display: "grid",
  gap: 12,
  gridTemplateColumns: "minmax(116px, 0.9fr) minmax(130px, 1.75fr) minmax(118px, 0.85fr)",
  minWidth: 0,
  padding: "3px 0",
};

const metricBreakdownLabelGroupStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  gap: 8,
  minWidth: 0,
};

const metricBreakdownRankStyle: CSSProperties = {
  color: "#94a3b8",
  flex: "0 0 auto",
  fontSize: 11,
  fontVariantNumeric: "tabular-nums",
  width: 18,
};

const metricBreakdownLabelStyle: CSSProperties = {
  color: "#1f2937",
  fontSize: 12,
  fontWeight: 650,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metricBreakdownTrackStyle: CSSProperties = {
  alignSelf: "center",
  background: "#edf3f9",
  borderRadius: 999,
  height: 7,
  overflow: "hidden",
  width: "100%",
};

const metricBreakdownBarStyle: CSSProperties = {
  background: "#2f7cf6",
  borderRadius: 999,
  display: "block",
  height: "100%",
};

const metricBreakdownValueStyle: CSSProperties = {
  alignItems: "baseline",
  display: "flex",
  gap: 6,
  justifyContent: "flex-end",
  minWidth: 0,
};

const metricBreakdownValueNumberStyle: CSSProperties = {
  color: "#334155",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 650,
  overflow: "hidden",
  textAlign: "right",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metricBreakdownShareStyle: CSSProperties = {
  color: "#64748b",
  flex: "0 0 auto",
  fontSize: 11,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const rankingShellStyle: CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: 8,
  minHeight: 0,
  overflow: "auto",
  padding: "10px 14px 14px",
};

const rankingHeaderStyle: CSSProperties = {
  alignItems: "center",
  color: "#64748b",
  display: "grid",
  fontSize: 11,
  fontWeight: 600,
  gap: 10,
  lineHeight: 1.25,
  minWidth: 420,
  paddingBottom: 2,
};

const rankingRowStyle: CSSProperties = {
  alignItems: "center",
  display: "grid",
  gap: 10,
  minWidth: 420,
  padding: "3px 0",
};

const rankingBadgeStyle: CSSProperties = {
  alignItems: "center",
  clipPath: "polygon(50% 0%, 61% 34%, 98% 35%, 68% 56%, 79% 92%, 50% 71%, 21% 92%, 32% 56%, 2% 35%, 39% 34%)",
  color: "#fff",
  display: "inline-flex",
  fontSize: 10,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 800,
  height: 22,
  justifyContent: "center",
  lineHeight: 1,
  width: 22,
};

const rankingOrdinalStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
  textAlign: "center",
  width: 22,
};

const rankingLabelStyle: CSSProperties = {
  color: "#334155",
  fontSize: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rankingTrackStyle: CSSProperties = {
  background: "#e8f0ff",
  borderRadius: 999,
  height: 7,
  overflow: "hidden",
  width: "100%",
};

const rankingBarStyle: CSSProperties = {
  background: "#3f7df4",
  borderRadius: 999,
  display: "block",
  height: "100%",
};

const rankingValueStyle: CSSProperties = {
  color: "#334155",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
  overflow: "hidden",
  textAlign: "right",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rankingMedalColors = ["#f6b51f", "#aeb9c8", "#c9844b"] as const;

const progressBarColors = ["#3b82f6", "#35c7c9", "#a78bfa", "#f6bd7b", "#8b8aa8", "#22c55e"];

const kpiBoardGridStyle: CSSProperties = {
  display: "grid",
  flex: "1 1 auto",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  minHeight: 0,
  overflow: "auto",
};

const kpiBoardCardStyle: CSSProperties = {
  borderRight: "1px solid #edf2f7",
  borderBottom: "1px solid #edf2f7",
  minHeight: 150,
  minWidth: 0,
  padding: "12px 10px",
};

const kpiBoardPeriodStyle: CSSProperties = {
  color: "#334155",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.3,
  marginBottom: 4,
};

const kpiBoardMetricNameStyle: CSSProperties = {
  color: "#111827",
  fontSize: 12,
  lineHeight: 1.35,
};

const kpiBoardValueStyle: CSSProperties = {
  color: "#020617",
  fontSize: 28,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 800,
  lineHeight: 1.2,
  margin: "4px 0 12px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const kpiBoardRowsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const kpiBoardRowStyle: CSSProperties = {
  alignItems: "center",
  display: "grid",
  gap: 8,
  gridTemplateColumns: "minmax(0, 1fr) auto",
  minWidth: 0,
};

const kpiBoardRowLabelStyle: CSSProperties = {
  color: "#334155",
  fontSize: 12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const kpiBoardRowValueStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 16,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const disabledPagerButtonStyle: CSSProperties = {
  ...tablePagerButtonStyle,
  color: "#bfbfbf",
  cursor: "not-allowed",
};

const titleIncludes = (component: ComponentInstance, ...keywords: readonly string[]): boolean => {
  const title = component.title ?? "";
  return keywords.some((keyword) => title.includes(keyword));
};

const DemoSvg = ({ testId, children }: { readonly testId: string; readonly children: React.ReactNode }) => (
  <svg data-testid={testId} viewBox="0 0 520 220" preserveAspectRatio="xMidYMid meet" style={svgStyle}>
    {children}
  </svg>
);

const LineDemo = ({ area = false, stacked = false }: { readonly area?: boolean; readonly stacked?: boolean }) => (
  <DemoSvg testId={stacked ? "empty-demo-stacked-line" : area ? "empty-demo-area" : "empty-demo-line"}>
    {[55, 85, 115, 145, 175].map((y) => <line key={y} x1="48" y1={y} x2="480" y2={y} stroke="#ececec" />)}
    <polyline points="54,160 105,138 158,148 220,112 284,80 342,118 420,108 472,96" fill="none" stroke="#b7b7b7" strokeWidth="3" />
    <polyline points="54,160 105,138 158,148 220,112 284,80 342,118 420,108 472,96 472,178 54,178" fill={area ? "#d8d8d8" : "none"} opacity={area ? "0.55" : "1"} />
    {stacked && <polyline points="54,128 105,118 158,126 220,96 284,68 342,98 420,88 472,80" fill="none" stroke="#d0d0d0" strokeWidth="2" />}
    {["1204", "1205", "1206", "1207", "1208", "1209", "1210", "1211"].map((label, index) => (
      <text key={label} x={56 + index * 59} y="196" fill="#b0b0b0" fontSize="12" textAnchor="middle">{label}</text>
    ))}
  </DemoSvg>
);

const BarDemo = ({ horizontal = false, stacked = false }: { readonly horizontal?: boolean; readonly stacked?: boolean }) => (
  <DemoSvg testId={horizontal ? "empty-demo-strip" : stacked ? "empty-demo-stacked-bar" : "empty-demo-bar"}>
    {[55, 85, 115, 145, 175].map((y) => <line key={y} x1="48" y1={y} x2="480" y2={y} stroke="#eeeeee" />)}
    {horizontal ? [58, 88, 118, 148, 178].map((y, index) => (
      <g key={y}>
        <text x="66" y={y + 12} fill="#b3b3b3" fontSize="12" textAnchor="end">{["A", "B", "C", "D", "E"][index]}</text>
        <rect x="82" y={y} width={[250, 190, 330, 145, 285][index]} height="14" fill="#c9c9c9" />
      </g>
    )) : [90, 145, 200, 255, 310, 365, 420].map((x, index) => (
      <g key={x}>
        {stacked ? (
          <>
            <rect x={x} y={120 - index * 5} width="26" height="58" fill="#d6d6d6" />
            <rect x={x} y={86 - index * 4} width="26" height="34" fill="#bdbdbd" />
          </>
        ) : (
          <rect x={x} y={[128, 104, 138, 78, 112, 62, 92][index]} width="26" height={178 - [128, 104, 138, 78, 112, 62, 92][index]!} fill="#c8c8c8" />
        )}
      </g>
    ))}
  </DemoSvg>
);

const FunnelDemo = () => (
  <DemoSvg testId="empty-demo-funnel">
    {[
      "130,42 400,42 364,76 166,76",
      "166,78 364,78 330,112 200,112",
      "200,114 330,114 302,148 228,148",
      "228,150 302,150 280,184 250,184",
    ].map((points, index) => (
      <polygon key={points} points={points} fill={["#b8b8b8", "#c8c8c8", "#d3d3d3", "#dedede"][index]} />
    ))}
    {["100%", "65.6%", "92.2%", "17.4%"].map((label, index) => (
      <text key={label} x="265" y={64 + index * 36} fill="#9f9f9f" fontSize="12" textAnchor="middle">{label}</text>
    ))}
  </DemoSvg>
);

const WaterfallDemo = () => (
  <DemoSvg testId="empty-demo-waterfall">
    {[60, 95, 130, 165].map((y) => <line key={y} x1="54" y1={y} x2="470" y2={y} stroke="#eeeeee" />)}
    {[
      [88, 126, 42],
      [150, 94, 74],
      [212, 118, 50],
      [274, 74, 94],
      [336, 108, 60],
      [398, 88, 80],
    ].map(([x, y, h]) => <rect key={x} x={x} y={y} width="32" height={h} fill="#c9c9c9" />)}
  </DemoSvg>
);

const BulletDemo = () => (
  <DemoSvg testId="empty-demo-bullet">
    {[72, 116, 160].map((y, index) => (
      <g key={y}>
        <rect x="96" y={y} width="320" height="18" fill="#eeeeee" />
        <rect x="96" y={y} width={[215, 165, 260][index]} height="18" fill="#c8c8c8" />
        <line x1={[344, 284, 390][index]} y1={y - 6} x2={[344, 284, 390][index]} y2={y + 24} stroke="#9f9f9f" strokeWidth="2" />
      </g>
    ))}
  </DemoSvg>
);

const BoxplotDemo = () => (
  <DemoSvg testId="empty-demo-boxplot">
    {[60, 95, 130, 165].map((y) => <line key={y} x1="70" y1={y} x2="450" y2={y} stroke="#eeeeee" />)}
    {[130, 210, 290, 370].map((x, index) => (
      <g key={x}>
        <line x1={x} y1={55 + index * 7} x2={x} y2={168 - index * 4} stroke="#b5b5b5" />
        <rect x={x - 24} y={82 + index * 4} width="48" height="54" fill="#d4d4d4" stroke="#b5b5b5" />
        <line x1={x - 24} y1={108 + index * 2} x2={x + 24} y2={108 + index * 2} stroke="#9f9f9f" />
      </g>
    ))}
  </DemoSvg>
);

const RingBarDemo = () => (
  <DemoSvg testId="empty-demo-ring-bar">
    {[
      { x: 160, endX: 28, endY: 149, label: "66%" },
      { x: 260, endX: 40, endY: 132, label: "82%" },
      { x: 360, endX: 18, endY: 154, label: "48%" },
    ].map(({ x, endX, endY, label }) => (
      <g key={x}>
        <circle cx={x} cy="110" r="48" fill="none" stroke="#eeeeee" strokeWidth="14" />
        <path d={`M ${x} 62 A 48 48 0 1 1 ${x + endX} ${endY}`} fill="none" stroke="#bdbdbd" strokeWidth="14" strokeLinecap="round" />
        <text x={x} y="116" textAnchor="middle" fill="#a0a0a0" fontSize="16">{label}</text>
      </g>
    ))}
  </DemoSvg>
);

const PieDemo = ({ rose = false, donut = false }: { readonly rose?: boolean; readonly donut?: boolean }) => (
  <DemoSvg testId={rose ? "empty-demo-rose" : donut ? "empty-demo-donut" : "empty-demo-pie"}>
    <circle cx="260" cy="110" r="64" fill="#d7d7d7" />
    <path d="M260 110 L260 46 A64 64 0 0 1 318 137 Z" fill="#b8b8b8" />
    <path d="M260 110 L318 137 A64 64 0 0 1 224 164 Z" fill="#c8c8c8" />
    {rose && [34, 50, 66, 78].map((r, index) => (
      <path key={r} d={`M260 110 L260 ${110 - r} A${r} ${r} 0 0 1 ${260 + r * 0.82} ${110 + r * 0.56} Z`} fill={["#d0d0d0", "#c0c0c0", "#b7b7b7", "#dddddd"][index]} opacity="0.75" />
    ))}
    {donut && <circle cx="260" cy="110" r="35" fill="#fff" />}
  </DemoSvg>
);

const RadarDemo = () => (
  <DemoSvg testId="empty-demo-radar">
    {[32, 54, 76].map((r) => <polygon key={r} points={`260,${110 - r} ${260 + r * 0.95},${110 - r * 0.3} ${260 + r * 0.58},${110 + r * 0.82} ${260 - r * 0.58},${110 + r * 0.82} ${260 - r * 0.95},${110 - r * 0.3}`} fill="none" stroke="#e4e4e4" />)}
    <polygon points="260,50 314,94 298,154 236,144 204,96" fill="#c7c7c7" opacity="0.78" />
  </DemoSvg>
);

const TreemapDemo = () => (
  <DemoSvg testId="empty-demo-treemap">
    <rect x="94" y="44" width="158" height="132" fill="#c6c6c6" />
    <rect x="258" y="44" width="168" height="62" fill="#d4d4d4" />
    <rect x="258" y="112" width="78" height="64" fill="#b9b9b9" />
    <rect x="342" y="112" width="84" height="64" fill="#dfdfdf" />
  </DemoSvg>
);

const SunburstDemo = () => (
  <DemoSvg testId="empty-demo-sunburst">
    <circle cx="260" cy="110" r="28" fill="#c5c5c5" />
    <circle cx="260" cy="110" r="58" fill="none" stroke="#d4d4d4" strokeWidth="28" />
    <path d="M260 52 A58 58 0 0 1 314 132" fill="none" stroke="#b8b8b8" strokeWidth="28" />
    <circle cx="260" cy="110" r="88" fill="none" stroke="#e0e0e0" strokeWidth="24" />
    <path d="M260 22 A88 88 0 0 1 348 110" fill="none" stroke="#c8c8c8" strokeWidth="24" />
  </DemoSvg>
);

const LiquidDemo = () => (
  <DemoSvg testId="empty-demo-liquid">
    <circle cx="260" cy="110" r="58" fill="none" stroke="#dfdfdf" strokeWidth="4" />
    <clipPath id="empty-liquid-clip"><circle cx="260" cy="110" r="54" /></clipPath>
    <g clipPath="url(#empty-liquid-clip)">
      <rect x="206" y="104" width="108" height="60" fill="#bdbdbd" />
      <path d="M206 104 C232 82 250 128 276 102 C294 86 306 92 314 84 L314 164 L206 164 Z" fill="#c8c8c8" />
    </g>
    <text x="260" y="112" textAnchor="middle" fill="#ffffff" fontSize="22" fontWeight="700">75.6%</text>
    <text x="260" y="132" textAnchor="middle" fill="#efefef" fontSize="11">Amount of profit</text>
    <text x="260" y="182" textAnchor="middle" fill="#b8b8b8" fontSize="12">Actual: 706,364,820</text>
    <text x="260" y="200" textAnchor="middle" fill="#b8b8b8" fontSize="12">Target: 934,345,000</text>
  </DemoSvg>
);

const liquidShellStyle: CSSProperties = {
  alignItems: "center",
  display: "flex",
  flexDirection: "column",
  height: "100%",
  justifyContent: "center",
  minHeight: 0,
  padding: "4px 8px 8px",
};

const liquidChartStyle: CSSProperties = {
  display: "block",
  flex: "1 1 auto",
  maxHeight: "calc(100% - 28px)",
  minHeight: 0,
  width: "100%",
};

const liquidSummaryStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  lineHeight: 1.4,
  marginTop: -2,
  overflow: "hidden",
  textAlign: "center",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  width: "100%",
};

const metricChartGridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  gridAutoRows: "minmax(220px, 1fr)",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  height: "100%",
  minHeight: 0,
  overflow: "auto",
  padding: 8,
};

const metricChartCellStyle: CSSProperties = {
  minHeight: 220,
  minWidth: 0,
};

const LiquidChart = ({ component, model, groupLabel }: {
  readonly component: ComponentInstance;
  readonly model: ReturnType<typeof buildLiquidModel>;
  readonly groupLabel?: string | undefined;
}) => {
  const uid = `${component.id}-${groupLabel ?? "all"}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const gradientId = `liquid-gradient-${uid}`;
  const clipId = `liquid-clip-${uid}`;
  const waterY = 179 - model.fillPercentage * 1.48;
  const primaryWave = `M0 ${waterY} C42 ${waterY - 10} 74 ${waterY + 10} 116 ${waterY} S190 ${waterY - 10} 232 ${waterY} S306 ${waterY + 10} 320 ${waterY} V240 H0 Z`;
  const secondaryWave = `M0 ${waterY + 5} C46 ${waterY + 15} 78 ${waterY - 5} 122 ${waterY + 5} S196 ${waterY + 15} 238 ${waterY + 5} S304 ${waterY - 5} 320 ${waterY + 5} V240 H0 Z`;
  const displayPercentage = model.percentage === null ? "—" : `${model.percentage.toFixed(model.decimals)}%`;
  const summary = `实际 ${formatCompactMetricNumber(model.value)} / 目标 ${formatCompactMetricNumber(model.target)}`;

  return (
    <section data-testid="liquid-chart-surface" role="img" aria-label={`${component.title ?? "水波图"}${groupLabel === undefined ? "" : ` ${groupLabel}`}图表`} style={liquidShellStyle}>
      <svg viewBox="0 0 320 240" aria-hidden="true" preserveAspectRatio="xMidYMid meet" style={liquidChartStyle}>
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#5ea0ff" />
            <stop offset="100%" stopColor="#1677ff" />
          </linearGradient>
          <clipPath id={clipId}><circle cx="160" cy="105" r="74" /></clipPath>
        </defs>
        <circle cx="160" cy="105" r="76" fill="#f3f8ff" stroke="#b9d7ff" strokeWidth="2" />
        <g clipPath={`url(#${clipId})`}>
          <rect x="0" y={waterY} width="320" height={240 - waterY} fill={`url(#${gradientId})`} opacity="0.8" />
          <g fill="#7db4ff" opacity="0.56">
            <path d={secondaryWave}>
              <animateTransform attributeName="transform" type="translate" values="0 0;32 0;0 0" dur="4.4s" repeatCount="indefinite" />
            </path>
          </g>
          <g fill={`url(#${gradientId})`}>
            <path d={primaryWave}>
              <animateTransform attributeName="transform" type="translate" values="0 0;-32 0;0 0" dur="3.6s" repeatCount="indefinite" />
            </path>
          </g>
        </g>
        <circle cx="160" cy="105" r="74" fill="none" stroke="#83b4ff" strokeWidth="1" />
        <text x="160" y="101" textAnchor="middle" fill="#0f172a" fontSize="26" fontWeight="700">{displayPercentage}</text>
        <text x="160" y="123" textAnchor="middle" fill="#475569" fontSize="11">{groupLabel ?? model.label}</text>
      </svg>
      <div style={liquidSummaryStyle} title={summary}>{summary}</div>
    </section>
  );
};

const GaugeDemo = () => (
  <DemoSvg testId="empty-demo-gauge">
    <path d="M178 148 A82 82 0 0 1 342 148" fill="none" stroke="#e8e8e8" strokeWidth="22" />
    <path d="M178 148 A82 82 0 0 1 326 100" fill="none" stroke="#bdbdbd" strokeWidth="22" />
    {[0, 25, 50, 75, 100].map((value, index) => (
      <text key={value} x={186 + index * 37} y={160 - Math.sin(index / 4 * Math.PI) * 70} fill="#b0b0b0" fontSize="10" textAnchor="middle">{value}%</text>
    ))}
    <text x="260" y="160" textAnchor="middle" fill="#a8a8a8" fontSize="20" fontWeight="700">309.8W</text>
    <text x="260" y="182" textAnchor="middle" fill="#b8b8b8" fontSize="12">Proportion: 77.5%</text>
  </DemoSvg>
);

const ProgressDemo = () => (
  <DemoSvg testId="empty-demo-progress">
    {[76, 116, 156].map((y, index) => (
      <g key={y}>
        <rect x="118" y={y} width="284" height="12" rx="6" fill="#ededed" />
        <rect x="118" y={y} width={[190, 232, 150][index]} height="12" rx="6" fill="#c8c8c8" />
      </g>
    ))}
  </DemoSvg>
);

const FlipNumberDemo = () => (
  <DemoSvg testId="empty-demo-flip-number">
    {[164, 250, 336].map((x, index) => (
      <g key={x}>
        <rect x={x} y="80" width="64" height="92" rx="8" fill="#ededed" />
        <path d={`M${x} 126 H${x + 64}`} stroke="#d5d5d5" />
        <text x={x + 32} y="119" textAnchor="middle" fill="#b5b5b5" fontSize="31" fontWeight="700">
          {["8", "6", "4"][index]}
        </text>
      </g>
    ))}
    <text x="260" y="204" textAnchor="middle" fill="#b8b8b8" fontSize="12">指标数值</text>
  </DemoSvg>
);

const MetricDemo = () => (
  <div data-testid="empty-demo-metric" style={{ alignItems: "center", display: "flex", height: 220, justifyContent: "center" }}>
    <div style={{ color: "#c2c2c2", fontSize: 38, fontWeight: 700 }}>76</div>
  </div>
);

const MetricBreakdownDemo = () => (
  <DemoSvg testId="empty-demo-metric-breakdown">
    {[78, 112, 146, 180].map((y, index) => (
      <g key={y}>
        <rect x="126" y={y} width="238" height="12" rx="6" fill="#ededed" />
        <rect x="126" y={y} width={[216, 164, 118, 72][index]} height="12" rx="6" fill="#c6c6c6" />
        <text x="116" y={y + 10} textAnchor="end" fill="#b2b2b2" fontSize="11">{["A", "B", "C", "D"][index]}</text>
      </g>
    ))}
  </DemoSvg>
);

const HeatmapDemo = () => (
  <div data-testid="empty-demo-heatmap" style={{ display: "grid", gap: 4, gridTemplateColumns: "repeat(6, 1fr)", height: 176, padding: "28px 48px" }}>
    {Array.from({ length: 30 }, (_, index) => (
      <span key={index} style={{ background: ["#eeeeee", "#dedede", "#c8c8c8", "#b8b8b8"][index % 4], minHeight: 18 }} />
    ))}
  </div>
);

const TableDemo = () => (
  <div data-testid="empty-demo-table" style={{ padding: "28px 40px" }}>
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>{["Region", "Sales", "Growth"].map((column) => <th key={column} style={{ borderBottom: "1px solid #e5e5e5", color: "#aaa", padding: 8, textAlign: "left" }}>{column}</th>)}</tr>
      </thead>
      <tbody>
        {["North", "East", "South"].map((region, index) => (
          <tr key={region}>
            <td style={{ borderBottom: "1px solid #ededed", color: "#b6b6b6", padding: 8 }}>{region}</td>
            <td style={{ borderBottom: "1px solid #ededed", color: "#b6b6b6", padding: 8 }}>{[1280, 960, 760][index]}</td>
            <td style={{ borderBottom: "1px solid #ededed", color: "#b6b6b6", padding: 8 }}>{["12.3%", "8.5%", "6.2%"][index]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const buildEmptyDataDemo = (component: ComponentInstance): React.ReactNode => {
  if (component.type === "flipNumber") return <FlipNumberDemo />;
  if (component.type === "progressBar") return <ProgressDemo />;
  if (component.type === "trend") {
    return <LineDemo area />;
  }
  if (component.type === "metricTrend") {
    return <LineDemo area />;
  }
  if (component.type === "metricBreakdown") return <MetricBreakdownDemo />;
  if (component.type === "percentBar") return <BarDemo stacked />;
  if (component.type === "percentArea") return <LineDemo area stacked />;
  if (component.type === "line" || component.type === "area" || component.type === "stackedArea") {
    return <LineDemo
      area={component.type !== "line" || Boolean(component.props.area)}
      stacked={component.type === "stackedArea"}
    />;
  }
  if (component.type === "stackedBar") return <BarDemo stacked />;
  if (component.type === "ringBar") return <RingBarDemo />;
  if (component.type === "ranking") return <BarDemo horizontal />;
  if (component.type === "bar") {
    if (titleIncludes(component, "漏斗")) return <FunnelDemo />;
    if (titleIncludes(component, "瀑布")) return <WaterfallDemo />;
    if (titleIncludes(component, "子弹")) return <BulletDemo />;
    if (titleIncludes(component, "箱形")) return <BoxplotDemo />;
    if (titleIncludes(component, "环形")) return <RingBarDemo />;
    if (titleIncludes(component, "条形", "排行", "动态")) return <BarDemo horizontal />;
    return <BarDemo stacked={titleIncludes(component, "堆积", "百分比")} />;
  }
  if (component.type === "rose") return <PieDemo rose />;
  if (component.type === "sunburst") return <SunburstDemo />;
  if (component.type === "radar") return <RadarDemo />;
  if (component.type === "treemap") return <TreemapDemo />;
  if (component.type === "pie") {
    if (titleIncludes(component, "雷达")) return <RadarDemo />;
    if (titleIncludes(component, "矩形")) return <TreemapDemo />;
    if (titleIncludes(component, "旭日")) return <SunburstDemo />;
    if (titleIncludes(component, "玫瑰")) return <PieDemo rose />;
    return <PieDemo donut={titleIncludes(component, "环形")} />;
  }
  if (component.type === "kpi") {
    if (titleIncludes(component, "水波")) return <LiquidDemo />;
    if (titleIncludes(component, "仪表")) return <GaugeDemo />;
    if (titleIncludes(component, "进度")) return <ProgressDemo />;
    if (titleIncludes(component, "翻牌")) return <FlipNumberDemo />;
    return <MetricDemo />;
  }
  if (component.type === "liquid") return <LiquidDemo />;
  if (component.type === "gauge") return <GaugeDemo />;
  if (component.type === "table") {
    return titleIncludes(component, "热力") ? <HeatmapDemo /> : <TableDemo />;
  }
  if (component.type === "heatmap") {
    return <HeatmapDemo />;
  }
  if (component.type === "crosstab") {
    return <TableDemo />;
  }
  if (component.type === "multidimensional") {
    return <TableDemo />;
  }
  return null;
};

const formatCrosstabNumber = (value: number): string => new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
}).format(value);

const heatmapCellFill = (intensity: number): string => {
  const clamped = Math.max(0, Math.min(1, intensity));
  const lightness = 96 - clamped * 48;
  const saturation = 82 - clamped * 16;
  return `hsl(213deg ${saturation}% ${lightness}%)`;
};

const formatTrendNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
};

const formatMetricNumber = (value: number | null | undefined, decimals: number): string => {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

const formatCompactMetricNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  if (Math.abs(value) >= 10000) {
    return `${new Intl.NumberFormat("zh-CN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
      useGrouping: false,
    }).format(value / 10000)}万`;
  }
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
};

const formatFlipNumber = (
  value: number | null | undefined,
  decimals: number,
  prefix: string,
  suffix: string,
): string => `${prefix}${Math.abs(value ?? 0) >= 10000
  ? formatCompactMetricNumber(value)
  : formatMetricNumber(value, decimals)}${suffix}`;

const formatTrendRate = (rate: number | null | undefined): string => {
  if (rate === null || rate === undefined) return "—";
  return `${(rate * 100).toFixed(1)}%`;
};

const formatKpiRate = (rate: number | null | undefined): string => {
  if (rate === null || rate === undefined) return "—";
  return `${rate > 0 ? "+" : ""}${(rate * 100).toFixed(1)}%`;
};

const formatKpiProgress = (progress: number | null | undefined): string => {
  if (progress === null || progress === undefined) return "—";
  return `${(progress * 100).toFixed(1)}%`;
};

const formatKpiBoardNumber = (value: number | null): string => {
  if (value === null) return "—";
  if (Math.abs(value) >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  }).format(value);
};

const RollingMetricValue = ({
  ariaLabel,
  value,
}: {
  readonly ariaLabel: string;
  readonly value: string;
}) => {
  const latestValue = useRef(value);
  const [previousValue, setPreviousValue] = useState(value);
  const [currentValue, setCurrentValue] = useState(value);
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    if (value === latestValue.current) return undefined;
    const previous = latestValue.current;
    latestValue.current = value;
    setPreviousValue(previous);
    setCurrentValue(value);
    setRolling(false);

    const start = globalThis.setTimeout(() => setRolling(true), 16);
    const settle = globalThis.setTimeout(() => {
      setPreviousValue(value);
      setRolling(false);
    }, 420);

    return () => {
      globalThis.clearTimeout(start);
      globalThis.clearTimeout(settle);
    };
  }, [value]);

  return (
    <strong
      aria-label={ariaLabel}
      data-rolling={rolling ? "true" : "false"}
      data-testid="flip-number-rolling-value"
      style={{ ...flipNumberValueStyle, height: "1.1em", overflow: "hidden" }}
    >
      <span style={{ ...flipNumberRollingTrackStyle, transform: rolling ? "translateY(-50%)" : "translateY(0)" }}>
        <span style={flipNumberRollingLineStyle}>{previousValue}</span>
        <span style={flipNumberRollingLineStyle}>{currentValue}</span>
      </span>
    </strong>
  );
};

const compactCount = (value: number, suffix: string): string => `${formatCrosstabNumber(value)} ${suffix}`;

const isLegacyFlipNumberKpi = (component: ComponentInstance): boolean =>
  component.type === "kpi" && component.title?.trim() === "翻牌器";

const isLegacyGaugeKpi = (component: ComponentInstance): boolean =>
  component.type === "kpi" && component.title?.trim() === "仪表盘";

const SurfaceChip = ({ children, tone = "blue" }: { readonly children: React.ReactNode; readonly tone?: "blue" | "teal" | "amber" }) => {
  const toneStyle: CSSProperties = tone === "teal"
    ? { background: "#effdf8", borderColor: "#c7f0df", color: "#08705d" }
    : tone === "amber"
      ? { background: "#fff8e6", borderColor: "#fde8a7", color: "#8a5a00" }
      : {};
  return <span style={{ ...chipStyle, ...toneStyle }}>{children}</span>;
};

const DataSurface = ({
  children,
  eyebrow,
  footer,
  testId,
  title,
  chips = [],
  variant = "default",
}: {
  readonly children: React.ReactNode;
  readonly eyebrow?: string;
  readonly footer?: React.ReactNode;
  readonly testId: string;
  readonly title?: string;
  readonly chips?: readonly React.ReactNode[];
  readonly variant?: "default" | "flat";
}) => (
  <section
    data-testid={testId}
    style={variant === "flat"
      ? { ...dataSurfaceStyle, background: "transparent", border: "none", borderRadius: 0, boxShadow: "none" }
      : dataSurfaceStyle}
  >
    {(eyebrow !== undefined || title !== undefined || chips.length > 0) && (
      <header style={variant === "flat" ? { ...dataSurfaceHeaderStyle, borderBottom: "none", padding: "4px 14px 6px" } : dataSurfaceHeaderStyle}>
        {(eyebrow !== undefined || title !== undefined) && (
          <div style={dataSurfaceTitleBlockStyle}>
            {eyebrow !== undefined && <span style={dataSurfaceEyebrowStyle}>{eyebrow}</span>}
            {title !== undefined && <strong style={dataSurfaceTitleStyle}>{title}</strong>}
          </div>
        )}
        {chips.length > 0 && <div style={chipRailStyle}>{chips.map((chip, index) => <span key={index}>{chip}</span>)}</div>}
      </header>
    )}
    {children}
    {footer !== undefined && <footer style={tableFooterStyle}>{footer}</footer>}
  </section>
);

const TableStatus = ({ children }: { readonly children: React.ReactNode }) => (
  <div style={tableStatusStyle}>{children}</div>
);

export const DashboardComponentRenderer = ({
  component,
  fields = [],
  rows,
  activeSunburstMeasure: externallySelectedSunburstMeasure,
  onSunburstMeasureChange,
  activeTreemapMeasure: externallySelectedTreemapMeasure,
  onTreemapMeasureChange,
}: Props) => {
  const [tablePage, setTablePage] = useState(1);
  const [activeMetricTrendMeasure, setActiveMetricTrendMeasure] = useState<string | null>(null);
  const [activeSunburstMeasure, setActiveSunburstMeasure] = useState<string | null>(null);
  const [activeTreemapMeasure, setActiveTreemapMeasure] = useState<string | null>(null);
  // Dashboards created before the first-class type used a pie with an 旭日图
  // title. Keep those saved dashboards functional after the upgrade.
  const isSunburst = component.type === "sunburst" || (component.type === "pie" && titleIncludes(component, "旭日"));
  const isRadar = component.type === "radar" || (component.type === "pie" && titleIncludes(component, "雷达"));
  const isTreemap = component.type === "treemap" || (component.type === "pie" && titleIncludes(component, "矩形"));
  const isEmptyData = rows.length === 0;
  if (isEmptyData) {
    const demo = buildEmptyDataDemo(component);
    if (demo !== null) return renderEmptyDataDemo(demo);
  }
  if (component.type === "bar" || component.type === "stackedBar" || component.type === "percentBar") {
    const fallbackTitle = component.type === "stackedBar"
      ? "堆积柱图"
      : component.type === "percentBar"
        ? "百分比堆积柱图"
        : "柱图";
    return <EChart option={buildBarOption(component, rows, fields)} ariaLabel={`${component.title ?? fallbackTitle}图表`} />;
  }
  if (component.type === "line" || component.type === "area" || component.type === "stackedArea" || component.type === "percentArea") {
    const fallbackTitle = component.type === "area"
      ? "面积图"
      : component.type === "stackedArea"
        ? "堆积面积图"
        : component.type === "percentArea"
          ? "百分比堆积面积图"
          : "折线图";
    return <EChart option={buildLineOption(component, rows, fields)} ariaLabel={`${component.title ?? fallbackTitle}图表`} />;
  }
  if (component.type === "trend") {
    const model = buildTrendModel(component, rows, fields);
    return (
      <DataSurface
        testId="trend-analysis-surface"
        eyebrow="趋势分析"
        title={component.title ?? "趋势分析"}
        chips={[
          <SurfaceChip key="binding">{model.timeLabel} → {model.measureLabel}</SurfaceChip>,
          <SurfaceChip key="periods" tone="teal">{compactCount(model.points.length, "个周期")}</SurfaceChip>,
        ]}
      >
        <div style={{ ...trendShellStyle, padding: 12 }}>
          {model.showSummary && (
            <div style={trendSummaryStyle}>
              <div style={trendSummaryItemStyle}>
                <span style={trendSummaryLabelStyle}>最新值</span>
                <span style={trendSummaryValueStyle}>{formatTrendNumber(model.latest?.value)}</span>
              </div>
              <div style={trendSummaryItemStyle}>
                <span style={trendSummaryLabelStyle}>较上一期</span>
                <span style={trendSummaryValueStyle}>{formatTrendRate(model.change?.rate)}</span>
              </div>
              <div style={trendSummaryItemStyle}>
                <span style={trendSummaryLabelStyle}>峰值</span>
                <span style={trendSummaryValueStyle}>{formatTrendNumber(model.peak?.value)}</span>
              </div>
            </div>
          )}
          <div style={trendChartStyle}>
            <EChart option={buildTrendOption(component, model)} ariaLabel={`${component.title ?? "趋势分析"}趋势图表`} />
          </div>
        </div>
      </DataSurface>
    );
  }
  if (component.type === "metricTrend") {
    const model = buildMetricTrendModel(component, rows, fields);
    const activeMeasureKey = model.measures.some((measure) => measure.key === activeMetricTrendMeasure)
      ? activeMetricTrendMeasure!
      : model.measures[0]?.key;
    return (
      <DataSurface testId="metric-trend-surface">
        <div style={metricTrendShellStyle}>
          <div style={metricTrendCardsStyle}>
            {model.measures.map((measure) => (
              <button
                key={measure.key}
                type="button"
                aria-label={`关注指标 ${measure.label}`}
                aria-pressed={measure.key === activeMeasureKey}
                style={measure.key === activeMeasureKey ? metricTrendPrimaryCardStyle : metricTrendCardStyle}
                onClick={() => setActiveMetricTrendMeasure(measure.key)}
              >
                <span style={metricTrendLabelStyle}>{measure.label}</span>
                <strong style={metricTrendValueStyle}>{formatTrendNumber(measure.latest?.value)}</strong>
              </button>
            ))}
          </div>
          <div style={metricTrendChartStyle}>
            <EChart option={buildMetricTrendOption(component, model, activeMeasureKey)} ariaLabel={`${component.title ?? "指标趋势"}趋势图表`} />
          </div>
        </div>
      </DataSurface>
    );
  }
  if (component.type === "metricBreakdown") {
    const model = buildMetricBreakdownModel(component, rows, fields);
    return (
      <DataSurface
        testId="metric-breakdown-surface"
        title={`${model.measureLabel} · 按${model.dimensionLabel}拆解`}
        variant="flat"
      >
        <section style={metricBreakdownShellStyle}>
          <div style={metricBreakdownSummaryStyle}>
            <div style={{ minWidth: 0 }}>
              <span style={metricBreakdownSummaryLabelStyle}>{model.measureLabel}合计</span>
              <strong aria-label={`${model.measureLabel}合计`} style={metricBreakdownSummaryValueStyle}>{formatMetricNumber(model.total, model.decimals)}</strong>
            </div>
            <span style={metricBreakdownSummaryMetaStyle}>{model.items.length} 个{model.dimensionLabel}</span>
          </div>
          <div style={metricBreakdownListStyle}>
            <div aria-hidden="true" style={metricBreakdownColumnHeaderStyle}>
              <span>{model.dimensionLabel}</span>
              <span>相对贡献</span>
              <span style={{ textAlign: "right" }}>{model.measureLabel} / 占比</span>
            </div>
            {model.items.map((item, index) => (
              <div key={item.key} style={metricBreakdownRowStyle}>
                <div style={metricBreakdownLabelGroupStyle}>
                  <span style={metricBreakdownRankStyle}>{String(index + 1).padStart(2, "0")}</span>
                  <span style={metricBreakdownLabelStyle} title={item.label}>{item.label}</span>
                </div>
                <div aria-label={`${item.label}贡献条`} style={metricBreakdownTrackStyle}>
                  <span style={{ ...metricBreakdownBarStyle, width: `${Math.min(100, item.barRatio * 100)}%` }} />
                </div>
                <span style={metricBreakdownValueStyle}>
                  <span style={metricBreakdownValueNumberStyle}>{formatMetricNumber(item.value, model.decimals)}</span>
                  {item.share !== null && <span style={metricBreakdownShareStyle}>{(item.share * 100).toFixed(1)}%</span>}
                </span>
              </div>
            ))}
          </div>
        </section>
      </DataSurface>
    );
  }
  if (isRadar) {
    const measures = bindingFieldKeys(component, "measure");
    const labels = new Map(fields.map((field) => [field.key, field.label]));
    return (
      <div style={sunburstShellStyle}>
        {measures.length > 0 && (
          <div aria-label="雷达图指标图例" style={radarLegendStyle}>
            {measures.map((measure, index) => (
              <span key={measure} style={radarLegendItemStyle}>
                <i aria-hidden="true" style={{ width: 10, height: 2, borderRadius: 2, background: sunburstLegendColors[index % sunburstLegendColors.length] }} />
                {labels.get(measure) ?? measure}
              </span>
            ))}
          </div>
        )}
        <div style={sunburstChartStyle}>
          <EChart option={buildRadarOption(component, rows, fields)} ariaLabel={`${component.title ?? "雷达图"}图表`} />
        </div>
      </div>
    );
  }
  if (isTreemap) {
    const measureKeys = component.binding?.slots.measure;
    const measures = (Array.isArray(measureKeys) ? measureKeys : measureKeys === undefined ? [] : [measureKeys]).map((binding) => binding.fieldKey);
    const selectedMeasure = externallySelectedTreemapMeasure ?? activeTreemapMeasure;
    const activeMeasureKey = measures.includes(selectedMeasure ?? "") ? selectedMeasure! : measures[0];
    const labels = new Map(fields.map((field) => [field.key, field.label]));
    const activeMeasureLabel = labels.get(activeMeasureKey ?? "") ?? activeMeasureKey ?? "指标";
    return (
      <div style={sunburstShellStyle}>
        {measures.length > 1 && onTreemapMeasureChange === undefined && (
          <select
            aria-label="切换矩形树图指标"
            style={sunburstMetricSelectStyle}
            value={activeMeasureKey}
            onChange={(event) => (onTreemapMeasureChange ?? setActiveTreemapMeasure)(event.target.value)}
          >
            {measures.map((measure) => <option key={measure} value={measure}>{labels.get(measure) ?? measure}</option>)}
          </select>
        )}
        <EChart option={buildTreemapOption(component, rows, fields, activeMeasureKey)} ariaLabel={`${component.title ?? "矩形树图"} ${activeMeasureLabel}图表`} />
      </div>
    );
  }
  if (isSunburst) {
    const measureKeys = component.binding?.slots.measure;
    const dimensionKey = component.binding?.slots.dimension;
    const dimension = Array.isArray(dimensionKey) ? dimensionKey[0]?.fieldKey : dimensionKey?.fieldKey;
    const measures = (Array.isArray(measureKeys) ? measureKeys : measureKeys === undefined ? [] : [measureKeys]).map((binding) => binding.fieldKey);
    const selectedMeasure = externallySelectedSunburstMeasure ?? activeSunburstMeasure;
    const activeMeasureKey = measures.includes(selectedMeasure ?? "") ? selectedMeasure! : measures[0];
    const labels = new Map(fields.map((field) => [field.key, field.label]));
    const activeMeasureLabel = labels.get(activeMeasureKey ?? "") ?? activeMeasureKey ?? "指标";
    const dimensionValues = dimension === undefined ? [] : Array.from(new Set(rows.map((row) => {
      const value = row[dimension];
      return value === null || value === undefined || value === "" ? "未分类" : String(value);
    })));
    return (
      <div style={sunburstShellStyle}>
        {measures.length > 1 && onSunburstMeasureChange === undefined && (
          <select
            aria-label="切换旭日图指标"
            style={sunburstMetricSelectStyle}
            value={activeMeasureKey}
            onChange={(event) => (onSunburstMeasureChange ?? setActiveSunburstMeasure)(event.target.value)}
          >
            {measures.map((measure) => <option key={measure} value={measure}>{labels.get(measure) ?? measure}</option>)}
          </select>
        )}
        {dimensionValues.length > 0 && (
          <div aria-label="旭日图维度图例" style={sunburstLegendStyle}>
            {dimensionValues.map((value, index) => (
              <span key={value} style={sunburstLegendItemStyle}>
                <i aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: sunburstLegendColors[index % sunburstLegendColors.length] }} />
                {value}
              </span>
            ))}
          </div>
        )}
        <div style={sunburstChartStyle}>
          <EChart option={buildSunburstOption(component, rows, fields, activeMeasureKey)} ariaLabel={`${component.title ?? "旭日图"} ${activeMeasureLabel}图表`} />
        </div>
      </div>
    );
  }
  if (component.type === "pie" || component.type === "rose") {
    return <EChart option={buildPieOption(component, rows, fields)} ariaLabel={`${component.title ?? (component.type === "rose" ? "玫瑰图" : "饼图")}图表`} />;
  }
  if (component.type === "ringBar") {
    return <EChart option={buildRingBarOption(component, rows, fields)} ariaLabel={`${component.title ?? "环形柱图"}图表`} />;
  }
  if (component.type === "ranking") {
    const model = buildRankingModel(component, rows, fields);
    const gridTemplateColumns = `28px minmax(70px, 0.85fr) minmax(136px, 2.1fr) repeat(${Math.max(1, model.measures.length)}, minmax(72px, 0.7fr))`;
    return (
      <section aria-label={`${component.title ?? "排行榜"}图表`} data-testid="ranking-surface" style={rankingShellStyle}>
        <div aria-hidden="true" style={{ ...rankingHeaderStyle, gridTemplateColumns }}>
          <span>排序</span>
          <span>{model.dimensionLabel}</span>
          <span />
          {model.measures.map((measure) => <span key={measure.key} style={{ textAlign: "right" }}>{measure.label}</span>)}
        </div>
        {model.items.map((item, index) => {
          const rank = index + 1;
          const medalColor = rankingMedalColors[index];
          return (
            <div key={`${item.label}-${rank}`} style={{ ...rankingRowStyle, gridTemplateColumns }}>
              {medalColor === undefined
                ? <span style={rankingOrdinalStyle}>{rank}</span>
                : <span aria-label={`第${rank}名`} style={{ ...rankingBadgeStyle, background: medalColor }}>{rank}</span>}
              <span style={rankingLabelStyle} title={item.label}>{item.label}</span>
              <span aria-label={`${item.label}排名进度`} style={rankingTrackStyle}>
                <span style={{ ...rankingBarStyle, width: `${item.primaryRatio * 100}%` }} />
              </span>
              {model.measures.map((measure) => {
                const value = item.values.find((entry) => entry.key === measure.key)?.value ?? 0;
                return <span key={measure.key} style={rankingValueStyle}>{formatCompactMetricNumber(value)}</span>;
              })}
            </div>
          );
        })}
      </section>
    );
  }
  if (component.type === "flipNumber" || isLegacyFlipNumberKpi(component)) {
    const model = buildFlipNumberModel(component, rows, fields);
    const decimals = numberProp(component, "decimals", 0);
    const prefix = stringProp(component, "prefix", "");
    const suffix = stringProp(component, "suffix", "");
    return (
      <section data-testid="flip-number-surface" style={flipNumberShellStyle}>
        <div style={flipNumberGridStyle}>
          {model.items.map((item) => (
            <div key={item.key} style={flipNumberCardStyle}>
              <span style={flipNumberTitleStyle}>{item.label}</span>
              <RollingMetricValue
                ariaLabel={`${item.label}翻牌器数值`}
                value={formatFlipNumber(item.value, decimals, prefix, suffix)}
              />
            </div>
          ))}
        </div>
      </section>
    );
  }
  if (component.type === "progressBar") {
    const model = buildProgressBarModel(component, rows, fields);
    const decimals = numberProp(component, "decimals", 1);
    const showValue = component.props.showValue !== false;
    return (
      <section data-testid="progress-bar-surface" style={progressBarShellStyle}>
        <div style={progressBarListStyle}>
          {model.items.map((item, index) => {
            const progress = item.progress === null ? null : item.progress * 100;
            const progressWidth = progress === null ? 0 : Math.max(0, Math.min(100, progress));
            const color = progressBarColors[index % progressBarColors.length] ?? "#3b82f6";
            return (
              <div key={item.key} style={progressBarItemStyle}>
                <div style={progressBarHeaderStyle}>
                  <span style={progressBarLabelStyle}>{item.label}</span>
                  <strong style={progressBarPercentStyle}>
                    {progress === null ? "—" : `${progress.toFixed(decimals)}%`}
                  </strong>
                </div>
                <div aria-label={`${item.label}进度条`} style={kpiProgressTrackStyle}>
                  <span style={{ ...kpiProgressBarStyle, background: color, width: `${progressWidth}%` }} />
                </div>
                {showValue && (
                  <span style={progressBarValueStyle}>
                    实际 {formatCompactMetricNumber(item.value)} | 目标 {formatCompactMetricNumber(item.target)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }
  if (component.type === "gauge" || isLegacyGaugeKpi(component)) {
    const models = buildGaugeModels(component, rows, fields);
    if (models.length === 1 && models[0]?.label === undefined) {
      const model = buildGaugeModel(component, rows, fields);
      return <EChart option={buildGaugeOption(component, model)} ariaLabel={`${component.title ?? "仪表盘"}图表`} />;
    }
    return (
      <section data-testid="gauge-chart-grid" style={metricChartGridStyle}>
        {models.map(({ key, label, model }) => (
          <div key={key} style={metricChartCellStyle}>
            <EChart
              option={buildGaugeOption(component, model, label ?? model.label)}
              ariaLabel={`${component.title ?? "仪表盘"}${label === undefined ? "" : ` ${label}`}图表`}
            />
          </div>
        ))}
      </section>
    );
  }
  if (component.type === "liquid") {
    const models = buildLiquidModels(component, rows, fields);
    if (models.length === 1 && models[0]?.label === undefined) {
      const model = buildLiquidModel(component, rows, fields);
      return <LiquidChart component={component} model={model} />;
    }
    return (
      <section data-testid="liquid-chart-grid" style={metricChartGridStyle}>
        {models.map(({ key, label, model }) => (
          <div key={key} style={metricChartCellStyle}>
            <LiquidChart component={component} model={model} groupLabel={label} />
          </div>
        ))}
      </section>
    );
  }
  if (component.type === "kpi") {
    const board = buildKpiBoardModel(component, rows, fields);
    if (board !== null) {
      return (
        <DataSurface
          testId="kpi-board-surface"
          eyebrow="指标看板"
          title={component.title ?? "指标看板"}
          chips={[
            <SurfaceChip key="dimension">{board.dimensionLabel}</SurfaceChip>,
            <SurfaceChip key="measure" tone="teal">{board.measureLabel}</SurfaceChip>,
          ]}
        >
          <div style={kpiBoardGridStyle}>
            {board.groups.map((group) => (
              <section aria-label={`${group.label}指标`} key={group.label} style={kpiBoardCardStyle}>
                <div style={kpiBoardPeriodStyle}>{group.label}</div>
                <div style={kpiBoardMetricNameStyle}>{board.measureLabel}</div>
                <div style={kpiBoardValueStyle}>
                  {stringProp(component, "prefix", "")}{formatKpiBoardNumber(group.value)}{stringProp(component, "suffix", "")}
                </div>
                <div style={kpiBoardRowsStyle}>
                  {group.metrics.map((metric) => (
                    <div key={metric.key} style={kpiBoardRowStyle}>
                      <span style={kpiBoardRowLabelStyle}>{metric.label}</span>
                      <span style={kpiBoardRowValueStyle}>{formatKpiBoardNumber(metric.value)}</span>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </DataSurface>
      );
    }
    const model = buildKpiModel(component, rows);
    const decimals = numberProp(component, "decimals", 0);
    const formatted = model.value === null ? "—" : model.value.toFixed(decimals);
    const progressWidth = model.target?.progress === null || model.target?.progress === undefined
      ? 0
      : Math.max(0, Math.min(100, model.target.progress * 100));
    const comparisonTone = model.comparison?.delta === undefined || model.comparison.delta === 0
      ? {}
      : model.comparison.delta > 0 ? kpiPositiveStyle : kpiNegativeStyle;
    return (
      <div style={kpiShellStyle}>
        <div aria-label={`${component.title ?? "指标"}指标值`} style={kpiValueStyle}>
          {stringProp(component, "prefix", "")}{formatted}{stringProp(component, "suffix", "")}
        </div>
        {(model.comparison !== null || model.target !== null) && (
          <div style={kpiMetaStackStyle}>
            {model.comparison !== null && (
              <div style={{ ...kpiMetaRowStyle, ...comparisonTone }}>
                <span>较对比 {formatKpiRate(model.comparison.rate)}</span>
              </div>
            )}
            {model.target !== null && (
              <>
                <div style={kpiMetaRowStyle}>
                  <span>目标达成 {formatKpiProgress(model.target.progress)}</span>
                </div>
                <div aria-label="目标达成进度" style={kpiProgressTrackStyle}>
                  <span style={{ ...kpiProgressBarStyle, width: `${progressWidth}%` }} />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }
  if (component.type === "table") {
    const pageSize = Math.max(1, Math.min(100, numberProp(component, "pageSize", 20)));
    const model = buildTableModel(component, rows, fields);
    const totalPages = Math.max(1, Math.ceil(model.rows.length / pageSize));
    const currentPage = Math.min(tablePage, totalPages);
    const pagedRows = model.rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    return (
      <DataSurface
        testId="detail-table-surface"
        chips={[
          <SurfaceChip key="rows" tone="teal">{compactCount(model.rows.length, "行")}</SurfaceChip>,
          <SurfaceChip key="columns">{compactCount(model.columns.length, "列")}</SurfaceChip>,
        ]}
        footer={(
          <>
            <TableStatus>
              <span>{compactCount(model.rows.length, "行")}</span>
              <span>{compactCount(model.columns.length, "列")}</span>
            </TableStatus>
            {totalPages > 1 ? (
              <div aria-label="表格分页" style={{ alignItems: "center", display: "flex", gap: 8 }}>
                <button
                  aria-label="上一页"
                  disabled={currentPage === 1}
                  style={currentPage === 1 ? disabledPagerButtonStyle : tablePagerButtonStyle}
                  type="button"
                  onClick={() => setTablePage((page) => Math.max(1, page - 1))}
                >
                  上一页
                </button>
                <span>第 {currentPage} / {totalPages} 页</span>
                <button
                  aria-label="下一页"
                  disabled={currentPage === totalPages}
                  style={currentPage === totalPages ? disabledPagerButtonStyle : tablePagerButtonStyle}
                  type="button"
                  onClick={() => setTablePage((page) => Math.min(totalPages, page + 1))}
                >
                  下一页
                </button>
              </div>
            ) : <span>第 1 / 1 页</span>}
          </>
        )}
      >
        <div style={tableScrollStyle}>
          <table aria-label={`${component.title ?? "明细表"}数据表`} style={dataTableStyle}>
            <thead><tr>{model.columns.map((column) => <th key={column.key} style={tableHeaderCellStyle}>{column.label}</th>)}</tr></thead>
            <tbody>{pagedRows.map((row, index) => (
              <tr key={index} style={{ background: index % 2 === 1 ? "#fbfdff" : "#ffffff" }}>
                {model.columns.map((column) => <td key={column.key} style={tableCellStyle}>{String(row[column.key] ?? "—")}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </DataSurface>
    );
  }
  if (component.type === "crosstab") {
    const model = buildCrosstabModel(component, rows, fields);
    return (
      <DataSurface
        testId="crosstab-surface"
        eyebrow="二维交叉表"
        title={component.title ?? "交叉表"}
        chips={[
          <SurfaceChip key="row">行：{model.rowHeader}</SurfaceChip>,
          <SurfaceChip key="column">列：{model.columnHeader}</SurfaceChip>,
          <SurfaceChip key="measure" tone="teal">指标：{model.measureLabel}</SurfaceChip>,
        ]}
        footer={(
          <>
            <TableStatus>
              <span>{compactCount(model.rows.length, "行维度")}</span>
              <span>{compactCount(model.columns.length, "列维度")}</span>
            </TableStatus>
            {model.showTotals ? <span>含行列合计</span> : <span>未显示合计</span>}
          </>
        )}
      >
        <div style={tableScrollStyle}>
          <table aria-label={`${component.title ?? "交叉表"}二维交叉表`} style={dataTableStyle}>
            <thead>
              <tr>
                <th style={tableTotalHeaderCellStyle}>{model.rowHeader} \ {model.columnHeader}</th>
                {model.columns.map((column) => <th key={column.key} style={tableHeaderCellStyle}>{column.label}</th>)}
                {model.showTotals && <th style={tableTotalHeaderCellStyle}>合计</th>}
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" style={tableRowHeaderCellStyle}>{row.label}</th>
                  {row.values.map((value, index) => (
                    <td key={model.columns[index]?.key ?? index} style={tableNumericCellStyle}>{formatCrosstabNumber(value)}</td>
                  ))}
                  {model.showTotals && <td style={tableTotalCellStyle}>{formatCrosstabNumber(row.total)}</td>}
                </tr>
              ))}
              {model.showTotals && (
                <tr>
                  <th scope="row" style={tableTotalHeaderCellStyle}>合计</th>
                  {model.columnTotals.map((value, index) => (
                    <td key={model.columns[index]?.key ?? index} style={tableTotalCellStyle}>{formatCrosstabNumber(value)}</td>
                  ))}
                  <td style={tableTotalCellStyle}>{formatCrosstabNumber(model.grandTotal)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DataSurface>
    );
  }
  if (component.type === "heatmap") {
    const model = buildHeatmapModel(component, rows, fields);
    return (
      <DataSurface
        testId="heatmap-surface"
        eyebrow="热力图"
        title={component.title ?? "热力图"}
        chips={[
          <SurfaceChip key="measure" tone="teal">{model.measureLabel}</SurfaceChip>,
          <SurfaceChip key="range">{formatCrosstabNumber(model.minValue)} - {formatCrosstabNumber(model.maxValue)}</SurfaceChip>,
        ]}
        footer={(
          <>
            <TableStatus>
              <span>行：{model.rowHeader}</span>
              <span>列：{model.columnHeader}</span>
            </TableStatus>
            <div aria-label="热力值图例" style={{ alignItems: "center", display: "flex", gap: 6 }}>
              <span>低</span>
              <span style={{
                background: "linear-gradient(90deg, #eef6ff 0%, #9ac7f4 48%, #1557ad 100%)",
                borderRadius: 999,
                display: "inline-block",
                height: 8,
                width: 74,
              }} />
              <span>高</span>
            </div>
          </>
        )}
      >
        <div style={tableScrollStyle}>
          <table aria-label={`${component.title ?? "热力图"}热力矩阵`} style={dataTableStyle}>
            <thead>
              <tr>
                <th style={tableTotalHeaderCellStyle}>{model.rowHeader} \ {model.columnHeader}</th>
                {model.columns.map((column) => <th key={column.key} style={tableHeaderCellStyle}>{column.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" style={tableRowHeaderCellStyle}>{row.label}</th>
                  {row.cells.map((cell) => (
                    <td
                      key={cell.columnKey}
                      aria-label={`${row.label} ${cell.columnLabel} ${model.measureLabel} ${formatCrosstabNumber(cell.value)}`}
                      style={{
                        ...heatmapCellBaseStyle,
                        background: heatmapCellFill(cell.intensity),
                        color: cell.intensity > 0.7 ? "#fff" : "#0f172a",
                      }}
                    >
                      {model.showValues ? formatCrosstabNumber(cell.value) : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataSurface>
    );
  }
  if (component.type === "multidimensional") {
    const model = buildMultidimensionalModel(component, rows, fields);
    return (
      <DataSurface
        testId="multidimensional-surface"
        eyebrow="多维分析"
        title={component.title ?? "多维分析"}
        chips={[
          <SurfaceChip key="dimensions">{compactCount(model.dimensions.length, "个维度")}</SurfaceChip>,
          <SurfaceChip key="measures" tone="teal">{compactCount(model.measures.length, "个指标")}</SurfaceChip>,
        ]}
        footer={(
          <>
            <TableStatus>
              <span>{compactCount(model.rows.length, "组结果")}</span>
              <span>{model.showTotals ? "含指标合计" : "未显示合计"}</span>
            </TableStatus>
            <span>{model.measures.map((measure) => measure.label).join(" / ")}</span>
          </>
        )}
      >
        <div style={tableScrollStyle}>
          <table aria-label={`${component.title ?? "多维分析"}多维分析表`} style={dataTableStyle}>
            <thead>
              <tr>
                <th colSpan={model.dimensions.length} style={tableTotalHeaderCellStyle}>维度</th>
                <th colSpan={model.measures.length} style={{ ...tableTotalHeaderCellStyle, color: "#08705d" }}>度量</th>
              </tr>
              <tr>
                {model.dimensions.map((dimension) => (
                  <th key={dimension.key} style={tableHeaderCellStyle}>{dimension.label}</th>
                ))}
                {model.measures.map((measure) => (
                  <th key={measure.key} style={tableHeaderCellStyle}>{measure.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {model.rows.map((row) => (
                <tr key={row.key}>
                  {row.dimensions.map((value, index) => index === 0 ? (
                    <th key={model.dimensions[index]?.key ?? index} scope="row" style={tableRowHeaderCellStyle}>{value}</th>
                  ) : (
                    <td key={model.dimensions[index]?.key ?? index} style={tableCellStyle}>{value}</td>
                  ))}
                  {row.values.map((value, index) => (
                    <td key={model.measures[index]?.key ?? index} style={tableNumericCellStyle}>{formatCrosstabNumber(value)}</td>
                  ))}
                </tr>
              ))}
              {model.showTotals && (
                <tr>
                  <th scope="row" style={tableTotalHeaderCellStyle}>合计</th>
                  {model.dimensions.slice(1).map((dimension) => (
                    <td key={dimension.key} style={tableTotalHeaderCellStyle}>—</td>
                  ))}
                  {model.totals.map((value, index) => (
                    <td key={model.measures[index]?.key ?? index} style={tableTotalCellStyle}>{formatCrosstabNumber(value)}</td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DataSurface>
    );
  }
  const style: CSSProperties = {
    color: stringProp(component, "color", "#1f1f1f"),
    fontSize: numberProp(component, "fontSize", 16),
    fontWeight: stringProp(component, "fontWeight", "normal"),
    textAlign: stringProp(component, "textAlign", "left") as CSSProperties["textAlign"],
    whiteSpace: "pre-wrap",
  };
  return <div style={style}>{stringProp(component, "content", "")}</div>;
};
