import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const MetricSettingSchema = z.object({
  measureKey: z.string().min(1),
  targetKey: z.string().min(1).nullable().default(null),
  label: z.string().max(40).default(""),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#2f6bff"),
  weight: z.number().min(0).max(100).default(0),
  includeInScore: z.boolean().default(true),
}).strict();

const ProgressIndicatorPropsSchema = z.object({
  aggregation: z.enum(["sum", "avg", "max", "min"]),
  decimals: z.number().int().min(0).max(4),
  periodLabel: z.string().max(40),
  showEmployeeRanking: z.boolean(),
  maxEmployees: z.number().int().min(3).max(20),
  metricSettings: z.array(MetricSettingSchema).max(6),
}).strict();

export type ProgressIndicatorProps = z.infer<typeof ProgressIndicatorPropsSchema>;

export const progressIndicatorDefinition: ComponentDefinition<ProgressIndicatorProps> = Object.freeze({
  type: "progressIndicator",
  title: "进度与指标",
  category: "指标",
  defaultLayout: Object.freeze({ w: 12, h: 8 }),
  createDefaults: (): ProgressIndicatorProps => ({
    aggregation: "sum",
    decimals: 1,
    periodLabel: "本月",
    showEmployeeRanking: true,
    maxEmployees: 8,
    metricSettings: [],
  }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "employeeDimension", title: "员工维度", acceptedTypes: Object.freeze(["string", "number"] as const), required: false, multiple: false }),
    Object.freeze({ key: "measure", title: "实际指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: true }),
    Object.freeze({ key: "target", title: "目标指标", acceptedTypes: Object.freeze(["number"] as const), required: false, multiple: true }),
  ]),
  propsSchema: ProgressIndicatorPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => requireSlot(binding, "measure", "请选择至少一个实际指标", { multiple: true }),
});
