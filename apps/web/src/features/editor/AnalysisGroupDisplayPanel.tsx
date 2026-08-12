import { Input, InputNumber, Switch, Typography } from "antd";
import type { ComponentDefinition } from "@drag-visual/component-registry";
import { useStore } from "zustand";

import type { EditorStore } from "./store/editorStore.js";

interface Props {
  readonly component: { readonly id: string; readonly type: ComponentDefinition["type"]; readonly props: Readonly<Record<string, unknown>>; };
  readonly definition: ComponentDefinition;
  readonly store: EditorStore;
}

/** Display controls owned by the analysis-group container rather than its child charts. */
export const AnalysisGroupDisplayPanel = ({ component, definition, store }: Props) => {
  const current = useStore(store, (state) => state.history.present.components.find((item) => item.id === component.id) ?? component);
  const props = { ...definition.createDefaults(), ...current.props } as { description: string; columns: number; gap: number; showSurface: boolean };
  const update = (next: Partial<typeof props>) => {
    const parsed = definition.propsSchema.safeParse({ ...props, ...next });
    if (parsed.success) store.getState().dispatch({ type: "component.props.update", componentId: current.id, nextProps: parsed.data });
  };

  return <section className="analysis-group-display-panel" aria-label="复合分析显示配置">
    <Typography.Text strong>容器展示</Typography.Text>
    <Typography.Paragraph type="secondary" style={{ margin: "4px 0 12px" }}>
      配置复合分析在预览与发布页中的说明、内部布局和容器外观。
    </Typography.Paragraph>
    <div className="analysis-group-panel">
      <label>说明<Input aria-label="复合分析说明" value={props.description} maxLength={180} onChange={(event) => update({ description: event.target.value })} /></label>
      <label>内部栅格列数<InputNumber aria-label="内部栅格列数" min={2} max={12} value={props.columns} onChange={(value) => update({ columns: typeof value === "number" ? value : 12 })} /></label>
      <label>图表间距<InputNumber aria-label="图表间距" min={4} max={32} value={props.gap} onChange={(value) => update({ gap: typeof value === "number" ? value : 12 })} /></label>
      <label className="analysis-group-panel__switch">显示容器边框<Switch aria-label="显示容器边框" checked={props.showSurface} onChange={(checked) => update({ showSurface: checked })} /></label>
    </div>
  </section>;
};
