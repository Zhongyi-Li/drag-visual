import { areaDefinition } from "./definitions/area.js";
import { barDefinition } from "./definitions/bar.js";
import { barLineDefinition } from "./definitions/barLine.js";
import { crosstabDefinition } from "./definitions/crosstab.js";
import { donutDefinition } from "./definitions/donut.js";
import { dashboardHeaderDefinition } from "./definitions/dashboardHeader.js";
import { analysisGroupDefinition } from "./definitions/analysisGroup.js";
import { flipNumberDefinition } from "./definitions/flipNumber.js";
import { gaugeDefinition } from "./definitions/gauge.js";
import { heatmapDefinition } from "./definitions/heatmap.js";
import { horizontalBarDefinition } from "./definitions/horizontalBar.js";
import { kpiDefinition } from "./definitions/kpi.js";
import { kpiInsightDefinition } from "./definitions/kpiInsight.js";
import { lineDefinition } from "./definitions/line.js";
import { liquidDefinition } from "./definitions/liquid.js";
import { metricTrendDefinition } from "./definitions/metricTrend.js";
import { metricBreakdownDefinition } from "./definitions/metricBreakdown.js";
import { multidimensionalDefinition } from "./definitions/multidimensional.js";
import { pieDefinition } from "./definitions/pie.js";
import { roseDefinition } from "./definitions/rose.js";
import { progressBarDefinition } from "./definitions/progressBar.js";
import { progressIndicatorDefinition } from "./definitions/progressIndicator.js";
import { targetProgressDefinition } from "./definitions/targetProgress.js";
import { rankingDefinition } from "./definitions/ranking.js";
import { radarDefinition } from "./definitions/radar.js";
import { ringBarDefinition } from "./definitions/ringBar.js";
import { percentAreaDefinition } from "./definitions/percentArea.js";
import { percentBarDefinition } from "./definitions/percentBar.js";
import { stackedAreaDefinition } from "./definitions/stackedArea.js";
import { stackedBarDefinition } from "./definitions/stackedBar.js";
import { sunburstDefinition } from "./definitions/sunburst.js";
import { tableDefinition } from "./definitions/table.js";
import { textDefinition } from "./definitions/text.js";
import { trendDefinition } from "./definitions/trend.js";
import { treemapDefinition } from "./definitions/treemap.js";
import { ComponentRegistry } from "./registry.js";

export { barDefinition } from "./definitions/bar.js";
export { barLineDefinition } from "./definitions/barLine.js";
export { areaDefinition } from "./definitions/area.js";
export { crosstabDefinition } from "./definitions/crosstab.js";
export { donutDefinition } from "./definitions/donut.js";
export { dashboardHeaderDefinition } from "./definitions/dashboardHeader.js";
export { analysisGroupDefinition } from "./definitions/analysisGroup.js";
export { flipNumberDefinition } from "./definitions/flipNumber.js";
export { gaugeDefinition } from "./definitions/gauge.js";
export { heatmapDefinition } from "./definitions/heatmap.js";
export { horizontalBarDefinition } from "./definitions/horizontalBar.js";
export { kpiDefinition } from "./definitions/kpi.js";
export { kpiInsightDefinition } from "./definitions/kpiInsight.js";
export { lineDefinition } from "./definitions/line.js";
export { liquidDefinition } from "./definitions/liquid.js";
export { metricTrendDefinition } from "./definitions/metricTrend.js";
export { metricBreakdownDefinition } from "./definitions/metricBreakdown.js";
export { multidimensionalDefinition } from "./definitions/multidimensional.js";
export { pieDefinition } from "./definitions/pie.js";
export { roseDefinition } from "./definitions/rose.js";
export { progressBarDefinition } from "./definitions/progressBar.js";
export { progressIndicatorDefinition } from "./definitions/progressIndicator.js";
export { targetProgressDefinition } from "./definitions/targetProgress.js";
export { rankingDefinition } from "./definitions/ranking.js";
export { radarDefinition } from "./definitions/radar.js";
export { ringBarDefinition } from "./definitions/ringBar.js";
export { percentAreaDefinition } from "./definitions/percentArea.js";
export { percentBarDefinition } from "./definitions/percentBar.js";
export { stackedAreaDefinition } from "./definitions/stackedArea.js";
export { stackedBarDefinition } from "./definitions/stackedBar.js";
export { sunburstDefinition } from "./definitions/sunburst.js";
export { tableDefinition } from "./definitions/table.js";
export { textDefinition } from "./definitions/text.js";
export { trendDefinition } from "./definitions/trend.js";
export { treemapDefinition } from "./definitions/treemap.js";
export {
  ComponentRegistry,
  ComponentRegistryError,
  type ComponentRegistryErrorCode,
} from "./registry.js";
export type {
  BindingValidationResult,
  ComponentDataSlot,
  ComponentDefinition,
  DefaultComponentLayout,
  FieldDataType,
} from "./types.js";

export const createDefaultRegistry = (): ComponentRegistry =>
  new ComponentRegistry()
    .register(areaDefinition)
    .register(barDefinition)
    .register(barLineDefinition)
    .register(crosstabDefinition)
    .register(heatmapDefinition)
    .register(horizontalBarDefinition)
    .register(trendDefinition)
    .register(multidimensionalDefinition)
    .register(lineDefinition)
    .register(stackedBarDefinition)
    .register(stackedAreaDefinition)
    .register(percentAreaDefinition)
    .register(percentBarDefinition)
    .register(ringBarDefinition)
    .register(rankingDefinition)
    .register(pieDefinition)
    .register(donutDefinition)
    .register(roseDefinition)
    .register(sunburstDefinition)
    .register(radarDefinition)
    .register(treemapDefinition)
    .register(kpiDefinition)
    .register(kpiInsightDefinition)
    .register(metricTrendDefinition)
    .register(metricBreakdownDefinition)
    .register(flipNumberDefinition)
    .register(progressBarDefinition)
    .register(progressIndicatorDefinition)
    .register(targetProgressDefinition)
    .register(gaugeDefinition)
    .register(liquidDefinition)
    .register(tableDefinition)
    .register(textDefinition)
    .register(dashboardHeaderDefinition)
    .register(analysisGroupDefinition);
