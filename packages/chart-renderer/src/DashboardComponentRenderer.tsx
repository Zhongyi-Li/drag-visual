import { DashboardGlobalFilterConfig, type ChartJumpRule, type ComponentInstance, type DashboardGlobalFilterConfig as DashboardGlobalFilterConfigValue, type DatasetField } from "@drag-visual/contracts";
import { Button, DatePicker, Input, InputNumber, Modal, Segmented, Select, Slider } from "antd";
import zhCN from "antd/es/date-picker/locale/zh_CN.js";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/zh-cn.js";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import { EChart, type EChartPointClick } from "./EChart.js";
import {
  buildBarOption,
  buildBarLineOption,
  type BarLineDisplayMode,
  buildCrosstabModel,
  buildFlipNumberModel,
  buildGaugeModel,
  buildGaugeModels,
  buildGaugeOption,
  buildHeatmapModel,
  buildHorizontalBarOption,
  buildKpiBoardModel,
  buildKpiModel,
  buildKpiModelForFields,
  buildKpiSecondaryMeasures,
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
  buildGoalTaskProgressModel,
  buildTargetProgressModel,
  buildTableModel,
  buildTrendModel,
  buildTrendOption,
  buildTreemapOption,
  isCurrencyMetric,
  isQuantityMetric,
} from "./options.js";

dayjs.locale("zh-cn");

interface Props {
  readonly component: ComponentInstance;
  readonly fields?: readonly DatasetField[] | undefined;
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  /** Remote dataset queries may already have applied per-metric aggregation. */
  readonly rowsAreAggregated?: boolean | undefined;
  /** Hides renderer-owned headers when an editor frame already provides the editable title. */
  readonly hideSurfaceHeaders?: boolean | undefined;
  readonly activeSunburstMeasure?: string | undefined;
  readonly onSunburstMeasureChange?: ((measure: string) => void) | undefined;
  readonly activeTreemapMeasure?: string | undefined;
  readonly onTreemapMeasureChange?: ((measure: string) => void) | undefined;
  readonly dashboardFilterValues?: Readonly<Record<string, unknown>> | undefined;
  readonly dashboardFilterOptions?: Readonly<Record<string, readonly string[]>> | undefined;
  readonly onDashboardFilterChange?: ((filterId: string, value: unknown) => void) | undefined;
  /** Whether the global filter batch that this header initiated is running. */
  readonly dashboardFiltersLoading?: boolean | undefined;
  /** Called after a header's draft filter values have been committed. Returns false when no chart is bound. */
  readonly onDashboardFiltersApply?: (() => boolean) | undefined;
  /** Editor-only bridge for persisting interactive custom-component settings. */
  readonly onComponentPropsChange?: ((props: ComponentInstance["props"]) => void) | undefined;
  /** Viewer bridge for point-click navigation configured in the analysis panel. */
  readonly onChartJump?: ((rule: ChartJumpRule, values: Row) => void) | undefined;
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

const dashboardHeaderShellStyle = (inline: boolean): CSSProperties => ({
  alignItems: inline ? "center" : "stretch",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: inline ? "row" : "column",
  flexWrap: inline ? "wrap" : "nowrap",
  gap: inline ? 24 : 12,
  height: "100%",
  minHeight: 0,
  padding: inline ? "20px 26px" : "12px 26px",
  width: "100%",
});

const dashboardHeaderInfoStyle = (inline: boolean): CSSProperties => ({ flex: inline ? "1 1 280px" : "0 0 auto", minWidth: 0 });
const dashboardHeaderHeadingStyle: CSSProperties = { color: "#172033", fontSize: 22, fontWeight: 700, lineHeight: 1.35, margin: 0 };
const dashboardHeaderDescriptionStyle: CSSProperties = { color: "#64748b", fontSize: 13, lineHeight: 1.55, margin: "6px 0 0", maxWidth: 680 };
const dashboardHeaderMetaStyle: CSSProperties = { color: "#94a3b8", fontSize: 12, lineHeight: 1.5, marginTop: 8 };
const dashboardHeaderControlsStyle = (inline: boolean): CSSProperties => ({ alignItems: "center", display: "flex", flex: inline ? "0 1 auto" : "1 1 auto", flexWrap: "wrap", gap: 12, minWidth: 0, width: inline ? undefined : "100%" });
const dashboardHeaderFilterFieldsStyle = (inline: boolean): CSSProperties => ({ alignItems: "center", display: "flex", flex: inline ? "0 1 auto" : "1 1 520px", flexWrap: "wrap", gap: 8, minWidth: 0 });
const dashboardHeaderControlStyle: CSSProperties = { background: "#fff", borderColor: "#d7dee8", borderRadius: 6, borderStyle: "solid", borderWidth: 1, color: "#334155", fontFamily: "inherit", fontSize: 13, height: 34, padding: "0 11px" };
const dashboardHeaderActionsStyle: CSSProperties = { alignSelf: "flex-end", display: "flex", flex: "0 0 auto", gap: 8 };
const analysisGroupShellStyle: CSSProperties = { boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 12, height: "100%", minHeight: 0, padding: "18px 20px", background: "#fff", border: "1px solid #e8ecf1", borderRadius: 8, boxShadow: "0 2px 8px rgba(15, 23, 42, .04)" };
const analysisGroupHeadingStyle: CSSProperties = { color: "#172033", fontSize: 18, fontWeight: 700, lineHeight: 1.35, margin: 0 };
const analysisGroupDescriptionStyle: CSSProperties = { color: "#64748b", fontSize: 13, lineHeight: 1.5, margin: "4px 0 0" };
const analysisGroupEmptyStyle: CSSProperties = { flex: "1 1 auto", minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #c9d7e8", borderRadius: 8, color: "#7c8da5", background: "#fff", boxShadow: "0 1px 3px rgba(15, 23, 42, .04)", fontSize: 13 };

const isDashboardHeaderFilterField = (value: unknown): value is { fieldKey: string; label: string } =>
  typeof value === "object"
  && value !== null
  && !Array.isArray(value)
  && typeof (value as Record<string, unknown>).fieldKey === "string"
  && typeof (value as Record<string, unknown>).label === "string";

const dashboardHeaderDateRange = (component: ComponentInstance, fallback: string): { start: string; end: string } => {
  const value = component.props.dateRange;
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { start: fallback, end: fallback };
  const record = value as Record<string, unknown>;
  if (typeof record.start !== "string" || typeof record.end !== "string") return { start: fallback, end: fallback };
  return { start: record.start, end: record.end };
};

const dashboardHeaderFilters = (component: ComponentInstance) => {
  const parsed = DashboardGlobalFilterConfig.array().safeParse(component.props.globalFilters);
  return parsed.success ? parsed.data : [];
};

const DashboardHeaderSurface = ({ component, rows, dashboardFilterValues, dashboardFilterOptions, onDashboardFilterChange, dashboardFiltersLoading = false, onDashboardFiltersApply }: { readonly component: ComponentInstance; readonly rows: readonly Row[]; readonly dashboardFilterValues?: Readonly<Record<string, unknown>> | undefined; readonly dashboardFilterOptions?: Readonly<Record<string, readonly string[]>> | undefined; readonly onDashboardFilterChange?: ((filterId: string, value: unknown) => void) | undefined; readonly dashboardFiltersLoading?: boolean | undefined; readonly onDashboardFiltersApply?: (() => boolean) | undefined }) => {
  const date = stringProp(component, "date", "2026-08-05");
  const configuredDateRange = dashboardHeaderDateRange(component, date);
  const toDateRange = (start: string, end: string): [Dayjs, Dayjs] => {
    const parsedStart = dayjs(start);
    const parsedEnd = dayjs(end);
    return [parsedStart.isValid() ? parsedStart : dayjs(), parsedEnd.isValid() ? parsedEnd : dayjs()];
  };
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>(() => toDateRange(configuredDateRange.start, configuredDateRange.end));
  const [localFilterValues, setLocalFilterValues] = useState<Record<string, string>>({});
  const [pendingAction, setPendingAction] = useState<"apply" | "reset" | null>(null);
  const headline = stringProp(component, "headline", "经营数据看板");
  const description = stringProp(component, "description", "");
  const updatedAt = stringProp(component, "updatedAt", "");
  const filters = dashboardHeaderFilters(component);
  const dateFilter = filters.find((filter) => filter.controlType === "dateRange");
  const useInlineHeaderLayout = filters.length <= 3;
  const configuredFiltersKey = JSON.stringify(filters.map((filter) => ({ id: filter.id, controlType: filter.controlType, operator: filter.operator })));
  const appliedValuesKey = JSON.stringify(dashboardFilterValues ?? {});
  useEffect(() => {
    const appliedDateRange = dateFilter === undefined ? undefined : dashboardFilterValues?.[dateFilter.id];
    if (typeof appliedDateRange === "object" && appliedDateRange !== null && !Array.isArray(appliedDateRange)) {
      const record = appliedDateRange as Record<string, unknown>;
      if (typeof record.start === "string" && typeof record.end === "string") setDateRange(toDateRange(record.start, record.end));
      else setDateRange(toDateRange(configuredDateRange.start, configuredDateRange.end));
    } else setDateRange(toDateRange(configuredDateRange.start, configuredDateRange.end));
    setLocalFilterValues(Object.fromEntries(filters.filter((filter) => filter.controlType !== "dateRange" && filter.operator !== "isEmpty" && filter.operator !== "isNotEmpty").map((filter): [string, string] => {
      const appliedValue = dashboardFilterValues?.[filter.id];
      return [filter.id, typeof appliedValue === "string" ? appliedValue : ""];
    })));
  }, [appliedValuesKey, configuredDateRange.end, configuredDateRange.start, configuredFiltersKey, dateFilter?.id]);
  useEffect(() => {
    if (!dashboardFiltersLoading) setPendingAction(null);
  }, [dashboardFiltersLoading]);
  const applyFilters = () => {
    if (dateFilter !== undefined) onDashboardFilterChange?.(dateFilter.id, { start: dateRange[0].format("YYYY-MM-DD"), end: dateRange[1].format("YYYY-MM-DD") });
    filters.filter((filter) => filter.controlType !== "dateRange" && filter.operator !== "isEmpty" && filter.operator !== "isNotEmpty").forEach((filter) => onDashboardFilterChange?.(filter.id, localFilterValues[filter.id] ?? ""));
    if (onDashboardFiltersApply?.() === true) setPendingAction("apply");
  };
  const resetFilters = () => {
    const nextRange = toDateRange(configuredDateRange.start, configuredDateRange.end);
    const clearedValues = Object.fromEntries(filters.filter((filter) => filter.controlType !== "dateRange" && filter.operator !== "isEmpty" && filter.operator !== "isNotEmpty").map((filter) => [filter.id, ""]));
    setDateRange(nextRange);
    setLocalFilterValues(clearedValues);
    if (dateFilter !== undefined) onDashboardFilterChange?.(dateFilter.id, { start: nextRange[0].format("YYYY-MM-DD"), end: nextRange[1].format("YYYY-MM-DD") });
    filters.filter((filter) => filter.controlType !== "dateRange" && filter.operator !== "isEmpty" && filter.operator !== "isNotEmpty").forEach((filter) => onDashboardFilterChange?.(filter.id, ""));
    if (onDashboardFiltersApply?.() === true) setPendingAction("reset");
  };
  const now = dayjs();
  return (
    <section aria-label="看板信息栏与全局筛选" data-layout={useInlineHeaderLayout ? "inline" : "stacked"} style={dashboardHeaderShellStyle(useInlineHeaderLayout)}>
      <div style={dashboardHeaderInfoStyle(useInlineHeaderLayout)}>
        <h2 style={dashboardHeaderHeadingStyle}>{headline}</h2>
        {description.length > 0 && <p style={dashboardHeaderDescriptionStyle}>{description}</p>}
        {updatedAt.length > 0 && <div style={dashboardHeaderMetaStyle}>{updatedAt}</div>}
      </div>
      {filters.length > 0 && <div aria-label="全局筛选器" style={dashboardHeaderControlsStyle(useInlineHeaderLayout)}>
        <div aria-label="筛选条件" style={dashboardHeaderFilterFieldsStyle(useInlineHeaderLayout)}>
          {dateFilter !== undefined && <DatePicker.RangePicker
            aria-label="全局筛选日期范围"
            allowClear
            format="YYYY/MM/DD"
            locale={zhCN}
            presets={[
              { label: "今日", value: [now, now] },
              { label: "本月", value: [now.startOf("month"), now.endOf("month")] },
              { label: "本年", value: [now.startOf("year"), now.endOf("year")] },
            ]}
            style={{ minWidth: 248 }}
            value={dateRange}
            onChange={(nextRange) => {
              if (nextRange === null) return;
              const [start, end] = nextRange;
              if (start !== null && end !== null) setDateRange([start, end]);
            }}
          />}
          {filters.filter((filter) => filter.controlType !== "dateRange" && filter.operator !== "isEmpty" && filter.operator !== "isNotEmpty").map((filter) => {
            return <DimensionFilter key={filter.id} filter={filter} rows={rows} options={dashboardFilterOptions?.[filter.id]} value={localFilterValues[filter.id] ?? ""} onChange={(value) => {
              setLocalFilterValues((current) => ({ ...current, [filter.id]: value }));
            }} />;
          })}
        </div>
        <div aria-label="筛选操作" style={dashboardHeaderActionsStyle}>
          <Button aria-label="重置筛选" loading={dashboardFiltersLoading && pendingAction === "reset"} disabled={dashboardFiltersLoading} onClick={resetFilters}>重置</Button>
          <Button aria-label="应用筛选" type="primary" loading={dashboardFiltersLoading && pendingAction === "apply"} disabled={dashboardFiltersLoading} onClick={applyFilters}>应用</Button>
        </div>
      </div>}
    </section>
  );
};

const DimensionFilter = ({ filter, rows, options: suppliedOptions, value, onChange }: { readonly filter: DashboardGlobalFilterConfigValue; readonly rows: readonly Row[]; readonly options?: readonly string[] | undefined; readonly value: string; readonly onChange: (value: string) => void }) => {
  const fallbackOptions = [...new Set(rows.map((row) => row[filter.fieldKey]).filter((item): item is string | number | boolean => typeof item === "string" || typeof item === "number" || typeof item === "boolean").map(String))].slice(0, 100);
  const options = suppliedOptions ?? fallbackOptions;
  if (filter.controlType === "input" || filter.operator === "contains" || filter.operator === "notContains") return <Input aria-label={`全局筛选${filter.label}`} placeholder={`输入${filter.label}`} style={{ ...dashboardHeaderControlStyle, width: 160 }} value={value} onChange={(event) => onChange(event.target.value)} />;
  return <Select
    aria-label={`全局筛选${filter.label}`}
    options={[{ label: `全部${filter.label}`, value: "" }, ...options.map((option) => ({ label: option, value: option }))]}
    style={{ minWidth: 160 }}
    value={value}
    onChange={(nextValue: string) => onChange(nextValue)}
  />;
};

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
  margin: "0 14px",
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
  background: "#ffffff",
  borderBottom: "1px solid #dce9ff",
  color: "#334155",
  fontWeight: 650,
  padding: "11px 12px",
  position: "sticky",
  textAlign: "left",
  top: 0,
  whiteSpace: "nowrap",
  zIndex: 2,
};

const tableCellStyle: CSSProperties = {
  borderBottom: "none",
  color: "#1e293b",
  maxWidth: 260,
  overflow: "hidden",
  padding: "10px 12px",
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
  background: "#ffffff",
  borderTop: "1px solid #f1f5f9",
  boxSizing: "border-box",
  color: "#7b8798",
  display: "flex",
  flex: "0 0 auto",
  fontSize: 11,
  gap: 8,
  justifyContent: "space-between",
  minHeight: 42,
  padding: "8px 14px",
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
  background: "#ffffff",
  border: "1px solid #e6edf6",
  borderRadius: 6,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: 3,
  justifyContent: "center",
  minHeight: 60,
  minWidth: 0,
  padding: "8px 12px",
};

const trendLatestSummaryItemStyle: CSSProperties = {
  ...trendSummaryItemStyle,
  background: "#f5f9ff",
  borderColor: "#cfe2ff",
  boxShadow: "inset 3px 0 0 #1677ff",
};

const trendPositiveSummaryItemStyle: CSSProperties = {
  ...trendSummaryItemStyle,
  background: "#f4fcf8",
  borderColor: "#cceedd",
  boxShadow: "inset 3px 0 0 #12a06a",
};

const trendNegativeSummaryItemStyle: CSSProperties = {
  ...trendSummaryItemStyle,
  background: "#fff7f6",
  borderColor: "#ffd9d5",
  boxShadow: "inset 3px 0 0 #e05252",
};

const trendPeakSummaryItemStyle: CSSProperties = {
  ...trendSummaryItemStyle,
  background: "#fafcff",
  borderColor: "#e0eaf7",
  boxShadow: "inset 3px 0 0 #7b9bc8",
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
  fontSize: 20,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  lineHeight: 1.2,
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
  gridTemplateRows: "auto minmax(0, 1fr)",
  height: "100%",
  minHeight: 0,
  padding: "12px 16px 14px",
  rowGap: 12,
};

const metricTrendHeaderStyle: CSSProperties = {
  alignItems: "end",
  display: "grid",
  gap: "12px 20px",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  minWidth: 0,
};

const metricTrendSummaryStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  minWidth: 0,
};

const metricTrendEyebrowStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 600,
  lineHeight: 1.35,
};

const metricTrendValueStyle: CSSProperties = {
  color: "#0f172a",
  display: "block",
  fontSize: 28,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 760,
  letterSpacing: "-0.025em",
  lineHeight: 1.12,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metricTrendTabsStyle: CSSProperties = {
  alignItems: "flex-end",
  borderBottom: "1px solid #edf2f7",
  display: "flex",
  flex: "0 1 auto",
  flexWrap: "wrap",
  gap: 4,
  justifyContent: "flex-end",
  minWidth: 0,
};

const metricTrendTabStyle: CSSProperties = {
  alignItems: "center",
  appearance: "none",
  background: "transparent",
  border: 0,
  borderBottomColor: "transparent",
  borderBottomStyle: "solid",
  borderBottomWidth: 2,
  borderRadius: 0,
  color: "#64748b",
  cursor: "pointer",
  display: "inline-flex",
  font: "inherit",
  fontSize: 12,
  fontWeight: 600,
  gap: 6,
  height: 34,
  marginBottom: -1,
  minWidth: 0,
  outline: 0,
  overflow: "hidden",
  padding: "0 8px 6px",
  textAlign: "left",
  textOverflow: "ellipsis",
  transition: "border-color 160ms ease, color 160ms ease",
  whiteSpace: "nowrap",
};

const metricTrendTabValueStyle: CSSProperties = {
  color: "inherit",
  fontSize: 11,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 500,
  opacity: 0.78,
};

const metricTrendActiveTabStyle: CSSProperties = {
  ...metricTrendTabStyle,
  borderBottomColor: "#1677ff",
  color: "#1677ff",
};

const metricTrendChartStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minHeight: 150,
  minWidth: 0,
  overflow: "hidden",
  padding: "8px 0 0",
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
  display: "block",
  height: "100%",
};

const metricAlertShellStyle: CSSProperties = {
  alignItems: "center",
  background: "#fff9f0",
  border: "1px solid #ffd8a8",
  borderRadius: 7,
  boxSizing: "border-box",
  color: "#1f2937",
  cursor: "pointer",
  display: "grid",
  gap: 16,
  gridTemplateColumns: "minmax(0, 1fr) auto",
  height: "100%",
  minHeight: 0,
  outline: "none",
  overflow: "hidden",
  padding: "14px 16px",
  textAlign: "left",
  transition: "border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease",
  width: "100%",
};

