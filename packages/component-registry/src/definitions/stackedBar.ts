import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { bindingCount } from "./helpers.js";
import { BarPropsSchema, type BarProps } from "./bar.js";

const stackedBarDataSlots = Object.freeze([
  Object.freeze({ key: "dimension", title: "维度", acceptedTypes: Object.freeze(["string", "date"] as const), required: true, multiple: false }),
  Object.freeze({ key: "measures", title: "指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: true }),
]);

const validateStackedBarBinding = (binding: DataBinding | undefined) => {
  const messages: string[] = [];
  if (bindingCount(binding, "dimension") !== 1) messages.push("请选择一个维度字段");
  if (bindingCount(binding, "measures") < 1) messages.push("请选择至少一个指标字段");
  return Object.freeze({ valid: messages.length === 0, messages: Object.freeze(messages) });
};

export const stackedBarDefinition: ComponentDefinition<BarProps> = Object.freeze({
  type: "stackedBar",
  title: "堆积柱图",
  category: "柱/条图",
  defaultLayout: Object.freeze({ w: 6, h: 5 }),
  createDefaults: (): BarProps => ({ color: "#1677ff", showLegend: true }),
  dataSlots: stackedBarDataSlots,
  propsSchema: BarPropsSchema,
  validateBinding: validateStackedBarBinding,
});
