import type { Dashboard } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import {
  EditorCommandError,
  EditorHistoryError,
  canRedo,
  canUndo,
  createHistory,
  execute,
  redo,
  undo,
  type EditorCommand,
  type EditorHistory,
  type LayoutChangeCommand,
} from "./index.js";

const dashboard = (): Dashboard => ({
  schemaVersion: 1,
  id: "645615f9-cddb-468e-a11d-91b477a4e2ac",
  name: "Sales overview",
  theme: { primaryColor: "#3366FF", backgroundColor: "#FFFFFF" },
  layout: [{ i: "text-1", x: 0, y: 0, w: 2, h: 2 }],
  components: [{ id: "text-1", type: "text", props: { text: "hello" } }],
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-02T10:00:00.000Z",
});

const move = (x: number, y = 0): LayoutChangeCommand => ({
  type: "layout.change" as const,
  updates: [{ i: "text-1", x, y, w: 2, h: 2 }],
});

const historyOperations = (history: EditorHistory) => [
  () => execute(history, move(1)),
  () => undo(history),
  () => redo(history),
  () => canUndo(history),
  () => canRedo(history),
];

const expectInvalidHistory = (history: EditorHistory) => {
  for (const operation of historyOperations(history)) {
    expect(operation).toThrow(EditorHistoryError);
    try {
      operation();
    } catch (error) {
      expect((error as EditorHistoryError).code).toBe("INVALID_HISTORY");
    }
  }
};

