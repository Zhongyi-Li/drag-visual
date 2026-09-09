import { SearchOutlined } from "@ant-design/icons";
import type { Dashboard } from "@drag-visual/contracts";
import { Button, Checkbox, Collapse, Empty, Input, Radio, Select, Typography } from "antd";
import { useMemo, useState, type ReactNode } from "react";
import { useStore } from "zustand";

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

  const updateTheme = (patch: Partial<Dashboard["theme"]>) => {
    store.getState().dispatch({
      type: "dashboard.theme.update",
      nextTheme: { ...store.getState().history.present.theme, ...patch } as Dashboard["theme"],
    });
  };
  const mode = dashboard.theme.mode ?? "light";
  const palette = dashboard.theme.chartPalette ?? paletteGroups.官方;
  const paletteName = Object.entries(paletteGroups).find(([, colors]) => JSON.stringify(colors) === JSON.stringify(palette))?.[0] ?? "自定义";
  const semantic = dashboard.theme.semanticColors ?? semanticGroups.标准;
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
      content: <div className="dashboard-settings__section-body">
        <div className="dashboard-settings__setting-row"><span>主题模式</span><Radio.Group value={mode} onChange={(event) => updateMode(event.target.value)} options={[{ label: "浅色模式", value: "light" }, { label: "深色模式", value: "dark" }]} /></div>
        <div className="dashboard-settings__setting-row"><span>图表色系</span><div className="dashboard-settings__palette-actions"><Select className="dashboard-settings__palette-select" popupClassName="dashboard-settings__palette-dropdown" size="small" value={paletteName} onChange={(value) => { if (value in paletteGroups) updateTheme({ chartPalette: [...paletteGroups[value as keyof typeof paletteGroups]] }); }} options={paletteOptions} /><Button size="small" onClick={() => setCustomPaletteOpen((open) => !open)}>自定义</Button></div></div>
        {customPaletteOpen && <div className="dashboard-settings__swatches" aria-label="自定义图表色系">{palette.map((color, index) => <input key={`${index}-${color}`} aria-label={`自定义颜色 ${index + 1}`} type="color" value={color} onChange={(event) => updateTheme({ chartPalette: palette.map((current, colorIndex) => colorIndex === index ? event.target.value : current) })} />)}</div>}
        <Checkbox checked>渐变色彩样式</Checkbox>
        <div className="dashboard-settings__setting-row"><span>语义色</span><Select size="small" value={semanticName} onChange={(value) => { if (value in semanticGroups) updateTheme({ semanticColors: { ...semanticGroups[value as keyof typeof semanticGroups] } }); }} options={Object.keys(semanticGroups).map((name) => ({ value: name, label: name }))} /></div>
        <Typography.Text type="secondary">浅色或深色模式会同步调整画布、卡片和图表文字；图表色系与语义色会应用到所有图表。</Typography.Text>
      </div>,
    },
    {
      key: "layout",
      label: "页面布局",
      keywords: "页面布局 栅格 宽度 自适应",
      content: <div className="dashboard-settings__section-body dashboard-settings__summary">
        <span>布局方式</span><strong>12 列自适应栅格</strong>
      </div>,
    },
    {
      key: "background",
      label: "仪表板背景",
      keywords: "仪表板背景 页面 底色 颜色",
      content: <div className="dashboard-settings__section-body">
        <ThemeColorField label="背景颜色" value={dashboard.theme.backgroundColor} onChange={(backgroundColor) => updateTheme({ backgroundColor })} />
        <Typography.Text type="secondary">发布后的仪表板使用该背景颜色。</Typography.Text>
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
  ], [dashboard.theme.backgroundColor, dashboard.theme.primaryColor, dashboard.theme.mode, JSON.stringify(dashboard.theme.chartPalette), JSON.stringify(dashboard.theme.semanticColors), customPaletteOpen]);

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
