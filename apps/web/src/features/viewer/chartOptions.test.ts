import { expect, it } from "vitest";

import { buildBarOption } from "./chartOptions.js";

it("builds a 10k-row bar option within the agreed baseline", () => {
  const rows = Array.from({ length: 10_000 }, (_, index) => ({ category: `C${index}`, value: index }));
  const started = performance.now();

  const option = buildBarOption({
    rows,
    dimension: "category",
    measure: "value",
    props: { title: "基准", color: "#1677ff", showLegend: false },
  });

  expect(option.xAxis.data).toHaveLength(10_000);
  expect(performance.now() - started).toBeLessThan(100);
});
