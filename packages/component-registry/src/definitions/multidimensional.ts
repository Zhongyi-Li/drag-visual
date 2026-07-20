import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const MultidimensionalPropsSchema = z.object({
  aggregation: z.enum(["sum", "avg", "max", "min"]),
  showTotals: z.boolean(),
  timeGranularity: z.enum(["day", "week", "month", "quarter", "year"]),
}).strict();

const dataSlots = Object.freeze([
  Object.freeze({
    key: "dateDimension",
    title: "日期",
    acceptedTypes: Object.freeze(["date"] as const),
    required: true,
    multiple: false,
  }),
  Object.freeze({
    key: "dimensions",
    title: "维度字段",
    acceptedTypes: Object.freeze(["string", "boolean"] as const),
    required: true,
    multiple: true,
  }),
  Object.freeze({
    key: "measures",
    title: "指标字段",
    acceptedTypes: Object.freeze(["number"] as const),
    required: true,
    multiple: true,
  }),
]);

export const multidimensionalDefinition: ComponentDefinition<z.infer<typeof MultidimensionalPropsSchema>> = Object.freeze({
  type: "multidimensional",
  title: "多维分析",
  category: "表格",
  defaultLayout: Object.freeze({ w: 10, h: 7 }),
  createDefaults: (): z.infer<typeof MultidimensionalPropsSchema> => ({ aggregation: "sum", showTotals: true, timeGranularity: "day" }),
  dataSlots,
  propsSchema: MultidimensionalPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const checks = [
      requireSlot(binding, "dateDimension", "请选择一个日期字段"),
      requireSlot(binding, "dimensions", "请选择至少一个维度字段", { multiple: true }),
      requireSlot(binding, "measures", "请选择至少一个指标字段", { multiple: true }),
    ];
    const messages = checks.flatMap((check) => check.messages);
    return Object.freeze({
      valid: messages.length === 0,
      messages: Object.freeze(messages),
    });
  },
});
