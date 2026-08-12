import { Input, Typography } from "antd";
import { useStore } from "zustand";

import type { EditorStore } from "./store/editorStore.js";

interface Props {
  readonly component: {
    readonly id: string;
    readonly title?: string | undefined;
  };
  readonly store: EditorStore;
}

/**
 * Keeps chart identity intentionally small; supporting copy lives with the
 * other chart explanations in the auxiliary explanation section.
 */
export const ComponentInfoPanel = ({ component, store }: Props) => {
  const current = useStore(store, (state) => state.history.present.components.find((candidate) => candidate.id === component.id) ?? component);
  return <section className="component-info-panel" aria-label="图表信息">
    <Typography.Text strong>图表信息</Typography.Text>
    <Typography.Text type="secondary">标题用于识别图表。</Typography.Text>
    <label>
      <span>标题</span>
      <Input aria-label="图表标题" maxLength={100} placeholder="添加标题" value={current.title ?? ""} onChange={(event) => store.getState().dispatch({ type: "component.title.update", componentId: component.id, nextTitle: event.target.value })} />
    </label>
  </section>;
};
