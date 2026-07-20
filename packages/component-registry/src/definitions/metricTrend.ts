import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const MetricTrendPropsSchema = z.object({
  aggregation: z.enum(["sum", "avg", "max", "min"]),
  showSummary: z.boolean(),
  timeGranularity: z.enum(["day", "week", "month", "quarter", "year"]),
}).strict();

const dataSlots = Object.freeze([
  Object.freeze({
    key: "timeDimension",
    title: "日期/维度",
    acceptedTypes: Object.freeze(["date", "string"] as const),
    required: true,
    multiple: false,
  }),
  Object.freeze({
    key: "measure",
    title: "指标/度量",
    acceptedTypes: Object.freeze(["number"] as const),
    required: true,
    multiple: true,
  }),
]);

export const metricTrendDefinition: ComponentDefinition<z.infer<typeof MetricTrendPropsSchema>> = Object.freeze({
  type: "metricTrend",
  title: "指标趋势",
  category: "指标",
  defaultLayout: Object.freeze({ w: 8, h: 5 }),
  createDefaults: (): z.infer<typeof MetricTrendPropsSchema> => ({
    aggregation: "sum",
    showSummary: true,
    timeGranularity: "day",
  }),
  dataSlots,
  propsSchema: MetricTrendPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const checks = [
      requireSlot(binding, "timeDimension", "请选择一个时间字段"),
      requireSlot(binding, "measure", "请选择一个指标字段", { multiple: true }),
    ];
    const messages = checks.flatMap((check) => check.messages);
    return Object.freeze({
      valid: messages.length === 0,
      messages: Object.freeze(messages),
    });
  },
});
