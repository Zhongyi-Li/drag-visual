import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const LinePropsSchema = z.object({
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  showLegend: z.boolean(),
  area: z.boolean(),
}).strict();

export const lineDefinition: ComponentDefinition<z.infer<typeof LinePropsSchema>> = Object.freeze({
  type: "line",
  title: "折线图",
  category: "趋势图",
  defaultLayout: Object.freeze({ w: 6, h: 5 }),
  createDefaults: (): z.infer<typeof LinePropsSchema> => ({ color: "#1677ff", showLegend: true, area: false }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "dimension", title: "维度", acceptedTypes: Object.freeze(["string", "date"] as const), required: true, multiple: false }),
    Object.freeze({ key: "measures", title: "指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: true }),
  ]),
  propsSchema: LinePropsSchema,
  validateBinding: (binding: DataBinding | undefined) => requireSlot(binding, "measures", "请选择至少一个指标字段", { multiple: true }),
});
