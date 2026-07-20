import type { DataBinding } from "@drag-visual/contracts";

import { PiePropsSchema } from "./pie.js";
import { requireSlot } from "./helpers.js";
import type { ComponentDefinition } from "../types.js";

/**
 * A rose chart is persisted as its own component type.  Unlike a title-based
 * variant, this keeps the polar-area encoding intact after a component is
 * renamed or copied into another dashboard.
 */
export const roseDefinition: ComponentDefinition = Object.freeze({
  type: "rose",
  title: "玫瑰图",
  category: "饼/环形",
  defaultLayout: Object.freeze({ w: 6, h: 5 }),
  createDefaults: () => ({ color: "#1677ff", showLegend: false }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "dimension", title: "维度", acceptedTypes: Object.freeze(["string", "date"] as const), required: true, multiple: false }),
    Object.freeze({ key: "measure", title: "指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: true }),
  ]),
  propsSchema: PiePropsSchema,
  validateBinding: (binding: DataBinding | undefined) => requireSlot(binding, "measure", "请选择一个指标字段"),
});
