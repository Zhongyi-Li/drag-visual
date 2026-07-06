import {
  ArrowLeftOutlined,
  BarChartOutlined,
  CloudOutlined,
  EyeOutlined,
  RedoOutlined,
  SaveOutlined,
  UndoOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import { Button, Space, Tooltip } from "antd";
import { useStore } from "zustand";

import { editorSelectors, type EditorStore } from "./store/editorStore.js";

interface EditorToolbarProps {
  store: EditorStore;
  onSave?: (() => void) | undefined;
  onPreview?: (() => void) | undefined;
  onPublish?: (() => void) | undefined;
  onAddChart: () => void;
}

export const EditorToolbar = ({ store, onSave, onPreview, onPublish, onAddChart }: EditorToolbarProps) => {
  const dashboard = useStore(store, editorSelectors.dashboard);
  const dirty = useStore(store, (state) => state.dirty);
  const saveStatus = useStore(store, (state) => state.saveStatus);
  const canUndo = useStore(store, editorSelectors.canUndo);
  const canRedo = useStore(store, editorSelectors.canRedo);

  return (
    <header className="editor-header">
      <div className="editor-header__primary">
        <div className="editor-header__identity">
          <Tooltip title="返回看板首页">
            <a className="editor-icon-link" href="/" aria-label="返回看板首页"><ArrowLeftOutlined /></a>
          </Tooltip>
          <span className="editor-product-mark" aria-hidden="true"><BarChartOutlined /></span>
          <div className="editor-title-block">
            <strong>{dashboard.name}</strong>
            <span role="status" aria-label="保存状态" aria-live="polite">
              <CloudOutlined /> {saveStatus === "saving" ? "正在保存" : saveStatus === "error" ? "保存失败" : dirty ? "有未保存更改" : "已保存"}
            </span>
          </div>
          <div className="editor-history-actions">
            <Tooltip title="撤销">
              <Button type="text" icon={<UndoOutlined />} aria-label="撤销" disabled={!canUndo} onClick={() => store.getState().undo()} />
            </Tooltip>
            <Tooltip title="重做">
              <Button type="text" icon={<RedoOutlined />} aria-label="重做" disabled={!canRedo} onClick={() => store.getState().redo()} />
            </Tooltip>
          </div>
        </div>
        <Space size={8}>
          <Tooltip title={onPreview ? "预览看板" : "预览功能将在后续阶段接入"}>
            <Button icon={<EyeOutlined />} aria-label="预览" disabled={!onPreview} onClick={onPreview}>预览</Button>
          </Tooltip>
          <Tooltip title={onSave ? "保存看板" : "保存功能将在后续阶段接入"}>
            <Button icon={<SaveOutlined />} aria-label="保存" disabled={!onSave || saveStatus === "saving"} onClick={onSave}>保存</Button>
          </Tooltip>
          <Tooltip title={onPublish ? "发布看板" : "发布功能将在后续阶段接入"}>
            <Button type="primary" icon={<UploadOutlined />} aria-label="发布" disabled={!onPublish || saveStatus === "saving"} onClick={onPublish}>发布</Button>
          </Tooltip>
        </Space>
      </div>
      <nav className="editor-header__tools" aria-label="编辑工具">
        <Button type="text" icon={<BarChartOutlined />} aria-label="添加图表" onClick={onAddChart}>添加图表</Button>
        <Tooltip title="添加查询控件即将开放">
          <span><Button type="text" disabled aria-label="添加查询控件（即将开放）">添加查询控件</Button></span>
        </Tooltip>
        <span className="editor-tools__hint">拖动组件可调整位置</span>
      </nav>
    </header>
  );
};
