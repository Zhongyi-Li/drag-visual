import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const MetricSettingSchema = z.object({
  measureKey: z.string().min(1),
  targetKey: z.string().min(1).nullable().default(null),
  targetValue: z.number().nonnegative().nullable().default(null),
  label: z.string().max(40).default(""),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#2f6bff"),
  weight: z.number().min(0).max(100).default(0),
  includeInScore: z.boolean().default(true),
}).strict();

const EmployeeMetricSettingSchema = z.object({
  measureKey: z.string().min(1),
  targetValue: z.number().nonnegative().nullable().default(null),
  /** Overrides the source target for the selected monthly period. */
  monthlyTargetValue: z.number().nonnegative().nullable().default(null),
  /** Overrides the source target when the component is switched to annual mode. */
  annualTargetValue: z.number().nonnegative().nullable().default(null),
  weight: z.number().min(0).max(100).nullable().default(null),
}).strict();

const EmployeeSettingSchema = z.object({
  employeeKey: z.string().min(1),
  metrics: z.array(EmployeeMetricSettingSchema).max(6),
}).strict();

const GoalTaskProgressPropsSchema = z.object({
  aggregation: z.enum(["sum", "avg", "max", "min"]),
  decimals: z.number().int().min(0).max(4),
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  periodMode: z.enum(["month", "year"]).default("month"),
  maxEmployees: z.number().int().min(3).max(50),
  metricSettings: z.array(MetricSettingSchema).max(6),
  employeeSettings: z.array(EmployeeSettingSchema).max(100),
}).strict();

export type GoalTaskProgressProps = z.infer<typeof GoalTaskProgressPropsSchema>;

export const goalTaskProgressDefinition: ComponentDefinition<GoalTaskProgressProps> = Object.freeze({
  type: "goalTaskProgress",
  title: "目标任务进度",
  category: "指标",
  defaultLayout: Object.freeze({ w: 12, h: 9 }),
  createDefaults: (): GoalTaskProgressProps => ({
    aggregation: "sum",
    decimals: 1,
    periodYear: 2026,
    periodMonth: 8,
    periodMode: "month",
    maxEmployees: 12,
    metricSettings: [],
    employeeSettings: [],
  }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "employeeDimension", title: "员工维度", acceptedTypes: Object.freeze(["string", "number"] as const), required: true, multiple: false }),
    Object.freeze({ key: "dateDimension", title: "日期字段", acceptedTypes: Object.freeze(["date", "string"] as const), required: false, multiple: false }),
    Object.freeze({ key: "measure", title: "实际指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: true }),
    Object.freeze({ key: "target", title: "目标指标", acceptedTypes: Object.freeze(["number"] as const), required: false, multiple: true }),
  ]),
  propsSchema: GoalTaskProgressPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const employee = requireSlot(binding, "employeeDimension", "请选择员工维度");
    const measures = requireSlot(binding, "measure", "请选择至少一个实际指标", { multiple: true });
    return { valid: employee.valid && measures.valid, messages: [...employee.messages, ...measures.messages] };
  },
});
