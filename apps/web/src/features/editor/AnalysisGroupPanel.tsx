import { Typography } from "antd";
import type { ComponentDefinition } from "@drag-visual/component-registry";
import { useStore } from "zustand";

import type { EditorStore } from "./store/editorStore.js";
import { AnalysisGroupDateFilterConfigurationPanel } from "./AnalysisGroupDateFilterConfigurationPanel.js";
import { QueryFiltersPanel } from "./QueryFiltersPanel.js";

interface Props {
  readonly component: { readonly id: string; readonly type: ComponentDefinition["type"]; readonly props: Readonly<Record<string, unknown>>; };
  readonly definition: ComponentDefinition;
  readonly store: EditorStore;
}

export const AnalysisGroupPanel = ({ component, definition, store }: Props) => {
  const current = useStore(store, (state) => state.history.present.components.find((item) => item.id === component.id) ?? component);
  return <div className="analysis-group-panel">
    <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
      复合分析统一管理内部图表的共享查询条件和时间范围；展示样式请在“显示”中配置。
    </Typography.Paragraph>
    <div className="inspector-analysis__card inspector-analysis__date-card">
      <div className="inspector-analysis__card-heading">日期筛选</div>
      <AnalysisGroupDateFilterConfigurationPanel component={current} store={store} />
    </div>
    <QueryFiltersPanel component={current} definition={definition} scope="analysisGroup" store={store} />
  </div>;
};
