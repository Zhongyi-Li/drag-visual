import { z } from "zod";

import type { ComponentDefinition } from "../types.js";
import {
  TimeSeriesPropsSchema,
  timeSeriesDataSlots,
  validateTimeSeriesBinding,
} from "./line.js";

const AreaPropsSchema = TimeSeriesPropsSchema.extend({ area: z.literal(true) });

export type AreaProps = z.infer<typeof AreaPropsSchema>;

export const areaDefinition: ComponentDefinition<AreaProps> = Object.freeze({
  type: "area",
  title: "面积图",
  category: "线/面积图",
  defaultLayout: Object.freeze({ w: 6, h: 5 }),
  createDefaults: (): AreaProps => ({ color: "#1677ff", showLegend: true, smooth: true, area: true }),
  dataSlots: timeSeriesDataSlots,
  propsSchema: AreaPropsSchema,
  validateBinding: validateTimeSeriesBinding,
});
