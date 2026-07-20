import { areaDefinition } from "./definitions/area.js";
import { barDefinition } from "./definitions/bar.js";
import { crosstabDefinition } from "./definitions/crosstab.js";
import { flipNumberDefinition } from "./definitions/flipNumber.js";
import { gaugeDefinition } from "./definitions/gauge.js";
import { heatmapDefinition } from "./definitions/heatmap.js";
import { kpiDefinition } from "./definitions/kpi.js";
import { lineDefinition } from "./definitions/line.js";
import { liquidDefinition } from "./definitions/liquid.js";
import { metricTrendDefinition } from "./definitions/metricTrend.js";
import { metricBreakdownDefinition } from "./definitions/metricBreakdown.js";
import { multidimensionalDefinition } from "./definitions/multidimensional.js";
import { pieDefinition } from "./definitions/pie.js";
import { roseDefinition } from "./definitions/rose.js";
import { progressBarDefinition } from "./definitions/progressBar.js";
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
export { areaDefinition } from "./definitions/area.js";
export { crosstabDefinition } from "./definitions/crosstab.js";
export { flipNumberDefinition } from "./definitions/flipNumber.js";
export { gaugeDefinition } from "./definitions/gauge.js";
export { heatmapDefinition } from "./definitions/heatmap.js";
export { kpiDefinition } from "./definitions/kpi.js";
export { lineDefinition } from "./definitions/line.js";
export { liquidDefinition } from "./definitions/liquid.js";
export { metricTrendDefinition } from "./definitions/metricTrend.js";
export { metricBreakdownDefinition } from "./definitions/metricBreakdown.js";
export { multidimensionalDefinition } from "./definitions/multidimensional.js";
export { pieDefinition } from "./definitions/pie.js";
export { roseDefinition } from "./definitions/rose.js";
export { progressBarDefinition } from "./definitions/progressBar.js";
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
    .register(crosstabDefinition)
    .register(heatmapDefinition)
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
    .register(roseDefinition)
    .register(sunburstDefinition)
    .register(radarDefinition)
    .register(treemapDefinition)
    .register(kpiDefinition)
    .register(metricTrendDefinition)
    .register(metricBreakdownDefinition)
    .register(flipNumberDefinition)
    .register(progressBarDefinition)
    .register(gaugeDefinition)
    .register(liquidDefinition)
    .register(tableDefinition)
    .register(textDefinition);
