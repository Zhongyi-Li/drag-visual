import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Result, Spin } from "antd";
import { useParams } from "react-router-dom";

import { DashboardViewer } from "../viewer/DashboardViewer.js";
import { getPreviewDashboard } from "../viewer/viewerQueries.js";

export const Component = () => {
  const { id = "" } = useParams();
  const query = useQuery({
    queryKey: ["preview-dashboard", id],
    queryFn: () => getPreviewDashboard(id),
  });

  if (query.isPending) {
    return <main role="status" aria-label="正在加载预览"><Spin size="large"><span /></Spin></main>;
  }
  if (query.isError) {
    return (
      <main style={{ minHeight: "100vh", padding: "48px 24px", background: "#f5f7fa" }}>
        <Result
          status="500"
          title={<h1>加载预览失败</h1>}
          extra={<Button type="primary" aria-label="重试" icon={<ReloadOutlined />} onClick={() => void query.refetch()}>重试</Button>}
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
