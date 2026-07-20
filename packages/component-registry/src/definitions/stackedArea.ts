import { z } from "zod";

import type { ComponentDefinition } from "../types.js";
import {
  TimeSeriesPropsSchema,
  timeSeriesDataSlots,
  validateTimeSeriesBinding,
} from "./line.js";

const StackedAreaPropsSchema = TimeSeriesPropsSchema.extend({ area: z.literal(true) });

export type StackedAreaProps = z.infer<typeof StackedAreaPropsSchema>;

export const stackedAreaDefinition: ComponentDefinition<StackedAreaProps> = Object.freeze({
  type: "stackedArea",
  title: "堆积面积图",
  category: "线/面积图",
  defaultLayout: Object.freeze({ w: 6, h: 5 }),
  createDefaults: (): StackedAreaProps => ({ color: "#1677ff", showLegend: true, smooth: true, area: true }),
  dataSlots: timeSeriesDataSlots,
  propsSchema: StackedAreaPropsSchema,
  validateBinding: validateTimeSeriesBinding,
});
