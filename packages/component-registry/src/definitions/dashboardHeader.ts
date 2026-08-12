import { z } from "zod";
import { DashboardGlobalFilterConfig } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";

const DashboardHeaderPropsSchema = z.object({
  headline: z.string().max(80),
  description: z.string().max(180),
  updatedAt: z.string().max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateRange: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }).strict(),
  dateFieldKey: z.string().min(1).nullable(),
  globalFilters: z.array(DashboardGlobalFilterConfig).max(6),
}).strip();

export const dashboardHeaderDefinition: ComponentDefinition<z.infer<typeof DashboardHeaderPropsSchema>> = Object.freeze({
  type: "dashboardHeader",
  title: "看板信息栏",
  category: "内容",
  defaultLayout: Object.freeze({ w: 12, h: 3 }),
  createDefaults: (): z.infer<typeof DashboardHeaderPropsSchema> => ({
    headline: "经营数据看板",
    description: "用于快速掌握经营表现与关键指标。",
    updatedAt: "更新时间：2026-08-05 10:00",
    date: "2026-08-05",
    dateRange: { start: "2026-08-05", end: "2026-08-05" },
    dateFieldKey: null,
    globalFilters: [],
  }),
  dataSlots: Object.freeze([]),
  propsSchema: DashboardHeaderPropsSchema,
  validateBinding: () => ({ valid: true, messages: [] }),
});
