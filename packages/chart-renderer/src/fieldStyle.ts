import { ComponentFieldStyle, type ComponentFieldTextStyle, type ComponentInstance } from "@drag-visual/contracts";
import type { EChartsCoreOption } from "echarts/core";

type LooseObject = Record<string, unknown>;

const isObject = (value: unknown): value is LooseObject => typeof value === "object" && value !== null && !Array.isArray(value);

const mapConfig = (value: unknown, transform: (entry: LooseObject) => LooseObject): unknown => {
  if (Array.isArray(value)) return value.map((entry) => isObject(entry) ? transform(entry) : entry);
  return isObject(value) ? transform(value) : value;
};

const textStyle = (style: ComponentFieldTextStyle): LooseObject => ({
  color: style.color,
  fontSize: style.fontSize,
  fontStyle: style.fontStyle,
  fontWeight: style.fontWeight,
});

const mergeStyle = (value: unknown, style: ComponentFieldTextStyle): LooseObject => ({
  ...(isObject(value) ? value : {}),
  ...textStyle(style),
});

/** Applies semantic field typography without changing whether chart labels are shown. */
export const applyComponentFieldStyle = (option: EChartsCoreOption, component: ComponentInstance): EChartsCoreOption => {
  if (component.fieldStyle === undefined || component.fieldStyle.enabled === false) return option;
  const style = ComponentFieldStyle.parse(component.fieldStyle ?? {});
  const source = option as LooseObject;
  const transformAxis = (axis: LooseObject): LooseObject => {
    const isDimensionAxis = axis.type === "category" || Array.isArray(axis.data);
    return {
      ...axis,
      axisLabel: mergeStyle(axis.axisLabel, isDimensionAxis ? style.dimension : style.metricValue),
      nameTextStyle: mergeStyle(axis.nameTextStyle, isDimensionAxis ? style.dimension : style.metricName),
    };
  };
  const transformSeries = (series: LooseObject): LooseObject => {
    const type = typeof series.type === "string" ? series.type : "";
    if (type === "gauge") {
      return {
        ...series,
        axisLabel: mergeStyle(series.axisLabel, style.metricValue),
        detail: mergeStyle(series.detail, style.metricValue),
        title: mergeStyle(series.title, style.metricName),
      };
    }
    const labelStyle = type === "pie" || type === "treemap" || type === "sunburst" || type === "radar"
      ? style.dimension
      : style.metricValue;
    return {
      ...series,
      label: mergeStyle(series.label, labelStyle),
      emphasis: isObject(series.emphasis)
        ? { ...series.emphasis, label: mergeStyle(series.emphasis.label, labelStyle) }
        : series.emphasis,
    };
  };
  return {
    ...source,
    xAxis: mapConfig(source.xAxis, transformAxis),
    yAxis: mapConfig(source.yAxis, transformAxis),
    legend: mapConfig(source.legend, (legend) => ({ ...legend, textStyle: mergeStyle(legend.textStyle, style.metricName) })),
    radar: mapConfig(source.radar, (radar) => ({ ...radar, axisName: mergeStyle(radar.axisName, style.dimension) })),
    visualMap: mapConfig(source.visualMap, (visualMap) => ({ ...visualMap, textStyle: mergeStyle(visualMap.textStyle, style.metricValue) })),
    series: mapConfig(source.series, transformSeries),
  } as EChartsCoreOption;
};
