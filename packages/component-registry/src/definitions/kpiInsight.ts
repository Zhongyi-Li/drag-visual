import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const InsightToneSchema = z.enum(["auto", "positive", "negative", "warning", "neutral"]);

const InsightRowSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("comparison"), prefix: z.string().max(40).default("环比"), tone: InsightToneSchema.default("auto") }).strict(),
  z.object({ type: z.literal("target"), prefix: z.string().max(40).default("目标完成"), tone: InsightToneSchema.default("auto") }).strict(),
  z.object({ type: z.literal("secondary"), prefix: z.string().max(40).default(""), tone: InsightToneSchema.default("neutral"), secondaryIndex: z.number().int().min(0).max(99).default(0) }).strict(),
  z.object({ type: z.literal("notice"), prefix: z.string().max(40).default(""), tone: InsightToneSchema.default("warning"), text: z.string().min(1).max(120) }).strict(),
]);

const MetricInsightSettingSchema = z.object({
  measureKey: z.string().min(1),
  displayName: z.string().max(40).default(""),
  targetKey: z.string().min(1).nullable().default(null),
  comparisonKey: z.string().min(1).nullable().default(null),
  secondaryKeys: z.array(z.string().min(1)).max(20).default([]),
  insightRows: z.array(InsightRowSchema).min(1).max(2).default([
    { type: "comparison", prefix: "环比", tone: "auto" },
    { type: "target", prefix: "目标完成", tone: "auto" },
  ]),
}).strict();

const KpiInsightPropsSchema = z.object({
  aggregation: z.enum(["first", "sum", "avg", "max", "min"]),
  prefix: z.string(),
  suffix: z.string(),
  decimals: z.number().int().min(0).max(6),
  /** Legacy fallback for dashboards created before per-metric configuration. */
  displayName: z.string().max(40),
  insightRows: z.array(InsightRowSchema).min(1).max(2),
  metricSettings: z.array(MetricInsightSettingSchema).max(20),
}).strict();

export const kpiInsightDefinition: ComponentDefinition<z.infer<typeof KpiInsightPropsSchema>> = Object.freeze({
  type: "kpiInsight",
  title: "指标洞察",
  category: "指标",
  defaultLayout: Object.freeze({ w: 6, h: 3 }),
  createDefaults: (): z.infer<typeof KpiInsightPropsSchema> => ({
    aggregation: "first",
    prefix: "",
    suffix: "",
    decimals: 0,
    displayName: "",
    insightRows: [
      { type: "comparison", prefix: "环比", tone: "auto" },
      { type: "target", prefix: "目标完成", tone: "auto" },
    ],
    metricSettings: [],
  }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "measure", title: "主指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: true }),
  ]),
  propsSchema: KpiInsightPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => requireSlot(binding, "measure", "请选择主指标字段"),
});
