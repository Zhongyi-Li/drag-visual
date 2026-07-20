import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const RankingPropsSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  maxItems: z.number().int().min(3).max(20),
  showValue: z.boolean(),
}).strict();

const dataSlots = Object.freeze([
  Object.freeze({ key: "dimension", title: "排名维度", acceptedTypes: Object.freeze(["string", "date", "boolean"] as const), required: true, multiple: false }),
  Object.freeze({ key: "measure", title: "排名指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: true }),
]);

export const rankingDefinition: ComponentDefinition<z.infer<typeof RankingPropsSchema>> = Object.freeze({
  type: "ranking",
  title: "排行榜",
  category: "柱/条图",
  defaultLayout: Object.freeze({ w: 7, h: 5 }),
  createDefaults: (): z.infer<typeof RankingPropsSchema> => ({ color: "#1677ff", maxItems: 10, showValue: true }),
  dataSlots,
  propsSchema: RankingPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const checks = [
      requireSlot(binding, "dimension", "请选择排名维度字段"),
      requireSlot(binding, "measure", "请选择排名指标字段"),
    ];
    const messages = checks.flatMap((check) => check.messages);
    return Object.freeze({ valid: messages.length === 0, messages: Object.freeze(messages) });
  },
});
