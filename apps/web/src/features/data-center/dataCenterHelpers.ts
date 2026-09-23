import type { DatasetField } from "@drag-visual/contracts";

export const typeLabel: Record<DatasetField["type"], string> = { string: "文本", number: "数值", date: "日期", boolean: "布尔" };
export const previewParameters = (parameters: readonly { readonly key: string; readonly type: "string" | "number" | "date" | "boolean"; readonly required: boolean }[]) => Object.fromEntries(
  parameters.filter((parameter) => parameter.required).map((parameter) => [parameter.key, parameter.type === "number" ? 0 : parameter.type === "boolean" ? false : parameter.type === "date" ? "2026-01-01" : ""]),
);

