import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import { requireSlot } from "./helpers.js";
import type { ComponentDefinition } from "../types.js";

const DonutBreakdownPropsSchema = z.object({
  aggregation: z.enum(["sum", "avg", "count", "max", "min"]).default("sum"),
  maxCategoryCount: z.number().int().min(1).max(5_000).default(20),
}).strict();

export const donutBreakdownDefinition: ComponentDefinition<z.infer<typeof DonutBreakdownPropsSchema>> = Object.freeze({
  type: "donutBreakdown",
  title: "环形构成明细",
  category: "饼/环形",
  defaultLayout: Object.freeze({ w: 10, h: 5 }),
  createDefaults: (): z.infer<typeof DonutBreakdownPropsSchema> => ({ aggregation: "sum", maxCategoryCount: 5_000 }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "dimension", title: "分类维度", acceptedTypes: Object.freeze(["string", "date"] as const), required: true, multiple: false }),
    Object.freeze({ key: "measure", title: "数值指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
  ]),
  propsSchema: DonutBreakdownPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const messages = [
      ...requireSlot(binding, "dimension", "请选择分类维度").messages,
      ...requireSlot(binding, "measure", "请选择数值指标").messages,
    ];
    return Object.freeze({ valid: messages.length === 0, messages: Object.freeze(messages) });
  },
});
