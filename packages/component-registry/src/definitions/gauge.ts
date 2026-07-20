import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const GaugePropsSchema = z.object({
  aggregation: z.enum(["first", "sum", "avg", "max", "min"]),
  decimals: z.number().int().min(0).max(4),
}).strict();

const dataSlots = Object.freeze([
  {
    key: "dimension",
    title: "分组维度",
    acceptedTypes: ["string", "date"] as const,
    required: false,
    multiple: false,
  },
  {
    key: "measure",
    title: "实际值",
    acceptedTypes: ["number"] as const,
    required: true,
    multiple: false,
  },
  {
    key: "target",
    title: "目标值",
    acceptedTypes: ["number"] as const,
    required: true,
    multiple: false,
  },
]);

export const gaugeDefinition: ComponentDefinition<z.infer<typeof GaugePropsSchema>> = Object.freeze({
  type: "gauge",
  title: "仪表盘",
  category: "指标",
  defaultLayout: Object.freeze({ w: 4, h: 4 }),
  createDefaults: (): z.infer<typeof GaugePropsSchema> => ({ aggregation: "sum", decimals: 1 }),
  dataSlots,
  propsSchema: GaugePropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const checks = [
      requireSlot(binding, "measure", "请选择实际值字段"),
      requireSlot(binding, "target", "请选择目标值字段"),
    ];
    const messages = checks.flatMap((check) => check.messages);
    return Object.freeze({
      valid: messages.length === 0,
      messages: Object.freeze(messages),
    });
  },
});