describe("editor history", () => {
  it("creates an independent validated history with a default limit of 100", () => {
    const initial = dashboard();
    const history = createHistory(initial);

    expect(history).toEqual({ past: [], present: initial, future: [], limit: 100 });
    expect(history.present).not.toBe(initial);
    expect(history.present.components[0]!.props).not.toBe(
      initial.components[0]!.props,
    );
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid history limit %s",
    (limit) => {
      expect(() => createHistory(dashboard(), limit)).toThrow(RangeError);
    },
  );

  it("executes a command as exactly one history entry", () => {
    const initial = createHistory(dashboard());
    const next = execute(initial, {
      type: "layout.change",
      updates: [{ i: "text-1", x: 5, y: 6, w: 7, h: 8 }],
    });

    expect(next.past).toHaveLength(1);
    expect(next.past[0]).toBe(initial.present);
    expect(next.present.layout[0]).toEqual({
      i: "text-1",
      x: 5,
      y: 6,
      w: 7,
      h: 8,
    });
    expect(next.future).toEqual([]);
  });

  it("bounds past to the newest 100 snapshots exactly", () => {
    let history = createHistory(dashboard());
    for (let x = 1; x <= 105; x += 1) history = execute(history, move(x));

    expect(history.past).toHaveLength(100);
    expect(history.past[0]!.layout[0]!.x).toBe(5);
    expect(history.past[99]!.layout[0]!.x).toBe(104);
    expect(history.present.layout[0]!.x).toBe(105);
  });

  it("uses a custom positive integer limit", () => {
    let history = createHistory(dashboard(), 2);
    history = execute(history, move(1));
    history = execute(history, move(2));
    history = execute(history, move(3));

    expect(history.past.map((entry) => entry.layout[0]!.x)).toEqual([1, 2]);
  });

  it("undoes and redoes by moving immutable snapshots", () => {
    const initial = createHistory(dashboard());
    const executed = execute(initial, move(3));
    const undone = undo(executed);
    const redone = redo(undone);

    expect(canUndo(executed)).toBe(true);
    expect(canRedo(executed)).toBe(false);
    expect(undone.present).toBe(initial.present);
    expect(undone.future).toEqual([executed.present]);
    expect(canRedo(undone)).toBe(true);
    expect(redone.present).toBe(executed.present);
    expect(redone.past).toEqual([initial.present]);
  });

  it("returns the same history reference when undo or redo is unavailable", () => {
    const initial = createHistory(dashboard());

    expect(undo(initial)).toBe(initial);
    expect(redo(initial)).toBe(initial);
  });

  it("invalidates redo after executing from an undone state", () => {
    let history = createHistory(dashboard());
    history = execute(history, move(1));
    history = execute(history, move(2));
    history = undo(history);
    history = execute(history, move(9));

    expect(history.future).toEqual([]);
    expect(canRedo(history)).toBe(false);
    expect(history.present.layout[0]!.x).toBe(9);
  });

  it("leaves the entire history unchanged when a command fails", () => {
    const history = execute(createHistory(dashboard()), move(1));

    expect(() =>
      execute(history, {
        type: "component.remove",
        componentId: "missing",
      }),
    ).toThrow();
    expect(history.past).toHaveLength(1);
    expect(history.present.layout[0]!.x).toBe(1);
    expect(history.future).toEqual([]);
  });

  it("keeps historical snapshots independent from command-owned JSON", () => {
    const commandProps = { nested: { label: "after" } };
    const initial = createHistory(dashboard());
    const next = execute(initial, {
      type: "component.props.update",
      componentId: "text-1",
      nextProps: commandProps,
    });

    commandProps.nested.label = "mutated";
    expect(next.present.components[0]!.props).toEqual({
      nested: { label: "after" },
    });
    expect(next.past[0]!.components[0]!.props).toEqual({ text: "hello" });
    expect(next.present.components[0]!.props).not.toBe(commandProps);
  });

  it("deep-freezes snapshots, hostile own keys, arrays, and history containers", () => {
    const initial = dashboard();
    initial.components[0]!.props = JSON.parse(
      '{"__proto__":{"nested":[1]},"items":[{"value":"safe"}]}',
    ) as Dashboard["components"][number]["props"];
    const history = createHistory(initial);
    const props = history.present.components[0]!.props;

    expect(Object.isFrozen(history)).toBe(true);
    expect(Object.isFrozen(history.past)).toBe(true);
    expect(Object.isFrozen(history.future)).toBe(true);
    expect(Object.isFrozen(history.present)).toBe(true);
    expect(Object.isFrozen(history.present.components)).toBe(true);
    expect(Object.isFrozen(props)).toBe(true);
    expect(Object.isFrozen(props.__proto__)).toBe(true);
    expect(Object.isFrozen((props.__proto__ as { nested: unknown[] }).nested)).toBe(true);
    expect(Object.isFrozen(props.items)).toBe(true);
    expect(Object.isFrozen((props.items as unknown[])[0])).toBe(true);
  });

  it("prevents mutation after execute and undo from changing shared histories", () => {
    const original = createHistory(dashboard());
    const executed = execute(original, move(4));
    const undone = undo(executed);

    expect(() => {
      (undone.present.layout[0] as { x: number }).x = 99;
    }).toThrow(TypeError);
    expect(() => {
      (undone.future as Dashboard[]).push(dashboard());
    }).toThrow(TypeError);
    expect(original.present.layout[0]!.x).toBe(0);
    expect(executed.past[0]!.layout[0]!.x).toBe(0);
    expect(executed.present.layout[0]!.x).toBe(4);
    expect(undone.present.layout[0]!.x).toBe(0);
  });

  it("rejects forged invalid limits at every history operation", () => {
    const valid = createHistory(dashboard());
    const forged = { ...valid, limit: 0 } as EditorHistory;
    const invalidCommand = { type: "component.teleport" } as unknown as EditorCommand;

    for (const operation of [
      () => execute(forged, move(1)),
      () => undo(forged),
      () => redo(forged),
      () => canUndo(forged),
      () => canRedo(forged),
    ]) {
      expect(operation).toThrow(EditorHistoryError);
      try {
        operation();
      } catch (error) {
        expect((error as EditorHistoryError).code).toBe("INVALID_HISTORY");
      }
    }
    expect(() => execute(forged, invalidCommand)).toThrow(EditorHistoryError);
  });

  it("rejects an invalid forged past snapshot without altering the input", () => {
    const valid = createHistory(dashboard());
    const invalid = { ...dashboard(), id: "not-a-uuid" };
    const forged = {
      ...valid,
      past: [invalid],
    } as unknown as EditorHistory;

    expect(() => undo(forged)).toThrow(EditorHistoryError);
    expect(invalid.id).toBe("not-a-uuid");
    expect(forged.past[0]).toBe(invalid);
  });

  it("rejects an invalid forged future snapshot without altering the input", () => {
    const valid = createHistory(dashboard());
    const invalid = { ...dashboard(), id: "not-a-uuid" };
    const forged = {
      ...valid,
      future: [invalid],
    } as unknown as EditorHistory;

    expect(() => redo(forged)).toThrow(EditorHistoryError);
    expect(invalid.id).toBe("not-a-uuid");
    expect(forged.future[0]).toBe(invalid);
  });

  it("rejects a forged timeline whose combined history exceeds its limit", () => {
    const valid = createHistory(dashboard(), 2);
    const forged = {
      ...valid,
      past: [valid.present],
      future: [valid.present, valid.present],
    } as EditorHistory;

    expect(() => undo(forged)).toThrow(EditorHistoryError);
  });

  it("leaves protected history unchanged for a forged invalid command", () => {
    const history = execute(createHistory(dashboard()), move(1));
    const command = { type: "component.teleport" } as unknown as EditorCommand;

    try {
      execute(history, command);
      throw new Error("Expected command to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(EditorCommandError);
      expect((error as EditorCommandError).code).toBe("INVALID_COMMAND");
    }
    expect(history.present.layout[0]!.x).toBe(1);
    expect(history.past).toHaveLength(1);
    expect(history.future).toEqual([]);
  });

  it("rejects forged invalid present even when past and future are empty", () => {
    const valid = createHistory(dashboard());
    const forged = {
      ...valid,
      present: { ...dashboard(), id: "not-a-uuid" },
    } as unknown as EditorHistory;

    expectInvalidHistory(forged);
  });

  it("rejects forged invalid non-head past across every public operation", () => {
    let valid = createHistory(dashboard());
    valid = execute(valid, move(1));
    valid = execute(valid, move(2));
    const invalid = { ...dashboard(), id: "not-a-uuid" };
    const forged = {
      ...valid,
      past: [invalid, valid.past[1]],
    } as unknown as EditorHistory;

    expectInvalidHistory(forged);
  });

  it("rejects forged invalid non-head future across every public operation", () => {
    let valid = createHistory(dashboard());
    valid = execute(valid, move(1));
    valid = execute(valid, move(2));
    valid = undo(undo(valid));
    const invalid = { ...dashboard(), id: "not-a-uuid" };
    const forged = {
      ...valid,
      future: [valid.future[0], invalid],
    } as unknown as EditorHistory;

    expectInvalidHistory(forged);
  });

  it("rejects a structurally cloned otherwise-valid history", () => {
    const valid = execute(createHistory(dashboard()), move(1));
    const cloned = {
      ...valid,
      past: [...valid.past],
      future: [...valid.future],
    } as EditorHistory;

    expectInvalidHistory(cloned);
  });
});
