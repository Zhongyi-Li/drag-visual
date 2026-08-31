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

const ChannelMetricTargetSchema = z.object({
  measureKey: z.string().min(1),
  monthlyTargetValue: z.number().nonnegative().nullable().default(null),
  annualTargetValue: z.number().nonnegative().nullable().default(null),
}).strict();

const ChannelSettingSchema = z.object({
  channel: z.string().min(1),
  storeKeys: z.array(z.string().min(1)).max(500).default([]),
  storeSelectionMode: z.enum(["all", "selected"]).default("all"),
  // Targets follow the actual metrics selected in the binding. This keeps the
  // channel configuration independent of a fixed GMV / profit / turnover set.
  metricTargets: z.array(ChannelMetricTargetSchema).max(6).default([]),
  // Legacy targets remain readable. New configurations store separate monthly
  // and annual goals so changing the dashboard period does not compare a year
  // of actuals against one month's target.
  gmvTarget: z.number().nonnegative().nullable().default(null),
  grossProfitTarget: z.number().nonnegative().nullable().default(null),
  turnoverTargetDays: z.number().nonnegative().nullable().default(null),
  monthlyGmvTarget: z.number().nonnegative().nullable().default(null),
  monthlyGrossProfitTarget: z.number().nonnegative().nullable().default(null),
  monthlyTurnoverTargetDays: z.number().nonnegative().nullable().default(null),
  annualGmvTarget: z.number().nonnegative().nullable().default(null),
  annualGrossProfitTarget: z.number().nonnegative().nullable().default(null),
  annualTurnoverTargetDays: z.number().nonnegative().nullable().default(null),
}).strict();

const GoalTaskProgressPropsSchema = z.object({
  aggregation: z.enum(["sum", "avg", "max", "min"]),
  decimals: z.number().int().min(0).max(4),
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  periodMode: z.enum(["month", "year"]).default("month"),
  maxEmployees: z.number().int().min(3).max(50),
  metricSettings: z.array(MetricSettingSchema).max(6),
  channelSettings: z.array(ChannelSettingSchema).max(100),
  // Kept for loading existing dashboards. New target configuration is channel based.
  employeeSettings: z.array(EmployeeSettingSchema).max(100),
}).strict();

export type GoalTaskProgressProps = z.infer<typeof GoalTaskProgressPropsSchema>;

export const goalTaskProgressDefinition: ComponentDefinition<GoalTaskProgressProps> = Object.freeze({
  type: "goalTaskProgress",
  title: "大盘任务进度看板",
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
    channelSettings: [],
    employeeSettings: [],
  }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "employeeDimension", title: "维度", acceptedTypes: Object.freeze(["string", "number"] as const), required: true, multiple: false }),
    Object.freeze({ key: "storeDimension", title: "店铺维度", acceptedTypes: Object.freeze(["string", "number"] as const), required: false, multiple: false }),
    // Older Excel imports can retain date serials as numbers. Keep them
    // bindable here so the renderer can normalize the serial at read time.
    Object.freeze({ key: "dateDimension", title: "日期字段", acceptedTypes: Object.freeze(["date", "string", "number"] as const), required: false, multiple: false }),
    Object.freeze({ key: "measure", title: "实际指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: true }),
  ]),
  propsSchema: GoalTaskProgressPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const employee = requireSlot(binding, "employeeDimension", "请选择维度");
    const measures = requireSlot(binding, "measure", "请选择至少一个实际指标", { multiple: true });
    return { valid: employee.valid && measures.valid, messages: [...employee.messages, ...measures.messages] };
  },
});
