import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Result, Spin } from "antd";
import { useParams } from "react-router-dom";

import { ApiError } from "../../api/ApiError.js";
import { DashboardViewer } from "../viewer/DashboardViewer.js";
import { getPublishedViewerDashboard } from "../viewer/viewerQueries.js";

export const Component = () => {
  const { id = "" } = useParams();
  const query = useQuery({
    queryKey: ["published-dashboard", id],
    queryFn: () => getPublishedViewerDashboard(id),
  });

  if (query.isPending) {
    return <main role="status" aria-label="正在加载发布页"><Spin size="large"><span /></Spin></main>;
  }
  if (query.isError) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <main style={{ minHeight: "100vh", padding: "48px 24px", background: "#f5f7fa" }}>
        <Result
          status={missing ? "404" : "500"}
          title={<h1>{missing ? "发布页不存在" : "加载发布页失败"}</h1>}
          extra={missing
            ? <Button href="/" aria-label="返回看板首页" icon={<ArrowLeftOutlined />}>返回看板首页</Button>
            : <Button type="primary" aria-label="重试" icon={<ReloadOutlined />} onClick={() => void query.refetch()}>重试</Button>}
        />
      </main>
    );
  }

  return (
    <>
      <Button href="/" aria-label="返回看板首页" icon={<ArrowLeftOutlined />} style={{ position: "fixed", zIndex: 10, top: 16, left: 16 }}>
        返回看板首页
      </Button>
      <DashboardViewer dashboard={query.data} />
    </>
  );
};