const metricAlertShellActiveStyle: CSSProperties = { ...metricAlertShellStyle, boxShadow: "0 0 0 3px rgba(255, 122, 69, 0.12)" };
const metricAlertCopyStyle: CSSProperties = { minWidth: 0 };
const metricAlertHeadlineStyle: CSSProperties = { alignItems: "center", color: "#1f2937", display: "flex", fontSize: 15, fontWeight: 700, gap: 8, lineHeight: 1.45, minWidth: 0 };
const metricAlertBadgeStyle: CSSProperties = { background: "#ff721b", borderRadius: 12, color: "#fff", flex: "0 0 auto", fontSize: 12, fontWeight: 700, lineHeight: "22px", maxWidth: 150, overflow: "hidden", padding: "0 9px", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const metricAlertHeadlineTextStyle: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const metricAlertMessageStyle: CSSProperties = { color: "#526176", fontSize: 12, lineHeight: 1.55, margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const metricAlertActionStyle: CSSProperties = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: 6, color: "#475569", flex: "0 0 auto", fontFamily: "inherit", fontSize: 12, height: 32, padding: "0 12px", whiteSpace: "nowrap" };
const metricAlertDetailStyle: CSSProperties = { color: "#475569", fontSize: 14, lineHeight: 1.75, margin: 0, whiteSpace: "pre-wrap" };
const metricAlertDetailListStyle: CSSProperties = { background: "#fffaf5", border: "1px solid #ffe1be", borderRadius: 8, display: "grid", gap: 8, marginTop: 18, padding: 14 };
const metricAlertDetailRowStyle: CSSProperties = { alignItems: "baseline", display: "grid", gap: 12, gridTemplateColumns: "88px minmax(0, 1fr)" };
const metricAlertDetailKeyStyle: CSSProperties = { color: "#8c6d46", fontSize: 12, fontWeight: 600 };
const metricAlertDetailValueStyle: CSSProperties = { color: "#1f2937", fontSize: 13, minWidth: 0, overflowWrap: "anywhere" };
const metricAlertTableWrapStyle: CSSProperties = { border: "1px solid #ffe1be", borderRadius: 8, flex: "1 1 auto", marginTop: 18, minHeight: 0, overflowX: "auto", overflowY: "auto", overscrollBehavior: "contain" };
const metricAlertTableStyle: CSSProperties = { borderCollapse: "collapse", fontSize: 13, minWidth: "100%", width: "100%" };
const metricAlertTableHeadCellStyle: CSSProperties = { background: "#fff8ef", borderBottom: "1px solid #ffe1be", color: "#8c6d46", fontSize: 12, fontWeight: 600, padding: "10px 12px", position: "sticky", textAlign: "left", top: 0, whiteSpace: "nowrap", zIndex: 1 };
const metricAlertTableCellStyle: CSSProperties = { borderBottom: "1px solid #fff0dc", color: "#1f2937", padding: "10px 12px", textAlign: "left" };
const metricAlertDetailContentStyle: CSSProperties = { display: "flex", flexDirection: "column", height: "68vh", maxHeight: 560, minHeight: 0, overflow: "hidden" };

const insightShellStyle: CSSProperties = {
  ...kpiShellStyle,
  gap: 7,
  padding: "16px 18px",
};

const insightTitleStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.4,
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const insightValueStyle: CSSProperties = { ...kpiValueStyle, fontSize: 36, fontWeight: 750, lineHeight: 1.18 };

const insightGridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
  height: "100%",
  minHeight: 0,
  overflow: "auto",
  width: "100%",
};

const kpiInsightAggregation = (component: ComponentInstance, measureKey: string): string => {
  const measure = component.binding?.slots.measure;
  const measures = measure === undefined ? [] : Array.isArray(measure) ? measure : [measure];
  const configured = measures.find((item) => item.fieldKey === measureKey)?.aggregation;
  if (configured === "sum" || configured === "avg" || configured === "count" || configured === "max" || configured === "min") return configured;
  const legacy = component.props.aggregation;
  return legacy === "sum" || legacy === "avg" || legacy === "count" || legacy === "max" || legacy === "min" ? legacy : "sum";
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

const targetProgressShellStyle: CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  minHeight: 0,
  overflow: "auto",
  padding: "12px 18px 14px",
};

const targetProgressListStyle: CSSProperties = {
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: 10,
  justifyContent: "space-between",
  minHeight: 0,
  minWidth: 0,
};

const targetProgressRowStyle: CSSProperties = {
  alignItems: "center",
  columnGap: 16,
  display: "grid",
  // Let the row itself absorb width changes. The former 620px minimum made
  // the value and percentage columns disappear outside a narrow editor card.
  gridTemplateColumns: "minmax(84px, 1fr) minmax(96px, 2fr) minmax(84px, max-content) 40px",
  minWidth: 0,
};

