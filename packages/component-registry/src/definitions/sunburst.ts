import type { DataBinding } from "@drag-visual/contracts";

import { PiePropsSchema } from "./pie.js";
import { requireSlot } from "./helpers.js";
import type { ComponentDefinition } from "../types.js";

/**
 * A dedicated type keeps the sunburst rendering and its metric switcher when
 * users rename or duplicate the component.
 */
export const sunburstDefinition: ComponentDefinition = Object.freeze({
  type: "sunburst",
  title: "旭日图",
  category: "饼/环形",
  defaultLayout: Object.freeze({ w: 7, h: 6 }),
  createDefaults: () => ({ color: "#1677ff", showLegend: true }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "dimension", title: "扇区标签/维度", acceptedTypes: Object.freeze(["string", "date"] as const), required: true, multiple: false }),
    Object.freeze({ key: "measure", title: "扇区角度/度量", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: true }),
    Object.freeze({ key: "tooltipMeasures", title: "工具提示/度量", acceptedTypes: Object.freeze(["number"] as const), required: false, multiple: true }),
  ]),
  propsSchema: PiePropsSchema,
  validateBinding: (binding: DataBinding | undefined) => requireSlot(binding, "measure", "请选择至少一个指标字段"),
});
