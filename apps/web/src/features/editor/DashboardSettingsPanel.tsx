import { BorderOutlined, DeleteOutlined, FormOutlined, FullscreenOutlined, LockOutlined, PictureOutlined, SearchOutlined, UnlockOutlined } from "@ant-design/icons";
import { DashboardBackground, DashboardPageLayout, type Dashboard } from "@drag-visual/contracts";
import { Alert, Button, Checkbox, Collapse, Empty, Input, InputNumber, Popover, Radio, Select, Tooltip, Typography } from "antd";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useStore } from "zustand";

import { DashboardBackgroundPicker, DashboardBackgroundThumbnail } from "./DashboardBackgroundPanel.js";
import { editorSelectors, type EditorStore } from "./store/editorStore.js";

interface DashboardSettingsPanelProps {
  readonly store: EditorStore;
}

interface GlobalSettingSection {
  readonly key: string;
  readonly label: string;
  readonly keywords: string;
  readonly content: ReactNode;
}

const paletteGroups = {
  官方: ["#1677ff", "#36cfc9", "#9254de", "#fa8c16", "#13c2c2", "#eb2f96"],
  智能: ["#2f6fed", "#58b5e8", "#6c7bd9", "#f2c14e", "#607da8", "#55b7a5"],
  鲜明: ["#1677ff", "#19a7ce", "#f4c20d", "#f66d44", "#7b61ff", "#db3a7b"],
  舒适: ["#4db6ac", "#64b5f6", "#9575cd", "#ffb74d", "#90a4ae", "#81c784"],
  简约: ["#4f7cac", "#5fa8d3", "#89c2d9", "#f4a261", "#e76f51", "#a8dadc"],
  色盲无障碍: ["#5278bb", "#f0a23a", "#385a9d", "#b9cde5", "#7b8797", "#e86f0e"],
} as const;
const semanticGroups = {
  标准: { positive: "#52c41a", negative: "#ff4d4f", neutral: "#faad14" },
  柔和: { positive: "#36b37e", negative: "#e76f51", neutral: "#f2c94c" },
} as const;
const MAX_BACKGROUND_IMAGE_BYTES = 2 * 1024 * 1024;
const pageFontOptions: Array<{ value: NonNullable<Dashboard["theme"]["fontFamily"]>; label: string }> = [
  { value: "system", label: "系统默认" },
  { value: "source-han-sans", label: "思源黑体" },
  { value: "source-han-serif", label: "思源宋体" },
  { value: "alibaba-puhuiti", label: "阿里巴巴普惠体" },
  { value: "harmonyos-sans", label: "HarmonyOS Sans" },
  { value: "lxgw-wenkai", label: "霞鹜文楷" },
];

const formatMegabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const marginPresets = [
  { value: "normal", label: "常规（上下 10 像素，左右 12 像素）" },
  { value: "wide", label: "超宽页面（上下 8 像素，左右 8 像素）" },
  { value: "custom", label: "自定义" },
] as const;

const MarginPresetOption = ({ icon, title, description }: { readonly icon: ReactNode; readonly title: string; readonly description: string }) => (
  <span className="dashboard-settings__margin-preset-option">
    <span className="dashboard-settings__margin-preset-icon" aria-hidden="true">{icon}</span>
    <span className="dashboard-settings__margin-preset-copy"><strong>{title}</strong><small>{description}</small></span>
  </span>
);

type CustomMargins = ReturnType<typeof DashboardPageLayout.parse>["customMargins"];

const MarginTextInput = ({
  ariaLabel,
  value,
  onCommit,
}: {
  readonly ariaLabel: string;
  readonly value: number;
  readonly onCommit: (next: number) => void;
}) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = Math.min(200, Math.max(0, parsed));
    setDraft(String(next));
    if (next !== value) onCommit(next);
  };

  return (
    <Input
      aria-label={ariaLabel}
      inputMode="numeric"
      maxLength={3}
      size="small"
      suffix="px"
      value={draft}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value.replace(/\D/g, ""))}
      onPressEnter={(event) => event.currentTarget.blur()}
    />
  );
};