const targetProgressLabelStyle: CSSProperties = {
  color: "#334155",
  fontSize: 12,
  lineHeight: 1.4,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const targetProgressTrackStyle: CSSProperties = {
  background: "#edf0f3",
  borderRadius: 999,
  height: 22,
  overflow: "hidden",
  width: "100%",
};

const targetProgressBarStyle: CSSProperties = {
  borderRadius: 999,
  display: "block",
  height: "100%",
  minWidth: 6,
};

const targetProgressValueStyle: CSSProperties = {
  color: "#475569",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
  textAlign: "right",
  whiteSpace: "nowrap",
};

const targetProgressPercentStyle: CSSProperties = {
  color: "#334155",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 700,
  textAlign: "right",
  whiteSpace: "nowrap",
};

const goalTaskProgressShellStyle: CSSProperties = {
  boxSizing: "border-box",
  display: "flex",
  flex: "1 1 auto",
  flexDirection: "column",
  gap: 12,
  minHeight: 0,
  overflow: "auto",
  padding: "12px 16px 16px",
};

const goalTaskProgressTableStyle: CSSProperties = {
  alignContent: "start",
  border: "1px solid #e5ebf3",
  borderRadius: 6,
  display: "grid",
  minWidth: 0,
  overflow: "hidden",
};

const GoalTaskProgressSurface = ({ component, rows, fields, onComponentPropsChange }: { readonly component: ComponentInstance; readonly rows: readonly Row[]; readonly fields: readonly DatasetField[]; readonly onComponentPropsChange?: ((props: ComponentInstance["props"]) => void) | undefined }) => {
  const initialYear = Math.max(2000, Math.min(2100, Math.trunc(numberProp(component, "periodYear", 2026))));
  const initialMonth = Math.max(1, Math.min(12, Math.trunc(numberProp(component, "periodMonth", 8))));
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [periodMode, setPeriodMode] = useState<"month" | "year">(component.props.periodMode === "year" ? "year" : "month");
  const dateKey = bindingFieldKeys(component, "dateDimension")[0]
    ?? fields.find((field) => field.type === "date" || /日期|月份|month|date/.test(`${field.key} ${field.label}`.toLowerCase()))?.key;
  const selectedRows = dateKey === undefined ? rows : rows.filter((row) => {
    const value = row[dateKey];
    const parsed = value instanceof Date ? dayjs(value) : typeof value === "string" || typeof value === "number" ? dayjs(value) : null;
    return parsed !== null && parsed.isValid() && parsed.year() === year && (periodMode === "year" || parsed.month() + 1 === month);
  });
  const model = buildGoalTaskProgressModel({ ...component, props: { ...component.props, periodYear: year, periodMonth: month, periodMode } }, selectedRows, fields);
  const decimals = Math.max(0, Math.min(4, Math.trunc(numberProp(component, "decimals", 1))));
  const maximumEmployees = Math.max(3, Math.min(50, Math.trunc(numberProp(component, "maxEmployees", 12))));
  const [activeEmployee, setActiveEmployee] = useState<string | null>(null);
  const [targetConfigOpen, setTargetConfigOpen] = useState(false);
  const [weightConfigOpen, setWeightConfigOpen] = useState(false);
  const [targetDrafts, setTargetDrafts] = useState<Record<string, { monthly: number | null; annual: number | null }>>({});
  const [weightDrafts, setWeightDrafts] = useState<Record<string, number>>({});
  const selectedEmployee = model.employees.find((employee) => employee.key === activeEmployee) ?? model.employees[0];
  const saveSettings = (changes: Record<string, { monthlyTargetValue?: number | null; annualTargetValue?: number | null; weight?: number }>) => {
    if (onComponentPropsChange === undefined || selectedEmployee === undefined) return;
    const existingSettings = Array.isArray(component.props.employeeSettings) ? component.props.employeeSettings : [];
    const currentEmployeeSettings = existingSettings.find((setting) => setting !== null && typeof setting === "object" && (setting as { employeeKey?: unknown }).employeeKey === selectedEmployee.key) as { readonly metrics?: unknown } | undefined;
    const existingMetrics = new Map(Array.isArray(currentEmployeeSettings?.metrics)
      ? currentEmployeeSettings.metrics.flatMap((metric) => metric !== null && typeof metric === "object" && typeof (metric as { measureKey?: unknown }).measureKey === "string"
        ? [[(metric as { measureKey: string }).measureKey, metric as Record<string, unknown>] as const] : [])
      : []);
    const otherEmployees = existingSettings.filter((setting) => setting !== null && typeof setting === "object" && (setting as { employeeKey?: unknown }).employeeKey !== selectedEmployee.key);
    onComponentPropsChange({ ...component.props, employeeSettings: [...otherEmployees, { employeeKey: selectedEmployee.key, metrics: selectedEmployee.metrics.map((metric) => {
      const change = changes[metric.measureKey];
      const previous = existingMetrics.get(metric.measureKey);
      return {
        measureKey: metric.measureKey,
        targetValue: typeof previous?.targetValue === "number" ? previous.targetValue : metric.target,
        monthlyTargetValue: change?.monthlyTargetValue ?? (typeof previous?.monthlyTargetValue === "number" ? previous.monthlyTargetValue : metric.target),
        annualTargetValue: change?.annualTargetValue ?? (typeof previous?.annualTargetValue === "number" ? previous.annualTargetValue : null),
        weight: change?.weight ?? (typeof previous?.weight === "number" ? previous.weight : metric.weight),
      };
    }) }] });
  };

  const formatMetric = (metric: typeof model.metrics[number], value: number | null, isTarget = false) => {
    if (metric.kind === "turnover") return value === null ? "—" : `${value.toFixed(0)} 天`;
    return formatCurrencyMetricNumber(value, isTarget ? metric.targetIsCurrency : metric.isCurrency, isTarget ? metric.targetIsQuantity : metric.isQuantity);
  };

  const changePeriod = (nextYear: number, nextMonth: number) => {
    setYear(nextYear); setMonth(nextMonth);
    onComponentPropsChange?.({ ...component.props, periodYear: nextYear, periodMonth: nextMonth, periodMode });
  };
  const changePeriodMode = (nextMode: "month" | "year") => {
    setPeriodMode(nextMode);
    onComponentPropsChange?.({ ...component.props, periodYear: year, periodMonth: month, periodMode: nextMode });
  };
  const selectEmployeeForConfig = (employeeKey: string) => {
    setActiveEmployee(employeeKey);
    const employee = model.employees.find((candidate) => candidate.key === employeeKey);
    const savedMetrics = new Map(
      (Array.isArray(component.props.employeeSettings) ? component.props.employeeSettings : []).flatMap((setting) => {
        if (setting === null || typeof setting !== "object" || (setting as { employeeKey?: unknown }).employeeKey !== employeeKey) return [];
        const metrics = (setting as { metrics?: unknown }).metrics;
        return Array.isArray(metrics)
          ? metrics.flatMap((metric) => metric !== null && typeof metric === "object" && typeof (metric as { measureKey?: unknown }).measureKey === "string"
            ? [[(metric as { measureKey: string }).measureKey, metric as Record<string, unknown>] as const] : [])
          : [];
      }),
    );
    setTargetDrafts(Object.fromEntries((employee?.metrics ?? []).map((metric) => [metric.measureKey, {
      monthly: typeof savedMetrics.get(metric.measureKey)?.monthlyTargetValue === "number" ? savedMetrics.get(metric.measureKey)?.monthlyTargetValue as number : metric.target,
      annual: typeof savedMetrics.get(metric.measureKey)?.annualTargetValue === "number"
        ? savedMetrics.get(metric.measureKey)?.annualTargetValue as number
        : metric.kind === "gmv" || metric.kind === "sales" ? (metric.target === null ? null : metric.target * 12) : null,
    }])));
    setWeightDrafts(Object.fromEntries((employee?.metrics ?? []).map((metric) => [metric.measureKey, metric.weight])));
  };
  const weightTotal = (selectedEmployee?.metrics ?? []).reduce((total, metric) => total + (weightDrafts[metric.measureKey] ?? metric.weight), 0);
  const metricByKind = (employee: typeof model.employees[number], kind: "gmv" | "sales" | "turnover") => employee.metrics.find((metric) => metric.kind === kind);
  const metricLabel = (metric: typeof model.metrics[number]) => metric.kind === "gmv" ? "GMV" : metric.kind === "sales" ? "销量" : metric.kind === "turnover" ? "周转天数" : metric.label;
  const targetDraftFor = (metric: typeof model.metrics[number]) => targetDrafts[metric.measureKey] ?? { monthly: metric.target, annual: null };
  const updateTargetDraft = (metric: typeof model.metrics[number], changes: Partial<{ monthly: number | null; annual: number | null }>) => {
    setTargetDrafts((current) => ({ ...current, [metric.measureKey]: { ...targetDraftFor(metric), ...current[metric.measureKey], ...changes } }));
  };
  const tableColumns = "minmax(88px, .8fr) 56px minmax(152px, 1.2fr) minmax(132px, 1fr) minmax(108px, .8fr) minmax(96px, .72fr) minmax(96px, .72fr) minmax(92px, .72fr)";
  return <section aria-label={`${component.title ?? "目标任务进度"}图表`} data-testid="goal-task-progress-surface" style={{ ...goalTaskProgressShellStyle, gap: 12, padding: "14px 16px 16px" }}>
    <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}><div style={{ display: "grid", gap: 2 }}><strong style={{ color: "#172033", fontSize: 15 }}>{periodMode === "year" ? "年度目标进度" : "月度目标进度"}</strong><span style={{ color: "#718096", fontSize: 12 }}>按员工查看 GMV、销量、毛利、完成率与评分</span></div><div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8 }}><Segmented aria-label="统计周期" size="small" value={periodMode} options={[{ label: "月度", value: "month" }, { label: "年度", value: "year" }]} onChange={(value) => changePeriodMode(value as "month" | "year")} /><Select aria-label="选择年份" size="small" value={year} style={{ width: 92 }} options={Array.from({ length: 7 }, (_, index) => ({ value: 2024 + index, label: `${2024 + index}年` }))} onChange={(value: number) => changePeriod(value, month)} />{periodMode === "month" && <Select aria-label="选择月份" size="small" value={month} style={{ width: 76 }} options={Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: `${index + 1}月` }))} onChange={(value: number) => changePeriod(year, value)} />}<Button size="small" onClick={() => { selectEmployeeForConfig(activeEmployee ?? model.employees[0]?.key ?? ""); setTargetConfigOpen(true); }}>自定义目标</Button><Button size="small" type="primary" onClick={() => { selectEmployeeForConfig(activeEmployee ?? model.employees[0]?.key ?? ""); setWeightConfigOpen(true); }}>评分权重设置</Button></div></div>
    {dateKey === undefined && <span style={{ color: "#8a98aa", fontSize: 12 }}>未找到日期字段，年/月选择将仅用于目标配置；可在数据绑定中指定日期字段。</span>}
    <div style={{ ...goalTaskProgressTableStyle, flex: "1 1 auto", borderRadius: 8 }}>
      {model.employees.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 12, padding: 18 }}>绑定员工维度后可查看运营人员的目标任务进度。</div> : <>
        <div aria-hidden="true" style={{ background: "#f7f9fc", color: "#64748b", display: "grid", fontSize: 12, fontWeight: 650, gap: 14, gridTemplateColumns: tableColumns, minWidth: 900, padding: "10px 14px" }}><span>{model.employeeLabel}</span><span>评分</span><span>GMV（实际 / 目标）</span><span>销量（实际 / 目标）</span><span>{model.grossProfitLabel}</span><span>GMV完成率</span><span>销量完成率</span><span>周转天数</span></div>
        {model.employees.slice(0, maximumEmployees).map((employee) => {
          const gmv = metricByKind(employee, "gmv");
          const sales = metricByKind(employee, "sales");
          const turnover = metricByKind(employee, "turnover");
          const score = employee.score === null ? null : employee.score * 100;
          const rate = (metric: typeof gmv) => metric?.progress === null || metric === undefined ? "—" : `${(metric.progress * 100).toFixed(decimals)}%`;
          return <button key={employee.key} type="button" aria-pressed={activeEmployee === employee.key} onClick={() => setActiveEmployee((current) => current === employee.key ? null : employee.key)} style={{ alignItems: "center", background: activeEmployee === employee.key ? "#f0f5ff" : "#fff", border: 0, borderTop: "1px solid #edf2f7", color: "#172033", cursor: "pointer", display: "grid", fontFamily: "inherit", gap: 14, gridTemplateColumns: tableColumns, minWidth: 900, padding: "13px 14px", textAlign: "left", width: "100%" }}><strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{employee.label}</strong><span style={{ color: score !== null && score < 70 ? "#e34d59" : "#2f6bee", fontSize: 18, fontVariantNumeric: "tabular-nums", fontWeight: 750 }}>{score === null ? "—" : score.toFixed(0)}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{gmv === undefined ? "—" : <>{formatMetric(gmv, gmv.value)} <span style={{ color: "#94a3b8" }}>/ {formatMetric(gmv, gmv.target, true)}</span></>}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{sales === undefined ? "—" : <>{formatMetric(sales, sales.value)} <span style={{ color: "#94a3b8" }}>/ {formatMetric(sales, sales.target, true)}</span></>}</span><span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrencyMetricNumber(employee.grossProfit, model.grossProfitIsCurrency, false)}</span><strong style={{ color: gmv?.progress !== null && gmv?.progress !== undefined && gmv.progress < .7 ? "#e65f00" : "#2f6bee" }}>{rate(gmv)}</strong><strong style={{ color: sales?.progress !== null && sales?.progress !== undefined && sales.progress < .7 ? "#e65f00" : "#2f6bee" }}>{rate(sales)}</strong><span style={{ fontVariantNumeric: "tabular-nums" }}>{turnover === undefined ? "—" : formatMetric(turnover, turnover.value)}</span></button>;
        })}
        <div style={{ alignItems: "center", borderTop: "1px solid #e7edf5", color: "#64748b", display: "flex", flexWrap: "wrap", fontSize: 12, gap: 10, padding: "10px 14px" }}><strong style={{ color: "#475569" }}>评分权重：</strong>{(selectedEmployee?.metrics ?? model.metrics).map((metric) => <span key={metric.measureKey} style={{ background: "#f5f8fe", borderRadius: 4, padding: "3px 7px" }}>{metric.label} {metric.weight}%</span>)}<span style={{ marginLeft: "auto" }}>{model.periodLabel}</span></div>
      </>}
    </div>
    <Modal aria-label="目标配置" title="目标配置" open={targetConfigOpen} okText="保存目标" cancelText="取消" onCancel={() => setTargetConfigOpen(false)} onOk={() => { saveSettings(Object.fromEntries((selectedEmployee?.metrics ?? []).map((metric) => [metric.measureKey, { monthlyTargetValue: targetDraftFor(metric).monthly, annualTargetValue: targetDraftFor(metric).annual }]))); setTargetConfigOpen(false); }}><p style={{ color: "#64748b", fontSize: 13, marginTop: 0 }}>选择运营后维护月度、年度目标；保存后列表中的实际、目标与完成率会同步更新。</p><Select aria-label="配置运营" value={selectedEmployee?.key ?? null} style={{ marginBottom: 16, width: "100%" }} options={model.employees.map((employee) => ({ value: employee.key, label: employee.label }))} onChange={selectEmployeeForConfig} />{selectedEmployee?.metrics.map((metric) => metric.kind === "gmv" || metric.kind === "sales" ? <div key={metric.measureKey} style={{ display: "grid", gap: 10, gridTemplateColumns: "112px 1fr 1fr", marginBottom: 14 }}><strong style={{ alignSelf: "center" }}>{metricLabel(metric)}</strong><label style={{ color: "#64748b", fontSize: 12 }}>月度目标<InputNumber aria-label={`月度${metricLabel(metric)}目标`} style={{ marginTop: 4, width: "100%" }} min={0} value={targetDraftFor(metric).monthly} onChange={(value) => updateTargetDraft(metric, { monthly: value })} /></label><label style={{ color: "#64748b", fontSize: 12 }}>年度目标<InputNumber aria-label={`年度${metricLabel(metric)}目标`} style={{ marginTop: 4, width: "100%" }} min={0} value={targetDraftFor(metric).annual} onChange={(value) => updateTargetDraft(metric, { annual: value })} /></label></div> : <label key={metric.measureKey} style={{ alignItems: "center", display: "grid", gap: 12, gridTemplateColumns: "112px 1fr", marginBottom: 14 }}><strong>{metricLabel(metric)}目标</strong><InputNumber aria-label={`${metricLabel(metric)}目标`} style={{ width: "100%" }} min={0} value={targetDraftFor(metric).monthly} onChange={(value) => updateTargetDraft(metric, { monthly: value })} /></label>)}</Modal>
    <Modal aria-label="评分权重配置" title="评分权重配置" open={weightConfigOpen} okText="保存配置" cancelText="取消" okButtonProps={{ disabled: weightTotal !== 100 }} onCancel={() => setWeightConfigOpen(false)} onOk={() => { saveSettings(Object.fromEntries(Object.entries(weightDrafts).map(([key, value]) => [key, { weight: value }]))); setWeightConfigOpen(false); }}><p style={{ color: "#64748b", fontSize: 13, marginTop: 0 }}>每位员工可独立设置 GMV、销量和周转天数的评分权重，合计为 100% 后方可保存。</p><Select aria-label="配置运营" value={selectedEmployee?.key ?? null} style={{ marginBottom: 16, width: "100%" }} options={model.employees.map((employee) => ({ value: employee.key, label: employee.label }))} onChange={selectEmployeeForConfig} />{selectedEmployee?.metrics.map((metric) => <div key={metric.measureKey} style={{ alignItems: "center", display: "grid", gap: 12, gridTemplateColumns: "112px 1fr 44px", marginBottom: 16 }}><strong>{metricLabel(metric)}贡献</strong><Slider aria-label={`${metricLabel(metric)}贡献`} min={0} max={100} value={weightDrafts[metric.measureKey] ?? metric.weight} onChange={(value) => setWeightDrafts((current) => ({ ...current, [metric.measureKey]: typeof value === "number" ? value : 0 }))} /><span style={{ fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{weightDrafts[metric.measureKey] ?? metric.weight}%</span></div>)}<div style={{ background: weightTotal === 100 ? "#f1f8f5" : "#fff7ed", borderRadius: 6, color: weightTotal === 100 ? "#267a4b" : "#b45309", fontSize: 13, padding: "10px 12px" }}>当前合计：{weightTotal}%（{(selectedEmployee?.metrics ?? []).map((metric) => `${metricLabel(metric)} ${weightDrafts[metric.measureKey] ?? metric.weight}%`).join("｜")}）</div></Modal>
  </section>;
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
  minWidth: 320,
  paddingBottom: 2,
};

const rankingRowStyle: CSSProperties = {
  alignItems: "start",
  display: "grid",
  gap: 10,
  minWidth: 320,
  padding: "4px 0",
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
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.45,
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

const rankingProgressGroupStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  minWidth: 0,
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
  alignSelf: "end",
  color: "#334155",
  fontSize: 12,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1.45,
  overflow: "hidden",
  textAlign: "right",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rankingMeasureHeaderStyle: CSSProperties = {
  minWidth: 0,
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
  gap: 8,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  minHeight: 0,
  overflow: "auto",
};

const kpiBoardCardStyle: CSSProperties = {
  background: "#f7f9fc",
  border: "none",
  borderRadius: 9,
  boxShadow: "none",
  minHeight: 156,
  minWidth: 0,
  padding: "13px 14px",
};

const kpiBoardPeriodStyle: CSSProperties = {
  color: "#243b5d",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.35,
  marginBottom: 8,
  maxHeight: 36,
  overflow: "hidden",
};

const kpiBoardMetricNameStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  lineHeight: 1.35,
};

const kpiBoardValueStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 27,
  fontVariantNumeric: "tabular-nums",
  fontWeight: 800,
  lineHeight: 1.2,
  margin: "5px 0 13px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const kpiBoardRowsStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
  paddingTop: 2,
};

