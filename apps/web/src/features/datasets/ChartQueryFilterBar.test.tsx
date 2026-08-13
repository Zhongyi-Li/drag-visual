// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { ChartQueryFilterBar } from "./ChartQueryFilterBar.js";

describe("ChartQueryFilterBar", () => {
  it("keeps edits local until apply, then clears non-date conditions on reset", () => {
    const onApply = vi.fn();
    const filters = [{ kind: "fieldText" as const, fieldKey: "product", operator: "contains" as const, value: "小米" }];
    render(<AppProviders><ChartQueryFilterBar filters={filters} fields={[{ key: "product", label: "商品", type: "string", nullable: false }]} onApply={onApply} /></AppProviders>);

    fireEvent.change(screen.getByRole("textbox", { name: "图表查询值1" }), { target: { value: "Redmi" } });
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "查询" }));
    expect(onApply).toHaveBeenLastCalledWith(
      [{ kind: "fieldText", fieldKey: "product", operator: "contains", value: "Redmi" }],
      [{ kind: "fieldText", fieldKey: "product", operator: "contains", value: "Redmi" }],
    );
    fireEvent.click(screen.getByRole("button", { name: /重\s*置/ }));
    expect(screen.getByRole("textbox", { name: "图表查询值1" })).toHaveValue("");
    expect(onApply).toHaveBeenLastCalledWith([], [{ kind: "fieldText", fieldKey: "product", operator: "contains", value: "" }]);
  });

  it("renders a control for every configured chart condition", () => {
    const filters = [
      { kind: "fieldText" as const, fieldKey: "product", operator: "contains" as const, value: "创维" },
      { kind: "fieldText" as const, fieldKey: "store", operator: "contains" as const, value: "华东" },
    ];
    render(<AppProviders><ChartQueryFilterBar filters={filters} fields={[
      { key: "product", label: "商品名称", type: "string", nullable: false },
      { key: "store", label: "店铺名称", type: "string", nullable: false },
    ]} onApply={vi.fn()} /></AppProviders>);

    expect(screen.getByText("商品名称")).toBeInTheDocument();
    expect(screen.getByText("店铺名称")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "图表查询值1" })).toHaveValue("创维");
    expect(screen.getByRole("textbox", { name: "图表查询值2" })).toHaveValue("华东");
  });
});
