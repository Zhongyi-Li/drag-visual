import type { DatasetCalculatedField, DatasetField, DatasetQueryResult } from "@drag-visual/contracts";

export type CalculatedFieldOperator = "+" | "-" | "*" | "/" | "percent";

export type CalculatedFieldDraft = DatasetCalculatedField;

const STORAGE_KEY = "drag-visual.data-center-calculated-fields.v1";

const readStore = (): Record<string, CalculatedFieldDraft[]> => {
  if (typeof window === "undefined") return {};
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).flatMap(([datasetId, fields]) => (
      Array.isArray(fields) ? [[datasetId, fields.filter((field): field is CalculatedFieldDraft => isCalculatedField(field))]] : []
    )));
  } catch {
    return {};
  }
};

const isCalculatedField = (value: unknown): value is CalculatedFieldDraft => {
  if (typeof value !== "object" || value === null) return false;
  const field = value as Record<string, unknown>;
  return typeof field.id === "string" && typeof field.label === "string"
    && typeof field.leftField === "string" && typeof field.rightField === "string"
    && ["+", "-", "*", "/", "percent"].includes(String(field.operator));
};

export const loadCalculatedFields = (datasetId: string): CalculatedFieldDraft[] => readStore()[datasetId] ?? [];

export const saveCalculatedFields = (datasetId: string, fields: readonly CalculatedFieldDraft[]): void => {
  if (typeof window === "undefined") return;
  const store = readStore();
  store[datasetId] = [...fields];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};

const numericValue = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const calculate = (left: number, operator: CalculatedFieldOperator, right: number): number | null => {
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "*") return left * right;
  if (operator === "percent") return right === 0 ? null : (left / right) * 100;
  return right === 0 ? null : left / right;
};

export const applyCalculatedFields = (
  result: DatasetQueryResult,
  fields: readonly CalculatedFieldDraft[],
): DatasetQueryResult => {
  if (fields.length === 0) return result;
  const knownFields = new Set(result.columns.map((field) => field.key));
  const validFields = fields.filter((field) => {
    if (!knownFields.has(field.leftField) || !knownFields.has(field.rightField) || knownFields.has(field.id)) return false;
    knownFields.add(field.id);
    return true;
  });
  const columns: DatasetField[] = [
    ...result.columns,
    ...validFields.map((field) => ({ key: field.id, label: field.label, type: "number" as const, nullable: true })),
  ];
  const rows = result.rows.map((row) => validFields.reduce<DatasetQueryResult["rows"][number]>((nextRow, field) => {
    const left = numericValue(nextRow[field.leftField]);
    const right = numericValue(nextRow[field.rightField]);
    return { ...nextRow, [field.id]: left === null || right === null ? null : calculate(left, field.operator, right) };
  }, { ...row }));
  return { ...result, columns, rows };
};
