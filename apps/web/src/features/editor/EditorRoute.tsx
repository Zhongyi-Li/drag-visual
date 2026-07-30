import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Result, Spin, message } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DashboardSchema, type Dashboard, type Dataset, type DatasetQueryResult } from "@drag-visual/contracts";
import { useStore } from "zustand";

import { ApiError } from "../../api/ApiError.js";
import {
  createDashboard,
  getDashboard,
  publishDashboard,
  renameDashboard,
  saveDashboard,
} from "../dashboards/dashboardApi.js";
import { writePreviewSnapshot } from "../preview/previewSnapshotStore.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
import { getDataset, listDatasets, queryDataset } from "../datasets/datasetApi.js";
import { buildRuntimeParameters, runtimeParameters } from "../datasets/RuntimeDatasetRequestBar.js";
import { EditorShell } from "./EditorShell.js";
import { RevisionConflictModal } from "./RevisionConflictModal.js";
import { useAutosave } from "./useAutosave.js";
import { createEditorStore, type EditorStore } from "./store/editorStore.js";
import { editorSelectors } from "./store/editorStore.js";
import { appPath } from "../../app/appPath.js";

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
            ? <Button href={appPath()} aria-label="返回看板首页" icon={<ArrowLeftOutlined />}>返回看板首页</Button>
            : <Button type="primary" aria-label="重试" icon={<ReloadOutlined />} onClick={() => void query.refetch()}>重试</Button>}
        />
      </main>
    );
  }

  return <LoadedEditor key={query.data.id} dashboard={query.data} />;
};

interface InterfaceDatasetSnapshot {
  readonly schema: Dataset;
  readonly result: DatasetQueryResult;
}

const loadInterfaceDatasets = async (): Promise<readonly InterfaceDatasetSnapshot[]> => {
  const summaries = await listDatasets();
  const snapshots = await Promise.all(summaries.map(async (summary) => {
    const schema = await getDataset(summary.id);
    // A dataset with non-runtime required inputs still needs a user-provided
    // business filter, so it cannot be safely materialized on editor entry.
    const runtime = runtimeParameters(schema.parameters);
    // The editor currently auto-materializes paged interface datasets. Other
    // remote datasets may still require business filters and remain opt-in.
    if (runtime.length === 0 || schema.parameters.some((parameter) => parameter.required && parameter.runtime !== true)) return null;
    const result = await queryDataset(schema.id, buildRuntimeParameters(runtime, {}));
    return { schema, result };
  }));
  return snapshots.filter((snapshot): snapshot is InterfaceDatasetSnapshot => snapshot !== null);
};

const InterfaceDatasetBootstrap = () => {
  const localDatasets = useLocalDatasets();
  const bootstrapped = useRef(new Set<string>());
  const query = useQuery({
    queryKey: ["editor-interface-dataset-bootstrap"],
    queryFn: loadInterfaceDatasets,
    staleTime: Infinity,
  });

  useEffect(() => {
    for (const snapshot of query.data ?? []) {
      if (bootstrapped.current.has(snapshot.schema.id)) continue;
      bootstrapped.current.add(snapshot.schema.id);
      localDatasets.upsertRuntimeDataset({
        schema: snapshot.result.datasetName === undefined
          ? { ...snapshot.schema, fields: snapshot.result.columns }
          : { ...snapshot.schema, name: snapshot.result.datasetName, fields: snapshot.result.columns },
        result: snapshot.result,
      });
    }
  }, [localDatasets, query.data]);
  return null;
};

