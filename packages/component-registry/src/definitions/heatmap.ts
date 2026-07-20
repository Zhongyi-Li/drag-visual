import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const HeatmapPropsSchema = z.object({
  aggregation: z.enum(["sum", "avg", "max", "min"]),
  showValues: z.boolean(),
}).strict();

const dataSlots = Object.freeze([
  Object.freeze({
    key: "rowDimension",
    title: "行维度",
    acceptedTypes: Object.freeze(["string", "date", "boolean"] as const),
    required: true,
    multiple: false,
  }),
  Object.freeze({
    key: "columnDimension",
    title: "列维度",
    acceptedTypes: Object.freeze(["string", "date", "boolean"] as const),
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

export const heatmapDefinition: ComponentDefinition<z.infer<typeof HeatmapPropsSchema>> = Object.freeze({
  type: "heatmap",
  title: "热力图",
  category: "表格",
  defaultLayout: Object.freeze({ w: 10, h: 7 }),
  createDefaults: (): z.infer<typeof HeatmapPropsSchema> => ({ aggregation: "sum", showValues: true }),
  dataSlots,
  propsSchema: HeatmapPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const checks = [
      requireSlot(binding, "rowDimension", "请选择一个行维度字段"),
      requireSlot(binding, "columnDimension", "请选择一个列维度字段"),
      requireSlot(binding, "measure", "请选择一个指标字段"),
    ];
    const messages = checks.flatMap((check) => check.messages);
    return Object.freeze({
      valid: messages.length === 0,
      messages: Object.freeze(messages),
    });
  },
});
