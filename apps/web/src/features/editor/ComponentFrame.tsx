import { CopyOutlined, DeleteOutlined } from "@ant-design/icons";
import type { ComponentInstance } from "@drag-visual/contracts";
import { Button, Tooltip } from "antd";
import type { MouseEvent } from "react";
import { useStore } from "zustand";

import { findAvailableLayout } from "./canvasLayout.js";
import type { EditorStore } from "./store/editorStore.js";

interface ComponentFrameProps {
  component: Pick<ComponentInstance, "id" | "type" | "title">;
  store: EditorStore;
  createComponentId: () => string;
  isInteracting: boolean;
}

export const ComponentFrame = ({ component, store, createComponentId, isInteracting }: ComponentFrameProps) => {
  const selected = useStore(store, (state) => state.selectedComponentId === component.id);
  const title = component.title ?? component.type;
  const select = () => store.getState().select(component.id);
  const stopControlEvent = (event: MouseEvent) => event.stopPropagation();
  const duplicate = () => {
    const state = store.getState();
    const sourceLayout = state.history.present.layout.find((item) => item.i === component.id);
    if (!sourceLayout) return;
    const newComponentId = createComponentId();
    const layout = findAvailableLayout(state.history.present.layout, { ...sourceLayout, i: newComponentId });
    state.dispatch({ type: "component.duplicate", sourceId: component.id, newComponentId, layout });
    store.getState().select(newComponentId);
  };
  const remove = () => {
    store.getState().dispatch({ type: "component.remove", componentId: component.id });
    store.getState().select(null);
  };

  return (
    <section
      aria-label={title}
      className={`component-frame${selected ? " component-frame--selected" : ""}`}
      role="group"
      tabIndex={0}
      onClick={select}
      onFocus={(event) => { if (event.target === event.currentTarget) select(); }}
    >
      <header className="component-frame__header">
        <strong>{title}</strong>
        <span className="component-frame__actions">
          <Tooltip title="复制">
            <Button type="text" size="small" aria-label={`复制${title}`} icon={<CopyOutlined />} onClick={(event) => { stopControlEvent(event); duplicate(); }} />
          </Tooltip>
          <Tooltip title="删除">
            <Button danger type="text" size="small" aria-label={`删除${title}`} icon={<DeleteOutlined />} onClick={(event) => { stopControlEvent(event); remove(); }} />
          </Tooltip>
        </span>
      </header>
      <div className="component-frame__placeholder" data-testid="component-placeholder" data-interacting={String(isInteracting)}>
        <span>{component.type}</span>
        <p>图表渲染将在后续阶段开放</p>
      </div>
    </section>
  );
};
