import type { DataBinding, DatasetField } from "@drag-visual/contracts";
import { describe, expect, it } from "vitest";

import { validateBinding, type DataSlotDefinition } from "./validateBinding.js";

const fields: readonly DatasetField[] = [
  { key: "month", label: "月份", type: "string", nullable: false },
  { key: "revenue", label: "收入", type: "number", nullable: false },
  { key: "cost", label: "成本", type: "number", nullable: false },
];

const slots: readonly DataSlotDefinition[] = [
  { key: "dimension", acceptedTypes: ["string", "date"], required: false, multiple: false },
  { key: "measures", acceptedTypes: ["number"], required: true, multiple: true },
];

const binding = (slotValues: DataBinding["slots"]): DataBinding => ({
  datasetId: "sales",
  slots: slotValues,
});

describe("validateBinding", () => {
  it("reports a required slot with a stable message", () => {
    expect(validateBinding(binding({}), fields, slots)).toEqual({
      valid: false,
      messages: ['Required slot "measures" is not bound'],
    });
  });

  it("allows multiple fields only in a multiple slot", () => {
    expect(validateBinding(binding({
      dimension: [{ fieldKey: "month" }, { fieldKey: "month" }],
      measures: [{ fieldKey: "revenue" }, { fieldKey: "cost" }],
    }), fields, slots)).toEqual({
      valid: false,
      messages: ['Slot "dimension" accepts only one field'],
    });
  });

  it("reports missing fields and type mismatches in deterministic slot order", () => {
    expect(validateBinding(binding({
      dimension: { fieldKey: "revenue" },
      measures: [{ fieldKey: "missing" }, { fieldKey: "month" }],
    }), fields, slots)).toEqual({
      valid: false,
      messages: [
        'Field "revenue" has type "number" but slot "dimension" accepts "string" or "date"',
        'Field "missing" bound to slot "measures" does not exist',
        'Field "month" has type "string" but slot "measures" accepts "number"',
      ],
    });
  });

  it("rejects stale slot keys after validating declared slots", () => {
    expect(validateBinding(binding({
      measures: { fieldKey: "revenue" },
      staleMeasure: { fieldKey: "cost" },
    }), fields, slots)).toEqual({
      valid: false,
      messages: ['Binding contains unknown slot "staleMeasure"'],
    });
  });

  it("treats inherited hostile-looking required slots as missing", () => {
    const hostileSlots: readonly DataSlotDefinition[] = [
      { key: "constructor", acceptedTypes: ["number"], required: true, multiple: false },
      { key: "__proto__", acceptedTypes: ["number"], required: true, multiple: false },
    ];

    expect(validateBinding(binding({}), fields, hostileSlots)).toEqual({
      valid: false,
      messages: [
        'Required slot "constructor" is not bound',
        'Required slot "__proto__" is not bound',
      ],
    });
  });

  it("accepts hostile-looking slots when they are safe own properties", () => {
    const hostileSlots: readonly DataSlotDefinition[] = [
      { key: "constructor", acceptedTypes: ["number"], required: true, multiple: false },
      { key: "__proto__", acceptedTypes: ["number"], required: true, multiple: false },
    ];
    const ownSlots = JSON.parse(
      '{"constructor":{"fieldKey":"revenue"},"__proto__":{"fieldKey":"cost"}}',
    ) as DataBinding["slots"];

    expect(validateBinding(binding(ownSlots), fields, hostileSlots)).toEqual({
      valid: true,
      messages: [],
    });
  });
});
