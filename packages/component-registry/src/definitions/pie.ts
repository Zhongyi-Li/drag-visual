import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

export const PieBasePropsSchema = z.object({
  aggregation: z.enum(["sum", "avg", "count", "max", "min"]).default("sum"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  showLegend: z.boolean(),
}).strict();

export const PiePropsSchema = PieBasePropsSchema.extend({
  maxCategoryCount: z.number().int().min(1).max(5_000).default(20),
}).strict();

export const pieDefinition: ComponentDefinition<z.infer<typeof PiePropsSchema>> = Object.freeze({
  type: "pie",
  title: "饼图",
  category: "占比图",
  defaultLayout: Object.freeze({ w: 6, h: 5 }),
  createDefaults: (): z.infer<typeof PiePropsSchema> => ({ aggregation: "sum", color: "#1677ff", maxCategoryCount: 20, showLegend: true }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "dimension", title: "维度", acceptedTypes: Object.freeze(["string", "date"] as const), required: true, multiple: false }),
    Object.freeze({ key: "measure", title: "指标/列", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: true }),
  ]),
  propsSchema: PiePropsSchema,
  validateBinding: (binding: DataBinding | undefined) => requireSlot(binding, "measure", "请选择一个指标字段"),
});