const MarginCustomEditor = ({
  value,
  locked,
  onToggleLock,
  onChange,
}: {
  readonly value: CustomMargins;
  readonly locked: boolean;
  readonly onToggleLock: () => void;
  readonly onChange: (side: keyof CustomMargins, next: number) => void;
}) => (
  <div className="dashboard-settings__margin-custom" onMouseDown={(event) => event.stopPropagation()}>
    <div className="dashboard-settings__margin-custom-title">自定义</div>
    <div className="dashboard-settings__margin-custom-body">
      <div className="dashboard-settings__margin-preview" aria-hidden="true"><BorderOutlined /></div>
      <Button className="dashboard-settings__margin-lock" aria-label={locked ? "锁定对称边距" : "解锁对称边距"} size="small" type={locked ? "primary" : "default"} icon={locked ? <LockOutlined /> : <UnlockOutlined />} onClick={onToggleLock} />
      <div className="dashboard-settings__margin-fields">
        <label>上<MarginTextInput ariaLabel="上边距" value={value.top} onCommit={(next) => onChange("top", next)} /></label>
        <label>左<MarginTextInput ariaLabel="左边距" value={value.left} onCommit={(next) => onChange("left", next)} /></label>
        <label>下<MarginTextInput ariaLabel="下边距" value={value.bottom} onCommit={(next) => onChange("bottom", next)} /></label>
        <label>右<MarginTextInput ariaLabel="右边距" value={value.right} onCommit={(next) => onChange("right", next)} /></label>
      </div>
    </div>
  </div>
);

const PaletteLabel = ({ name, colors }: { readonly name: string; readonly colors: readonly string[] }) => (
  <span className="dashboard-settings__palette-option">
    <span className="dashboard-settings__palette-option-swatches" aria-hidden="true">
      {colors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}
    </span>
    <span>{name}</span>
  </span>
);

