import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";

export const BarPropsSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  showLegend: z.boolean(),
}).strict();

export type BarProps = z.infer<typeof BarPropsSchema>;

const dataSlots = Object.freeze([
  Object.freeze({
    key: "dimension",
    title: "维度",
    acceptedTypes: Object.freeze(["string", "date"] as const),
    required: false,
    multiple: false,
  }),
  Object.freeze({
    key: "measure",
    title: "指标",
    acceptedTypes: Object.freeze(["number"] as const),
    required: true,
    multiple: true,
  }),
]);

export const barDefinition: ComponentDefinition<BarProps> = Object.freeze({
  type: "bar",
  title: "柱图",
  category: "柱/条图",
  defaultLayout: Object.freeze({ w: 6, h: 5 }),
  createDefaults: (): BarProps => ({ color: "#1677ff", showLegend: true }),
  dataSlots,
  propsSchema: BarPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const measures = binding?.slots.measure;
    const measureCount = Array.isArray(measures)
      ? measures.length
      : measures === undefined
        ? 0
        : 1;
    const hasMeasures = measureCount >= 1;
    return Object.freeze({
      valid: hasMeasures,
      messages: Object.freeze(hasMeasures ? [] : ["请选择至少一个指标字段"]),
    });
  },
});
