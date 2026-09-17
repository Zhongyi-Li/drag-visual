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
    await userEvent.click(screen.getByRole("combobox", { name: "图表色系" }));
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

  it("configures page sizing, information regions and margins", async () => {
    const store = createEditorStore(dashboard);
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /页面布局/ }));

    await userEvent.click(screen.getByLabelText("适应窗口"));
    await userEvent.click(screen.getByRole("checkbox", { name: "页尾" }));
    await userEvent.click(await screen.findByRole("button", { name: "编辑页尾文字" }));
    await userEvent.type(screen.getByRole("textbox", { name: "页尾文字" }), "内部经营资料");
    await userEvent.click(screen.getByLabelText("固定"));
    fireEvent.change(screen.getByRole("spinbutton", { name: "固定页面宽度" }), { target: { value: "1600" } });
    await userEvent.click(screen.getByRole("combobox", { name: "页边距" }));
    await userEvent.click(await screen.findByText("超宽页面"));

    expect(store.getState().history.present.theme.pageLayout).toMatchObject({
      layoutMode: "fitViewport",
      footerVisible: true,
      footerText: "内部经营资料",
      widthMode: "fixed",
      fixedWidth: 1600,
      marginPreset: "wide",
    });
  });

  it("keeps footer input local until editing is committed", async () => {
    const store = createEditorStore(dashboard);
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /页面布局/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: "页尾" }));
    await userEvent.click(await screen.findByRole("button", { name: "编辑页尾文字" }));
    const footer = await screen.findByRole("textbox", { name: "页尾文字" });
    const historyAfterOpening = store.getState().history.past.length;

    await userEvent.type(footer, "输入过程不刷新画布");

    expect(footer).toHaveValue("输入过程不刷新画布");
    expect(store.getState().history.present.theme.pageLayout?.footerText).toBe("");
    expect(store.getState().history.past).toHaveLength(historyAfterOpening);

    fireEvent.blur(footer);
    expect(store.getState().history.present.theme.pageLayout?.footerText).toBe("输入过程不刷新画布");
    expect(store.getState().history.past).toHaveLength(historyAfterOpening + 1);
  });

  it("configures independent title and footer typography", async () => {
    const store = createEditorStore(dashboard);
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /页面布局/ }));

    await userEvent.click(screen.getByRole("button", { name: "编辑页面标题" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "页面标题文字大小" }), { target: { value: "30" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "页面标题字间距" }), { target: { value: "1.5" } });
    await userEvent.click(screen.getByRole("combobox", { name: "页面标题字体" }));
    const titleFontOptions = await screen.findAllByText("思源宋体");
    await userEvent.click(titleFontOptions.at(-1)!);

    expect(store.getState().history.present.theme.pageLayout).toMatchObject({
      titleFontSize: 30,
      titleFontFamily: "source-han-serif",
      titleLetterSpacing: 1.5,
    });

    await userEvent.click(screen.getByRole("button", { name: "编辑页面标题" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "页尾" }));
    await userEvent.click(screen.getByRole("button", { name: "编辑页尾文字" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "页尾文字大小" }), { target: { value: "14" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "页尾字间距" }), { target: { value: "2" } });
    await userEvent.click(screen.getByRole("combobox", { name: "页尾字体" }));
    const footerFontOptions = await screen.findAllByText("霞鹜文楷");
    await userEvent.click(footerFontOptions.at(-1)!);

    expect(store.getState().history.present.theme.pageLayout).toMatchObject({
      footerFontSize: 14,
      footerFontFamily: "lxgw-wenkai",
      footerLetterSpacing: 2,
    });
  }, 10_000);

  it("configures custom page margins with linked and independent sides", async () => {
    const store = createEditorStore(dashboard);
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /页面布局/ }));
    await userEvent.click(screen.getByRole("combobox", { name: "页边距" }));

    const customOptions = await screen.findAllByText(/自定义/);
    await userEvent.click(customOptions.find((option) => option.closest(".ant-select-item-option"))!);
    await userEvent.click(screen.getByRole("combobox", { name: "页边距" }));
    const topMargin = screen.getByRole("textbox", { name: "上边距" });
    fireEvent.change(topMargin, { target: { value: "40" } });
    fireEvent.blur(topMargin);

    expect(store.getState().history.present.theme.pageLayout).toMatchObject({
      marginPreset: "custom",
      customMargins: { top: 40, right: 12, bottom: 40, left: 12 },
    });

    await userEvent.click(screen.getByRole("button", { name: "锁定对称边距" }));
    const bottomMargin = screen.getByRole("textbox", { name: "下边距" });
    fireEvent.change(bottomMargin, { target: { value: "10" } });
    fireEvent.blur(bottomMargin);
    expect(store.getState().history.present.theme.pageLayout?.customMargins).toMatchObject({ top: 40, bottom: 10 });
  }, 10_000);

  it("exposes page background as mutually exclusive color and image choices", async () => {
    const store = createEditorStore(dashboard);
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /页面布局/ }));

    expect(screen.getByRole("radio", { name: /颜色/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: "图片" })).toBeDisabled();
    expect(screen.getByLabelText("页面背景颜色")).not.toBeDisabled();
  });

  it("shows a prominent size error for background images over 2 MB", async () => {
    const store = createEditorStore(dashboard);
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /页面布局/ }));

    const oversizedImage = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "large-background.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("选择页面背景图片"), { target: { files: [oversizedImage] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("最大支持 2 MB");
  });

  it("configures independent top and bottom dashboard background images", async () => {
    const store = createEditorStore(dashboard);
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /仪表板背景/ }));

    await userEvent.click(screen.getByRole("button", { name: "配置顶部图片" }));
    await userEvent.click(await screen.findByRole("button", { name: "使用蓝色光束" }));
    expect(store.getState().history.present.theme.dashboardBackground).toMatchObject({
      topVisible: true,
      topImage: "/images/dashboard-backgrounds/blue-cyan.png",
      bottomVisible: false,
    });

    await userEvent.click(screen.getByRole("button", { name: "配置底部图片" }));
    const customImageTabs = await screen.findAllByRole("tab", { name: "自定义图片" });
    await userEvent.click(customImageTabs.at(-1)!);
    await userEvent.type(screen.getByRole("textbox", { name: "仪表板背景图片地址" }), "https://example.com/footer.png");
    await userEvent.click(screen.getByRole("button", { name: /^使\s*用$/ }));
    expect(store.getState().history.present.theme.dashboardBackground).toMatchObject({
      bottomVisible: true,
      bottomImage: "https://example.com/footer.png",
    });
  }, 10_000);
});
