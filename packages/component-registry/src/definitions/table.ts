import { z } from "zod";
import type { DataBinding } from "@drag-visual/contracts";

import type { ComponentDefinition } from "../types.js";
import { requireSlot } from "./helpers.js";

const TablePropsSchema = z.object({
  pageSize: z.number().int().min(1).max(100),
  striped: z.boolean(),
}).strict();

export const tableDefinition: ComponentDefinition<z.infer<typeof TablePropsSchema>> = Object.freeze({
  type: "table",
  title: "明细表",
  category: "表格",
  defaultLayout: Object.freeze({ w: 9, h: 6 }),
  createDefaults: (): z.infer<typeof TablePropsSchema> => ({ pageSize: 20, striped: false }),
  dataSlots: Object.freeze([
    Object.freeze({ key: "columns", title: "字段", acceptedTypes: Object.freeze(["string", "number", "date", "boolean"] as const), required: true, multiple: true }),
  ]),
  propsSchema: TablePropsSchema,
  validateBinding: (binding: DataBinding | undefined) => requireSlot(binding, "columns", "请选择至少一个字段", { multiple: true }),
});
