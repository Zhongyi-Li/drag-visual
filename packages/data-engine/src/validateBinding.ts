import type { DataBinding, DatasetField } from "@drag-visual/contracts";

export type FieldDataType = DatasetField["type"];

export interface DataSlotDefinition {
  readonly key: string;
  readonly acceptedTypes: readonly FieldDataType[];
  readonly required: boolean;
  readonly multiple: boolean;
}

export interface BindingValidationResult {
  readonly valid: boolean;
  readonly messages: readonly string[];
}

const quotedTypes = (types: readonly FieldDataType[]): string =>
  types.map((type) => `"${type}"`).join(" or ");

export const validateBinding = (
  binding: DataBinding | undefined,
  fields: readonly DatasetField[],
  slots: readonly DataSlotDefinition[],
): BindingValidationResult => {
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
  const messages: string[] = [];

  for (const slot of slots) {
    const value = binding !== undefined && Object.hasOwn(binding.slots, slot.key)
      ? binding.slots[slot.key]
      : undefined;
    const boundFields = value === undefined ? [] : Array.isArray(value) ? value : [value];
    if (slot.required && boundFields.length === 0) {
      messages.push(`Required slot "${slot.key}" is not bound`);
      continue;
    }
    if (!slot.multiple && boundFields.length > 1) {
      messages.push(`Slot "${slot.key}" accepts only one field`);
    }
    for (const fieldBinding of boundFields) {
      const field = fieldsByKey.get(fieldBinding.fieldKey);
      if (field === undefined) {
        messages.push(`Field "${fieldBinding.fieldKey}" bound to slot "${slot.key}" does not exist`);
      } else if (!slot.acceptedTypes.includes(field.type)) {
        messages.push(
          `Field "${field.key}" has type "${field.type}" but slot "${slot.key}" accepts ${quotedTypes(slot.acceptedTypes)}`,
        );
      }
    }
  }

  const declaredSlotKeys = new Set(slots.map((slot) => slot.key));
  const unknownSlotKeys = Object.keys(binding?.slots ?? {})
    .filter((key) => !declaredSlotKeys.has(key))
    .sort();
  for (const key of unknownSlotKeys) {
    messages.push(`Binding contains unknown slot "${key}"`);
  }

  return { valid: messages.length === 0, messages };
};
