import { z } from "zod";

import type { ComponentDefinition } from "../types.js";
import {
  TimeSeriesPropsSchema,
  timeSeriesDataSlots,
  validateTimeSeriesBinding,
} from "./line.js";

const PercentBarPropsSchema = TimeSeriesPropsSchema.extend({ area: z.literal(true) });

export type PercentBarProps = z.infer<typeof PercentBarPropsSchema>;

export const percentBarDefinition: ComponentDefinition<PercentBarProps> = Object.freeze({
  type: "percentBar",
  title: "百分比堆积柱图",
  category: "柱/条图",
  defaultLayout: Object.freeze({ w: 6, h: 5 }),
  createDefaults: (): PercentBarProps => ({ color: "#1677ff", showLegend: true, smooth: true, area: true }),
  dataSlots: timeSeriesDataSlots,
  propsSchema: PercentBarPropsSchema,
  validateBinding: validateTimeSeriesBinding,
});
