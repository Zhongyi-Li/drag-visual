import type { DataBinding } from "@drag-visual/contracts";

import { PiePropsSchema } from "./pie.js";
import { requireSlot } from "./helpers.js";
import type { ComponentDefinition } from "../types.js";

/** A treemap encodes a single aggregated measure as proportional rectangles. */
export const treemapDefinition: ComponentDefinition = Object.freeze({
  type: "treemap",
  title: "矩形树图",
  category: "饼/环形",
  defaultLayout: Object.freeze({ w: 6, h: 6 }),
  createDefaults: () => ({ color: "#4b7cf5", showLegend: false }),
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
