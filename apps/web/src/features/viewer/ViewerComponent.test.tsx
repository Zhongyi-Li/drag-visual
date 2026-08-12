// @vitest-environment jsdom

import { ComponentInstance } from "@drag-visual/contracts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ViewerComponent } from "./ViewerComponent.js";

it("applies global filters from an unbound dashboard header", async () => {
  const onGlobalFilterChange = vi.fn();
  const header = ComponentInstance.parse({
    id: "dashboard-header",
    type: "dashboardHeader",
    props: {
      headline: "经营数据看板",
      dateRange: { start: "2026-08-01", end: "2026-08-05" },
      globalFilters: [{
        id: "period",
        fieldKey: "orderTime",
        label: "统计周期",
        controlType: "dateRange",
        targets: [{ componentId: "orders", fieldKey: "orderTime" }],
      }],
    },
  });

  render(<ViewerComponent
    component={header}
    globalFilters={[{ id: "period", fieldKey: "orderTime", label: "统计周期", controlType: "dateRange", targets: [{ componentId: "orders", fieldKey: "orderTime" }] }]}
    globalFilterValues={{ period: { start: "2026-08-01", end: "2026-08-05" } }}
    onGlobalFilterChange={onGlobalFilterChange}
  />);

  await userEvent.click(screen.getByRole("button", { name: "应用筛选" }));

  expect(onGlobalFilterChange).toHaveBeenCalledWith("period", {
    start: "2026-08-01",
    end: "2026-08-05",
  });
});
