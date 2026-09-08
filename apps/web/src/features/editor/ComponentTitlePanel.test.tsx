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
  await userEvent.click(screen.getByRole("checkbox", { name: "显示主标题" }));

  expect(store.getState().history.present.components[0]?.titleStyle).toEqual({
    visible: false,
    color: "#262626",
    fontSize: 18,
    fontWeight: "bold",
    fontStyle: "normal",
    textAlign: "center",
  });
});

it("persists dimension, metric name, and metric value typography", async () => {
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

  fireEvent.change(screen.getByRole("spinbutton", { name: "数值字号" }), { target: { value: "20" } });
  await userEvent.click(screen.getByRole("button", { name: "名称加粗" }));
  await userEvent.click(screen.getByRole("button", { name: "维度斜体" }));

  expect(store.getState().history.present.components[0]?.fieldStyle).toEqual({
    enabled: true,
    dimension: { color: "#475569", fontSize: 12, fontWeight: "normal", fontStyle: "italic" },
    metricName: { color: "#475569", fontSize: 12, fontWeight: "bold", fontStyle: "normal" },
    metricValue: { color: "#0F172A", fontSize: 20, fontWeight: "normal", fontStyle: "normal" },
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

it("persists a custom background fill for the component card", async () => {
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

  await userEvent.click(screen.getByRole("checkbox", { name: "自定义背景填充" }));
  const borderRadius = screen.getByRole("spinbutton", { name: "卡片圆角" });
  fireEvent.change(borderRadius, { target: { value: "12" } });
  fireEvent.blur(borderRadius);

  expect(store.getState().history.present.components[0]?.containerStyle).toEqual({
    customBackground: true,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
  });
});

it("clamps a card border radius above 32px", () => {
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

  const borderRadius = screen.getByRole("spinbutton", { name: "卡片圆角" });
  fireEvent.change(borderRadius, { target: { value: "48" } });
  fireEvent.blur(borderRadius);

  expect(borderRadius).toHaveValue("32");
  expect(store.getState().history.present.components[0]?.containerStyle).toEqual({
    customBackground: false,
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
  });
});

it("persists each configured card padding side after editing", () => {
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

  const topPadding = screen.getByRole("spinbutton", { name: "卡片内边距上" });
  fireEvent.change(topPadding, { target: { value: "20" } });
  fireEvent.blur(topPadding);

  expect(store.getState().history.present.components[0]?.containerStyle?.padding).toEqual({ top: 20, right: 0, bottom: 0, left: 0 });
});
