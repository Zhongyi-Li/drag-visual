import type { DataBinding, DatasetField } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import { applyTransforms } from "./applyTransforms.js";

const fields: readonly DatasetField[] = [
  { key: "name", label: "名称", type: "string", nullable: false },
  { key: "amount", label: "金额", type: "number", nullable: false },
  { key: "day", label: "日期", type: "date", nullable: false },
];

const transform = (fieldKey: string, direction: "asc" | "desc", limit?: number): DataBinding => ({
  datasetId: "sales",
  slots: {},
  sort: { fieldKey, direction },
  ...(limit === undefined ? {} : { limit }),
});

describe("applyTransforms", () => {
  it("sorts numbers without mutating the input and applies Top N", () => {
    const rows = [{ amount: 12 }, { amount: 3 }, { amount: 20 }];
    const before = structuredClone(rows);

    const result = applyTransforms(rows, transform("amount", "desc", 2), fields);

    expect(result).toEqual([{ amount: 20 }, { amount: 12 }]);
    expect(rows).toEqual(before);
    expect(result).not.toBe(rows);
  });

  it.each([
    ["name", "asc", [{ name: "A" }, { name: "B" }, { name: "C" }]],
    ["day", "desc", [{ day: "2026-12-01" }, { day: "2026-02-10" }, { day: "2026-01-15" }]],
  ] as const)("sorts %s values in declared order", (fieldKey, direction, expected) => {
    const input = [...expected].reverse();
    expect(applyTransforms(input, transform(fieldKey, direction), fields)).toEqual(expected);
  });

  it("keeps equal values in their original order", () => {
    const rows = [{ id: "first", amount: 2 }, { id: "second", amount: 2 }];
    expect(applyTransforms(rows, transform("amount", "asc"), fields)).toEqual(rows);
  });
});
