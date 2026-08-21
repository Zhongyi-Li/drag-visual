import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const MetricAlertPropsSchema = z.object({
  /** Keeps the threshold and displayed value aligned with the data query. */
  aggregation: z.enum(["sum", "avg", "count", "max", "min"]),
  operator: z.enum(["gt", "gte", "lt", "lte", "eq", "neq"]),
  threshold: z.number(),
  decimals: z.number().int().min(0).max(6),
  alertLabel: z.string().min(1).max(40),
  scopeText: z.string().max(120),
  headlineTemplate: z.string().min(1).max(120),
  messageTemplate: z.string().min(1).max(240),
  detailTemplate: z.string().min(1).max(500),
}).strict();

/** A dashboard-level metric risk notice with runtime-resolved copy tokens. */
export const metricAlertDefinition: ComponentDefinition<z.infer<typeof MetricAlertPropsSchema>> = Object.freeze({
  type: "metricAlert",
  title: "指标预警",
  category: "指标",
  defaultLayout: Object.freeze({ w: 12, h: 2 }),
  createDefaults: (): z.infer<typeof MetricAlertPropsSchema> => ({
    aggregation: "sum",
    operator: "gte",
    threshold: 1,
    decimals: 0,
    alertLabel: "指标预警 {{count}} 项",
    scopeText: "全部范围",
    headlineTemplate: "{{metric}}触发预警",
    messageTemplate: "{{scope}}｜共 {{count}} 个{{dimensionLabel}}命中预警。",
    detailTemplate: "{{dimension}}的{{metric}}当前值为 {{value}}。预警条件：{{metric}} {{operator}} {{threshold}}。请结合业务范围核查原因并及时处理。",
  }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "dimension", title: "预警维度", acceptedTypes: Object.freeze(["string", "date"] as const), required: true, multiple: false }),
    Object.freeze({ key: "measure", title: "预警指标", acceptedTypes: Object.freeze(["number"] as const), required: true, multiple: false }),
  ]),
  propsSchema: MetricAlertPropsSchema,
  validateBinding: (binding: DataBinding | undefined) => {
    const dimension = requireSlot(binding, "dimension", "请选择一个预警维度");
    const measure = requireSlot(binding, "measure", "请选择一个预警指标");
    return { valid: dimension.valid && measure.valid, messages: [...dimension.messages, ...measure.messages] };
  },
});
