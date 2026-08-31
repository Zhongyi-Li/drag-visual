import { AlignCenterOutlined, AlignLeftOutlined, AlignRightOutlined, BoldOutlined, ItalicOutlined } from "@ant-design/icons";
import { Button, Input, InputNumber, Space, Switch, Tooltip } from "antd";
import { ComponentTitleStyle } from "@drag-visual/contracts";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";

import type { EditorStore } from "./store/editorStore.js";

interface Props {
  readonly component: {
    readonly id: string;
    readonly title?: string | undefined;
    readonly titleStyle?: ComponentTitleStyle | undefined;
  };
  readonly store: EditorStore;
}

/** A concise title control for the display accordion; explanatory copy lives outside the form. */
export const ComponentTitlePanel = ({ component, store }: Props) => {
  const current = useStore(store, (state) => state.history.present.components.find((candidate) => candidate.id === component.id) ?? component);
  const currentTitle = current.title ?? "";
  const [draftTitle, setDraftTitle] = useState(currentTitle);
  const draftTitleRef = useRef(draftTitle);
  const savedTitleRef = useRef(currentTitle);
  const titleStyle = ComponentTitleStyle.parse(current.titleStyle ?? {});
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
  useEffect(() => {
    draftTitleRef.current = currentTitle;
    savedTitleRef.current = currentTitle;
    setDraftTitle(currentTitle);
  }, [component.id, currentTitle]);
  useEffect(() => {
    const componentId = component.id;
    return () => {
      const nextTitle = draftTitleRef.current;
      if (nextTitle === savedTitleRef.current) return;
      store.getState().dispatch({ type: "component.title.update", componentId, nextTitle });
      savedTitleRef.current = nextTitle;
    };
  }, [component.id, store]);
  return <section className="component-title-panel" aria-label="图表标题">
    <div className="component-title-panel__visibility"><Switch aria-label="显示主标题" checked={titleStyle.visible} size="small" onChange={(visible) => updateTitleStyle({ visible })} /><span>显示主标题</span></div>
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
  </section>;
};
