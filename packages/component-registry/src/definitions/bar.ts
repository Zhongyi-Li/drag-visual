import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";

const BarPropsSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  showLegend: z.boolean(),
}).strict();

type BarProps = z.infer<typeof BarPropsSchema>;

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
    multiple: false,
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
    const measure = binding?.slots.measure;
    const measureCount = Array.isArray(measure)
      ? measure.length
      : measure === undefined
        ? 0
        : 1;
    const hasOneMeasure = measureCount === 1;
    return Object.freeze({
      valid: hasOneMeasure,
      messages: Object.freeze(hasOneMeasure ? [] : ["请选择一个指标字段"]),
    });
  },
});
