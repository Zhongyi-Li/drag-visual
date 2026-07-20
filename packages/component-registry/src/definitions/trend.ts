import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const TrendPropsSchema = z.object({
  aggregation: z.enum(["sum", "avg", "max", "min"]),
  showSummary: z.boolean(),
  timeGranularity: z.enum(["day", "week", "month", "quarter", "year"]),
}).strict();

const dataSlots = Object.freeze([
  Object.freeze({
    key: "timeDimension",
    title: "日期",
    acceptedTypes: Object.freeze(["date"] as const),
    required: true,
    multiple: false,
  }),
  Object.freeze({
    key: "measure",
    title: "指标",
    acceptedTypes: Object.freeze(["number"] as const),
    required: true,
    multiple: false,
  }),
]);

export const trendDefinition: ComponentDefinition<z.infer<typeof TrendPropsSchema>> = Object.freeze({
  type: "trend",
  title: "趋势分析",
  category: "趋势图",
  defaultLayout: Object.freeze({ w: 8, h: 5 }),
  createDefaults: (): z.infer<typeof TrendPropsSchema> => ({ aggregation: "sum", showSummary: true, timeGranularity: "day" }),
  dataSlots,
  propsSchema: TrendPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const checks = [
      requireSlot(binding, "timeDimension", "请选择一个时间字段"),
      requireSlot(binding, "measure", "请选择一个指标字段"),
    ];
    const messages = checks.flatMap((check) => check.messages);
    return Object.freeze({
      valid: messages.length === 0,
      messages: Object.freeze(messages),
    });
  },
});
