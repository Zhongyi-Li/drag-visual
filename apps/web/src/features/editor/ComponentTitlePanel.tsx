import { Input } from "antd";
import { useStore } from "zustand";

import type { EditorStore } from "./store/editorStore.js";

interface Props {
  readonly component: {
    readonly id: string;
    readonly title?: string | undefined;
  };
  readonly store: EditorStore;
}

/** A concise title control for the display accordion; explanatory copy lives outside the form. */
export const ComponentTitlePanel = ({ component, store }: Props) => {
  const current = useStore(store, (state) => state.history.present.components.find((candidate) => candidate.id === component.id) ?? component);
  return <section className="component-title-panel" aria-label="图表标题">
    <label>
      <span>标题</span>
      <Input
        aria-label="图表标题"
        maxLength={100}
        placeholder="添加标题"
        value={current.title ?? ""}
        onChange={(event) => store.getState().dispatch({ type: "component.title.update", componentId: component.id, nextTitle: event.target.value })}
      />
    </label>
  </section>;
};
