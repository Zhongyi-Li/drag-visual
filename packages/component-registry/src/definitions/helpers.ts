import type { DataBinding } from "@drag-visual/contracts";

export const bindingCount = (binding: DataBinding | undefined, slot: string): number => {
  const value = binding?.slots[slot];
  if (value === undefined) return 0;
  return Array.isArray(value) ? value.length : 1;
};

export const requireSlot = (
  binding: DataBinding | undefined,
  slot: string,
  message: string,
  options: { multiple?: boolean } = {},
) => {
  const count = bindingCount(binding, slot);
  const valid = options.multiple ? count >= 1 : count === 1;
  return { valid, messages: valid ? [] : [message] } as const;
};
