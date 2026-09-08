import { BarChart, GaugeChart, LineChart, PieChart, RadarChart, SunburstChart, TreemapChart } from "echarts/charts";
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import { init, use, type EChartsCoreOption } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useContext, useEffect, useMemo, useRef } from "react";
import { applyChartTheme, ChartThemeContext } from "./chartTheme.js";

use([BarChart, GaugeChart, LineChart, PieChart, RadarChart, SunburstChart, TreemapChart, GridComponent, LegendComponent, TitleComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);

export interface EChartPointClick {
  readonly dataIndex?: number | undefined;
  readonly name?: string | undefined;
  readonly seriesName?: string | undefined;
}

export const EChart = ({ option, ariaLabel, onPointClick }: { readonly option: EChartsCoreOption; readonly ariaLabel: string; readonly onPointClick?: ((point: EChartPointClick) => void) | undefined }) => {
  const theme = useContext(ChartThemeContext);
  const themedOption = useMemo(() => applyChartTheme(option, theme) as EChartsCoreOption, [option, theme]);
  const container = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof init> | null>(null);

  useEffect(() => {
    if (container.current === null) return undefined;
    const chart = init(container.current);
    chartRef.current = chart;
    const resize = () => chart.resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container.current);
    window.addEventListener("resize", resize);
    // Flex/grid 尺寸会在初次挂载后的布局阶段才稳定；下一帧再计算一次，
    // 能避免预览卡片首次渲染时底部坐标轴被截断。
    const animationFrame = window.requestAnimationFrame(resize);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (chart === null) return;
    chart.setOption(themedOption, { notMerge: true });
    // Apply the option against the settled flex/grid dimensions as well as on
    // later ResizeObserver events. This avoids preserving a smaller initial
    // plot rectangle in a preview card that has just received its final height.
    chart.resize();
  }, [themedOption]);

  useEffect(() => {
    const chart = chartRef.current;
    if (chart === null || onPointClick === undefined) return undefined;
    const handleClick = (event: EChartPointClick) => onPointClick(event);
    chart.on("click", handleClick);
    return () => {
      chart.off("click", handleClick);
    };
  }, [onPointClick]);

  return <div ref={container} role="img" aria-label={ariaLabel} style={{ flex: "1 1 auto", height: "100%", minHeight: 0, width: "100%", cursor: onPointClick === undefined ? undefined : "pointer" }} />;
};