const kpiBoardRowStyle: CSSProperties = {
  alignItems: "center",
  display: "grid",
  gap: 8,
  gridTemplateColumns: "minmax(0, 1fr) auto",
  minWidth: 0,
};

const kpiBoardRowLabelStyle: CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const kpiBoardRowValueStyle: CSSProperties = {
  color: "#1e293b",
  fontSize: 15,
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
  const summary = `实际 ${formatCurrencyMetricNumber(model.value, model.measureIsCurrency, model.measureIsQuantity)} / 目标 ${formatCurrencyMetricNumber(model.target, model.targetIsCurrency, model.targetIsQuantity)}`;

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
  if (component.type === "targetProgress") return <ProgressDemo />;
  if (component.type === "goalTaskProgress") return <ProgressDemo />;
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
  if (component.type === "horizontalBar") return <BarDemo horizontal />;
  if (component.type === "barLine") return <BarDemo />;
  if (component.type === "donut") return <PieDemo donut />;
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
  if (component.type === "kpiInsight") return <MetricDemo />;
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

/** Monetary values use 万 consistently once they exceed one thousand. */
const formatCurrencyInWan = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return "—";
  if (Math.abs(value) <= 1_000) return formatCrosstabNumber(value);
  return `${new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    useGrouping: false,
  }).format(value / 10_000)}万`;
};

const formatCrosstabMetric = (value: number, isCurrency: boolean, isQuantity = false): string =>
  `${isCurrency ? formatCurrencyInWan(value) : formatCrosstabNumber(value)}${isCurrency ? " ¥" : isQuantity ? " 件" : ""}`;

