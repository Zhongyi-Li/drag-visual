import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

/**
 * The semantic color is deliberately kept separate from the row type.  Most
 * rows can derive an appropriate color from their value, while an author can
 * explicitly mark a row as a positive result or a warning when needed.
 */
const KpiInsightToneSchema = z.enum(["auto", "positive", "negative", "warning", "neutral"]);

/**
 * Insight rows only describe how to present data already bound to the KPI.
 *
 * `comparison` and `target` use their respective legacy data slots,
 * `secondary` selects an item in `secondaryMeasures`, and `notice` is an
 * author-provided status message. This keeps the dashboard's data lineage in
 * bindings instead of letting free-form content reference fields by name.
 */
const KpiInsightRowSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("comparison"),
    prefix: z.string().max(40).default("环比"),
    tone: KpiInsightToneSchema.default("auto"),
  }).strict(),
  z.object({
    type: z.literal("target"),
    prefix: z.string().max(40).default("目标完成"),
    tone: KpiInsightToneSchema.default("auto"),
  }).strict(),
  z.object({
    type: z.literal("secondary"),
    prefix: z.string().max(40).default(""),
    tone: KpiInsightToneSchema.default("neutral"),
    secondaryIndex: z.number().int().min(0).max(99).default(0),
  }).strict(),
  z.object({
    type: z.literal("notice"),
    prefix: z.string().max(40).default(""),
    tone: KpiInsightToneSchema.default("warning"),
    text: z.string().min(1).max(120),
  }).strict(),
]);

const KpiPropsSchema = z.object({
  aggregation: z.enum(["first", "sum", "avg", "max", "min"]),
  prefix: z.string(),
  suffix: z.string(),
  decimals: z.number().int().min(0).max(6),
  // Optional at parse time so saved KPI instances created before insight rows
  // were introduced continue to validate without a migration.
  insightRows: z.array(KpiInsightRowSchema).max(2).default([]),
}).strict();

export const kpiDefinition: ComponentDefinition<z.infer<typeof KpiPropsSchema>> = Object.freeze({
  type: "kpi",
  title: "指标卡",
  category: "指标",
  defaultLayout: Object.freeze({ w: 3, h: 3 }),
  createDefaults: (): z.infer<typeof KpiPropsSchema> => ({
    aggregation: "first",
    prefix: "",
    suffix: "",
    decimals: 0,
    // Accepted solely so dashboards created during the experimental phase can
    // still be opened. KPI rendering keeps its original presentation.
    insightRows: [],
  }),
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
