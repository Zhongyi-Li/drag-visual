import { describe, expect, it } from "vitest";

import { filterRowsByDateRange, resolveDateFilterPreset } from "./dateFilter.js";

const control = { fieldKey: "orderTime", defaultPreset: "all" as const, allowCustom: true, timezone: "Asia/Shanghai" as const };

describe("dateFilter", () => {
  it("resolves shortcut ranges in the configured timezone", () => {
    expect(resolveDateFilterPreset(control, "last7Days", new Date("2026-07-31T12:00:00Z"))).toMatchObject({
      start: "2026-07-25", end: "2026-07-31", fieldKey: "orderTime",
    });
  });

  it("filters local date and datetime rows inclusively", () => {
    expect(filterRowsByDateRange([
      { orderTime: "2026-07-01 08:00:00", amount: 1 },
      { orderTime: "2026-07-31", amount: 2 },
      { orderTime: "2026-08-01", amount: 3 },
    ], { kind: "dateRange", fieldKey: "orderTime", start: "2026-07-01", end: "2026-07-31", timezone: "Asia/Shanghai" })).toEqual([
      { orderTime: "2026-07-01 08:00:00", amount: 1 },
      { orderTime: "2026-07-31", amount: 2 },
    ]);
  });
});
