import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Result, Spin } from "antd";
import { useCallback, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import { useStore } from "zustand";

import { ApiError } from "../../api/ApiError.js";
import {
  createDashboard,
  getDashboard,
  publishDashboard,
  saveDashboard,
} from "../dashboards/dashboardApi.js";
import { EditorShell } from "./EditorShell.js";
import { RevisionConflictModal } from "./RevisionConflictModal.js";
import { useAutosave } from "./useAutosave.js";
import { createEditorStore, type EditorStore } from "./store/editorStore.js";
import { editorSelectors } from "./store/editorStore.js";

const EditorLoader = () => {
  const { id = "" } = useParams();
  const query = useQuery({
    queryKey: ["dashboard", id],
    queryFn: () => getDashboard(id),
  });
  if (query.isPending) {
    return <main className="editor-route-state" role="status" aria-label="正在加载看板"><Spin size="large" description="正在加载看板"><span /></Spin></main>;
  }
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <main className="editor-route-state">
        <Result
          status={missing ? "404" : "500"}
          title={<h1>{missing ? "看板不存在" : "加载看板失败"}</h1>}
          subTitle={missing ? "该看板可能已被删除。" : "服务暂时不可用，请稍后重试。"}
          extra={missing
            ? <Button href="/" aria-label="返回看板首页" icon={<ArrowLeftOutlined />}>返回看板首页</Button>
            : <Button type="primary" aria-label="重试" icon={<ReloadOutlined />} onClick={() => void query.refetch()}>重试</Button>}
        />
      </main>
    );
  }

  return <LoadedEditor key={query.data.id} dashboard={query.data} />;
};

const LoadedEditor = ({ dashboard }: { dashboard: Dashboard }) => {
  const [store] = useState<EditorStore>(() => createEditorStore(dashboard));
  const [conflictOpen, setConflictOpen] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const currentDashboard = useStore(store, editorSelectors.dashboard);
  const dirty = useStore(store, (state) => state.dirty);
  const currentWritableDashboard = DashboardSchema.parse(currentDashboard);
  const savingPromise = useRef<Promise<Dashboard> | null>(null);

  const save = useCallback(async (snapshot: Dashboard) => {
    if (savingPromise.current) return savingPromise.current;
    store.getState().markSaving();
    const request = (async () => {
      const saved = await saveDashboard(snapshot);
      store.getState().markSaved(saved);
      return saved;
    })();
    savingPromise.current = request;
    try {
      return await request;
    } catch (error: unknown) {
      store.getState().markSaveFailed();
      if (error instanceof ApiError && error.status === 409 && error.code === "DASHBOARD_VERSION_CONFLICT") {
        setConflictOpen(true);
      }
      throw error;
    } finally {
      if (savingPromise.current === request) savingPromise.current = null;
    }
  }, [store]);

  useAutosave({ dashboard: currentWritableDashboard, dirty, save });

  const onSave = useCallback(() => {
    void save(DashboardSchema.parse(editorSelectors.dashboard(store.getState()))).catch(() => undefined);
  }, [save, store]);

  const onPublish = useCallback(() => {
    void (async () => {
      const snapshot = DashboardSchema.parse(editorSelectors.dashboard(store.getState()));
      const saved = store.getState().dirty ? await save(snapshot) : snapshot;
      const published = await publishDashboard(saved.id);
      setPublishedId(published.id);
    })().catch(() => undefined);
  }, [save, store]);

  const onPreview = useCallback(() => {
    void (async () => {
      const snapshot = DashboardSchema.parse(editorSelectors.dashboard(store.getState()));
      const saved = store.getState().dirty ? await save(snapshot) : snapshot;
      window.open(`/preview/${saved.id}`, "_blank", "noopener,noreferrer");
    })().catch(() => undefined);
  }, [save, store]);

  const onReloadServerVersion = useCallback(() => {
    window.location.reload();
  }, []);

  const onCopyLocalVersion = useCallback(() => {
    void (async () => {
      const local = DashboardSchema.parse(editorSelectors.dashboard(store.getState()));
      const created = await createDashboard(`${local.name} 副本`);
      const saved = await saveDashboard({
        ...local,
        id: created.id,
        name: created.name,
        revision: created.revision,
        updatedAt: created.updatedAt,
      });
      window.location.assign(`/editor/${saved.id}`);
    })().catch(() => undefined);
  }, [store]);

  return (
    <>
      {publishedId && (
        <Alert
          type="success"
          showIcon
          message="发布成功"
          action={<Link to={`/view/${publishedId}`}><Button type="link">打开发布页</Button></Link>}
          style={{ position: "fixed", zIndex: 20, top: 16, right: 16 }}
        />
      )}
      <EditorShell store={store} onSave={onSave} onPreview={onPreview} onPublish={onPublish} />
      <RevisionConflictModal
        open={conflictOpen}
        onReload={onReloadServerVersion}
        onCopy={onCopyLocalVersion}
        onCancel={() => setConflictOpen(false)}
      />
    </>
  );
};

export const Component = EditorLoader;
