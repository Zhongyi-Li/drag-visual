import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const RingBarPropsSchema = z.object({
  decimals: z.number().int().min(0).max(4),
  showValue: z.boolean(),
}).strict();

const dataSlots = Object.freeze([
  Object.freeze({ key: "dimension", title: "分组维度", acceptedTypes: Object.freeze(["string", "date"] as const), required: true, multiple: false }),
  Object.freeze({ key: "measure", title: "实际值", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
  Object.freeze({ key: "target", title: "目标值", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
]);

export const ringBarDefinition: ComponentDefinition<z.infer<typeof RingBarPropsSchema>> = Object.freeze({
  type: "ringBar",
  title: "环形柱图",
  category: "柱/条图",
  defaultLayout: Object.freeze({ w: 7, h: 4 }),
  createDefaults: (): z.infer<typeof RingBarPropsSchema> => ({ decimals: 1, showValue: true }),
  dataSlots,
  propsSchema: RingBarPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const checks = [
      requireSlot(binding, "dimension", "请选择分组维度字段"),
      requireSlot(binding, "measure", "请选择实际值字段"),
      requireSlot(binding, "target", "请选择目标值字段"),
    ];
    const messages = checks.flatMap((check) => check.messages);
    return Object.freeze({ valid: messages.length === 0, messages: Object.freeze(messages) });
  },
});
