import type { DataBinding } from "@drag-visual/contracts";

import { PiePropsSchema, pieDefinition } from "./pie.js";
import { requireSlot } from "./helpers.js";
import type { ComponentDefinition } from "../types.js";

/**
 * 环形图保留独立类型，避免依赖标题文字判断而在改名后退化为普通饼图。
 */
export const donutDefinition: ComponentDefinition = Object.freeze({
  type: "donut",
  title: "环形图",
  category: "饼/环形",
  defaultLayout: Object.freeze({ w: 7, h: 5 }),
  createDefaults: () => ({ color: "#1677ff", showLegend: true }),
  dataSlots: pieDefinition.dataSlots,
  propsSchema: PiePropsSchema,
  validateBinding: (binding: DataBinding | undefined) => requireSlot(binding, "measure", "请选择一个指标字段"),
});
