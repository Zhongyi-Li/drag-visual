import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";

import type { EditorCommand } from "./commands.js";
import { applyCommand } from "./reducer.js";

export type DeepReadonly<Value> =
  Value extends (...args: never[]) => unknown
    ? Value
    : Value extends readonly (infer Item)[]
      ? readonly DeepReadonly<Item>[]
      : Value extends object
        ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
        : Value;

export type DashboardSnapshot = DeepReadonly<Dashboard>;

export type EditorHistoryErrorCode = "INVALID_HISTORY";

export class EditorHistoryError extends RangeError {
  readonly code: EditorHistoryErrorCode;

  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "EditorHistoryError";
    this.code = "INVALID_HISTORY";
  }
}

export interface EditorHistory {
  readonly past: readonly DashboardSnapshot[];
  readonly present: DashboardSnapshot;
  readonly future: readonly DashboardSnapshot[];
  readonly limit: number;
}

const protectedSnapshots = new WeakSet<object>();
const protectedHistories = new WeakSet<object>();

const deepFreeze = <Value>(value: Value): DeepReadonly<Value> => {
  if (typeof value !== "object" || value === null) {
    return value as DeepReadonly<Value>;
  }
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return Object.freeze(value) as DeepReadonly<Value>;
};

const protectParsedSnapshot = (dashboard: Dashboard): DashboardSnapshot => {
  const snapshot = deepFreeze(dashboard);
  protectedSnapshots.add(snapshot);
  return snapshot;
};

const protectSnapshot = (candidate: unknown): DashboardSnapshot => {
  if (
    typeof candidate === "object" &&
    candidate !== null &&
    protectedSnapshots.has(candidate)
  ) {
    return candidate as DashboardSnapshot;
  }
  try {
    return protectParsedSnapshot(DashboardSchema.parse(candidate));
  } catch (cause) {
    throw new EditorHistoryError(
      "History contains an invalid dashboard snapshot",
      cause,
    );
  }
};

const assertValidLimit: (limit: unknown) => asserts limit is number = (limit) => {
  if (!Number.isInteger(limit) || (limit as number) <= 0) {
    throw new EditorHistoryError("History limit must be a positive integer");
  }
};

const assertHistoryShape: (history: EditorHistory) => void = (history) => {
  if (
    typeof history !== "object" ||
    history === null ||
    !protectedHistories.has(history)
  ) {
    throw new EditorHistoryError("History was not produced by editor-core");
  }
  assertValidLimit(history.limit);
  if (!Array.isArray(history.past) || !Array.isArray(history.future)) {
    throw new EditorHistoryError("History past and future must be arrays");
  }
  if (history.past.length + history.future.length > history.limit) {
    throw new EditorHistoryError("History exceeds its configured limit");
  }
};

const makeHistory = (
  past: readonly DashboardSnapshot[],
  present: DashboardSnapshot,
  future: readonly DashboardSnapshot[],
  limit: number,
): EditorHistory => {
  const history: EditorHistory = Object.freeze({
    past: Object.freeze([...past]),
    present,
    future: Object.freeze([...future]),
    limit,
  });
  protectedHistories.add(history);
  return history;
};

export const createHistory = (
  initial: Dashboard,
  limit = 100,
): EditorHistory => {
  assertValidLimit(limit);
  return makeHistory([], protectSnapshot(initial), [], limit);
};

export const execute = (
  history: EditorHistory,
  command: EditorCommand,
): EditorHistory => {
  assertHistoryShape(history);
  const current = protectSnapshot(history.present);
  const present = protectParsedSnapshot(
    applyCommand(current as Dashboard, command),
  );
  return makeHistory(
    [...history.past, current].slice(-history.limit),
    present,
    [],
    history.limit,
  );
};

export const undo = (history: EditorHistory): EditorHistory => {
  assertHistoryShape(history);
  const candidate = history.past.at(-1);
  if (!candidate) return history;
  const present = protectSnapshot(candidate);
  const current = protectSnapshot(history.present);
  return makeHistory(
    history.past.slice(0, -1),
    present,
    [current, ...history.future],
    history.limit,
  );
};

export const redo = (history: EditorHistory): EditorHistory => {
  assertHistoryShape(history);
  const [candidate, ...future] = history.future;
  if (!candidate) return history;
  const present = protectSnapshot(candidate);
  const current = protectSnapshot(history.present);
  return makeHistory(
    [...history.past, current].slice(-history.limit),
    present,
    future,
    history.limit,
  );
};

export const canUndo = (history: EditorHistory): boolean => {
  assertHistoryShape(history);
  return history.past.length > 0;
};

export const canRedo = (history: EditorHistory): boolean => {
  assertHistoryShape(history);
  return history.future.length > 0;
};