const heatmapCellFill = (intensity: number): string => {
  const clamped = Math.max(0, Math.min(1, intensity));
  const lightness = 96 - clamped * 48;
  const saturation = 82 - clamped * 16;
  return `hsl(213deg ${saturation}% ${lightness}%)`;
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

const formatCurrencyMetricNumber = (value: number | null | undefined, isCurrency: boolean, isQuantity = false): string =>
  `${isCurrency ? formatCurrencyInWan(value) : formatCompactMetricNumber(value)}${isCurrency ? " ¥" : isQuantity ? " 件" : ""}`;

const formatCurrencyNumber = (value: number | null | undefined, decimals: number, isCurrency: boolean, isQuantity = false): string =>
  `${isCurrency && value !== null && value !== undefined && Math.abs(value) > 1_000 ? formatCurrencyInWan(value) : formatMetricNumber(value, decimals)}${isCurrency ? " ¥" : isQuantity ? " 件" : ""}`;

const formatKpiValue = (value: number | null | undefined, decimals: number, isCurrency: boolean): string => {
  if (value === null || value === undefined) return "—";
  return isCurrency && Math.abs(value) > 1_000 ? formatCurrencyInWan(value) : value.toFixed(decimals);
};

type MetricAlertOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq";

const metricAlertOperator = (value: unknown): MetricAlertOperator =>
  value === "gt" || value === "gte" || value === "lt" || value === "lte" || value === "eq" || value === "neq" ? value : "gte";

const metricAlertOperatorLabel = (operator: MetricAlertOperator): string => ({
  gt: "大于", gte: "大于等于", lt: "小于", lte: "小于等于", eq: "等于", neq: "不等于",
})[operator];

const metricAlertMatches = (value: number | null, operator: MetricAlertOperator, threshold: number): boolean => {
  if (value === null) return false;
  if (operator === "gt") return value > threshold;
  if (operator === "gte") return value >= threshold;
  if (operator === "lt") return value < threshold;
  if (operator === "lte") return value <= threshold;
  if (operator === "eq") return value === threshold;
  return value !== threshold;
};

const metricAlertTemplate = (template: string, variables: Readonly<Record<string, string>>): string =>
  template.replace(/\{\{(metric|value|threshold|operator|label|scope|dimension|dimensionLabel|count)\}\}/g, (_token, key: string) => variables[key] ?? "");

type MetricAlertGroup = Readonly<{ key: string; value: number | null }>;

const buildMetricAlertGroups = (
  component: ComponentInstance,
  rows: readonly Row[],
  dimensionKey: string,
  measureKey: string,
  aggregation: string,
): readonly MetricAlertGroup[] => {
  const groupedRows = new Map<string, Row[]>();

  for (const row of rows) {
    const key = dimensionKey ? String(row[dimensionKey] ?? "未填写") : "全部范围";
    const group = groupedRows.get(key);
    if (group) group.push(row);
    else groupedRows.set(key, [row]);
  }

  return [...groupedRows].map(([key, groupRows]) => ({
    key,
    value: buildKpiModelForFields(component, groupRows, measureKey, undefined, undefined, aggregation).value,
  }));
};

const MetricAlertSurface = ({ component, fields, rows }: { readonly component: ComponentInstance; readonly fields: readonly DatasetField[]; readonly rows: readonly Row[] }) => {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const dimensionKey = bindingFieldKeys(component, "dimension")[0] ?? "";
  const measureKey = bindingFieldKeys(component, "measure")[0] ?? "";
  const aggregation = stringProp(component, "aggregation", "sum");
  const threshold = numberProp(component, "threshold", 0);
  const operator = metricAlertOperator(component.props.operator);
  const dimensionLabel = (fields.find((field) => field.key === dimensionKey)?.label ?? dimensionKey) || "维度";
  const metric = (fields.find((field) => field.key === measureKey)?.label ?? measureKey) || "预警指标";
  const decimals = Math.max(0, Math.min(6, Math.trunc(numberProp(component, "decimals", 0))));
  const groups = buildMetricAlertGroups(component, rows, dimensionKey, measureKey, aggregation);
  const triggeredGroups = groups.filter((group) => metricAlertMatches(group.value, operator, threshold));
  const primaryGroup = triggeredGroups[0];
  const value = formatCurrencyNumber(primaryGroup?.value ?? null, decimals, isCurrencyMetric(measureKey, fields), isQuantityMetric(measureKey, fields));
  const thresholdDisplay = formatCurrencyNumber(threshold, decimals, isCurrencyMetric(measureKey, fields), isQuantityMetric(measureKey, fields));
  const operatorLabel = metricAlertOperatorLabel(operator);
  const baseVariables = {
    metric,
    value,
    threshold: thresholdDisplay,
    operator: operatorLabel,
    scope: stringProp(component, "scopeText", "全部范围") || "全部范围",
    dimension: triggeredGroups.map((group) => group.key).join("、") || "—",
    dimensionLabel,
    count: String(triggeredGroups.length),
  };
  const label = metricAlertTemplate(stringProp(component, "alertLabel", "指标预警 {{count}} 项"), baseVariables);
  const variables = { ...baseVariables, label };
  const headline = metricAlertTemplate(stringProp(component, "headlineTemplate", "{{metric}}触发预警"), variables);
  const message = metricAlertTemplate(stringProp(component, "messageTemplate", "{{scope}}｜共 {{count}} 个{{dimensionLabel}}命中预警。"), variables);
  const detail = metricAlertTemplate(stringProp(component, "detailTemplate", "{{dimension}}的{{metric}}当前值为 {{value}}。预警条件：{{metric}} {{operator}} {{threshold}}。"), variables);

  if (triggeredGroups.length === 0) return null;

  return <>
    <section
      aria-label={`${label}，点击查看详情`}
      data-testid="metric-alert-surface"
      role="button"
      style={metricAlertShellActiveStyle}
      tabIndex={0}
      onClick={() => setDetailsOpen(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setDetailsOpen(true);
        }
      }}
    >
      <div style={metricAlertCopyStyle}>
        <div style={metricAlertHeadlineStyle}>
          <span style={metricAlertBadgeStyle}>{label}</span>
          <span style={metricAlertHeadlineTextStyle}>{headline}</span>
        </div>
        <p style={metricAlertMessageStyle}>{message}</p>
      </div>
      <button aria-label={`查看${metric}预警详情`} style={metricAlertActionStyle} type="button" onClick={(event) => { event.stopPropagation(); setDetailsOpen(true); }}>查看风险</button>
    </section>
    <Modal footer={null} open={detailsOpen} title={`${label}详情`} onCancel={() => setDetailsOpen(false)}>
      <div aria-label="预警详情内容" data-testid="metric-alert-detail-content" style={metricAlertDetailContentStyle}>
        <p style={metricAlertDetailStyle}>{detail}</p>
        <div style={metricAlertDetailListStyle}>
          <div style={metricAlertDetailRowStyle}><span style={metricAlertDetailKeyStyle}>预警维度</span><span style={metricAlertDetailValueStyle}>{dimensionLabel}</span></div>
          <div style={metricAlertDetailRowStyle}><span style={metricAlertDetailKeyStyle}>预警指标</span><span style={metricAlertDetailValueStyle}>{metric}</span></div>
          <div style={metricAlertDetailRowStyle}><span style={metricAlertDetailKeyStyle}>触发条件</span><span style={metricAlertDetailValueStyle}>{operatorLabel} {thresholdDisplay}</span></div>
          <div style={metricAlertDetailRowStyle}><span style={metricAlertDetailKeyStyle}>适用范围</span><span style={metricAlertDetailValueStyle}>{variables.scope}</span></div>
        </div>
        <div aria-label="命中预警项，可纵向滚动" data-testid="metric-alert-triggered-table-scroll" style={metricAlertTableWrapStyle} tabIndex={0}>
          <table style={metricAlertTableStyle}>
            <thead><tr><th style={metricAlertTableHeadCellStyle}>{dimensionLabel}</th><th style={metricAlertTableHeadCellStyle}>{metric}</th><th style={metricAlertTableHeadCellStyle}>预警条件</th></tr></thead>
            <tbody>{triggeredGroups.map((group) => <tr key={group.key}><td style={metricAlertTableCellStyle}>{group.key}</td><td style={metricAlertTableCellStyle}>{formatCurrencyNumber(group.value, decimals, isCurrencyMetric(measureKey, fields), isQuantityMetric(measureKey, fields))}</td><td style={metricAlertTableCellStyle}>{operatorLabel} {thresholdDisplay}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </Modal>
  </>;
};

const currencyAffixes = (prefix: string, suffix: string, isCurrency: boolean, isQuantity = false): { readonly prefix: string; readonly suffix: string } => ({
  // Earlier cards often used a leading ¥ manually. Move that common legacy
  // setting to the shared trailing unit without duplicating the symbol.
  prefix: isCurrency && prefix === "¥" ? "" : prefix,
  suffix: isCurrency && !suffix.includes("¥") ? `${suffix} ¥` : isQuantity && !suffix.includes("件") ? `${suffix} 件` : suffix,
});

const formatFlipNumber = (
  value: number | null | undefined,
  decimals: number,
  prefix: string,
  suffix: string,
  isCurrency: boolean,
): string => `${prefix}${isCurrency && Math.abs(value ?? 0) > 1_000
  ? formatCurrencyInWan(value)
  : Math.abs(value ?? 0) >= 10000
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

const formatKpiBoardNumber = (value: number | null, isCurrency: boolean): string => {
  if (value === null) return "—";
  if (isCurrency && Math.abs(value) > 1_000) return formatCurrencyInWan(value);
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
  hideHeader = false,
}: {
  readonly children: React.ReactNode;
  readonly eyebrow?: string;
  readonly footer?: React.ReactNode;
  readonly testId: string;
  readonly title?: string;
  readonly chips?: readonly React.ReactNode[];
  readonly variant?: "default" | "flat" | "borderless";
  readonly hideHeader?: boolean;
}) => (
  <section
    data-testid={testId}
    style={variant === "flat"
      ? { ...dataSurfaceStyle, background: "transparent", border: "none", borderRadius: 0, boxShadow: "none" }
      : variant === "borderless"
        ? { ...dataSurfaceStyle, border: "none", boxShadow: "none" }
        : dataSurfaceStyle}
  >
    {!hideHeader && (eyebrow !== undefined || title !== undefined || chips.length > 0) && (
      <header style={variant === "flat"
        ? { ...dataSurfaceHeaderStyle, borderBottom: "none", padding: "4px 14px 6px" }
        : variant === "borderless"
          ? { ...dataSurfaceHeaderStyle, borderBottom: "none" }
          : dataSurfaceHeaderStyle}>
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

interface ResponsiveBarChartProps {
  readonly component: ComponentInstance;
  readonly fields: readonly DatasetField[];
  readonly rows: readonly Row[];
  readonly rowsAreAggregated: boolean;
  readonly ariaLabel: string;
  readonly onPointClick?: ((point: EChartPointClick) => void) | undefined;
}

const responsiveBarChartStyle: CSSProperties = {
  alignSelf: "stretch",
  display: "flex",
  flex: "1 1 0",
  height: "100%",
  minHeight: 0,
  minWidth: 0,
};

const ResponsiveBarChart = ({ component, fields, rows, rowsAreAggregated, ariaLabel, onPointClick }: ResponsiveBarChartProps) => {
  const container = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>();

  useEffect(() => {
    const element = container.current;
    if (element === null) return undefined;
    const updateHeight = (nextHeight: number) => {
      if (nextHeight <= 0) return;
      setHeight((current) => current !== undefined && Math.abs(current - nextHeight) < 1 ? current : nextHeight);
    };
    const bounds = element.getBoundingClientRect();
    updateHeight(bounds.height);
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) updateHeight(entry.contentRect.height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={container} style={responsiveBarChartStyle}>
      <EChart option={buildBarOption(component, rows, fields, rowsAreAggregated, height)} ariaLabel={ariaLabel} onPointClick={onPointClick} />
    </div>
  );
};

/**
 * Readers can change the visual lens without changing the saved dashboard.
 * This remains local renderer state in editor, preview, and published views.
 */
const BarLineChart = ({
  component,
  fields,
  rows,
  rowsAreAggregated,
  onPointClick,
}: {
  readonly component: ComponentInstance;
  readonly fields: readonly DatasetField[];
  readonly rows: readonly Row[];
  readonly rowsAreAggregated: boolean;
  readonly onPointClick?: ((point: EChartPointClick) => void) | undefined;
}) => {
  const [displayMode, setDisplayMode] = useState<BarLineDisplayMode>("combined");
  return (
    <div style={{ height: "100%", minHeight: 0, overflow: "hidden", position: "relative" }}>
      <div
        aria-label="图表展示方式"
        style={{ position: "absolute", right: 8, top: 4, zIndex: 2 }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Segmented
          aria-label="切换图表展示方式"
          options={[
            { label: "组合图", value: "combined" },
            { label: "仅柱形", value: "bar" },
            { label: "仅曲线", value: "line" },
          ]}
          size="small"
          value={displayMode}
          onChange={(value) => setDisplayMode(value as BarLineDisplayMode)}
        />
      </div>
      <EChart
        key={displayMode}
        option={buildBarLineOption(component, rows, fields, rowsAreAggregated, displayMode)}
        ariaLabel={`${component.title ?? "柱状折线组合图"}图表`}
        onPointClick={onPointClick}
      />
    </div>
  );
};

export const DashboardComponentRenderer = ({
  component,
  fields = [],
  rows,
  rowsAreAggregated = false,
  hideSurfaceHeaders = false,
  activeSunburstMeasure: externallySelectedSunburstMeasure,
  onSunburstMeasureChange,
  activeTreemapMeasure: externallySelectedTreemapMeasure,
  onTreemapMeasureChange,
  dashboardFilterValues,
  dashboardFilterOptions,
  onDashboardFilterChange,
  dashboardFiltersLoading,
  onDashboardFiltersApply,
  onComponentPropsChange,
  onChartJump,
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
  const jumpRules = component.interaction?.jumpRules ?? [];
  const jumpRuleForMetric = (fieldKey: string): ChartJumpRule | undefined => {
    const field = fields.find((candidate) => candidate.key === fieldKey);
    return jumpRules.find((rule) => rule.triggerFieldKey === fieldKey || rule.triggerFieldKey === field?.key)
      ?? (jumpRules.length === 1 ? jumpRules[0] : undefined);
  };
  const rowForChartPoint = (point: EChartPointClick): Row => {
    if (typeof point.name === "string") {
      const dimensionSlotKeys = ["dimension", "dimensions", "rowDimension", "columnDimension", "timeDimension", "dateDimension"];
      const dimensionKeys = dimensionSlotKeys.flatMap((slot) => bindingFieldKeys(component, slot as keyof BindingSlots));
      const matched = rows.find((row) => dimensionKeys.some((key) => String(row[key]) === point.name));
      if (matched !== undefined) return matched;
    }
    return typeof point.dataIndex === "number" ? rows[point.dataIndex] ?? {} : {};
  };
  const handleChartPointClick = jumpRules.length === 0 || onChartJump === undefined ? undefined : (point: EChartPointClick) => {
    const matchingRule = jumpRules.find((rule) => {
      const field = fields.find((candidate) => candidate.key === rule.triggerFieldKey);
      return point.seriesName === rule.triggerFieldKey || point.name === rule.triggerFieldKey || point.seriesName === field?.label || point.name === field?.label;
    }) ?? (jumpRules.length === 1 ? jumpRules[0] : undefined);
    if (matchingRule === undefined) return;
    onChartJump(matchingRule, rowForChartPoint(point));
  };
  if (component.type === "dashboardHeader") return <DashboardHeaderSurface component={component} rows={rows} dashboardFilterValues={dashboardFilterValues} dashboardFilterOptions={dashboardFilterOptions} onDashboardFilterChange={onDashboardFilterChange} dashboardFiltersLoading={dashboardFiltersLoading} onDashboardFiltersApply={onDashboardFiltersApply} />;
  if (component.type === "analysisGroup") {
    const description = stringProp(component, "description", "用于组织同一业务主题下的多个图表与明细。");
    const showSurface = component.props.showSurface !== false;
    return <section aria-label={`${component.title ?? "复合分析"}容器`} style={{ ...analysisGroupShellStyle, ...(showSurface ? {} : { borderColor: "transparent", background: "transparent" }) }}>
      <div>
        <h3 style={analysisGroupHeadingStyle}>{component.title || "复合分析"}</h3>
        {description.length > 0 && <p style={analysisGroupDescriptionStyle}>{description}</p>}
      </div>
      <div style={analysisGroupEmptyStyle}>双击容器，开始添加并编排图表</div>
    </section>;
  }
  const isEmptyData = rows.length === 0;
  if (isEmptyData) {
    const demo = buildEmptyDataDemo(component);
    if (demo !== null) return renderEmptyDataDemo(demo);
  }
  if (component.type === "metricAlert") return <MetricAlertSurface component={component} fields={fields} rows={rows} />;
  if (component.type === "bar" || component.type === "stackedBar" || component.type === "percentBar") {
    const fallbackTitle = component.type === "stackedBar"
      ? "堆积柱图"
      : component.type === "percentBar"
        ? "百分比堆积柱图"
        : "柱图";
    return (
      <ResponsiveBarChart
        component={component}
        fields={fields}
        rows={rows}
        rowsAreAggregated={rowsAreAggregated}
        ariaLabel={`${component.title ?? fallbackTitle}图表`}
        onPointClick={handleChartPointClick}
      />
    );
  }
  if (component.type === "horizontalBar") {
    return <EChart option={buildHorizontalBarOption(component, rows, fields, rowsAreAggregated)} ariaLabel={`${component.title ?? "条形图"}图表`} onPointClick={handleChartPointClick} />;
  }
  if (component.type === "barLine") {
    return <BarLineChart component={component} fields={fields} rows={rows} rowsAreAggregated={rowsAreAggregated} onPointClick={handleChartPointClick} />;
  }
  if (component.type === "line" || component.type === "area" || component.type === "stackedArea" || component.type === "percentArea") {
    const fallbackTitle = component.type === "area"
      ? "面积图"
      : component.type === "stackedArea"
        ? "堆积面积图"
        : component.type === "percentArea"
          ? "百分比堆积面积图"
          : "折线图";
    return <EChart option={buildLineOption(component, rows, fields)} ariaLabel={`${component.title ?? fallbackTitle}图表`} onPointClick={handleChartPointClick} />;
  }
  if (component.type === "trend") {
    const model = buildTrendModel(component, rows, fields);
    const trendChangeSummaryItemStyle = model.change?.rate === undefined || model.change.rate === null
      ? trendSummaryItemStyle
      : model.change.rate >= 0 ? trendPositiveSummaryItemStyle : trendNegativeSummaryItemStyle;
    return (
      <DataSurface
        testId="trend-analysis-surface"
        hideHeader={hideSurfaceHeaders}
        variant={hideSurfaceHeaders ? "borderless" : "default"}
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
              <div style={trendLatestSummaryItemStyle}>
                <span style={trendSummaryLabelStyle}>最新值</span>
                <span style={trendSummaryValueStyle}>{formatCurrencyMetricNumber(model.latest?.value, model.measureIsCurrency, model.measureIsQuantity)}</span>
              </div>
              <div style={trendChangeSummaryItemStyle}>
                <span style={trendSummaryLabelStyle}>较上一期</span>
                <span style={trendSummaryValueStyle}>{formatTrendRate(model.change?.rate)}</span>
              </div>
              <div style={trendPeakSummaryItemStyle}>
                <span style={trendSummaryLabelStyle}>峰值</span>
                <span style={trendSummaryValueStyle}>{formatCurrencyMetricNumber(model.peak?.value, model.measureIsCurrency, model.measureIsQuantity)}</span>
              </div>
            </div>
          )}
          <div style={trendChartStyle}>
            <EChart option={buildTrendOption(component, model)} ariaLabel={`${component.title ?? "趋势分析"}趋势图表`} onPointClick={handleChartPointClick} />
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
    const activeMeasure = model.measures.find((measure) => measure.key === activeMeasureKey) ?? model.measures[0];
    return (
      <DataSurface testId="metric-trend-surface" variant="flat">
        <div style={metricTrendShellStyle}>
          <div style={metricTrendHeaderStyle}>
            {model.showSummary && activeMeasure && (
              <div style={metricTrendSummaryStyle}>
                <span style={metricTrendEyebrowStyle}>汇总值 · {activeMeasure.label}</span>
                <strong style={metricTrendValueStyle}>{formatCurrencyMetricNumber(activeMeasure.total, activeMeasure.isCurrency, activeMeasure.isQuantity)}</strong>
              </div>
            )}
            <div aria-label="指标切换" style={metricTrendTabsStyle}>
              {model.measures.map((measure) => {
                const isActive = measure.key === activeMeasureKey;
                return (
                  <button
                    key={measure.key}
                    type="button"
                    aria-label={`关注指标 ${measure.label}`}
                    aria-pressed={isActive}
                    style={isActive ? metricTrendActiveTabStyle : metricTrendTabStyle}
                    title={`查看${measure.label}趋势`}
                    onMouseDown={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveMetricTrendMeasure(measure.key);
                    }}
                  >
                    <span>{measure.label}</span>
                    <span style={metricTrendTabValueStyle}>{formatCurrencyMetricNumber(measure.total, measure.isCurrency, measure.isQuantity)}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div style={metricTrendChartStyle}>
            <EChart key={activeMeasureKey ?? "empty"} option={buildMetricTrendOption(component, model, activeMeasureKey)} ariaLabel={`${component.title ?? "指标趋势"}趋势图表`} onPointClick={handleChartPointClick} />
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
        hideHeader={hideSurfaceHeaders}
        title={`${model.measureLabel} · 按${model.dimensionLabel}拆解`}
        variant="flat"
      >
        <section style={metricBreakdownShellStyle}>
          <div style={metricBreakdownSummaryStyle}>
            <div style={{ minWidth: 0 }}>
              <span style={metricBreakdownSummaryLabelStyle}>{model.measureLabel}合计</span>
              <strong aria-label={`${model.measureLabel}合计`} style={metricBreakdownSummaryValueStyle}>{formatCurrencyNumber(model.total, model.decimals, model.measureIsCurrency, model.measureIsQuantity)}</strong>
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
                  <span style={metricBreakdownValueNumberStyle}>{formatCurrencyNumber(item.value, model.decimals, model.measureIsCurrency, model.measureIsQuantity)}</span>
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
          <EChart option={buildRadarOption(component, rows, fields)} ariaLabel={`${component.title ?? "雷达图"}图表`} onPointClick={handleChartPointClick} />
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
        <EChart option={buildTreemapOption(component, rows, fields, activeMeasureKey)} ariaLabel={`${component.title ?? "矩形树图"} ${activeMeasureLabel}图表`} onPointClick={handleChartPointClick} />
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
          <EChart option={buildSunburstOption(component, rows, fields, activeMeasureKey)} ariaLabel={`${component.title ?? "旭日图"} ${activeMeasureLabel}图表`} onPointClick={handleChartPointClick} />
        </div>
      </div>
    );
  }
  if (component.type === "pie" || component.type === "donut" || component.type === "rose") {
    const fallbackTitle = component.type === "rose" ? "玫瑰图" : component.type === "donut" ? "环形图" : "饼图";
    return <EChart option={buildPieOption(component, rows, fields)} ariaLabel={`${component.title ?? fallbackTitle}图表`} onPointClick={handleChartPointClick} />;
  }
  if (component.type === "ringBar") {
    return <EChart option={buildRingBarOption(component, rows, fields, rowsAreAggregated)} ariaLabel={`${component.title ?? "环形柱图"}图表`} onPointClick={handleChartPointClick} />;
  }
  if (component.type === "ranking") {
    const model = buildRankingModel(component, rows, fields);
    const gridTemplateColumns = `28px minmax(144px, 1fr) repeat(${Math.max(1, model.measures.length)}, minmax(72px, 0.7fr))`;
    return (
      <section aria-label={`${component.title ?? "排行榜"}图表`} data-testid="ranking-surface" style={rankingShellStyle}>
        <div aria-hidden="true" style={{ ...rankingHeaderStyle, gridTemplateColumns }}>
          <span />
          <span />
          {model.measures.map((measure) => <span key={measure.key} style={rankingMeasureHeaderStyle} title={measure.label}>{measure.label}</span>)}
        </div>
        {model.items.map((item, index) => {
          const rank = index + 1;
          const medalColor = rankingMedalColors[index];
          return (
            <div key={`${item.label}-${rank}`} style={{ ...rankingRowStyle, gridTemplateColumns }}>
              {medalColor === undefined
                ? <span style={rankingOrdinalStyle}>{rank}</span>
                : <span aria-label={`第${rank}名`} style={{ ...rankingBadgeStyle, background: medalColor }}>{rank}</span>}
              <span style={rankingProgressGroupStyle}>
                <span style={rankingLabelStyle}>{item.label}</span>
                <span aria-label={`${item.label}排名进度`} style={rankingTrackStyle}>
                  <span style={{ ...rankingBarStyle, width: `${item.primaryRatio * 100}%` }} />
                </span>
              </span>
              {model.measures.map((measure) => {
                const value = item.values.find((entry) => entry.key === measure.key)?.value ?? 0;
                return <span key={measure.key} style={rankingValueStyle}>{formatCurrencyMetricNumber(value, isCurrencyMetric(measure.key, fields), isQuantityMetric(measure.key, fields))}</span>;
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
    const configuredPrefix = stringProp(component, "prefix", "");
    const configuredSuffix = stringProp(component, "suffix", "");
    return (
      <section data-testid="flip-number-surface" style={flipNumberShellStyle}>
        <div style={flipNumberGridStyle}>
          {model.items.map((item) => {
            const affixes = currencyAffixes(configuredPrefix, configuredSuffix, item.isCurrency, item.isQuantity);
            return <div key={item.key} style={flipNumberCardStyle}>
              <span style={flipNumberTitleStyle}>{item.label}</span>
              <RollingMetricValue
                ariaLabel={`${item.label}翻牌器数值`}
                value={formatFlipNumber(item.value, decimals, affixes.prefix, affixes.suffix, item.isCurrency)}
              />
            </div>;
          })}
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
                    实际 {formatCurrencyMetricNumber(item.value, item.isCurrency, item.isQuantity)} | 目标 {formatCurrencyMetricNumber(item.target, item.targetIsCurrency, item.targetIsQuantity)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    );
  }
  if (component.type === "targetProgress") {
    const model = buildTargetProgressModel(component, rows, fields);
    const decimals = Math.max(0, Math.min(4, Math.trunc(numberProp(component, "decimals", 0))));
    const color = stringProp(component, "color", "#f57c00");
    const suffix = stringProp(component, "suffix", "");
    const showValue = component.props.showValue !== false;
    return (
      <section aria-label={`${component.title ?? "目标完成率"}图表`} data-testid="target-progress-surface" style={targetProgressShellStyle}>
        <div style={targetProgressListStyle}>
          {model.items.map((item) => {
            const progress = item.progress === null ? null : item.progress * 100;
            const progressWidth = progress === null ? 0 : Math.max(0, Math.min(100, progress));
            return (
              <div key={item.key} style={targetProgressRowStyle}>
                <span style={targetProgressLabelStyle}>{item.label}</span>
                <span aria-label={`${item.label}完成率进度`} style={targetProgressTrackStyle}>
                  <span style={{ ...targetProgressBarStyle, background: color, width: `${progressWidth}%` }} />
                </span>
                {showValue && <span style={targetProgressValueStyle}>{formatCurrencyMetricNumber(item.value, model.measureIsCurrency, model.measureIsQuantity)} / {formatCurrencyMetricNumber(item.target, model.targetIsCurrency, model.targetIsQuantity)}{model.measureIsQuantity && suffix.includes("件") ? "" : suffix}</span>}
                <strong style={targetProgressPercentStyle}>{progress === null ? "—" : `${progress.toFixed(decimals)}%`}</strong>
              </div>
            );
          })}
        </div>
      </section>
    );
  }
  if (component.type === "goalTaskProgress") return <GoalTaskProgressSurface component={component} rows={rows} fields={fields} onComponentPropsChange={onComponentPropsChange} />;
  if (component.type === "gauge" || isLegacyGaugeKpi(component)) {
    const models = buildGaugeModels(component, rows, fields);
    if (models.length === 1 && models[0]?.label === undefined) {
      const model = buildGaugeModel(component, rows, fields);
      return <EChart option={buildGaugeOption(component, model)} ariaLabel={`${component.title ?? "仪表盘"}图表`} onPointClick={handleChartPointClick} />;
    }
    return (
      <section data-testid="gauge-chart-grid" style={metricChartGridStyle}>
        {models.map(({ key, label, model }) => (
          <div key={key} style={metricChartCellStyle}>
            <EChart
              option={buildGaugeOption(component, model, label ?? model.label)}
              ariaLabel={`${component.title ?? "仪表盘"}${label === undefined ? "" : ` ${label}`}图表`}
              onPointClick={handleChartPointClick}
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
  if (component.type === "kpiInsight") {
    const measureKeys = bindingFieldKeys(component, "measure");
    const decimals = numberProp(component, "decimals", 0);
    return (
      <section data-testid="kpi-insight-surface" style={insightGridStyle}>
        {measureKeys.map((measureKey, index) => {
          const model = buildKpiModelForFields(component, rows, measureKey, undefined, undefined, kpiInsightAggregation(component, measureKey));
          const measureIsCurrency = isCurrencyMetric(measureKey, fields);
          const affixes = currencyAffixes(
            stringProp(component, "prefix", ""),
            stringProp(component, "suffix", ""),
            measureIsCurrency,
            isQuantityMetric(measureKey, fields),
          );
          const formatted = formatKpiValue(model.value, decimals, measureIsCurrency);
          const displayName = fields.find((field) => field.key === measureKey)?.label || (measureKeys.length === 1 ? component.title : measureKey) || "指标洞察";
          return <section key={measureKey} style={insightShellStyle}>
            <div style={insightTitleStyle} title={displayName}>{displayName}</div>
            <div aria-label={`${displayName}指标值`} style={insightValueStyle}>{affixes.prefix}{formatted}{affixes.suffix}</div>
          </section>;
        })}
      </section>
    );
  }
  if (component.type === "kpi") {
    const board = buildKpiBoardModel(component, rows, fields);
    if (board !== null) {
      return (
        <DataSurface
          testId="kpi-board-surface"
          hideHeader
          variant="borderless"
        >
          <div style={kpiBoardGridStyle}>
            {board.groups.map((group) => (
              <section aria-label={`${group.label}指标`} key={group.label} style={kpiBoardCardStyle}>
                <div style={kpiBoardPeriodStyle}>{group.label}</div>
                <div style={kpiBoardMetricNameStyle}>{board.measureLabel}</div>
                <div style={kpiBoardValueStyle}>{(() => {
                  const measureIsCurrency = isCurrencyMetric(board.measureKey, fields);
                  const affixes = currencyAffixes(stringProp(component, "prefix", ""), stringProp(component, "suffix", ""), measureIsCurrency, isQuantityMetric(board.measureKey, fields));
                  return <>{affixes.prefix}{formatKpiBoardNumber(group.value, measureIsCurrency)}{affixes.suffix}</>;
                })()}</div>
                <div style={kpiBoardRowsStyle}>
                  {group.metrics.map((metric) => (
                    <div key={metric.key} style={kpiBoardRowStyle}>
                      <span style={kpiBoardRowLabelStyle}>{metric.label}</span>
                      <span style={kpiBoardRowValueStyle}>{formatCurrencyMetricNumber(metric.value, metric.isCurrency, metric.isQuantity)}</span>
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
    const measureKey = bindingFieldKeys(component, "measure")[0] ?? "";
    const affixes = currencyAffixes(
      stringProp(component, "prefix", ""),
      stringProp(component, "suffix", ""),
      isCurrencyMetric(measureKey, fields),
      isQuantityMetric(measureKey, fields),
    );
    const decimals = numberProp(component, "decimals", 0);
    const formatted = formatKpiValue(model.value, decimals, isCurrencyMetric(measureKey, fields));
    const progressWidth = model.target?.progress === null || model.target?.progress === undefined
      ? 0
      : Math.max(0, Math.min(100, model.target.progress * 100));
    const comparisonTone = model.comparison?.delta === undefined || model.comparison.delta === 0
      ? {}
      : model.comparison.delta > 0 ? kpiPositiveStyle : kpiNegativeStyle;
    return (
      <div style={kpiShellStyle}>
        <div aria-label={`${component.title ?? "指标"}指标值`} style={kpiValueStyle}>
          {affixes.prefix}{formatted}{affixes.suffix}
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
    const model = buildTableModel(component, rows, fields, rowsAreAggregated);
    const totalPages = Math.max(1, Math.ceil(model.rows.length / pageSize));
    const currentPage = Math.min(tablePage, totalPages);
    const pagedRows = model.rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    return (
      <DataSurface
        testId="detail-table-surface"
        variant="borderless"
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
              <tr key={index} style={{ background: "#ffffff" }}>
                {model.columns.map((column) => {
                  const value = row[column.key];
                  const display = typeof value === "number" && (isCurrencyMetric(column.key, fields) || isQuantityMetric(column.key, fields))
                    ? formatCrosstabMetric(value, isCurrencyMetric(column.key, fields), isQuantityMetric(column.key, fields))
                    : String(value ?? "—");
                  return <td key={column.key} style={tableCellStyle}>{display}</td>;
                })}
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
        variant="borderless"
        hideHeader={hideSurfaceHeaders}
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
                    <td key={model.columns[index]?.key ?? index} style={tableNumericCellStyle}>{formatCrosstabMetric(value, model.measureIsCurrency, model.measureIsQuantity)}</td>
                  ))}
                  {model.showTotals && <td style={tableTotalCellStyle}>{formatCrosstabMetric(row.total, model.measureIsCurrency, model.measureIsQuantity)}</td>}
                </tr>
              ))}
              {model.showTotals && (
                <tr>
                  <th scope="row" style={tableTotalHeaderCellStyle}>合计</th>
                  {model.columnTotals.map((value, index) => (
                    <td key={model.columns[index]?.key ?? index} style={tableTotalCellStyle}>{formatCrosstabMetric(value, model.measureIsCurrency, model.measureIsQuantity)}</td>
                  ))}
                  <td style={tableTotalCellStyle}>{formatCrosstabMetric(model.grandTotal, model.measureIsCurrency, model.measureIsQuantity)}</td>
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
    const heatmapJumpRule = jumpRuleForMetric(model.measureKey);
    const handleHeatmapCellClick = heatmapJumpRule === undefined || onChartJump === undefined ? undefined : (row: typeof model.rows[number], cell: typeof model.rows[number]["cells"][number]) => {
      onChartJump(heatmapJumpRule, {
        [model.rowDimension]: row.label,
        [model.columnDimension]: cell.columnLabel,
        [model.measureKey]: cell.value,
      });
    };
    return (
      <DataSurface
        testId="heatmap-surface"
        variant="borderless"
        hideHeader={hideSurfaceHeaders}
        eyebrow="热力图"
        title={component.title ?? "热力图"}
        chips={[
          <SurfaceChip key="measure" tone="teal">{model.measureLabel}</SurfaceChip>,
          <SurfaceChip key="range">{formatCrosstabMetric(model.minValue, model.measureIsCurrency, model.measureIsQuantity)} - {formatCrosstabMetric(model.maxValue, model.measureIsCurrency, model.measureIsQuantity)}</SurfaceChip>,
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
                      aria-label={`${row.label} ${cell.columnLabel} ${model.measureLabel} ${formatCrosstabMetric(cell.value, model.measureIsCurrency, model.measureIsQuantity)}`}
                      {...(handleHeatmapCellClick === undefined ? {} : {
                        role: "button",
                        tabIndex: 0,
                        onClick: () => handleHeatmapCellClick(row, cell),
                        onKeyDown: (event: React.KeyboardEvent<HTMLTableCellElement>) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleHeatmapCellClick(row, cell);
                          }
                        },
                      })}
                      style={{
                        ...heatmapCellBaseStyle,
                        background: heatmapCellFill(cell.intensity),
                        color: cell.intensity > 0.7 ? "#fff" : "#0f172a",
                        cursor: handleHeatmapCellClick === undefined ? undefined : "pointer",
                      }}
                    >
                      {model.showValues ? formatCrosstabMetric(cell.value, model.measureIsCurrency, model.measureIsQuantity) : ""}
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
        variant="borderless"
        hideHeader={hideSurfaceHeaders}
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
                    <td key={model.measures[index]?.key ?? index} style={tableNumericCellStyle}>{formatCrosstabMetric(value, model.measures[index]?.isCurrency ?? false, model.measures[index]?.isQuantity ?? false)}</td>
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
                    <td key={model.measures[index]?.key ?? index} style={tableTotalCellStyle}>{formatCrosstabMetric(value, model.measures[index]?.isCurrency ?? false, model.measures[index]?.isQuantity ?? false)}</td>
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
