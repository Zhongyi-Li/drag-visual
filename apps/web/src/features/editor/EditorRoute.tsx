import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Result, Spin } from "antd";
import { useState } from "react";
import { useParams } from "react-router-dom";
import type { Dashboard } from "@drag-visual/contracts";

import { ApiError } from "../../api/ApiError.js";
import { getDashboard } from "../dashboards/dashboardApi.js";
import { EditorShell } from "./EditorShell.js";
import { createEditorStore, type EditorStore } from "./store/editorStore.js";

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
  return <EditorShell store={store} />;
};

export const Component = EditorLoader;
