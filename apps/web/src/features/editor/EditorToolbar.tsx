import {
  ArrowLeftOutlined,
  BarChartOutlined,
  CloudUploadOutlined,
  CloudOutlined,
  CompressOutlined,
  EditOutlined,
  EyeOutlined,
  RedoOutlined,
  SaveOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { Button, Input, Space, Tooltip, type InputRef } from "antd";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";

import { editorSelectors, type EditorStore } from "./store/editorStore.js";
import { FileDatasetImporter } from "./FileDatasetImporter.js";
import { appPath } from "../../app/appPath.js";

interface EditorToolbarProps {
  store: EditorStore;
  onSave?: (() => void) | undefined;
  onPreview?: (() => void) | undefined;
  onPublish?: (() => void) | undefined;
  onAutoArrange: () => void;
  onAddChart: () => void;
  onRename: (name: string) => void;
}

export const EditorToolbar = ({ store, onSave, onPreview, onPublish, onAutoArrange, onAddChart, onRename }: EditorToolbarProps) => {
  const dashboard = useStore(store, editorSelectors.dashboard);
  const dirty = useStore(store, (state) => state.dirty);
  const saveStatus = useStore(store, (state) => state.saveStatus);
  const canUndo = useStore(store, editorSelectors.canUndo);
  const canRedo = useStore(store, editorSelectors.canRedo);
  const hasTopLevelComponents = dashboard.layout.some((item) => item.parentId === undefined);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(dashboard.name);
  const nameInput = useRef<InputRef>(null);
  const nameCommitInProgress = useRef(false);

  useEffect(() => {
    if (!editingName) setNameDraft(dashboard.name);
  }, [dashboard.name, editingName]);

  useEffect(() => {
    if (editingName) nameInput.current?.focus();
  }, [editingName]);

  const beginRename = () => {
    nameCommitInProgress.current = false;
    setEditingName(true);
  };
  const cancelRename = () => {
    nameCommitInProgress.current = false;
    setNameDraft(dashboard.name);
    setEditingName(false);
  };
  const commitRename = () => {
    if (nameCommitInProgress.current) return;
    const nextName = nameDraft.trim();
    if (!nextName || nextName === dashboard.name) return cancelRename();
    nameCommitInProgress.current = true;
    onRename(nextName);
    setEditingName(false);
  };

  return (
    <header className="editor-header">
      <div className="editor-header__primary">
        <div className="editor-header__identity">
          <Tooltip title="返回看板首页">
            <a className="editor-icon-link" href={appPath()} aria-label="返回看板首页"><ArrowLeftOutlined /></a>
          </Tooltip>
          <span className="editor-product-mark" aria-hidden="true"><BarChartOutlined /></span>
          <div className="editor-title-block">
            <div className="editor-title-block__name-row">
              {editingName ? (
                <Input
                  ref={nameInput}
                  size="small"
                  maxLength={100}
                  value={nameDraft}
                  aria-label="编辑看板名称"
                  onChange={(event) => setNameDraft(event.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") commitRename();
                    if (event.key === "Escape") cancelRename();
                  }}
                />
              ) : (
                <>
                  <strong>{dashboard.name}</strong>
                  <Tooltip title="修改看板名称">
                    <Button type="text" size="small" icon={<EditOutlined />} aria-label="修改看板名称" onClick={beginRename} />
                  </Tooltip>
                </>
              )}
            </div>
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
          <Tooltip title={onPublish ? "保存并发布看板" : "发布功能将在后续阶段接入"}>
            <Button type="primary" icon={<CloudUploadOutlined />} aria-label="保存并发布" disabled={!onPublish || saveStatus === "saving"} onClick={onPublish}>保存并发布</Button>
          </Tooltip>
        </Space>
      </div>
      <nav className="editor-header__tools" aria-label="编辑工具">
        <Button type="text" icon={<BarChartOutlined />} aria-label="添加图表" onClick={onAddChart}>添加图表</Button>
        <FileDatasetImporter />
        <Tooltip title={hasTopLevelComponents ? "按当前阅读顺序紧凑整理顶层组件，不改变尺寸" : "添加组件后即可整理"}>
          <span><Button type="text" icon={<CompressOutlined />} aria-label="一件整理" disabled={!hasTopLevelComponents} onClick={onAutoArrange}>一件整理</Button></span>
        </Tooltip>
        <Tooltip title="添加查询控件即将开放">
          <span><Button type="text" disabled aria-label="添加查询控件（即将开放）">添加查询控件</Button></span>
        </Tooltip>
        <span className="editor-tools__hint">拖动组件可调整位置</span>
      </nav>
    </header>
  );
};
