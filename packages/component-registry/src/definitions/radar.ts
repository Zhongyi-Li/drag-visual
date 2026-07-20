import type { DataBinding } from "@drag-visual/contracts";

import { PiePropsSchema } from "./pie.js";
import { requireSlot } from "./helpers.js";
import type { ComponentDefinition } from "../types.js";

/**
 * A radar uses one category axis and compares every selected numeric measure
 * around that axis, matching the multi-series BI radar convention.
 */
export const radarDefinition: ComponentDefinition = Object.freeze({
  type: "radar",
  title: "雷达图",
  category: "饼/环形",
  defaultLayout: Object.freeze({ w: 6, h: 6 }),
  createDefaults: () => ({ color: "#4b7cf5", showLegend: true }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "dimension", title: "维度", acceptedTypes: Object.freeze(["string", "date"] as const), required: true, multiple: false }),
    Object.freeze({ key: "measure", title: "指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: true }),
  ]),
  propsSchema: PiePropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const checks = [
      requireSlot(binding, "dimension", "请选择一个维度字段"),
      requireSlot(binding, "measure", "请选择至少一个指标字段", { multiple: true }),
    ];
    const messages = checks.flatMap((check) => check.messages);
    return Object.freeze({ valid: messages.length === 0, messages: Object.freeze(messages) });
  },
});
