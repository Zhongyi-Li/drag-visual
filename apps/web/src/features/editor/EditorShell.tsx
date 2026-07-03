import { AppstoreAddOutlined } from "@ant-design/icons";
import { createDefaultRegistry, type ComponentRegistry } from "@drag-visual/component-registry";
import { useStore } from "zustand";

import { ComponentPalette } from "./ComponentPalette.js";
import { EditorToolbar } from "./EditorToolbar.js";
import { InspectorPanel } from "./InspectorPanel.js";
import "./editor.css";
import { editorSelectors, type EditorStore } from "./store/editorStore.js";

interface EditorShellProps {
  store: EditorStore;
  createComponentId?: () => string;
  onSave?: () => void;
  onPreview?: () => void;
  onPublish?: () => void;
  registry?: ComponentRegistry;
}

const defaultRegistry = createDefaultRegistry();

export const EditorShell = ({
  store,
  createComponentId = () => crypto.randomUUID(),
  onSave,
  onPreview,
  onPublish,
  registry = defaultRegistry,
}: EditorShellProps) => {
  const components = useStore(store, (state) => editorSelectors.dashboard(state).components);
  return (
    <div className="editor-app">
      <EditorToolbar
        store={store}
        onSave={onSave}
        onPreview={onPreview}
        onPublish={onPublish}
        onAddChart={() => document.getElementById("component-search")?.focus()}
      />
      <div className="editor-workbench">
        <ComponentPalette store={store} createComponentId={createComponentId} registry={registry} />
        <main className="editor-canvas" aria-label="看板画布">
          <div className="editor-canvas__stage">
            <AppstoreAddOutlined />
            {components.length === 0 ? (
              <><strong>从左侧添加图表</strong><span>网格拖拽画布将在下一阶段开放</span></>
            ) : (
              <><strong>已添加 {components.length} 个组件</strong><span>组件已写入看板，网格呈现将在下一阶段开放</span></>
            )}
          </div>
        </main>
        <InspectorPanel store={store} />
      </div>
    </div>
  );
};
