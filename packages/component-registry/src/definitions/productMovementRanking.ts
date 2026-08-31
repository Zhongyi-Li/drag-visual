import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const ProductMovementRankingPropsSchema = z.object({
  aggregation: z.enum(["sum", "avg", "max", "min"]),
  maxItems: z.number().int().min(3).max(20),
  primarySeriesLabel: z.string().max(24),
  primaryReferenceSeriesLabel: z.string().max(24),
  secondarySeriesLabel: z.string().max(24),
  secondaryReferenceSeriesLabel: z.string().max(24),
  primaryRowLabel: z.string().min(1).max(12),
  secondaryRowLabel: z.string().min(1).max(12),
  actualValueLabel: z.string().max(8),
  referenceValueLabel: z.string().max(8),
  primaryPrefix: z.string().max(12),
  primarySuffix: z.string().max(12),
  secondaryPrefix: z.string().max(12),
  secondarySuffix: z.string().max(12),
  primaryNumberFormat: z.enum(["compact", "number"]),
  secondaryNumberFormat: z.enum(["compact", "number"]),
}).strict();

/** Paired sales and inventory bars, kept separate to preserve their units. */
export const productMovementRankingDefinition: ComponentDefinition<z.infer<typeof ProductMovementRankingPropsSchema>> = Object.freeze({
  type: "productMovementRanking",
  title: "双指标对比排行",
  category: "柱/条图",
  defaultLayout: Object.freeze({ w: 12, h: 7 }),
  createDefaults: (): z.infer<typeof ProductMovementRankingPropsSchema> => ({
    aggregation: "sum", maxItems: 6,
    primarySeriesLabel: "", primaryReferenceSeriesLabel: "", secondarySeriesLabel: "", secondaryReferenceSeriesLabel: "",
    primaryRowLabel: "金额", secondaryRowLabel: "数量", actualValueLabel: "销", referenceValueLabel: "库",
    primaryPrefix: "¥", primarySuffix: "", secondaryPrefix: "", secondarySuffix: "件",
    primaryNumberFormat: "compact", secondaryNumberFormat: "number",
  }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "dimension", title: "分类维度", acceptedTypes: Object.freeze(["string", "date", "boolean"] as const), required: true, multiple: false }),
    Object.freeze({ key: "salesAmount", title: "主指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
    Object.freeze({ key: "inventoryAmount", title: "主指标对比值", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
    Object.freeze({ key: "salesQuantity", title: "次指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
    Object.freeze({ key: "inventoryQuantity", title: "次指标对比值", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
  ]),
  propsSchema: ProductMovementRankingPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const messages = [
      requireSlot(binding, "dimension", "请选择分类维度字段"),
      requireSlot(binding, "salesAmount", "请选择主指标字段"),
      requireSlot(binding, "inventoryAmount", "请选择主指标对比字段"),
      requireSlot(binding, "salesQuantity", "请选择次指标字段"),
      requireSlot(binding, "inventoryQuantity", "请选择次指标对比字段"),
    ].flatMap((check) => check.messages);
    return Object.freeze({ valid: messages.length === 0, messages: Object.freeze(messages) });
  },
});
