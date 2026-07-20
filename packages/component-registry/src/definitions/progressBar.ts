import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const ProgressBarPropsSchema = z.object({
  aggregation: z.enum(["first", "sum", "avg", "max", "min"]),
  decimals: z.number().int().min(0).max(6),
  showValue: z.boolean(),
}).strict();

const dataSlots = Object.freeze([
  Object.freeze({
    key: "measure",
    title: "指标/度量",
    acceptedTypes: Object.freeze(["number"] as const),
    required: true,
    multiple: true,
  }),
  Object.freeze({
    key: "target",
    title: "目标值",
    acceptedTypes: Object.freeze(["number"] as const),
    required: false,
    multiple: true,
  }),
]);

export const progressBarDefinition: ComponentDefinition<z.infer<typeof ProgressBarPropsSchema>> = Object.freeze({
  type: "progressBar",
  title: "进度条",
  category: "指标",
  defaultLayout: Object.freeze({ w: 6, h: 3 }),
  createDefaults: (): z.infer<typeof ProgressBarPropsSchema> => ({
    aggregation: "sum",
    decimals: 1,
    showValue: true,
  }),
  dataSlots,
  propsSchema: ProgressBarPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const checks = [requireSlot(binding, "measure", "请选择至少一个指标字段", { multiple: true })];
    const messages = checks.flatMap((check) => check.messages);
    return Object.freeze({
      valid: messages.length === 0,
      messages: Object.freeze(messages),
    });
  },
});
