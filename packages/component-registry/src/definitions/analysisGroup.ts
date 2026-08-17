import { z } from "zod";
import { AnalysisGroupDateFilterControl, QueryFilterControl } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";

const AnalysisGroupPropsSchema = z.object({
  description: z.string().max(180),
  columns: z.number().int().min(2).max(12),
  gap: z.number().int().min(4).max(32),
  showSurface: z.boolean(),
  /** Shared, saved filters applied to every bound chart inside this group. */
  queryFilters: z.array(QueryFilterControl).max(6),
  /** Optional source-free date control whose targets are mapped to child charts. */
  dateFilter: AnalysisGroupDateFilterControl.nullable().default(null),
}).strict();

/**
 * A layout boundary for a business-analysis section. Child instances are
 * introduced by the editor rather than being baked into this definition.
 */
export const analysisGroupDefinition: ComponentDefinition<z.infer<typeof AnalysisGroupPropsSchema>> = Object.freeze({
  type: "analysisGroup",
  title: "复合分析",
  category: "内容",
  defaultLayout: Object.freeze({ w: 12, h: 9 }),
  createDefaults: (): z.infer<typeof AnalysisGroupPropsSchema> => ({
    description: "用于组织同一业务主题下的多个图表与明细。",
    columns: 12,
    gap: 12,
    showSurface: true,
    queryFilters: [],
    dateFilter: null,
  }),
  dataSlots: Object.freeze([]),
  propsSchema: AnalysisGroupPropsSchema,
  validateBinding: () => ({ valid: true, messages: [] }),
});
