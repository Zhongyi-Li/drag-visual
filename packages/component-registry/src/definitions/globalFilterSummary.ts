import { z } from "zod";

import type { ComponentDefinition } from "../types.js";

/** A compact card that mirrors the current value of a dashboard-header filter. */
const GlobalFilterSummaryPropsSchema = z.object({
  /** Retained for dashboards saved before multiple filter summaries were supported. */
  filterId: z.string().max(80),
  filterIds: z.array(z.string().min(1).max(80)).max(6).default([]),
  label: z.string().min(1).max(40),
  emptyValue: z.string().min(1).max(80),
  description: z.string().max(120),
}).strict();

export const globalFilterSummaryDefinition: ComponentDefinition<z.infer<typeof GlobalFilterSummaryPropsSchema>> = Object.freeze({
  type: "globalFilterSummary",
  title: "全局筛选摘要",
  category: "内容",
  defaultLayout: Object.freeze({ w: 3, h: 3 }),
  createDefaults: (): z.infer<typeof GlobalFilterSummaryPropsSchema> => ({
    filterId: "",
    filterIds: [],
    label: "当前筛选",
    emptyValue: "全部范围",
    description: "",
  }),
  dataSlots: Object.freeze([]),
  propsSchema: GlobalFilterSummaryPropsSchema,
  validateBinding: () => ({ valid: true, messages: [] }),
});
