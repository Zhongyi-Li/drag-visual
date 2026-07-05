import { z } from "zod";

import type { ComponentDefinition } from "../types.js";

const TextPropsSchema = z.object({
  content: z.string(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  fontSize: z.number().int().min(12).max(72),
  fontWeight: z.enum(["normal", "bold"]),
  textAlign: z.enum(["left", "center", "right"]),
}).strict();

export const textDefinition: ComponentDefinition<z.infer<typeof TextPropsSchema>> = Object.freeze({
  type: "text",
  title: "文本",
  category: "内容",
  defaultLayout: Object.freeze({ w: 6, h: 2 }),
  createDefaults: (): z.infer<typeof TextPropsSchema> => ({ content: "文本内容", color: "#1f1f1f", fontSize: 16, fontWeight: "normal", textAlign: "left" }),
  dataSlots: Object.freeze([]),
  propsSchema: TextPropsSchema,
  validateBinding: () => ({ valid: true, messages: [] }),
});
