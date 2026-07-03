import { z } from "zod";

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export type JsonPrimitive = null | string | number | boolean;
export type JsonValue = JsonPrimitive | JsonValue[] | JsonRecord;
export interface JsonRecord {
  [key: string]: JsonValue;
}

const INVALID = Symbol("invalid-json-value");

type ParseContext = Parameters<
  Parameters<ReturnType<typeof z.unknown>["transform"]>[0]
>[1];

const cloneJsonValue = (
  value: unknown,
  context: ParseContext,
  path: PropertyKey[],
  ancestors: WeakSet<object>,
): JsonValue | typeof INVALID => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (Number.isFinite(value)) return value;
    context.addIssue({ code: "custom", message: "Expected a finite JSON number", path });
    return INVALID;
  }
  if (typeof value !== "object") {
    context.addIssue({ code: "custom", message: "Expected a JSON value", path });
    return INVALID;
  }
  if (ancestors.has(value)) {
    context.addIssue({ code: "custom", message: "Circular JSON values are not supported", path });
    return INVALID;
  }

  ancestors.add(value);
  if (Array.isArray(value)) {
    const result: JsonValue[] = [];
    value.forEach((entry, index) => {
      const parsed = cloneJsonValue(entry, context, [...path, index], ancestors);
      if (parsed !== INVALID) result.push(parsed);
    });
    ancestors.delete(value);
    return result;
  }
  if (!isPlainRecord(value)) {
    ancestors.delete(value);
    context.addIssue({ code: "custom", message: "Expected a plain JSON object", path });
    return INVALID;
  }

  const result: JsonRecord = {};
  for (const [key, entry] of Object.entries(value)) {
    const parsed = cloneJsonValue(entry, context, [...path, key], ancestors);
    if (parsed !== INVALID) {
      Object.defineProperty(result, key, {
        value: parsed,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }
  ancestors.delete(value);
  return result;
};

export const safeRecord = <ValueSchema extends z.ZodType>(
  valueSchema: ValueSchema,
) =>
  z.unknown().transform((value, context) => {
    if (!isPlainRecord(value)) {
      context.addIssue({
        code: "custom",
        message: "Expected an object record",
      });
      return z.NEVER;
    }

    const result: Record<string, z.output<ValueSchema>> = {};
    for (const [key, entry] of Object.entries(value)) {
      const parsedEntry = valueSchema.safeParse(entry);
      if (!parsedEntry.success) {
        for (const issue of parsedEntry.error.issues) {
          context.addIssue({ ...issue, path: [key, ...issue.path] });
        }
        continue;
      }
      Object.defineProperty(result, key, {
        value: parsedEntry.data,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return result;
  });

export const safeJsonRecord = z.unknown().transform((value, context) => {
  if (!isPlainRecord(value)) {
    context.addIssue({ code: "custom", message: "Expected an object record" });
    return z.NEVER;
  }
  const result = cloneJsonValue(value, context, [], new WeakSet());
  return result === INVALID ? z.NEVER : (result as JsonRecord);
});
