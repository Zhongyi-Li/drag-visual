import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { Button, Collapse, Empty, Tabs, Tooltip, Typography } from "antd";
import type { ComponentRegistry } from "@drag-visual/component-registry";
import { useStore } from "zustand";

import { ComponentBindingPanel } from "./ComponentBindingPanel.js";
import { ComponentDataPanel } from "./ComponentDataPanel.js";
import { editorSelectors, type EditorStore } from "./store/editorStore.js";

interface InspectorPanelProps {
  readonly store: EditorStore;
  readonly registry: ComponentRegistry;
  readonly collapsed: boolean;
  readonly onToggleCollapsed: () => void;
  readonly dataCollapsed?: boolean;
  readonly onToggleDataCollapsed?: () => void;
}

export const InspectorPanel = ({
  store,
  registry,
  collapsed,
  onToggleCollapsed,
  dataCollapsed = false,
  onToggleDataCollapsed = () => undefined,
}: InspectorPanelProps) => {
  const selected = useStore(store, editorSelectors.selectedComponent);
  const configurationTitle = selected === null ? "配置" : `${selected.title ?? "柱图"}配置`;
  const content = selected === null ? (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未选择组件" />
  ) : (() => {
    const definition = registry.get(selected.type);
    return (
      <div className="inspector-selected">
        {definition.dataSlots.length === 0 ? (
          <Typography.Text type="secondary">该组件不需要数据绑定。</Typography.Text>
        ) : (
          <ComponentBindingPanel store={store} component={selected} definition={definition} />
        )}
      </div>
    );
  })();
  const analysisContent = (
    <Collapse
      ghost
      className="inspector-analysis"
      items={[
        {
          key: "interaction",
          label: "数据交互",
          children: <Typography.Text type="secondary">数据交互配置功能开发中。</Typography.Text>,
        },
        {
          key: "advanced",
          label: "高级设置",
          children: <Typography.Text type="secondary">高级设置功能开发中。</Typography.Text>,
        },
      ]}
    />
  );

  if (collapsed) {
    return (
      <aside className={`editor-inspector editor-inspector--config-collapsed${dataCollapsed ? " editor-inspector--data-collapsed" : ""}`} aria-label="配置与数据面板">
        <section className="inspector-config inspector-config--collapsed" aria-label="配置面板">
          <Tooltip title="展开配置栏" placement="left">
            <Button
              type="text"
              aria-label="展开配置栏"
              icon={<MenuUnfoldOutlined />}
              onClick={onToggleCollapsed}
            />
          </Tooltip>
        </section>
        <ComponentDataPanel
          store={store}
          registry={registry}
          collapsed={dataCollapsed}
          onToggleCollapsed={onToggleDataCollapsed}
        />
      </aside>
    );
  }

  return (
    <aside className={`editor-inspector${dataCollapsed ? " editor-inspector--data-collapsed" : ""}`} aria-label="配置与数据面板">
      <section className="inspector-config editor-panel-scroll" aria-label="配置面板">
        <div className="inspector-heading">
        <strong>{configurationTitle}</strong>
        <span className="inspector-heading__actions">
          <Tooltip title="收起配置栏" placement="left">
            <Button
              type="text"
              size="small"
              aria-label="收起配置栏"
              icon={<MenuFoldOutlined />}
              onClick={onToggleCollapsed}
            />
          </Tooltip>
        </span>
        </div>
        <Tabs size="small" defaultActiveKey="component" items={[
          { key: "component", label: "字段", children: content },
          { key: "analysis", label: "分析", children: analysisContent },
        ]} />
      </section>
      <ComponentDataPanel
        store={store}
        registry={registry}
        collapsed={dataCollapsed}
        onToggleCollapsed={onToggleDataCollapsed}
      />
    </aside>
  );
};
