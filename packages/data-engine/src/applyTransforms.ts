import type { DataBinding, DatasetField } from "@drag-visual/contracts";

type Row = Readonly<Record<string, unknown>>;

const compareValues = (left: unknown, right: unknown, type: DatasetField["type"] | undefined): number => {
  if (left === right) return 0;
  if (left === null || left === undefined) return 1;
  if (right === null || right === undefined) return -1;
  if (type === "number" && typeof left === "number" && typeof right === "number") return left - right;
  if (type === "boolean" && typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
  return String(left) < String(right) ? -1 : 1;
};

export const applyTransforms = <T extends Row>(
  rows: readonly T[],
  binding: DataBinding | undefined,
  fields: readonly DatasetField[] = [],
): T[] => {
  const transformed = [...rows];
  if (binding?.sort !== undefined) {
    const { fieldKey, direction } = binding.sort;
    const field = fields.find((candidate) => candidate.key === fieldKey);
    const multiplier = direction === "asc" ? 1 : -1;
    transformed.sort((left, right) => compareValues(left[fieldKey], right[fieldKey], field?.type) * multiplier);
  }
  return binding?.limit === undefined ? transformed : transformed.slice(0, binding.limit);
};
