import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const FlipNumberPropsSchema = z.object({
  aggregation: z.enum(["first", "sum", "avg", "max", "min"]),
  prefix: z.string(),
  suffix: z.string(),
  decimals: z.number().int().min(0).max(6),
}).strict();

export const flipNumberDefinition: ComponentDefinition<z.infer<typeof FlipNumberPropsSchema>> = Object.freeze({
  type: "flipNumber",
  title: "翻牌器",
  category: "指标",
  defaultLayout: Object.freeze({ w: 4, h: 2 }),
  createDefaults: (): z.infer<typeof FlipNumberPropsSchema> => ({
    aggregation: "sum",
    prefix: "",
    suffix: "",
    decimals: 0,
  }),
  dataSlots: Object.freeze([
    Object.freeze({
      key: "measure",
      title: "指标/度量",
      acceptedTypes: Object.freeze(["number"] as const),
      required: true,
      multiple: true,
    }),
  ]),
  propsSchema: FlipNumberPropsSchema,
  validateBinding: (binding: DataBinding | undefined) =>
    requireSlot(binding, "measure", "请选择至少一个指标字段", { multiple: true }),
});
