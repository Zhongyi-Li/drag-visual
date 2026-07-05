import type { ComponentInstance } from "@drag-visual/contracts";
import { expect, it } from "vitest";

import { buildBarOption } from "./options.js";

it("builds a 10k-row bar option within the local median baseline", () => {
  const component: ComponentInstance = {
    id: "bar-benchmark",
    type: "bar",
    title: "基准",
    props: { color: "#1677ff", showLegend: false },
    binding: {
      datasetId: "benchmark",
      slots: {
        dimension: { fieldKey: "category" },
        measure: { fieldKey: "value" },
      },
    },
  };
  const rows = Array.from({ length: 10_000 }, (_, index) => ({ category: `C${index}`, value: index }));
  const durations = Array.from({ length: 5 }, () => {
    const started = performance.now();
    const option = buildBarOption(component, rows);
    expect(option.series[0]?.data).toHaveLength(10_000);
    return performance.now() - started;
  }).sort((left, right) => left - right);

  expect(durations[2]).toBeLessThan(100);
});
