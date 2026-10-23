import { describe, expect, it } from "vitest";
import { Dataset } from "@drag-visual/contracts";
import { buildDatabaseQuery, normalizeDatabaseCell } from "./database-query.js";
import { quoteDatabaseIdentifier } from "./database-driver.js";

const dataset = Dataset.parse({ id: "database-test", name: "Sales", schemaVersion: "v1", parameters: [], fields: [
  { key: "region", label: "Region", type: "string", nullable: false },
  { key: "amount", label: "Amount", type: "number", nullable: true },
  { key: "day", label: "Day", type: "date", nullable: false },
] });

describe("database SQL", () => {
  it.each(["mysql", "postgresql"] as const)("binds values and quotes hostile identifiers for %s", (type) => {
    const attack = "x' OR 1=1 --";
    const result = buildDatabaseQuery(type, { schema: "public", name: 'a`b"c' }, dataset, { parameters: {}, filters: [{ kind: "fieldText", fieldKey: "region", value: attack, operator: "contains" }] });
    expect(result.sql).not.toContain(attack);
    expect(result.values).toEqual([attack.toLowerCase()]);
    expect(result.sql).toContain(quoteDatabaseIdentifier(type, 'a`b"c'));
    expect(result.sql).toContain("LIMIT 5001");
  });

  it("aggregates the full table in SQL after applying filters", () => {
    const result = buildDatabaseQuery("postgresql", { schema: "public", name: "sales" }, dataset, {
      parameters: {}, globalFilters: [{ kind: "dateRange", fieldKey: "day", start: "2026-01-01", end: "2026-01-31", timezone: "Asia/Shanghai" }],
      componentFilters: [{ kind: "numberComparison", fieldKey: "amount", operator: "gte", value: 10 }],
      aggregation: { groupBy: ["region"], measures: [{ fieldKey: "amount", aggregation: "sum" }] },
    });
    expect(result.sql).toContain('SUM("amount") AS "amount"');
    expect(result.sql).toContain('GROUP BY "region"');
    expect(result.sql).toContain('"amount" >= $3');
    expect(result.values).toEqual(["2026-01-01", "2026-01-31", 10]);
    expect(result.columns.map((field) => field.key)).toEqual(["region", "amount"]);
  });

  it("rejects unknown filter fields and aggregating strings", () => {
    expect(() => buildDatabaseQuery("mysql", { schema: "public", name: "sales" }, dataset, { parameters: {}, filters: [{ kind: "fieldValue", fieldKey: "secret", values: ["x"] }] })).toThrow();
    expect(() => buildDatabaseQuery("mysql", { schema: "public", name: "sales" }, dataset, { parameters: {}, aggregation: { groupBy: [], measures: [{ fieldKey: "region", aggregation: "sum" }] } })).toThrow();
  });

  it("normalizes driver-specific values without losing nulls", () => {
    expect(normalizeDatabaseCell("12.50", dataset.fields[1]!)).toBe(12.5);
    expect(normalizeDatabaseCell(null, dataset.fields[1]!)).toBeNull();
    expect(normalizeDatabaseCell(new Date("2026-01-01T00:00:00Z"), dataset.fields[2]!)).toBe("2026-01-01T00:00:00.000Z");
    expect(() => normalizeDatabaseCell("NaN", dataset.fields[1]!)).toThrow();
  });
});
