import { describe, expect, it } from "vitest";

import { applyCalculatedFields } from "./calculatedFields.js";

describe("applyCalculatedFields", () => {
  it("adds calculated columns without changing the source rows", () => {
    const source = {
      columns: [
        { key: "sales", label: "销售额", type: "number" as const, nullable: false },
        { key: "cost", label: "成本", type: "number" as const, nullable: false },
      ],
      rows: [{ sales: 120, cost: 70 }, { sales: 10, cost: 0 }],
      sampledAt: "2026-09-18T00:00:00.000Z",
    };
    const result = applyCalculatedFields(source, [{ id: "profit", label: "利润", leftField: "sales", operator: "-", rightField: "cost" }]);
    expect(result.columns.at(-1)).toMatchObject({ key: "profit", label: "利润", type: "number" });
    expect(result.rows).toEqual([{ sales: 120, cost: 70, profit: 50 }, { sales: 10, cost: 0, profit: 10 }]);
    expect(source.rows).toEqual([{ sales: 120, cost: 70 }, { sales: 10, cost: 0 }]);
  });

  it("returns null for division by zero or missing values", () => {
    const source = {
      columns: [{ key: "a", label: "A", type: "number" as const, nullable: true }, { key: "b", label: "B", type: "number" as const, nullable: true }],
      rows: [{ a: 5, b: 0 }, { a: null, b: 2 }], sampledAt: "2026-09-18T00:00:00.000Z",
    };
    const result = applyCalculatedFields(source, [{ id: "ratio", label: "比率", leftField: "a", operator: "/", rightField: "b" }]);
    expect(result.rows.map((row) => row.ratio)).toEqual([null, null]);
  });

  it("supports percentage calculations", () => {
    const source = {
      columns: [{ key: "profit", label: "利润", type: "number" as const, nullable: false }, { key: "sales", label: "销售额", type: "number" as const, nullable: false }],
      rows: [{ profit: 25, sales: 100 }, { profit: 5, sales: 0 }], sampledAt: "2026-09-18T00:00:00.000Z",
    };
    const result = applyCalculatedFields(source, [{ id: "margin", label: "利润率", leftField: "profit", operator: "percent", rightField: "sales" }]);
    expect(result.rows.map((row) => row.margin)).toEqual([25, null]);
  });

  it("evaluates calculated fields in order so later fields can reuse earlier results", () => {
    const source = {
      columns: [{ key: "sales", label: "销售额", type: "number" as const, nullable: false }, { key: "cost", label: "成本", type: "number" as const, nullable: false }],
      rows: [{ sales: 120, cost: 80 }], sampledAt: "2026-09-18T00:00:00.000Z",
    };
    const result = applyCalculatedFields(source, [
      { id: "profit", label: "利润", leftField: "sales", operator: "-", rightField: "cost" },
      { id: "margin", label: "利润率", leftField: "profit", operator: "percent", rightField: "sales" },
    ]);
    expect(result.rows[0]?.profit).toBe(40);
    expect(result.rows[0]?.margin).toBeCloseTo(100 / 3);
  });
});
