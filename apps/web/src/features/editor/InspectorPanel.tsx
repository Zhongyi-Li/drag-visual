import { MenuFoldOutlined, MenuUnfoldOutlined, SettingOutlined } from "@ant-design/icons";
import { Button, Collapse, Drawer, Empty, Tabs, Tooltip, Typography } from "antd";
import { useState } from "react";
import type { ComponentRegistry } from "@drag-visual/component-registry";
import { useStore } from "zustand";

import { ComponentBindingPanel } from "./ComponentBindingPanel.js";
import { ComponentDataPanel } from "./ComponentDataPanel.js";
import { ComponentTitlePanel } from "./ComponentTitlePanel.js";
import { ComponentStylePanel } from "./ComponentStylePanel.js";
import { DisplayHintsPanel } from "./DisplayHintsPanel.js";
import { DateFilterConfigurationPanel } from "./DateFilterConfigurationPanel.js";
import { DashboardHeaderPanel } from "./DashboardHeaderPanel.js";
import { KpiInsightPanel } from "./KpiInsightPanel.js";
import { AnalysisGroupPanel } from "./AnalysisGroupPanel.js";
import { AnalysisGroupDisplayPanel } from "./AnalysisGroupDisplayPanel.js";
import { QueryFiltersPanel } from "./QueryFiltersPanel.js";
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
  const [insightSettingsOpen, setInsightSettingsOpen] = useState(false);
  const configurationTitle = selected === null ? "配置" : `${selected.title?.trim() || registry.get(selected.type).title}配置`;
  const content = selected === null ? (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未选择组件" />
  ) : (() => {
    const definition = registry.get(selected.type);
    return (
      <div className="inspector-selected">
        {selected.type === "dashboardHeader" ? (
          <DashboardHeaderPanel component={selected} definition={definition} store={store} />
        ) : selected.type === "analysisGroup" ? (
          <AnalysisGroupPanel component={selected} definition={definition} store={store} />
        ) : definition.dataSlots.length === 0 ? (
          <Typography.Text type="secondary">该组件不需要数据绑定。</Typography.Text>
        ) : selected.type === "kpiInsight" ? (
          <>
            <ComponentBindingPanel
              compact
              component={selected}
              definition={definition}
              showRefreshButton
              slotKeys={["measure"]}
              slotActions={{
                measure: <Tooltip title="配置指标洞察" placement="topRight">
                  <Button
                    aria-label="打开指标洞察设置"
                    className="binding-field__settings"
                    icon={<SettingOutlined />}
                    size="small"
                    type="text"
                    onClick={() => setInsightSettingsOpen(true)}
                  />
                </Tooltip>,
              }}
              store={store}
            />
            <Drawer
              className="kpi-insight-drawer"
              destroyOnHidden
              footer={<div className="kpi-insight-drawer__footer"><Button type="primary" onClick={() => setInsightSettingsOpen(false)}>完成</Button></div>}
              open={insightSettingsOpen}
              placement="bottom"
              size="large"
              title="指标洞察设置"
              onClose={() => setInsightSettingsOpen(false)}
            >
              <div className="kpi-insight-drawer__content">
                <KpiInsightPanel component={selected} definition={definition} store={store} />
              </div>
            </Drawer>
          </>
        ) : selected.type === "progressIndicator" ? (
          <ComponentBindingPanel store={store} component={selected} definition={definition} />
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
      defaultActiveKey={["interaction"]}
      items={[
        {
          key: "interaction",
          label: "数据交互",
          children: selected === null
            ? <Typography.Text type="secondary">选择图表后配置日期筛选。</Typography.Text>
            : selected.type === "analysisGroup" || selected.type === "dashboardHeader"
              ? <Typography.Text type="secondary">该组件不支持独立数据交互。</Typography.Text>
              : <>
                  <div className="inspector-analysis__card inspector-analysis__date-card">
                    <div className="inspector-analysis__card-heading">日期筛选</div>
                    <DateFilterConfigurationPanel store={store} component={selected} />
                  </div>
                  <div className="inspector-analysis__card inspector-analysis__query-card">
                    <QueryFiltersPanel component={selected} definition={registry.get(selected.type)} scope="component" store={store} />
                  </div>
                </>,
        },
      ]}
    />
  );
  const displayContent = selected === null
    ? <Typography.Text type="secondary">选择图表后配置展示方式。</Typography.Text>
    : selected.type === "analysisGroup"
      ? <div className="display-configuration">
          <Collapse
            className="display-configuration__collapse"
            defaultActiveKey={["title", "container"]}
            ghost
          items={[
            {
              key: "title",
              label: "标题与卡片",
              children: <div className="display-configuration__body"><ComponentTitlePanel component={selected} store={store} /></div>,
            },
            {
              key: "container",
              label: "容器展示",
              children: <div className="display-configuration__body"><AnalysisGroupDisplayPanel component={selected} definition={registry.get(selected.type)} store={store} /></div>,
            },
          ]}
          />
        </div>
    : <div className="display-configuration">
        <Collapse
          className="display-configuration__collapse"
          defaultActiveKey={["title", "style"]}
          ghost
          items={[
            {
              key: "title",
              label: "标题与卡片",
              children: <div className="display-configuration__body"><ComponentTitlePanel component={selected} store={store} /></div>,
            },
            {
              key: "style",
              label: "图表样式",
              children: <div className="display-configuration__body"><ComponentStylePanel component={selected} definition={registry.get(selected.type)} store={store} /></div>,
            },
            {
              key: "hints",
              label: "辅助展示",
              children: <div className="display-configuration__body"><DisplayHintsPanel component={selected} store={store} /></div>,
            },
          ]}
        />
      </div>;

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
        <Tabs size="small" defaultActiveKey="component" items={selected?.type === "dashboardHeader"
          ? [{ key: "component", label: "设置", children: content }]
          : [
              { key: "component", label: "字段", children: content },
              { key: "display", label: "显示", children: displayContent },
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
