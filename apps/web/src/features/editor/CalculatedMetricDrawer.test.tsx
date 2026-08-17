// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { CalculatedMetricDrawer } from "./CalculatedMetricDrawer.js";

it("loads and saves an existing calculated metric without changing its id", () => {
  const onSave = vi.fn();
  render(<AppProviders><CalculatedMetricDrawer
    open
    fields={[
      { key: "price", label: "供货价", type: "number", nullable: false },
      { key: "freight", label: "物流费用", type: "number", nullable: false },
    ]}
    initialMetric={{
      id: "calculated-aaa",
      name: "aaa",
      tokens: [
        { kind: "metric", reference: { fieldKey: "price", aggregation: "sum" } },
        { kind: "operator", value: "+" },
        { kind: "metric", reference: { fieldKey: "freight", aggregation: "sum" } },
      ],
      format: "currency",
      decimals: 2,
      divideByZero: "dash",
    }}
    onClose={() => undefined}
    onSave={onSave}
  /></AppProviders>);

  expect(screen.getByRole("dialog", { name: "编辑计算指标" })).toBeTruthy();
  expect(screen.getByLabelText("指标名称")).toHaveValue("aaa");
  expect(screen.getByLabelText("供货价的聚合方式")).toBeTruthy();
  fireEvent.change(screen.getByLabelText("指标名称"), { target: { value: "采购成本" } });
  fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: "calculated-aaa", name: "采购成本" }));
});
