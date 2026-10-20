// @vitest-environment jsdom

import { DashboardSchema } from "@drag-visual/contracts";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  it("keeps theme appearance editable, preserves layout/images and supports undo", async () => {
    const image = "data:image/png;base64,ZmFrZQ==";
    const store = createEditorStore(DashboardSchema.parse({ ...dashboard, theme: { ...dashboard.theme, pageLayout: { backgroundImageEnabled: true, backgroundColorEnabled: false, backgroundImage: image, fixedWidth: 1800, widthMode: "fixed" }, dashboardBackground: { topVisible: true, topImage: image } } }));
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /仪表板主题/ }));
    await userEvent.click(screen.getByRole("tab", { name: "官方" }));
    await userEvent.click(screen.getByRole("button", { name: "科技仪表板主题" }));
    await userEvent.click(screen.getByRole("button", { name: /页面布局/ }));
    expect(screen.queryByRole("button", { name: "背景颜色" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "自适应" }));
    await userEvent.click(screen.getByRole("button", { name: /仪表板背景/ }));
    expect(screen.getByRole("button", { name: "背景颜色" })).not.toBeDisabled();
    expect(screen.getByLabelText("选择页面背景图片")).not.toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "整页背景图片" })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "背景颜色" }));
    await userEvent.click(await within(await screen.findByLabelText("背景颜色调色面板")).findByRole("button", { name: "选择颜色 #c58bf2" }));
    expect(store.getState().history.present.theme).toMatchObject({ preset: "technology", backgroundColor: "#c58bf2" });
    await userEvent.click(screen.getByRole("button", { name: "背景颜色" }));
    expect(store.getState().history.present.theme).toMatchObject({ preset: "technology", backgroundColor: "#c58bf2", borderRadiusStyle: "small", pageLayout: { backgroundImage: image, backgroundImageEnabled: true, backgroundColorEnabled: true, titleColor: "#dce8ff", titleTextAlign: "center", widthMode: "adaptive", fixedWidth: 1800 }, dashboardBackground: { topImage: image } });
    act(() => store.getState().undo());
    expect(store.getState().history.present.theme.backgroundColor).toBe("#2164df");
    act(() => store.getState().redo());
    expect(store.getState().history.present.theme.backgroundColor).toBe("#c58bf2");
  }, 20_000);
  it("applies official dashboard themes, keeps component overrides and preserves custom/undo state", async () => {
    const store = createEditorStore(DashboardSchema.parse({ ...dashboard, theme: { ...dashboard.theme, primaryColor: "#a18bfa", tableStyle: { colorScheme: "custom", customColor: "#36c99a" } } }));
    const view = render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /仪表板主题/ }));
    expect(screen.getByRole("tab", { name: "自定义" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "主题色" })).toHaveAttribute("data-color", "#a18bfa");
    await userEvent.click(screen.getByRole("tab", { name: "官方" }));
    expect(screen.getByRole("button", { name: "科技仪表板主题" })).toBeInTheDocument();
    for (const [label, file] of [["默认", "default"], ["深蓝", "deep-blue"], ["科技", "technology"], ["活动", "activity"]]) {
      expect(screen.getByRole("button", { name: `${label}仪表板主题` }).querySelector("img")).toHaveAttribute("src", `/theme-thumbnails/${file === "activity" ? "activity" : `${file}-${file === "technology" ? "v3" : "v2"}`}.png`);
    }
    expect(store.getState().history.present.theme.primaryColor).toBe("#a18bfa");
    for (const [label, preset, primaryColor] of [["默认", "default", "#1677ff"], ["深蓝", "deepBlue", "#38bdf8"], ["科技", "technology", "#427be0"], ["活动", "activity", "#ff7a18"]]) {
      await userEvent.click(screen.getByRole("button", { name: `${label}仪表板主题` }));
      await waitFor(() => expect(store.getState().history.present.theme).toMatchObject({ preset, primaryColor, mode: preset === "deepBlue" ? "dark" : "light" }));
      expect(store.getState().history.present.theme.chartPalette?.[0]).toBe(primaryColor);
      expect(store.getState().history.present.theme.tableStyle?.colorScheme).toBe("theme");
    }
    act(() => store.getState().undo());
    await waitFor(() => expect(screen.getByRole("button", { name: "科技仪表板主题" })).toHaveAttribute("aria-pressed", "true"));
    act(() => store.getState().redo());
    view.unmount();
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /仪表板主题/ }));
    expect(screen.getByRole("button", { name: "活动仪表板主题" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("tab", { name: "自定义" }));
    expect(screen.getByRole("button", { name: "主题色" })).toHaveAttribute("data-color", "#ff7a18");
    await userEvent.click(screen.getByRole("button", { name: "主题色" }));
    await userEvent.click(await within(await screen.findByLabelText("主题色调色面板")).findByRole("button", { name: "选择颜色 #a18bfa" }));
    await waitFor(() => expect(store.getState().history.present.theme).toMatchObject({ preset: "activity", primaryColor: "#a18bfa" }));
  }, 20_000);
  it("applies the activity background and clears only built-in decoration when switching themes", async () => {
    const store = createEditorStore(dashboard);
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /仪表板主题/ }));
    await userEvent.click(screen.getByRole("tab", { name: "官方" }));
    await userEvent.click(screen.getByRole("button", { name: "活动仪表板主题" }));
    expect(store.getState().history.present.theme).toMatchObject({ preset: "activity", borderRadiusStyle: "large", primaryColor: "#ff7a18", pageLayout: { backgroundImage: "/theme-backgrounds/activity.svg", backgroundImageEnabled: true, titleColor: "#ffffff", titleTextAlign: "center" } });
    await userEvent.click(screen.getByRole("button", { name: "默认仪表板主题" }));
    expect(store.getState().history.present.theme.pageLayout).toMatchObject({ backgroundImage: "", backgroundImageEnabled: false });
    act(() => store.getState().dispatch({ type: "dashboard.theme.update", nextTheme: DashboardSchema.parse({ ...dashboard, theme: { ...store.getState().history.present.theme, pageLayout: { ...store.getState().history.present.theme.pageLayout!, backgroundImage: "data:image/png;base64,ZmFrZQ==", backgroundImageEnabled: true } } }).theme }));
    await userEvent.click(screen.getByRole("button", { name: "活动仪表板主题" }));
    expect(store.getState().history.present.theme.pageLayout?.backgroundImage).toBe("data:image/png;base64,ZmFrZQ==");
  }, 20_000);
  it("supports independent header/body palettes, transparency, recent colors and reset", async () => {
    const store = createEditorStore(dashboard);
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /通用内容样式/ }));
    await userEvent.click(await screen.findByRole("button", { name: "表头文字颜色" }));
    await userEvent.click(await within(await screen.findByLabelText("表头调色面板")).findByRole("button", { name: "选择颜色 #a18bfa" }));
    fireEvent.change(screen.getByLabelText("表头文字透明度"), { target: { value: "50" } });
    fireEvent.pointerUp(screen.getByLabelText("表头文字透明度"));
    await waitFor(() => expect(store.getState().history.present.theme.tableStyle?.header).toMatchObject({ color: "#a18bfa", opacity: 0.5 }));
    await userEvent.click(screen.getByRole("button", { name: "内容文字颜色" }));
    await userEvent.click(await screen.findByRole("button", { name: "最近使用颜色 #a18bfa · 50%" }, { timeout: 5000 }));
    await waitFor(() => expect(store.getState().history.present.theme.tableStyle?.body.color).toBe("#a18bfa"));
    expect(store.getState().history.present.theme.tableStyle?.body.opacity).toBe(0.5);
    await userEvent.click(screen.getByRole("button", { name: "重置" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "最近使用颜色 #a18bfa · 50%" })).not.toBeInTheDocument());
    expect(store.getState().history.present.theme.tableStyle?.header.opacity).toBe(0.5);
  }, 15_000);
  it("hides color-scheme controls for the minimal preset without losing their saved values", async () => {
    const store = createEditorStore(dashboard);
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /通用内容样式/ }));
    await userEvent.click(screen.getByRole("radio", { name: "自定义" }));
    await userEvent.click(screen.getByRole("button", { name: "表格自定义配色" }));
    await userEvent.click(await within(await screen.findByLabelText("表格配色调色面板")).findByRole("button", { name: "选择颜色 #36c99a" }));
    await userEvent.click(screen.getByRole("button", { name: "表格自定义配色" }));
    await userEvent.click(screen.getByRole("button", { name: "极简表格样式" }));
    expect(screen.getByRole("button", { name: "表头加粗" })).toHaveAttribute("aria-pressed", "false");
    await waitFor(() => expect(screen.queryByRole("radiogroup", { name: "表格主色系" })).not.toBeInTheDocument());
    expect(screen.queryByLabelText("表格自定义配色")).not.toBeInTheDocument();
    expect(screen.getByLabelText("表头文字颜色")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "默认表格样式" }));
    expect(screen.getByLabelText("表格自定义配色")).toHaveAttribute("data-color", "#36c99a");
    await userEvent.click(screen.getByRole("button", { name: "线框表格样式" }));
    expect(screen.getByRole("button", { name: "表头加粗" })).toHaveAttribute("aria-pressed", "true");
  });
  it("saves table presets, colors and independent typography across remounts", async () => {
    const store = createEditorStore(dashboard);
    const first = render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /通用内容样式/ }));
    await userEvent.click(screen.getByRole("button", { name: "简版表格样式" }));
    await userEvent.click(screen.getByRole("radio", { name: "自定义" }));
    await userEvent.click(screen.getByRole("button", { name: "表格自定义配色" }));
    await userEvent.click(await within(await screen.findByLabelText("表格配色调色面板")).findByRole("button", { name: "选择颜色 #36c99a" }));
    await userEvent.click(screen.getByRole("button", { name: "表格自定义配色" }));
    await userEvent.click(screen.getByRole("button", { name: "表头文字颜色" }));
    await userEvent.click(await within(await screen.findByLabelText("表头调色面板")).findByRole("button", { name: "选择颜色 #a18bfa" }));
    await userEvent.click(screen.getByRole("button", { name: "表头文字颜色" }));
    await userEvent.click(screen.getByRole("button", { name: "内容加粗" }));
    await userEvent.click(screen.getByRole("button", { name: "表头斜体" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "内容字号" }), { target: { value: "16" } });
    expect(store.getState().history.present.theme.tableStyle).toMatchObject({
      preset: "simple", colorScheme: "custom", customColor: "#36c99a",
      header: { color: "#a18bfa", italic: true }, body: { bold: true, fontSize: 16 },
    });
    store.getState().undo();
    expect(store.getState().history.present.theme.tableStyle?.body.fontSize).toBe(12);
    store.getState().redo();
    expect(store.getState().history.present.theme.tableStyle?.body.fontSize).toBe(16);
    first.unmount();
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /通用内容样式/ }));
    expect(screen.getByRole("button", { name: "简版表格样式" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "内容加粗" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("spinbutton", { name: "内容字号" })).toHaveValue("16");
  });
  it("finds table settings by search and disables custom color for inherited schemes", async () => {
    const store = createEditorStore(dashboard);
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.type(screen.getByRole("textbox", { name: "搜索全局配置" }), "表头");
    expect(screen.getByText("通用内容样式")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /通用内容样式/ }));
    expect(screen.getByLabelText("表格自定义配色")).toBeDisabled();
  });
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
    await userEvent.type(await screen.findByRole("textbox", { name: "页尾文字" }), "内部经营资料");
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

  it("allows background color and image to be enabled independently", async () => {
    const store = createEditorStore(DashboardSchema.parse({ ...dashboard, theme: { ...dashboard.theme, pageLayout: { backgroundImage: "data:image/png;base64,ZmFrZQ==", backgroundImageEnabled: true } } }));
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /仪表板背景/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: "背景颜色" }));
    expect(store.getState().history.present.theme.pageLayout).toMatchObject({ backgroundColorEnabled: true, backgroundImageEnabled: true });
    await userEvent.click(screen.getByRole("checkbox", { name: "整页背景图片" }));
    expect(store.getState().history.present.theme.pageLayout).toMatchObject({ backgroundColorEnabled: true, backgroundImageEnabled: false });
  });

  it("shows a prominent size error for background images over 2 MB", async () => {
    const store = createEditorStore(dashboard);
    render(<AppProviders><DashboardSettingsPanel store={store} /></AppProviders>);
    await userEvent.click(screen.getByRole("button", { name: /仪表板背景/ }));

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
