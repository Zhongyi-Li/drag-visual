import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { bindingCount } from "./helpers.js";

export const TimeSeriesPropsSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  showLegend: z.boolean(),
  smooth: z.boolean(),
  area: z.boolean(),
}).strict();

export type TimeSeriesProps = z.infer<typeof TimeSeriesPropsSchema>;

export const timeSeriesDataSlots = Object.freeze([
  Object.freeze({ key: "dimension", title: "维度", acceptedTypes: Object.freeze(["string", "date"] as const), required: true, multiple: false }),
  Object.freeze({ key: "measures", title: "指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: true }),
]);

export const validateTimeSeriesBinding = (binding: DataBinding | undefined) => {
  const messages: string[] = [];
  if (bindingCount(binding, "dimension") !== 1) messages.push("请选择一个维度字段");
  if (bindingCount(binding, "measures") < 1) messages.push("请选择至少一个指标字段");
  return Object.freeze({ valid: messages.length === 0, messages: Object.freeze(messages) });
};

export const lineDefinition: ComponentDefinition<TimeSeriesProps> = Object.freeze({
  type: "line",
  title: "折线图",
  category: "线/面积图",
  defaultLayout: Object.freeze({ w: 6, h: 5 }),
  createDefaults: (): TimeSeriesProps => ({ color: "#1677ff", showLegend: true, smooth: false, area: false }),
  dataSlots: timeSeriesDataSlots,
  propsSchema: TimeSeriesPropsSchema,
  validateBinding: validateTimeSeriesBinding,
});
