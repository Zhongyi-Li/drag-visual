import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const KpiPropsSchema = z.object({
  aggregation: z.enum(["first", "sum", "avg", "max", "min"]),
  prefix: z.string(),
  suffix: z.string(),
  decimals: z.number().int().min(0).max(6),
}).strict();

export const kpiDefinition: ComponentDefinition<z.infer<typeof KpiPropsSchema>> = Object.freeze({
  type: "kpi",
  title: "指标卡",
  category: "指标",
  defaultLayout: Object.freeze({ w: 3, h: 3 }),
  createDefaults: (): z.infer<typeof KpiPropsSchema> => ({ aggregation: "first", prefix: "", suffix: "", decimals: 0 }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "dimension", title: "分组维度", acceptedTypes: Object.freeze(["string", "date"] as const), required: false, multiple: false }),
    Object.freeze({ key: "measure", title: "指标/容量", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: true }),
    Object.freeze({ key: "target", title: "目标值", acceptedTypes: Object.freeze(["number"] as const), required: false, multiple: false }),
    Object.freeze({ key: "comparison", title: "对比值", acceptedTypes: Object.freeze(["number"] as const), required: false, multiple: false }),
    Object.freeze({ key: "secondaryMeasures", title: "辅助指标", acceptedTypes: Object.freeze(["number"] as const), required: false, multiple: true }),
  ]),
  propsSchema: KpiPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => requireSlot(binding, "measure", "请选择至少一个指标字段", { multiple: true }),
});
