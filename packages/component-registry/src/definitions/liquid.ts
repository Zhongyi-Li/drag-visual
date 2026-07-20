import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const LiquidPropsSchema = z.object({
  aggregation: z.enum(["first", "sum", "avg", "max", "min"]),
  decimals: z.number().int().min(0).max(4),
}).strict();

export const liquidDefinition: ComponentDefinition<z.infer<typeof LiquidPropsSchema>> = Object.freeze({
  type: "liquid",
  title: "水波图",
  category: "指标",
  defaultLayout: Object.freeze({ w: 4, h: 4 }),
  createDefaults: (): z.infer<typeof LiquidPropsSchema> => ({ aggregation: "sum", decimals: 1 }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "dimension", title: "分组维度", acceptedTypes: Object.freeze(["string", "date"] as const), required: false, multiple: false }),
    Object.freeze({ key: "measure", title: "实际值", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
    Object.freeze({ key: "target", title: "目标值", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
  ]),
  propsSchema: LiquidPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const checks = [
      requireSlot(binding, "measure", "请选择实际值字段"),
      requireSlot(binding, "target", "请选择目标值字段"),
    ];
    const messages = checks.flatMap((check) => check.messages);
    return Object.freeze({ valid: messages.length === 0, messages: Object.freeze(messages) });
  },
});
