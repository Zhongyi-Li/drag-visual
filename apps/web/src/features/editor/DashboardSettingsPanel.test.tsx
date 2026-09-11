// @vitest-environment jsdom

import { DashboardSchema } from "@drag-visual/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProviders } from "../../app/AppProviders.js";
import { describe, expect, it } from "vitest";

import { DashboardSettingsPanel } from "./DashboardSettingsPanel.js";
import { createEditorStore } from "./store/editorStore.js";

const dashboard = DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "样式测试",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [], components: [], datasets: [], revision: 1, updatedAt: "2026-07-03T08:00:00.000Z",
});

describe("DashboardSettingsPanel", () => {
  it("persists both states of the gradient toggle across remounts", async () => {
    const store = createEditorStore(dashboard);
    const first = render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /全局样式/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: "渐变色彩样式" }));
    expect(store.getState().history.present.theme.chartGradient).toBe(false);
    first.unmount();
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /全局样式/ }));
    expect(screen.getByRole("checkbox", { name: "渐变色彩样式" })).not.toBeChecked();
    await userEvent.click(screen.getByRole("checkbox", { name: "渐变色彩样式" }));
    expect(store.getState().history.present.theme.chartGradient).toBe(true);
  });
  it("switches mode and persists chart palette and semantic colors", async () => {
    const store = createEditorStore(dashboard);
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /全局样式/ }));
    await userEvent.click(screen.getByLabelText(/深色模式/));
    expect(store.getState().history.present.theme).toMatchObject({ mode: "dark", backgroundColor: "#0f172a" });
    await userEvent.click(screen.getAllByRole("combobox")[0]!);
    expect(await screen.findByText("分析属性")).toBeInTheDocument();
    expect(screen.getByText("场景属性")).toBeInTheDocument();
    expect(screen.getByText("色盲无障碍")).toBeInTheDocument();
    await userEvent.click(await screen.findByText("鲜明"));
    expect(store.getState().history.present.theme.chartPalette).toEqual(["#1677ff", "#19a7ce", "#f4c20d", "#f66d44", "#7b61ff", "#db3a7b"]);
  });

  it("opens custom palette controls and updates one swatch", async () => {
    const store = createEditorStore(dashboard);
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /全局样式/ }));
    await userEvent.click(screen.getByRole("button", { name: "自定义" }));
    const firstSwatch = await waitFor(() => {
      const swatch = document.querySelector<HTMLInputElement>('input[aria-label="自定义颜色 1"]');
      if (swatch === null) throw new Error("custom palette is not open");
      return swatch;
    });
    fireEvent.change(firstSwatch, { target: { value: "#112233" } });
    expect(store.getState().history.present.theme.chartPalette?.[0]).toBe("#112233");
  });
});
