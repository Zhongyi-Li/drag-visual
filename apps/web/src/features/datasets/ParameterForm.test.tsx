// @vitest-environment jsdom

import type { QueryParameter } from "@drag-visual/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildQueryParameters, ParameterForm } from "./ParameterForm.js";

const parameters: readonly QueryParameter[] = [
  { key: "region", label: "区域", type: "string", required: false },
  { key: "year", label: "年份", type: "number", required: true },
  { key: "fromDate", label: "开始日期", type: "date", required: true },
  { key: "active", label: "启用", type: "boolean", required: false },
];

describe("buildQueryParameters", () => {
  it("omits blank optional values and ignores unknown parameters", () => {
    expect(buildQueryParameters(parameters, {
      region: "   ", year: 2026, fromDate: "2026-01-01", unknown: "secret",
    })).toEqual({ year: 2026, fromDate: "2026-01-01" });
  });

  it.each([undefined, null, ""])("rejects a missing required value (%s)", (year) => {
    expect(() => buildQueryParameters(parameters, { year, fromDate: "2026-01-01" })).toThrow(
      'Required parameter "year" is missing',
    );
  });

  it.each(["2026-02-29", "2026-01-01T00:00:00Z", "2026-1-1"])("rejects invalid date %s", (fromDate) => {
    expect(() => buildQueryParameters(parameters, { year: 2026, fromDate })).toThrow(
      'Parameter "fromDate" must be a valid YYYY-MM-DD date',
    );
  });

  it("preserves an explicitly selected boolean", () => {
    expect(buildQueryParameters(parameters, { year: 2026, fromDate: "2026-01-01", active: false }))
      .toEqual({ year: 2026, fromDate: "2026-01-01", active: false });
  });

  it("serializes hostile-looking known keys as safe own properties", () => {
    const hostileParameters: readonly QueryParameter[] = [
      { key: "__proto__", label: "Proto", type: "string", required: true },
      { key: "constructor", label: "Constructor", type: "number", required: true },
      { key: "prototype", label: "Prototype", type: "boolean", required: true },
    ];
    const values = JSON.parse(
      '{"__proto__":"safe","constructor":7,"prototype":false,"unknown":"drop"}',
    ) as Record<string, unknown>;

    const result = buildQueryParameters(hostileParameters, values);

    expect(Object.keys(result)).toEqual(["__proto__", "constructor", "prototype"]);
    expect(Object.hasOwn(result, "__proto__")).toBe(true);
    expect(JSON.stringify(result)).toBe('{"__proto__":"safe","constructor":7,"prototype":false}');
  });

  it("omits missing optional hostile-looking keys instead of reading Object.prototype", () => {
    const hostileParameters: readonly QueryParameter[] = [
      { key: "__proto__", label: "Proto", type: "string", required: false },
      { key: "constructor", label: "Constructor", type: "string", required: false },
      { key: "toString", label: "To string", type: "string", required: false },
    ];

    expect(buildQueryParameters(hostileParameters, {})).toEqual({});
  });

  it.each(["__proto__", "constructor", "toString"])(
    "treats a missing required hostile-looking key %s as missing",
    (key) => {
      expect(() => buildQueryParameters([
        { key, label: key, type: "string", required: true },
      ], {})).toThrow(`Required parameter "${key}" is missing`);
    },
  );
});

describe("ParameterForm", () => {
  it("generates controls from every parameter type", () => {
    render(<ParameterForm parameters={parameters} onSubmit={vi.fn()} />);
    expect(screen.getByRole("textbox", { name: "区域" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "年份" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "开始日期" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "启用" })).toBeInTheDocument();
  });
});
