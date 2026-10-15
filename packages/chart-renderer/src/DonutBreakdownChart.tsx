import type { ComponentInstance, DatasetField } from "@drag-visual/contracts";
import { useContext, useEffect, useRef, useState, type CSSProperties } from "react";

import { ChartThemeContext, defaultDarkPalette, defaultLightPalette } from "./chartTheme.js";
import { EChart, type EChartPointClick } from "./EChart.js";
import { buildDonutBreakdownModel } from "./options.js";

type Row = Readonly<Record<string, unknown>>;

interface Props {
  readonly component: ComponentInstance;
  readonly rows: readonly Row[];
  readonly fields: readonly DatasetField[];
  readonly rowsAreAggregated: boolean;
  readonly hideSurfaceHeaders: boolean;
  readonly onPointClick?: ((point: EChartPointClick) => void) | undefined;
}

const fallbackPalette = ["#2863e8", "#f97316", "#64748b", "#e11d73", "#7c3aed", "#06b6d4", "#16a34a"];
const numberFormatter = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const moneyFormatter = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const shellStyle: CSSProperties = { display: "flex", flexDirection: "column", gap: 22, height: "100%", minHeight: 0, padding: "12px 16px", boxSizing: "border-box", overflow: "hidden" };
const headingStyle: CSSProperties = { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 };
const bodyStyle: CSSProperties = { display: "flex", flex: "1 1 auto", flexWrap: "wrap", gap: "18px 24px", minHeight: 0, overflow: "auto", alignItems: "flex-start" };
const ringStyle: CSSProperties = { height: "min(100%, 300px)", flex: "0 1 345px", minWidth: 180, position: "relative" };
const listStyle: CSSProperties = { flex: "1 1 300px", minWidth: 220, maxHeight: "100%", overflowY: "auto", display: "flex", flexDirection: "column", gap: 7, alignSelf: "flex-start" };

export const DonutBreakdownChart = ({ component, rows, fields, rowsAreAggregated, hideSurfaceHeaders, onPointClick }: Props) => {
  const theme = useContext(ChartThemeContext);
  const shellRef = useRef<HTMLElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const model = buildDonutBreakdownModel(component, rows, fields, rowsAreAggregated);
  const selected = model.items.find((item) => item.name === selectedName);
  const palette = theme?.chartPalette?.length
    ? theme.chartPalette
    : theme?.mode === "dark" ? defaultDarkPalette : theme === undefined ? fallbackPalette : defaultLightPalette;
  const dark = theme?.mode === "dark";
  const ink = dark ? "#e2e8f0" : "#172033";
  const muted = dark ? "#94a3b8" : "#64748b";
  const border = dark ? "#334155" : "#dce3ed";
  const formatValue = (value: number) => model.isCurrency ? `CNY ${value === 0 ? "0" : moneyFormatter.format(value)}` : numberFormatter.format(value);
  const totalMeasureLabel = model.measureLabel.startsWith("总") ? model.measureLabel : `总${model.measureLabel}`;
  const focus = (name: string) => setSelectedName((current) => current === name ? null : name);
  useEffect(() => {
    const element = shellRef.current;
    if (element === null) return undefined;
    const updateWidth = (width: number) => { if (width > 0) setIsNarrow(width < 620); };
    updateWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => updateWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const chartOption = {
    color: [...palette],
    animationDuration: 250,
    tooltip: {
      trigger: "item",
      formatter: (params: { name?: string }) => {
        const item = model.items.find((candidate) => candidate.name === params.name);
        return item === undefined ? "" : `${item.name}<br/>${model.measureLabel}：${formatValue(item.value)}<br/>占比：${item.percent.toFixed(1)}%`;
      },
    },
    series: [{
      type: "pie",
      radius: ["52%", "72%"],
      center: ["50%", "50%"],
      startAngle: 90,
      avoidLabelOverlap: true,
      label: { show: false },
      labelLine: { show: false },
      data: model.items.map((item) => ({
        name: item.name,
        value: item.sliceValue,
        itemStyle: { opacity: selected === undefined || selected.name === item.name ? 1 : 0.34 },
      })),
    }],
  };
  const handleRingClick = (point: EChartPointClick) => {
    if (point.name !== undefined) focus(point.name);
    onPointClick?.(point);
  };

  return (
    <section ref={shellRef} aria-label={`${component.title || "环形构成明细"}图表`} data-testid="donut-breakdown-surface" style={shellStyle}>
      <div style={headingStyle}>
        <div>
          {!hideSurfaceHeaders && <div style={{ color: ink, fontSize: 16, fontWeight: 700, lineHeight: 1.4 }}>{component.title || `${model.measureLabel}构成`}</div>}
          <div style={{ color: muted, fontSize: 12, lineHeight: 1.5 }}>点击分类查看占比，再次点击可返回全部。</div>
        </div>
        <button type="button" onClick={() => setSelectedName(null)} aria-label={`查看全部${model.dimensionLabel}`} style={{ border: 0, borderRadius: 6, background: theme?.primaryColor ?? "#1677ff", color: "#fff", cursor: "pointer", padding: "7px 11px", whiteSpace: "nowrap", fontSize: 12 }}>
          全部{model.dimensionLabel}
        </button>
      </div>
      <div style={{ ...bodyStyle, gap: isNarrow ? "12px" : bodyStyle.gap }}>
        <div data-testid="donut-breakdown-ring" style={{ ...ringStyle, height: isNarrow ? 200 : ringStyle.height }}>
          <div style={{ width: isNarrow ? 240 : 320, maxWidth: "100%", height: "100%", display: "flex" }}><EChart option={chartOption} ariaLabel={`${model.dimensionLabel}${model.measureLabel}环形图`} onPointClick={handleRingClick} /></div>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: isNarrow ? 240 : 320, maxWidth: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", color: ink, textAlign: "center", padding: "0 26%", boxSizing: "border-box" }}>
            <span style={{ color: muted, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{selected?.name ?? `全部${model.dimensionLabel}`}</span>
            <strong style={{ fontSize: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{selected === undefined ? totalMeasureLabel : `${selected.percent.toFixed(1)}%`}</strong>
          </div>
        </div>
        <div aria-label="分类指标及占比" style={{ ...listStyle, maxHeight: isNarrow ? "none" : listStyle.maxHeight, overflowY: isNarrow ? "visible" : "auto" }}>
          {model.items.length === 0 && <div role="status" style={{ color: muted }}>暂无分类数据，请绑定分类维度和数值指标。</div>}
          {model.items.map((item, index) => (
            <button key={item.name} type="button" onClick={() => focus(item.name)} aria-pressed={selected?.name === item.name} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", minHeight: 34, border: `1px solid ${selected?.name === item.name ? (theme?.primaryColor ?? "#1677ff") : border}`, borderRadius: 6, background: selected?.name === item.name ? `${theme?.primaryColor ?? "#1677ff"}${dark ? "24" : "10"}` : "transparent", opacity: selected !== undefined && selected.name !== item.name ? 0.55 : 1, color: ink, cursor: "pointer", textAlign: "left", fontSize: 12 }}>
              <i aria-hidden="true" style={{ width: 10, height: 10, flex: "0 0 10px", borderRadius: "50%", background: palette[index % palette.length] }} />
              <strong style={{ flex: "0 1 105px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.name}>{item.name}</strong>
              <span style={{ color: muted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={formatValue(item.value)}>{formatValue(item.value)}</span>
              <strong style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{item.percent.toFixed(1)}%</strong>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