const ThemeColorField = ({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) => (
  <label className="dashboard-settings__field">
    <span>{label}</span>
    <span className="dashboard-settings__color-control">
      <input
        aria-label={label}
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <code>{value.toUpperCase()}</code>
    </span>
  </label>
);

export const DashboardSettingsPanel = ({ store }: DashboardSettingsPanelProps) => {
  const dashboard = useStore(store, editorSelectors.dashboard);
  const [query, setQuery] = useState("");
  const [customPaletteOpen, setCustomPaletteOpen] = useState(false);
  const [paddingLocked, setPaddingLocked] = useState(true);
  const [backgroundImageError, setBackgroundImageError] = useState<string | null>(null);
  const [titleEditorOpen, setTitleEditorOpen] = useState(false);
  const [footerEditorOpen, setFooterEditorOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(dashboard.name);
  const [footerDraft, setFooterDraft] = useState("");
  const [marginSelectOpen, setMarginSelectOpen] = useState(false);
  const [marginLocked, setMarginLocked] = useState(true);
  const [backgroundPickerTarget, setBackgroundPickerTarget] = useState<"top" | "bottom" | null>(null);
  const [draftSpacing, setDraftSpacing] = useState({ rowGap: 8, columnGap: 8, paddingTop: 8, paddingRight: 12, paddingBottom: 8, paddingLeft: 12 });

  const updateTheme = (patch: Partial<Dashboard["theme"]>) => {
    store.getState().dispatch({
      type: "dashboard.theme.update",
      nextTheme: { ...store.getState().history.present.theme, ...patch } as Dashboard["theme"],
    });
  };
  const pageLayout = DashboardPageLayout.parse(dashboard.theme.pageLayout ?? {});
  const dashboardBackground = DashboardBackground.parse(dashboard.theme.dashboardBackground ?? {});
  useEffect(() => setTitleDraft(dashboard.name), [dashboard.name]);
  useEffect(() => setFooterDraft(pageLayout.footerText), [pageLayout.footerText]);
  const updatePageLayout = (patch: Partial<typeof pageLayout>) => updateTheme({
    pageLayout: DashboardPageLayout.parse({ ...pageLayout, ...patch }),
  });
  const updateCustomMargin = (side: keyof typeof pageLayout.customMargins, next: number) => {
    const margins = pageLayout.customMargins;
    const patch = marginLocked
      ? side === "top" || side === "bottom"
        ? { ...margins, top: next, bottom: next }
        : { ...margins, left: next, right: next }
      : { ...margins, [side]: next };
    updatePageLayout({ customMargins: patch });
  };
  const updateDashboardBackground = (patch: Partial<typeof dashboardBackground>) => updateTheme({
    dashboardBackground: DashboardBackground.parse({ ...dashboardBackground, ...patch }),
  });
  const chooseDashboardBackground = (target: "top" | "bottom", image: string) => {
    updateDashboardBackground(target === "top" ? { topImage: image, topVisible: true } : { bottomImage: image, bottomVisible: true });
    setBackgroundPickerTarget(null);
  };
  const clearDashboardBackground = (target: "top" | "bottom") => {
    updateDashboardBackground(target === "top" ? { topImage: "", topVisible: false } : { bottomImage: "", bottomVisible: false });
    setBackgroundPickerTarget(null);
  };
  const commitPageText = (field: "footerText", value: string) => {
    if (value === pageLayout[field]) return;
    updatePageLayout({ [field]: value });
  };
  const commitTitle = () => {
    const nextName = titleDraft.trim();
    if (nextName && nextName !== dashboard.name) {
      store.getState().dispatch({ type: "dashboard.name.update", nextName });
      return;
    }
    setTitleDraft(dashboard.name);
  };
  const selectBackgroundImage = (file: File | undefined) => {
    if (file === undefined) return;
    if (!file.type.startsWith("image/")) {
      setBackgroundImageError("请选择图片文件");
      return;
    }
    if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
      setBackgroundImageError(`背景图片过大：当前 ${formatMegabytes(file.size)}，最大支持 2 MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setBackgroundImageError(null);
      updatePageLayout({ backgroundImage: reader.result, backgroundImageEnabled: true });
    };
    reader.onerror = () => setBackgroundImageError("背景图片读取失败");
    reader.readAsDataURL(file);
  };
  const mode = dashboard.theme.mode ?? "light";
  const palette = dashboard.theme.chartPalette ?? paletteGroups.官方;
  const paletteName = Object.entries(paletteGroups).find(([, colors]) => JSON.stringify(colors) === JSON.stringify(palette))?.[0] ?? "自定义";
  const semantic = dashboard.theme.semanticColors ?? semanticGroups.标准;
  const radiusStyle = dashboard.theme.borderRadiusStyle ?? "none";
  const spacingStyle = dashboard.theme.spacingStyle ?? "compact";
  const customSpacing = dashboard.theme.customSpacing ?? { rowGap: 8, columnGap: 8, paddingTop: 8, paddingRight: 12, paddingBottom: 8, paddingLeft: 12 };
  useEffect(() => setDraftSpacing(customSpacing), [JSON.stringify(customSpacing)]);
  const updateSpacing = (patch: Partial<typeof customSpacing>) => setDraftSpacing((current) => ({ ...current, ...patch }));
  const commitSpacing = () => updateTheme({ customSpacing: draftSpacing });
  const semanticName = Object.entries(semanticGroups).find(([, colors]) => JSON.stringify(colors) === JSON.stringify(semantic))?.[0] ?? "标准";
  const paletteOptions = [
    {
      label: "分析属性",
      options: Object.entries(paletteGroups).slice(0, 5).map(([name, colors]) => ({ value: name, label: <PaletteLabel name={name} colors={colors} /> })),
    },
    {
      label: "场景属性",
      options: [{ value: "色盲无障碍", label: <PaletteLabel name="色盲无障碍" colors={paletteGroups.色盲无障碍} /> }],
    },
  ];
  const updateMode = (nextMode: "light" | "dark") => updateTheme({
    mode: nextMode,
    backgroundColor: nextMode === "dark" ? "#0f172a" : "#f5f7fa",
    primaryColor: nextMode === "dark" ? "#5b8ff9" : "#1677ff",
  });

  const sections = useMemo<readonly GlobalSettingSection[]>(() => [
    {
      key: "theme",
      label: "仪表板主题",
      keywords: "仪表板主题 品牌 主色 调色",
      content: <div className="dashboard-settings__section-body">
        <ThemeColorField label="主题色" value={dashboard.theme.primaryColor} onChange={(primaryColor) => updateTheme({ primaryColor })} />
        <Typography.Text type="secondary">主题色用于按钮、选中状态和重点信息。</Typography.Text>
      </div>,
    },
    {
      key: "global-style",
      label: "全局样式",
      keywords: "全局样式 圆角 间距 字体",
      content: <div className="dashboard-settings__section-body dashboard-settings__global-style">
        <div className="dashboard-settings__setting-row"><span>页面字体</span><Select size="small" value={dashboard.theme.fontFamily ?? "system"} onChange={(fontFamily) => updateTheme({ fontFamily })} options={[{ value: "system", label: "系统默认" }, { value: "source-han-sans", label: "思源黑体" }, { value: "source-han-serif", label: "思源宋体" }, { value: "alibaba-puhuiti", label: "阿里巴巴普惠体" }, { value: "harmonyos-sans", label: "HarmonyOS Sans" }, { value: "lxgw-wenkai", label: "霞鹜文楷" }]} /></div>
        <div className="dashboard-settings__setting-row"><span>圆角风格</span><Radio.Group value={radiusStyle} onChange={(event) => updateTheme({ borderRadiusStyle: event.target.value })} options={[{ label: "无", value: "none" }, { label: "小", value: "small" }, { label: "大", value: "large" }]} /></div>
        <div className="dashboard-settings__setting-row"><span>间距</span><Radio.Group value={spacingStyle} onChange={(event) => updateTheme({ spacingStyle: event.target.value })} options={[{ label: "紧凑", value: "compact" }, { label: "常规", value: "regular" }, { label: "自定义", value: "custom" }]} /></div>
        {spacingStyle === "custom" ? <div className="dashboard-settings__custom-spacing">
          <div className="dashboard-settings__custom-spacing-title">卡片之间的间距</div>
          <div className="dashboard-settings__custom-spacing-row"><label>行间距<InputNumber size="small" min={0} max={64} value={draftSpacing.rowGap} suffix="px" onChange={(value) => updateSpacing({ rowGap: typeof value === "number" ? value : 8 })} onBlur={commitSpacing} onPressEnter={commitSpacing} /></label><label>列间距<InputNumber size="small" min={0} max={64} value={draftSpacing.columnGap} suffix="px" onChange={(value) => updateSpacing({ columnGap: typeof value === "number" ? value : 8 })} onBlur={commitSpacing} onPressEnter={commitSpacing} /></label></div>
          <div className="dashboard-settings__custom-spacing-title">卡片内边距</div>
          <div className="dashboard-settings__custom-spacing-row"><Button size="small" aria-label={paddingLocked ? "已锁定上下、左右内边距，点击解锁" : "未锁定内边距，点击锁定"} title={paddingLocked ? "已锁定：上下、左右内边距成对联动" : "未锁定：各方向内边距独立调整"} onClick={() => setPaddingLocked((locked) => !locked)}>{paddingLocked ? "🔒" : "🔓"}</Button><label>上<InputNumber size="small" min={0} max={64} value={draftSpacing.paddingTop} suffix="px" onChange={(value) => { const next = typeof value === "number" ? value : 8; updateSpacing(paddingLocked ? { paddingTop: next, paddingBottom: next } : { paddingTop: next }); }} onBlur={commitSpacing} onPressEnter={commitSpacing} /></label><label>下<InputNumber size="small" min={0} max={64} value={draftSpacing.paddingBottom} suffix="px" onChange={(value) => { const next = typeof value === "number" ? value : 8; updateSpacing(paddingLocked ? { paddingTop: next, paddingBottom: next } : { paddingBottom: next }); }} onBlur={commitSpacing} onPressEnter={commitSpacing} /></label><label>左<InputNumber size="small" min={0} max={64} value={draftSpacing.paddingLeft} suffix="px" onChange={(value) => { const next = typeof value === "number" ? value : 12; updateSpacing(paddingLocked ? { paddingLeft: next, paddingRight: next } : { paddingLeft: next }); }} onBlur={commitSpacing} onPressEnter={commitSpacing} /></label><label>右<InputNumber size="small" min={0} max={64} value={draftSpacing.paddingRight} suffix="px" onChange={(value) => { const next = typeof value === "number" ? value : 12; updateSpacing(paddingLocked ? { paddingLeft: next, paddingRight: next } : { paddingRight: next }); }} onBlur={commitSpacing} onPressEnter={commitSpacing} /></label></div>
        </div> : null}
        <div className="dashboard-settings__setting-row"><span>主题模式</span><Radio.Group value={mode} onChange={(event) => updateMode(event.target.value)} options={[{ label: "浅色模式", value: "light" }, { label: "深色模式", value: "dark" }]} /></div>
        <div className="dashboard-settings__setting-row"><span>图表色系</span><div className="dashboard-settings__palette-actions"><Select aria-label="图表色系" className="dashboard-settings__palette-select" classNames={{ popup: { root: "dashboard-settings__palette-dropdown" } }} size="small" value={paletteName} onChange={(value) => { if (value in paletteGroups) updateTheme({ chartPalette: [...paletteGroups[value as keyof typeof paletteGroups]] }); }} options={paletteOptions} /><Button size="small" onClick={() => setCustomPaletteOpen((open) => !open)}>自定义</Button></div></div>
        {customPaletteOpen && <div className="dashboard-settings__swatches" aria-label="自定义图表色系">{palette.map((color, index) => <input key={`${index}-${color}`} aria-label={`自定义颜色 ${index + 1}`} type="color" value={color} onChange={(event) => updateTheme({ chartPalette: palette.map((current, colorIndex) => colorIndex === index ? event.target.value : current) })} />)}</div>}
        <div className="dashboard-settings__setting-row"><span>渐变色彩样式</span><Checkbox aria-label="渐变色彩样式" checked={dashboard.theme.chartGradient ?? true} onChange={(event) => updateTheme({ chartGradient: event.target.checked })} /></div>
        <div className="dashboard-settings__setting-row"><span>语义色</span><Select size="small" value={semanticName} onChange={(value) => { if (value in semanticGroups) updateTheme({ semanticColors: { ...semanticGroups[value as keyof typeof semanticGroups] } }); }} options={Object.keys(semanticGroups).map((name) => ({ value: name, label: name }))} /></div>
        <Typography.Text type="secondary">浅色或深色模式会同步调整画布、卡片和图表文字；图表色系与语义色会应用到所有图表。</Typography.Text>
      </div>,
    },
    {
      key: "layout",
      label: "页面布局",
      keywords: "页面布局 栅格 宽度 自适应 固定 标题 页尾 页边距",
      content: <div className="dashboard-settings__section-body dashboard-settings__page-layout">
        <div className="dashboard-settings__setting-row"><span>页面布局</span><Radio.Group value={pageLayout.layoutMode} onChange={(event) => updatePageLayout({ layoutMode: event.target.value })} options={[{ label: "适应内容", value: "fitContent" }, { label: "适应窗口", value: "fitViewport" }]} /></div>
        <div className="dashboard-settings__setting-row dashboard-settings__page-information"><span>页面信息</span><div>
          <span className="dashboard-settings__page-information-item">
            <Checkbox checked={pageLayout.titleVisible} onChange={(event) => updatePageLayout({ titleVisible: event.target.checked })}>标题区</Checkbox>
            {pageLayout.titleVisible && <Popover
              placement="bottom"
              trigger="click"
              open={titleEditorOpen}
              onOpenChange={(open) => { if (!open) commitTitle(); setTitleEditorOpen(open); }}
              content={<div className="dashboard-settings__page-text-editor">
                <span>页面标题</span><Input aria-label="页面标题" size="small" maxLength={100} value={titleDraft} onChange={(event) => setTitleDraft(event.target.value)} onBlur={commitTitle} onPressEnter={(event) => event.currentTarget.blur()} />
                <span>文字大小</span><InputNumber aria-label="页面标题文字大小" size="small" min={12} max={72} suffix="px" value={pageLayout.titleFontSize} onChange={(value) => typeof value === "number" && updatePageLayout({ titleFontSize: value })} />
                <span>字体</span><Select aria-label="页面标题字体" size="small" value={pageLayout.titleFontFamily} options={pageFontOptions} onChange={(titleFontFamily) => updatePageLayout({ titleFontFamily })} />
                <span>字间距</span><InputNumber aria-label="页面标题字间距" size="small" min={-2} max={12} step={0.5} suffix="px" value={pageLayout.titleLetterSpacing} onChange={(value) => typeof value === "number" && updatePageLayout({ titleLetterSpacing: value })} />
              </div>}
            ><Button className="dashboard-settings__inline-edit" aria-label="编辑页面标题" type="text" size="small" icon={<FormOutlined />} /></Popover>}
          </span>
          <span className="dashboard-settings__page-information-item">
            <Checkbox checked={pageLayout.footerVisible} onChange={(event) => updatePageLayout({ footerVisible: event.target.checked })}>页尾</Checkbox>
            {pageLayout.footerVisible && <Popover
              placement="bottom"
              trigger="click"
              open={footerEditorOpen}
              onOpenChange={(open) => { if (!open) commitPageText("footerText", footerDraft); setFooterEditorOpen(open); }}
              content={<div className="dashboard-settings__page-text-editor">
                <span>页尾文字</span><Input aria-label="页尾文字" size="small" maxLength={200} placeholder={`${dashboard.name} · 数据看板`} value={footerDraft} onChange={(event) => setFooterDraft(event.target.value)} onBlur={() => commitPageText("footerText", footerDraft)} onPressEnter={(event) => event.currentTarget.blur()} />
                <span>文字大小</span><InputNumber aria-label="页尾文字大小" size="small" min={10} max={48} suffix="px" value={pageLayout.footerFontSize} onChange={(value) => typeof value === "number" && updatePageLayout({ footerFontSize: value })} />
                <span>字体</span><Select aria-label="页尾字体" size="small" value={pageLayout.footerFontFamily} options={pageFontOptions} onChange={(footerFontFamily) => updatePageLayout({ footerFontFamily })} />
                <span>字间距</span><InputNumber aria-label="页尾字间距" size="small" min={-2} max={12} step={0.5} suffix="px" value={pageLayout.footerLetterSpacing} onChange={(value) => typeof value === "number" && updatePageLayout({ footerLetterSpacing: value })} />
              </div>}
            ><Button className="dashboard-settings__inline-edit" aria-label="编辑页尾文字" type="text" size="small" icon={<FormOutlined />} /></Popover>}
          </span>
        </div></div>
        <div className="dashboard-settings__setting-row"><span>页面背景</span><div className="dashboard-settings__page-background">
          <Radio.Group aria-label="页面背景类型" value={pageLayout.backgroundImageEnabled ? "image" : "color"} onChange={(event) => updatePageLayout({ backgroundImageEnabled: event.target.value === "image" })}>
            <Radio value="color"><span className="dashboard-settings__background-color-option">颜色<input aria-label="页面背景颜色" type="color" value={dashboard.theme.backgroundColor} disabled={pageLayout.backgroundImageEnabled} onChange={(event) => updateTheme({ backgroundColor: event.target.value })} /></span></Radio>
            <Radio value="image" disabled={pageLayout.backgroundImage.length === 0}>图片</Radio>
          </Radio.Group>
          <Tooltip title={pageLayout.backgroundImage.length > 0 ? "更换背景图片" : "选择背景图片"}>
            <label className={`dashboard-settings__background-upload${pageLayout.backgroundImage.length > 0 ? " dashboard-settings__background-upload--has-image" : ""}`} style={pageLayout.backgroundImage.length > 0 ? { backgroundImage: `url(${pageLayout.backgroundImage})` } : undefined}>
              {pageLayout.backgroundImage.length === 0 && <PictureOutlined aria-hidden="true" />}
              <input aria-label="选择页面背景图片" type="file" accept="image/*" onChange={(event) => selectBackgroundImage(event.target.files?.[0])} />
            </label>
          </Tooltip>
          {pageLayout.backgroundImage.length > 0 && <Tooltip title="移除背景图片"><Button className="dashboard-settings__background-remove" aria-label="移除背景图片" size="small" type="text" danger icon={<DeleteOutlined />} onClick={() => updatePageLayout({ backgroundImage: "", backgroundImageEnabled: false })} /></Tooltip>}
        </div></div>
        {backgroundImageError && <Alert className="dashboard-settings__background-error" type="error" showIcon message={backgroundImageError} />}
        <div className="dashboard-settings__setting-row"><span>页面宽度</span><div className="dashboard-settings__page-width">
          <Radio.Group value={pageLayout.widthMode} onChange={(event) => updatePageLayout({ widthMode: event.target.value })} options={[{ label: "自适应", value: "adaptive" }, { label: "固定", value: "fixed" }]} />
          <InputNumber aria-label="固定页面宽度" size="small" min={960} max={2560} step={20} suffix="px" disabled={pageLayout.widthMode !== "fixed"} value={pageLayout.fixedWidth} onChange={(value) => typeof value === "number" && updatePageLayout({ fixedWidth: value })} />
        </div></div>
        <div className="dashboard-settings__setting-row"><span>页边距</span><Select
          aria-label="页边距"
          size="small"
          open={marginSelectOpen}
          onOpenChange={setMarginSelectOpen}
          value={pageLayout.marginPreset}
          options={marginPresets.map((option) => ({
            value: option.value,
            label: option.value === "custom"
              ? `自定义（上${pageLayout.customMargins.top} 像素，下${pageLayout.customMargins.bottom} 像素，左${pageLayout.customMargins.left} 像素，右${pageLayout.customMargins.right} 像素）`
              : option.value === "normal"
                ? <MarginPresetOption icon={<BorderOutlined />} title="常规" description="上下10像素，左右12像素" />
                : <MarginPresetOption icon={<FullscreenOutlined />} title="超宽页面" description="上下8像素，左右8像素" />,
          }))}
          onChange={(marginPreset) => updatePageLayout({ marginPreset })}
          popupRender={(menu) => <><div>{menu}</div><MarginCustomEditor value={pageLayout.customMargins} locked={marginLocked} onToggleLock={() => setMarginLocked((locked) => !locked)} onChange={updateCustomMargin} /></>}
        /></div>
      </div>,
    },
    {
      key: "background",
      label: "仪表板背景",
      keywords: "仪表板背景 页面 底色 颜色",
      content: <div className="dashboard-settings__section-body">
        <div className="dashboard-background-settings">
          {(["top", "bottom"] as const).map((target) => {
            const enabled = target === "top" ? dashboardBackground.topVisible : dashboardBackground.bottomVisible;
            const image = target === "top" ? dashboardBackground.topImage : dashboardBackground.bottomImage;
            const label = target === "top" ? "顶部图片" : "底部图片";
            return <div className="dashboard-background-settings__item" key={target}>
              <Checkbox checked={enabled} onChange={(event) => updateDashboardBackground(target === "top" ? { topVisible: event.target.checked } : { bottomVisible: event.target.checked })}>{label}</Checkbox>
              <Popover
                destroyOnHidden
                open={backgroundPickerTarget === target}
                placement="rightTop"
                trigger="click"
                content={<DashboardBackgroundPicker value={image} onSelect={(next) => chooseDashboardBackground(target, next)} onClear={() => clearDashboardBackground(target)} />}
                onOpenChange={(open) => setBackgroundPickerTarget(open ? target : null)}
              >
                <button aria-label={`配置${label}`} className="dashboard-background-settings__thumbnail-button" type="button"><DashboardBackgroundThumbnail value={image} /></button>
              </Popover>
            </div>;
          })}
        </div>
        <ThemeColorField label="背景颜色" value={dashboard.theme.backgroundColor} onChange={(backgroundColor) => updateTheme({ backgroundColor })} />
        <Typography.Text type="secondary">背景图片会显示在仪表板顶部或底部，发布后对访问者可见。</Typography.Text>
      </div>,
    },
    {
      key: "components",
      label: "组件",
      keywords: "组件 卡片 图表 默认样式",
      content: <div className="dashboard-settings__section-body">
        <Typography.Text type="secondary">选中画布中的组件后，可继续配置标题、卡片和图表样式。</Typography.Text>
      </div>,
    },
    {
      key: "content-style",
      label: "通用内容样式",
      keywords: "通用内容样式 文字 数字 字体",
      content: <div className="dashboard-settings__section-body">
        <Typography.Text type="secondary">内容默认继承当前主题，以保持整张仪表板的视觉一致性。</Typography.Text>
      </div>,
    },
  ], [dashboard.name, titleDraft, footerDraft, titleEditorOpen, footerEditorOpen, marginSelectOpen, marginLocked, backgroundPickerTarget, dashboard.theme.backgroundColor, dashboard.theme.primaryColor, dashboard.theme.mode, dashboard.theme.fontFamily, dashboard.theme.borderRadiusStyle, dashboard.theme.spacingStyle, dashboard.theme.spacing, JSON.stringify(dashboard.theme.customSpacing), JSON.stringify(dashboard.theme.pageLayout), JSON.stringify(dashboard.theme.dashboardBackground), dashboard.theme.chartGradient, JSON.stringify(dashboard.theme.chartPalette), JSON.stringify(dashboard.theme.semanticColors), backgroundImageError, customPaletteOpen, paddingLocked]);

  const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
  const visibleSections = normalizedQuery.length === 0
    ? sections
    : sections.filter((section) => section.keywords.toLocaleLowerCase("zh-CN").includes(normalizedQuery));

  return (
    <div className="dashboard-settings">
      <div className="dashboard-settings__search">
        <Input
          allowClear
          aria-label="搜索全局配置"
          placeholder="搜索"
          prefix={<SearchOutlined aria-hidden="true" />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      {visibleSections.length > 0 ? (
        <Collapse
          className="dashboard-settings__collapse"
          ghost
          items={visibleSections.map((section) => ({
            key: section.key,
            ...(section.key === "layout" ? { className: "dashboard-settings__collapse-item--page-layout" } : {}),
            label: section.label,
            children: section.content,
          }))}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的配置项" />
      )}
    </div>
  );
};
