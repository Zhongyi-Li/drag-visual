import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const RingBarPropsSchema = z.object({
  aggregation: z.enum(["sum", "avg", "count", "max", "min"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  showLegend: z.boolean(),
}).strict();

const dataSlots = Object.freeze([
  Object.freeze({ key: "dimension", title: "维度", acceptedTypes: Object.freeze(["string", "date"] as const), required: true, multiple: false }),
  Object.freeze({ key: "measure", title: "指标/列", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
  Object.freeze({ key: "tooltipMeasures", title: "工具提示/度量", acceptedTypes: Object.freeze(["number"] as const), required: false, multiple: true }),
]);

export const ringBarDefinition: ComponentDefinition<z.infer<typeof RingBarPropsSchema>> = Object.freeze({
  type: "ringBar",
  title: "环形柱图",
  category: "柱/条图",
  defaultLayout: Object.freeze({ w: 7, h: 4 }),
  createDefaults: (): z.infer<typeof RingBarPropsSchema> => ({ aggregation: "sum", color: "#1677ff", showLegend: true }),
  dataSlots,
  propsSchema: RingBarPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const checks = [
      requireSlot(binding, "dimension", "请选择一个维度字段"),
      requireSlot(binding, "measure", "请选择一个指标字段"),
    ];
    const messages = checks.flatMap((check) => check.messages);
    return Object.freeze({ valid: messages.length === 0, messages: Object.freeze(messages) });
  },
});
