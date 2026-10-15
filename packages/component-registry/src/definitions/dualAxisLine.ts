import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const DualAxisLinePropsSchema = z.object({
  amountColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  rateColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  rateUnit: z.enum(["percent", "fraction"]),
  showValues: z.boolean(),
  showAverage: z.boolean(),
}).strict();

export const dualAxisLineDefinition: ComponentDefinition<z.infer<typeof DualAxisLinePropsSchema>> = Object.freeze({
  type: "dualAxisLine",
  title: "双轴折线图",
  category: "线/面积图",
  defaultLayout: Object.freeze({ w: 12, h: 6 }),
  createDefaults: (): z.infer<typeof DualAxisLinePropsSchema> => ({ amountColor: "#22964b", rateColor: "#eb6b16", rateUnit: "percent", showValues: true, showAverage: true }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "dimension", title: "日期或分类", acceptedTypes: Object.freeze(["date", "string"] as const), required: true, multiple: false }),
    Object.freeze({ key: "amountMeasure", title: "数值指标（左轴）", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
    Object.freeze({ key: "rateMeasure", title: "比率指标（右轴）", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
  ]),
  propsSchema: DualAxisLinePropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const messages = [
      requireSlot(binding, "dimension", "请选择日期或分类字段"),
      requireSlot(binding, "amountMeasure", "请选择左轴数值指标字段"),
      requireSlot(binding, "rateMeasure", "请选择右轴比率指标字段"),
    ].flatMap((check) => check.messages);
    return Object.freeze({ valid: messages.length === 0, messages: Object.freeze(messages) });
  },
});
