import { describe, expect, it } from "vitest";

import {
  Dataset,
  DatasetQueryRequest,
  DatasetQueryResult,
  DatasetSummary,
  ErrorResponse,
} from "./index.js";

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
  it("parses the precise dataset summary shape", () => {
    const summary: DatasetSummary = {
      id: "orders",
      name: "Orders",
      schemaVersion: "orders-v1",
    };

    expect(DatasetSummary.parse(summary)).toEqual(summary);
    expect(
      DatasetSummary.safeParse({ ...summary, upstreamUrl: "https://secret" })
        .success,
    ).toBe(false);
  });

  it("parses a strict stable error response", () => {
    const error = {
      code: "DATASET_QUERY_INVALID",
      message: "Dataset query is invalid",
    };

    expect(ErrorResponse.parse(error)).toEqual(error);
    expect(ErrorResponse.safeParse({ ...error, details: [] }).success).toBe(false);
    expect(
      ErrorResponse.safeParse({ code: "UNKNOWN_CODE", message: "Unknown" })
        .success,
    ).toBe(false);
  });

  it("parses a dataset schema and query rows", () => {
    expect(Dataset.parse(validDataset())).toEqual(validDataset());
    expect(DatasetQueryResult.parse(validResult())).toEqual(validResult());
  });

  it.each([
    ["dataset", Dataset, { ...validDataset(), extra: true }],
    [
      "field",
      Dataset,
      {
        ...validDataset(),
        fields: [{ ...validDataset().fields[0], extra: true }],
      },
    ],
    [
      "query parameter definition",
      Dataset,
      {
        ...validDataset(),
        parameters: [{ ...validDataset().parameters[0], extra: true }],
      },
    ],
    ["query request", DatasetQueryRequest, { parameters: {}, extra: true }],
    ["query result", DatasetQueryResult, { ...validResult(), extra: true }],
  ])("rejects unknown fields on fixed-shape %s objects", (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  it("safely preserves hostile own keys in query parameters", () => {
    const parameters = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":"constructor-value","prototype":"prototype-value"}',
    ) as Record<string, unknown>;

    const parsed = DatasetQueryRequest.parse({ parameters });

    expect(Object.hasOwn(parsed.parameters, "__proto__")).toBe(true);
    expect(parsed.parameters.__proto__).toEqual({ polluted: true });
    expect(parsed.parameters.constructor).toBe("constructor-value");
    expect(parsed.parameters.prototype).toBe("prototype-value");
    expect(Object.getPrototypeOf(parsed.parameters)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("safely preserves hostile own keys in every result row", () => {
    const row = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":"constructor-value","prototype":"prototype-value"}',
    ) as Record<string, unknown>;

    const parsed = DatasetQueryResult.parse({ ...validResult(), rows: [row] });
    const parsedRow = parsed.rows[0]!;

    expect(Object.hasOwn(parsedRow, "__proto__")).toBe(true);
    expect(parsedRow.__proto__).toEqual({ polluted: true });
    expect(parsedRow.constructor).toBe("constructor-value");
    expect(parsedRow.prototype).toBe("prototype-value");
    expect(Object.getPrototypeOf(parsedRow)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("safely preserves nested hostile keys in parameters and result rows", () => {
    const nested = JSON.parse(
      '{"filters":[{"__proto__":{"polluted":true},"constructor":"safe"}]}',
    ) as Record<string, unknown>;

    const request = DatasetQueryRequest.parse({ parameters: nested });
    const result = DatasetQueryResult.parse({
      ...validResult(),
      rows: [{ nested }],
    });
    const requestFilter = (request.parameters.filters as Array<Record<string, unknown>>)[0]!;
    const resultNested = result.rows[0]!.nested as Record<string, unknown>;
    const resultFilter = (resultNested.filters as Array<Record<string, unknown>>)[0]!;

    expect(Object.hasOwn(requestFilter, "__proto__")).toBe(true);
    expect(requestFilter.__proto__).toEqual({ polluted: true });
    expect(resultFilter.constructor).toBe("safe");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each([
    ["undefined", undefined],
    ["date object", new Date()],
    ["NaN", Number.NaN],
    ["infinity", Number.POSITIVE_INFINITY],
    ["bigint", 1n],
    ["function", () => undefined],
    ["symbol", Symbol("invalid")],
  ])("rejects nested non-JSON query values: %s", (_name, invalid) => {
    expect(
      DatasetQueryRequest.safeParse({
        parameters: { nested: { invalid } },
      }).success,
    ).toBe(false);
    expect(
      DatasetQueryResult.safeParse({
        ...validResult(),
        rows: [{ nested: { invalid } }],
      }).success,
    ).toBe(false);
  });

  it("rejects circular query parameters and rows", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(
      DatasetQueryRequest.safeParse({ parameters: circular }).success,
    ).toBe(false);
    expect(
      DatasetQueryResult.safeParse({ ...validResult(), rows: [circular] })
        .success,
    ).toBe(false);
  });

  it.each([
    ["array query parameters", DatasetQueryRequest, { parameters: [] }],
    ["date query parameters", DatasetQueryRequest, { parameters: new Date() }],
    ["array result row", DatasetQueryResult, { ...validResult(), rows: [[]] }],
    ["date result row", DatasetQueryResult, { ...validResult(), rows: [new Date()] }],
  ])("rejects invalid open-map container: %s", (_name, schema, value) => {
    expect(schema.safeParse(value).success).toBe(false);
  });

  it("rejects more than 10,000 rows", () => {
    expect(
      DatasetQueryResult.safeParse({
        ...validResult(),
        rows: Array.from({ length: 10_001 }, () => ({})),
      }).success,
    ).toBe(false);
  });

  it("accepts exactly 10,000 rows", () => {
    expect(
      DatasetQueryResult.safeParse({
        ...validResult(),
        rows: Array.from({ length: 10_000 }, () => ({})),
      }).success,
    ).toBe(true);
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
