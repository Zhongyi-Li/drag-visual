import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const MetricBreakdownPropsSchema = z.object({
  aggregation: z.enum(["sum", "avg", "max", "min"]),
  decimals: z.number().int().min(0).max(4),
}).strict();

export const metricBreakdownDefinition: ComponentDefinition<z.infer<typeof MetricBreakdownPropsSchema>> = Object.freeze({
  type: "metricBreakdown",
  title: "指标拆解",
  category: "指标",
  defaultLayout: Object.freeze({ w: 6, h: 4 }),
  createDefaults: (): z.infer<typeof MetricBreakdownPropsSchema> => ({ aggregation: "sum", decimals: 1 }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "dimension", title: "拆解维度", acceptedTypes: Object.freeze(["string", "date", "boolean"] as const), required: true, multiple: false }),
    Object.freeze({ key: "measure", title: "拆解指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
  ]),
  propsSchema: MetricBreakdownPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const checks = [
      requireSlot(binding, "dimension", "请选择拆解维度"),
      requireSlot(binding, "measure", "请选择拆解指标"),
    ];
    const messages = checks.flatMap((check) => check.messages);
    return Object.freeze({ valid: messages.length === 0, messages: Object.freeze(messages) });
  },
});
