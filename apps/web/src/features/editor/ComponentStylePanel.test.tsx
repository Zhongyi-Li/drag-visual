// @vitest-environment jsdom

import { barDefinition, kpiDefinition } from "@drag-visual/component-registry";
import { DashboardSchema } from "@drag-visual/contracts";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { ComponentStylePanel } from "./ComponentStylePanel.js";
import { createEditorStore } from "./store/editorStore.js";

const dashboard = DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
  components: [{ id: "bar-1", type: "bar", title: "柱图", props: { color: "#1677ff", showLegend: true } }],
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
});

describe("ComponentStylePanel", () => {
  it("hides chart color and legend controls", () => {
    const store = createEditorStore(dashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><ComponentStylePanel store={store} component={component} definition={barDefinition} /></AppProviders>);

    expect(screen.queryByLabelText("主题颜色")).not.toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "显示图例" })).not.toBeInTheDocument();
    expect(store.getState().history.present.components[0]!.props).toEqual({ color: "#1677ff", showLegend: true });
  });

  it("supports numeric formatting controls for metric components", async () => {
    const kpiDashboard = DashboardSchema.parse({
      ...dashboard,
      components: [{ id: "bar-1", type: "kpi", title: "指标卡", props: { aggregation: "first", prefix: "", suffix: "", decimals: 0 } }],
    });
    const store = createEditorStore(kpiDashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><ComponentStylePanel store={store} component={component} definition={kpiDefinition} /></AppProviders>);

    const prefix = screen.getByRole("textbox", { name: "数值前缀" });
    await userEvent.type(prefix, "¥");
    const decimals = screen.getByRole("spinbutton", { name: "小数位数" });
    await userEvent.clear(decimals);
    await userEvent.type(decimals, "2");
    fireEvent.blur(decimals);

    expect(store.getState().history.present.components[0]!.props).toMatchObject({ prefix: "¥", decimals: 2 });
  });
});
