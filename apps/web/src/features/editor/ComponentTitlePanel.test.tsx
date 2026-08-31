// @vitest-environment jsdom

import { DashboardSchema } from "@drag-visual/contracts";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { ComponentTitlePanel } from "./ComponentTitlePanel.js";
import { createEditorStore } from "./store/editorStore.js";

it("persists display, size, and text styling for a chart title", async () => {
  const dashboard = DashboardSchema.parse({
    schemaVersion: 1,
    id: "123e4567-e89b-42d3-a456-426614174000",
    name: "销售分析",
    theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
    layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
    components: [{ id: "bar-1", type: "bar", title: "月度 GMV", props: { color: "#1677ff", showLegend: true } }],
    datasets: [],
    revision: 1,
    updatedAt: "2026-08-28T08:00:00.000Z",
  });
  const store = createEditorStore(dashboard);
  const component = store.getState().history.present.components[0]!;
  render(<AppProviders><ComponentTitlePanel component={component} store={store} /></AppProviders>);

  await userEvent.click(screen.getByRole("button", { name: "标题加粗" }));
  await userEvent.click(screen.getByRole("button", { name: "标题居中" }));
  fireEvent.change(screen.getByRole("spinbutton", { name: "标题字号" }), { target: { value: "18" } });
  await userEvent.click(screen.getByRole("switch", { name: "显示主标题" }));

  expect(store.getState().history.present.components[0]?.titleStyle).toEqual({
    visible: false,
    color: "#262626",
    fontSize: 18,
    fontWeight: "bold",
    fontStyle: "normal",
    textAlign: "center",
  });
});

it("saves a title once after the author finishes typing", () => {
  const dashboard = DashboardSchema.parse({
    schemaVersion: 1,
    id: "123e4567-e89b-42d3-a456-426614174000",
    name: "销售分析",
    theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
    layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
    components: [{ id: "bar-1", type: "bar", title: "月度 GMV", props: { color: "#1677ff", showLegend: true } }],
    datasets: [],
    revision: 1,
    updatedAt: "2026-08-28T08:00:00.000Z",
  });
  const store = createEditorStore(dashboard);
  const dispatch = vi.spyOn(store.getState(), "dispatch");
  const component = store.getState().history.present.components[0]!;
  render(<AppProviders><ComponentTitlePanel component={component} store={store} /></AppProviders>);

  const input = screen.getByRole("textbox", { name: "图表标题" });
  fireEvent.change(input, { target: { value: "测试复合分析图表" } });

  expect(dispatch).not.toHaveBeenCalled();
  expect(store.getState().history.present.components[0]?.title).toBe("月度 GMV");

  fireEvent.blur(input);

  expect(dispatch).toHaveBeenCalledTimes(1);
  expect(dispatch).toHaveBeenCalledWith({ type: "component.title.update", componentId: "bar-1", nextTitle: "测试复合分析图表" });
  expect(store.getState().history.present.components[0]?.title).toBe("测试复合分析图表");
});
