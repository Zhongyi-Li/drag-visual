import { AlignCenterOutlined, AlignLeftOutlined, AlignRightOutlined, BoldOutlined, ExpandOutlined, FontColorsOutlined, ItalicOutlined } from "@ant-design/icons";
import { Button, Checkbox, Collapse, ColorPicker, Input, InputNumber, Space, Switch, Tooltip } from "antd";
import { ComponentContainerStyle, ComponentFieldStyle, ComponentTitleStyle, type ComponentContainerPadding, type ComponentFieldTextStyle } from "@drag-visual/contracts";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";

import type { EditorStore } from "./store/editorStore.js";

interface Props {
  readonly component: {
    readonly id: string;
    readonly title?: string | undefined;
    readonly titleStyle?: ComponentTitleStyle | undefined;
    readonly fieldStyle?: ComponentFieldStyle | undefined;
    readonly containerStyle?: ComponentContainerStyle | undefined;
  };
  readonly store: EditorStore;
}

const containerColorPresets = [
  "#1677FF", "#4C8FFB", "#7B61FF", "#FFB742", "#43C6B9", "#5B7DB1",
  "#E8885E", "#B46DDE", "#DC83DB", "#A47B6D", "#6F97AA", "#8AB0DF",
];
const fieldColorPresets = ["#0F172A", "#475569", "#64748B", "#98A2B3", "#1677FF", "#4C8FFB", "#7B61FF", "#08705D", "#E8885E", "#D92D20"];

const paddingSides = ["top", "right", "bottom", "left"] as const;
const paddingLabels: Readonly<Record<(typeof paddingSides)[number], string>> = { top: "上", right: "右", bottom: "下", left: "左" };

