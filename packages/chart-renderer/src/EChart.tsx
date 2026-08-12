import { BarChart, GaugeChart, LineChart, PieChart, RadarChart, SunburstChart, TreemapChart } from "echarts/charts";
import { GridComponent, LegendComponent, TitleComponent, TooltipComponent } from "echarts/components";
import { init, use, type EChartsCoreOption } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

use([BarChart, GaugeChart, LineChart, PieChart, RadarChart, SunburstChart, TreemapChart, GridComponent, LegendComponent, TitleComponent, TooltipComponent, CanvasRenderer]);

export const EChart = ({ option, ariaLabel }: { readonly option: EChartsCoreOption; readonly ariaLabel: string }) => {
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
    chart.setOption(option, { notMerge: true });
    // Apply the option against the settled flex/grid dimensions as well as on
    // later ResizeObserver events. This avoids preserving a smaller initial
    // plot rectangle in a preview card that has just received its final height.
    chart.resize();
  }, [option]);

  return <div ref={container} role="img" aria-label={ariaLabel} style={{ flex: "1 1 auto", height: "100%", minHeight: 0, width: "100%" }} />;
};
