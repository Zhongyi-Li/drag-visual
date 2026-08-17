import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const HorizontalBarPropsSchema = z.object({
  aggregation: z.enum(["sum", "avg", "count", "max", "min"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  maxItems: z.number().int().min(3).max(20),
  showValue: z.boolean(),
  /** Two measures can use individual axes when their units or ranges differ. */
  multiMetricScale: z.enum(["auto", "independent", "shared"]).default("auto"),
}).strict();

const dataSlots = Object.freeze([
  Object.freeze({ key: "dimension", title: "分类维度", acceptedTypes: Object.freeze(["string", "date", "boolean"] as const), required: true, multiple: false }),
  Object.freeze({ key: "measure", title: "条形指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: true }),
]);

export const horizontalBarDefinition: ComponentDefinition<z.infer<typeof HorizontalBarPropsSchema>> = Object.freeze({
  type: "horizontalBar",
  title: "条形图",
  category: "柱/条图",
  defaultLayout: Object.freeze({ w: 7, h: 5 }),
  createDefaults: (): z.infer<typeof HorizontalBarPropsSchema> => ({ aggregation: "sum", color: "#5b6ff0", maxItems: 10, showValue: true, multiMetricScale: "auto" }),
  dataSlots,
  propsSchema: HorizontalBarPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const checks = [
      requireSlot(binding, "dimension", "请选择一个分类维度字段"),
      requireSlot(binding, "measure", "请选择至少一个条形指标字段"),
    ];
    const messages = checks.flatMap((check) => check.messages);
    return Object.freeze({ valid: messages.length === 0, messages: Object.freeze(messages) });
  },
});