const LoadedEditor = ({ dashboard }: { dashboard: Dashboard }) => {
  const [store] = useState<EditorStore>(() => createEditorStore(dashboard));
  const [conflictOpen, setConflictOpen] = useState(false);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [publishFailed, setPublishFailed] = useState(false);
  const currentDashboard = useStore(store, editorSelectors.dashboard);
  const dirty = useStore(store, (state) => state.dirty);
  const currentWritableDashboard = DashboardSchema.parse(currentDashboard);
  const savingPromise = useRef<Promise<Dashboard> | null>(null);

  const saveSnapshot = useCallback(async (snapshot: Dashboard) => {
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
      if (error instanceof ApiError && error.status === 409) {
        setConflictOpen(true);
      }
      throw error;
    } finally {
      if (savingPromise.current === request) savingPromise.current = null;
    }
  }, [store]);

  const save = useCallback(async (_snapshot: Dashboard) => {
    if (savingPromise.current) await savingPromise.current;
    const latest = DashboardSchema.parse(editorSelectors.dashboard(store.getState()));
    if (!store.getState().dirty) return latest;
    return saveSnapshot(latest);
  }, [saveSnapshot, store]);

  const ensureLatestSaved = useCallback(async (): Promise<Dashboard> => {
    while (true) {
      if (savingPromise.current) await savingPromise.current;
      const snapshot = DashboardSchema.parse(editorSelectors.dashboard(store.getState()));
      if (!store.getState().dirty) return snapshot;
      const saved = await saveSnapshot(snapshot);
      if (!store.getState().dirty) return saved;
    }
  }, [saveSnapshot, store]);

  useAutosave({ dashboard: currentWritableDashboard, dirty, save });

  const onSave = useCallback(() => {
    if (!store.getState().dirty) {
      void message.info("当前看板已保存，没有需要提交的更改");
      return;
    }
    void save(DashboardSchema.parse(editorSelectors.dashboard(store.getState()))).then(
      () => message.success("看板已保存"),
      () => message.error("保存失败，请检查后端服务后重试"),
    );
  }, [save, store]);

  const onRename = useCallback((name: string) => {
    const hadPendingChanges = store.getState().dirty;
    store.getState().dispatch({ type: "dashboard.name.update", nextName: name });
    if (hadPendingChanges) return;

    const snapshot = DashboardSchema.parse(editorSelectors.dashboard(store.getState()));
    store.getState().markSaving();
    const request = renameDashboard(snapshot.id, snapshot.name, snapshot.revision);
    savingPromise.current = request;
    void request.then(
      (saved) => store.getState().markSaved(saved),
      (error: unknown) => {
        store.getState().markSaveFailed();
        if (error instanceof ApiError && error.status === 409) setConflictOpen(true);
      },
    ).finally(() => {
      if (savingPromise.current === request) savingPromise.current = null;
    });
  }, [store]);

  const onPublish = useCallback(() => {
    void (async () => {
      let saved: Dashboard;
      try {
        saved = await ensureLatestSaved();
      } catch {
        return;
      }
      setPublishFailed(false);
      try {
        const published = await publishDashboard(saved.id);
        setPublishedId(published.id);
      } catch {
        setPublishFailed(true);
      }
    })();
  }, [ensureLatestSaved]);

  const onPreview = useCallback(() => {
    const snapshot = DashboardSchema.parse(editorSelectors.dashboard(store.getState()));
    writePreviewSnapshot(snapshot);
    window.open(appPath(`preview/${snapshot.id}`), "_blank", "noopener,noreferrer");
  }, [store]);

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
      window.location.assign(appPath(`editor/${saved.id}`));
    })().catch(() => undefined);
  }, [store]);

  return (
    <>
      <InterfaceDatasetBootstrap />
      {(publishedId || publishFailed) && (
        <div className="editor-route-alerts">
          {publishedId && (
            <Alert
              type="success"
              showIcon
              title="发布成功"
              action={<Link to={`/view/${publishedId}`}>打开发布页</Link>}
            />
          )}
          {publishFailed && (
            <Alert
              type="error"
              showIcon
              title="发布失败"
              description="未能发布当前版本，请稍后重试。"
            />
          )}
        </div>
      )}
      <EditorShell store={store} onSave={onSave} onPreview={onPreview} onPublish={onPublish} onRename={onRename} />
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
