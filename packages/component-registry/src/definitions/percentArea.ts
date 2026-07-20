import { z } from "zod";

import type { ComponentDefinition } from "../types.js";
import {
  TimeSeriesPropsSchema,
  timeSeriesDataSlots,
  validateTimeSeriesBinding,
} from "./line.js";

const PercentAreaPropsSchema = TimeSeriesPropsSchema.extend({ area: z.literal(true) });

export type PercentAreaProps = z.infer<typeof PercentAreaPropsSchema>;

export const percentAreaDefinition: ComponentDefinition<PercentAreaProps> = Object.freeze({
  type: "percentArea",
  title: "百分比堆积面积图",
  category: "线/面积图",
  defaultLayout: Object.freeze({ w: 6, h: 5 }),
  createDefaults: (): PercentAreaProps => ({ color: "#1677ff", showLegend: true, smooth: true, area: true }),
  dataSlots: timeSeriesDataSlots,
  propsSchema: PercentAreaPropsSchema,
  validateBinding: validateTimeSeriesBinding,
});
