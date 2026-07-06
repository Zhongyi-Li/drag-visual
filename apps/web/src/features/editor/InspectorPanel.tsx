import { BgColorsOutlined, SettingOutlined } from "@ant-design/icons";
import { Button, Empty, Tabs, Typography } from "antd";
import type { ComponentRegistry } from "@drag-visual/component-registry";
import { useStore } from "zustand";

import { ComponentBindingPanel } from "./ComponentBindingPanel.js";
import { editorSelectors, type EditorStore } from "./store/editorStore.js";

export const InspectorPanel = ({ store, registry }: { store: EditorStore; registry: ComponentRegistry }) => {
  const selected = useStore(store, editorSelectors.selectedComponent);
  const content = selected === null ? (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未选择组件" />
  ) : (() => {
    const definition = registry.get(selected.type);
    return (
      <div className="inspector-selected">
        <h2>{selected.title ?? "柱图"}配置</h2>
        {definition.dataSlots.length === 0 ? (
          <Typography.Text type="secondary">该组件不需要数据绑定。</Typography.Text>
        ) : (
          <ComponentBindingPanel store={store} component={selected} definition={definition} />
        )}
        <Button block disabled icon={<SettingOutlined />}>组件属性</Button>
      </div>
    );
  })();

  return (
    <aside className="editor-inspector editor-panel-scroll" aria-label="配置面板">
      <div className="inspector-heading"><strong>配置</strong><SettingOutlined /></div>
      <Tabs size="small" defaultActiveKey="component" items={[
        { key: "component", label: "组件", children: content },
        { key: "theme", label: "主题", children: <div className="inspector-selected"><Button block disabled icon={<BgColorsOutlined />}>主题样式</Button></div> },
      ]} />
    </aside>
  );
};
