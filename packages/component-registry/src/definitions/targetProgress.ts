import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const TargetProgressPropsSchema = z.object({
  aggregation: z.enum(["sum", "avg", "max", "min"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  decimals: z.number().int().min(0).max(4),
  showValue: z.boolean(),
  suffix: z.string(),
}).strict();

export type TargetProgressProps = z.infer<typeof TargetProgressPropsSchema>;

export const targetProgressDefinition: ComponentDefinition<TargetProgressProps> = Object.freeze({
  type: "targetProgress",
  title: "目标完成率",
  category: "指标",
  defaultLayout: Object.freeze({ w: 9, h: 5 }),
  createDefaults: (): TargetProgressProps => ({ aggregation: "sum", color: "#f57c00", decimals: 0, showValue: true, suffix: "" }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "dimension", title: "完成维度", acceptedTypes: Object.freeze(["string", "date", "boolean"] as const), required: true, multiple: false }),
    Object.freeze({ key: "measure", title: "完成值", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
    Object.freeze({ key: "target", title: "目标值", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
  ]),
  propsSchema: TargetProgressPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const checks = [
      requireSlot(binding, "dimension", "请选择完成维度字段"),
      requireSlot(binding, "measure", "请选择完成值字段"),
      requireSlot(binding, "target", "请选择目标值字段"),
    ];
    const messages = checks.flatMap((check) => check.messages);
    return Object.freeze({ valid: messages.length === 0, messages: Object.freeze(messages) });
  },
});
