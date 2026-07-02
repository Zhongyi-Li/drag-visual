import { describe, expect, it } from "vitest";

import { Dataset, DatasetQueryResult } from "./dataset";

const validDataset = () => ({
  id: "orders",
  name: "Orders",
  fields: [
    { key: "createdAt", label: "Created at", type: "date", nullable: false },
    { key: "total", label: "Total", type: "number", nullable: true },
  ],
  parameters: [
    { key: "region", label: "Region", type: "string", required: false },
  ],
  schemaVersion: "orders-v1",
});

const validResult = () => ({
  columns: validDataset().fields,
  rows: [{ createdAt: "2026-07-02", total: 42 }],
  total: 1,
  sampledAt: "2026-07-02T10:00:00.000Z",
});

describe("Dataset contracts", () => {
  it("parses a dataset schema and query rows", () => {
    expect(Dataset.parse(validDataset())).toEqual(validDataset());
    expect(DatasetQueryResult.parse(validResult())).toEqual(validResult());
  });

  it("rejects more than 10,000 rows", () => {
    expect(
      DatasetQueryResult.safeParse({
        ...validResult(),
        rows: Array.from({ length: 10_001 }, () => ({})),
      }).success,
    ).toBe(false);
  });

  it.each([
    {
      name: "field keys",
      schema: Dataset,
      value: {
        ...validDataset(),
        fields: [
          { key: "total", label: "Total", type: "number", nullable: false },
          { key: "total", label: "Duplicate", type: "number", nullable: true },
        ],
      },
      path: ["fields", 1, "key"],
    },
    {
      name: "parameter keys",
      schema: Dataset,
      value: {
        ...validDataset(),
        parameters: [
          { key: "region", label: "Region", type: "string", required: false },
          { key: "region", label: "Duplicate", type: "string", required: true },
        ],
      },
      path: ["parameters", 1, "key"],
    },
    {
      name: "result column keys",
      schema: DatasetQueryResult,
      value: {
        ...validResult(),
        columns: [
          { key: "total", label: "Total", type: "number", nullable: false },
          { key: "total", label: "Duplicate", type: "number", nullable: true },
        ],
      },
      path: ["columns", 1, "key"],
    },
  ])("rejects duplicate $name", ({ schema, value, path }) => {
    const result = schema.safeParse(value);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path })]),
      );
    }
  });

  it.each([
    ["sample timestamp", { sampledAt: "not-a-date" }],
    ["negative total", { total: -1 }],
  ])("rejects an invalid %s", (_name, override) => {
    expect(
      DatasetQueryResult.safeParse({ ...validResult(), ...override }).success,
    ).toBe(false);
  });
});
