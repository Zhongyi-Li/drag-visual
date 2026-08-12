import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const BarLinePropsSchema = z.object({
  aggregation: z.enum(["sum", "avg", "count", "max", "min"]),
  barColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  hideZeroValues: z.boolean(),
  lineColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  showLegend: z.boolean(),
  smartLineScale: z.boolean(),
  smooth: z.boolean(),
}).strict();

const dataSlots = Object.freeze([
  Object.freeze({ key: "dimension", title: "分类维度", acceptedTypes: Object.freeze(["string", "date"] as const), required: true, multiple: false }),
  Object.freeze({ key: "barMeasure", title: "柱状指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
  Object.freeze({ key: "lineMeasure", title: "折线指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
]);

export const barLineDefinition: ComponentDefinition<z.infer<typeof BarLinePropsSchema>> = Object.freeze({
  type: "barLine",
  title: "柱状折线组合图",
  category: "柱/条图",
  defaultLayout: Object.freeze({ w: 7, h: 5 }),
  createDefaults: (): z.infer<typeof BarLinePropsSchema> => ({ aggregation: "sum", barColor: "#2f62dc", hideZeroValues: true, lineColor: "#ff7417", showLegend: true, smartLineScale: true, smooth: true }),
  dataSlots,
  propsSchema: BarLinePropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const checks = [
      requireSlot(binding, "dimension", "请选择一个分类维度字段"),
      requireSlot(binding, "barMeasure", "请选择一个柱状指标字段"),
      requireSlot(binding, "lineMeasure", "请选择一个折线指标字段"),
    ];
    const messages = checks.flatMap((check) => check.messages);
    return Object.freeze({ valid: messages.length === 0, messages: Object.freeze(messages) });
  },
});