/** A concise title control for the display accordion; explanatory copy lives outside the form. */
export const ComponentTitlePanel = ({ component, store }: Props) => {
  const current = useStore(store, (state) => state.history.present.components.find((candidate) => candidate.id === component.id) ?? component);
  const currentTitle = current.title ?? "";
  const [draftTitle, setDraftTitle] = useState(currentTitle);
  const [recentContainerColors, setRecentContainerColors] = useState<string[]>([]);
  const draftTitleRef = useRef(draftTitle);
  const savedTitleRef = useRef(currentTitle);
  const titleStyle = ComponentTitleStyle.parse(current.titleStyle ?? {});
  const fieldStyle = ComponentFieldStyle.parse(current.fieldStyle ?? {});
  const containerStyle = ComponentContainerStyle.parse(current.containerStyle ?? {});
  const [draftBorderRadius, setDraftBorderRadius] = useState<number | null>(containerStyle.borderRadius);
  const [draftPadding, setDraftPadding] = useState<ComponentContainerPadding>(containerStyle.padding);
  const commitTitle = () => {
    const nextTitle = draftTitleRef.current;
    if (nextTitle === savedTitleRef.current) return;
    store.getState().dispatch({ type: "component.title.update", componentId: component.id, nextTitle });
    savedTitleRef.current = nextTitle;
  };
  const updateTitleStyle = (next: Partial<ComponentTitleStyle>) => store.getState().dispatch({
    type: "component.title-style.update",
    componentId: component.id,
    nextTitleStyle: { ...titleStyle, ...next },
  });
  const updateContainerStyle = (next: Partial<ComponentContainerStyle>) => store.getState().dispatch({
    type: "component.container-style.update",
    componentId: component.id,
    nextContainerStyle: { ...containerStyle, ...next },
  });
  const updateFieldStyle = (next: Partial<ComponentFieldStyle>) => store.getState().dispatch({
    type: "component.field-style.update",
    componentId: component.id,
    nextFieldStyle: { ...fieldStyle, ...next },
  });
  const updateFieldTextStyle = (role: "dimension" | "metricName" | "metricValue", next: Partial<ComponentFieldTextStyle>) => updateFieldStyle({ [role]: { ...fieldStyle[role], ...next } });
  const updateContainerColor = (color: string) => {
    const backgroundColor = color.toUpperCase();
    updateContainerStyle({ backgroundColor });
    setRecentContainerColors((colors) => [backgroundColor, ...colors.filter((item) => item !== backgroundColor)].slice(0, 12));
  };
  useEffect(() => {
    draftTitleRef.current = currentTitle;
    savedTitleRef.current = currentTitle;
    setDraftTitle(currentTitle);
  }, [component.id, currentTitle]);
  useEffect(() => {
    setDraftBorderRadius(containerStyle.borderRadius);
  }, [component.id, containerStyle.borderRadius]);
  useEffect(() => {
    setDraftPadding(containerStyle.padding);
  }, [component.id, containerStyle.padding.top, containerStyle.padding.right, containerStyle.padding.bottom, containerStyle.padding.left]);
  useEffect(() => {
    const componentId = component.id;
    return () => {
      const nextTitle = draftTitleRef.current;
      if (nextTitle === savedTitleRef.current) return;
      store.getState().dispatch({ type: "component.title.update", componentId, nextTitle });
      savedTitleRef.current = nextTitle;
    };
  }, [component.id, store]);
  const titleControls = <div className="component-title-panel__controls">
    <div className="component-title-panel__visibility"><Checkbox aria-label="显示主标题" checked={titleStyle.visible} onChange={(event) => updateTitleStyle({ visible: event.target.checked })}>显示主标题</Checkbox></div>
    <label>
      <span>标题</span>
      <Input aria-label="图表标题" disabled={!titleStyle.visible} maxLength={100} placeholder="添加标题" value={draftTitle} onBlur={commitTitle} onChange={(event) => { draftTitleRef.current = event.target.value; setDraftTitle(event.target.value); }} onPressEnter={commitTitle} />
    </label>
    <div className="component-title-panel__format" aria-label="标题文本样式">
      <span>文本</span>
      <Space.Compact>
        <Tooltip title="标题颜色"><input aria-label="标题颜色" className="component-title-panel__color" disabled={!titleStyle.visible} type="color" value={titleStyle.color} onChange={(event) => updateTitleStyle({ color: event.target.value })} /></Tooltip>
        <InputNumber aria-label="标题字号" controls={false} disabled={!titleStyle.visible} max={32} min={12} precision={0} suffix="px" value={titleStyle.fontSize} onChange={(fontSize) => { if (fontSize !== null) updateTitleStyle({ fontSize }); }} />
      </Space.Compact>
      <Space.Compact>
        <Tooltip title="加粗"><Button aria-label="标题加粗" aria-pressed={titleStyle.fontWeight === "bold"} disabled={!titleStyle.visible} icon={<BoldOutlined />} size="small" type={titleStyle.fontWeight === "bold" ? "primary" : "default"} onClick={() => updateTitleStyle({ fontWeight: titleStyle.fontWeight === "bold" ? "normal" : "bold" })} /></Tooltip>
        <Tooltip title="斜体"><Button aria-label="标题斜体" aria-pressed={titleStyle.fontStyle === "italic"} disabled={!titleStyle.visible} icon={<ItalicOutlined />} size="small" type={titleStyle.fontStyle === "italic" ? "primary" : "default"} onClick={() => updateTitleStyle({ fontStyle: titleStyle.fontStyle === "italic" ? "normal" : "italic" })} /></Tooltip>
      </Space.Compact>
      <div className="component-title-panel__alignment">
        <Space.Compact>
          <Tooltip title="左对齐"><Button aria-label="标题左对齐" aria-pressed={titleStyle.textAlign === "left"} disabled={!titleStyle.visible} icon={<AlignLeftOutlined />} size="small" type={titleStyle.textAlign === "left" ? "primary" : "default"} onClick={() => updateTitleStyle({ textAlign: "left" })} /></Tooltip>
          <Tooltip title="居中"><Button aria-label="标题居中" aria-pressed={titleStyle.textAlign === "center"} disabled={!titleStyle.visible} icon={<AlignCenterOutlined />} size="small" type={titleStyle.textAlign === "center" ? "primary" : "default"} onClick={() => updateTitleStyle({ textAlign: "center" })} /></Tooltip>
          <Tooltip title="右对齐"><Button aria-label="标题右对齐" aria-pressed={titleStyle.textAlign === "right"} disabled={!titleStyle.visible} icon={<AlignRightOutlined />} size="small" type={titleStyle.textAlign === "right" ? "primary" : "default"} onClick={() => updateTitleStyle({ textAlign: "right" })} /></Tooltip>
        </Space.Compact>
      </div>
    </div>
  </div>;
  const fieldTextControls = (role: "dimension" | "metricName" | "metricValue", label: string) => {
    const style = fieldStyle[role];
    return <div className="field-settings-panel__row">
      <span className="field-settings-panel__row-label">{label}</span>
      <div className="field-settings-panel__controls">
        <Tooltip title={`${label}颜色`}>
          <ColorPicker
            aria-label={`${label}颜色`}
            disabled={!fieldStyle.enabled}
            presets={[{ label: "常用颜色", colors: fieldColorPresets, defaultOpen: true }]}
            value={style.color}
            onChangeComplete={(color) => updateFieldTextStyle(role, { color: color.toHexString().toUpperCase() })}
          >
            <Button aria-label={`${label}颜色`} className="field-settings-panel__color" disabled={!fieldStyle.enabled} icon={<FontColorsOutlined style={{ color: style.color }} />} size="small" />
          </ColorPicker>
        </Tooltip>
        <InputNumber aria-label={`${label}字号`} controls={false} disabled={!fieldStyle.enabled} max={32} min={10} precision={0} suffix="px" value={style.fontSize} onChange={(fontSize) => { if (fontSize !== null) updateFieldTextStyle(role, { fontSize }); }} />
        <Tooltip title={`${label}加粗`}><Button aria-label={`${label}加粗`} aria-pressed={style.fontWeight === "bold"} className="field-settings-panel__format-button" disabled={!fieldStyle.enabled} icon={<BoldOutlined />} size="small" type="text" onClick={() => updateFieldTextStyle(role, { fontWeight: style.fontWeight === "bold" ? "normal" : "bold" })} /></Tooltip>
        <Tooltip title={`${label}斜体`}><Button aria-label={`${label}斜体`} aria-pressed={style.fontStyle === "italic"} className="field-settings-panel__format-button" disabled={!fieldStyle.enabled} icon={<ItalicOutlined />} size="small" type="text" onClick={() => updateFieldTextStyle(role, { fontStyle: style.fontStyle === "italic" ? "normal" : "italic" })} /></Tooltip>
      </div>
    </div>;
  };
  const fieldControls = <div className="field-settings-panel">
    {fieldTextControls("dimension", "维度")}
    <div className="field-settings-panel__metric-group">
      <span className="field-settings-panel__group-label">指标</span>
      <div className="field-settings-panel__metric-rows">
        {fieldTextControls("metricName", "名称")}
        {fieldTextControls("metricValue", "数值")}
      </div>
    </div>
  </div>;
  const commitBorderRadius = (candidate = draftBorderRadius) => {
    if (candidate === null || !Number.isFinite(candidate)) return;
    const borderRadius = Math.min(32, Math.max(0, candidate));
    if (borderRadius !== draftBorderRadius) setDraftBorderRadius(borderRadius);
    if (borderRadius !== containerStyle.borderRadius) updateContainerStyle({ borderRadius });
  };
  const commitPadding = (side: (typeof paddingSides)[number], candidate = draftPadding[side]) => {
    if (!Number.isFinite(candidate)) return;
    const value = Math.min(64, Math.max(0, candidate));
    if (value !== draftPadding[side]) setDraftPadding((padding) => ({ ...padding, [side]: value }));
    if (value !== containerStyle.padding[side]) updateContainerStyle({ padding: { ...containerStyle.padding, [side]: value } });
  };

  return <section className="component-title-panel" aria-label="标题与卡片配置">
    <Collapse
      className="component-title-panel__collapse"
      defaultActiveKey={["title", "field", "container"]}
      ghost
      items={[
        { key: "title", label: "标题", children: titleControls },
        {
          key: "field",
          label: "字段设置",
          extra: <Switch aria-label="启用字段设置" checked={fieldStyle.enabled} size="small" onClick={(_, event) => event.stopPropagation()} onChange={(enabled) => updateFieldStyle({ enabled })} />,
          children: fieldControls,
        },
        {
          key: "container",
          label: "组件容器",
          children: <div className="component-container-panel">
            <Checkbox className="component-container-panel__custom-background" aria-label="自定义背景填充" checked={containerStyle.customBackground} onChange={(event) => updateContainerStyle({ customBackground: event.target.checked })}>自定义背景填充</Checkbox>
            <div className="component-container-panel__color-row">
              <span>卡片颜色</span>
              <ColorPicker
                aria-label="卡片颜色"
                disabled={!containerStyle.customBackground}
                format="hex"
                presets={[
                  { label: "常用颜色", colors: containerColorPresets, defaultOpen: true },
                  ...(recentContainerColors.length === 0 ? [] : [{ label: "最近使用", colors: recentContainerColors, defaultOpen: true }]),
                ]}
                showText
                value={containerStyle.backgroundColor}
                onChangeComplete={(color) => updateContainerColor(color.toHexString())}
              />
            </div>
            <div className="component-container-panel__radius-row">
              <span>圆角</span>
              <InputNumber aria-label="卡片圆角" controls={false} max={32} min={0} precision={0} suffix="px" value={draftBorderRadius} onBlur={(event) => commitBorderRadius(Number(event.currentTarget.value))} onChange={setDraftBorderRadius} onPressEnter={(event) => commitBorderRadius(Number(event.currentTarget.value))} />
            </div>
            <div className="component-container-panel__padding">
              <span className="component-container-panel__padding-label"><ExpandOutlined aria-hidden="true" />卡片内边距</span>
              <div className="component-container-panel__padding-grid">
                {paddingSides.map((side) => <label key={side}>
                  <span>{paddingLabels[side]}</span>
                  <InputNumber aria-label={`卡片内边距${paddingLabels[side]}`} controls={false} max={64} min={0} precision={0} suffix="px" value={draftPadding[side]} onBlur={(event) => commitPadding(side, Number(event.currentTarget.value))} onChange={(value) => { if (value !== null) setDraftPadding((padding) => ({ ...padding, [side]: value })); }} onPressEnter={(event) => commitPadding(side, Number(event.currentTarget.value))} />
                </label>)}
              </div>
            </div>
          </div>,
        },
      ]}
    />
  </section>;
};
