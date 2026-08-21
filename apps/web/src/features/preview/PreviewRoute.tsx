import { BarChartOutlined, EditOutlined, ReloadOutlined, ShareAltOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Button, Result, Spin, Tag, message } from "antd";
import { useLocation, useParams } from "react-router-dom";

import { DashboardViewer } from "../viewer/DashboardViewer.js";
import { chartJumpFiltersFromSearch, chartJumpTargetFromSearch } from "../viewer/chartJump.js";
import { getPreviewDashboard } from "../viewer/viewerQueries.js";
import { appPath } from "../../app/appPath.js";

const copyLink = async (link: string): Promise<void> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(link);
      return;
    }
  } catch {
    // Fall back to the browser's legacy copy command for non-secure preview hosts.
  }

  const input = document.createElement("textarea");
  input.value = link;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("copy failed");
};

export const Component = () => {
  const { id = "" } = useParams();
  const location = useLocation();
  const isEmbedded = new URLSearchParams(location.search).get("embed") === "1";
  const query = useQuery({
    queryKey: ["preview-dashboard", id],
    queryFn: () => getPreviewDashboard(id),
  });
  const [messageApi, messageContext] = message.useMessage();

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

  const publishedUrl = new URL(appPath(`view/${id}`), globalThis.location.origin).toString();
  const sharePublishedDashboard = () => {
    void copyLink(publishedUrl).then(
      () => messageApi.success("发布页链接已复制，可直接分享给他人"),
      () => messageApi.error("链接复制失败，请稍后重试"),
    );
  };

  return (
    <>
      {messageContext}
      {!isEmbedded && (
        <header
          aria-label="预览工具栏"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 56,
            padding: "0 24px",
            borderBottom: "1px solid #e8e8e8",
            background: "rgba(255, 255, 255, 0.96)",
            boxShadow: "0 1px 4px rgba(0, 0, 0, 0.04)",
            backdropFilter: "blur(10px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span style={{ display: "inline-flex", color: "#1677ff", fontSize: 20 }} aria-hidden="true"><BarChartOutlined /></span>
            <h1 style={{ margin: 0, overflow: "hidden", fontSize: 16, fontWeight: 600, lineHeight: "24px", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{query.data.name}</h1>
            <Tag variant="filled" color="default">预览</Tag>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button href={appPath(`editor/${id}`)} icon={<EditOutlined />} aria-label="继续编辑">继续编辑</Button>
            <Button type="primary" icon={<ShareAltOutlined />} aria-label="分享" onClick={sharePublishedDashboard}>分享</Button>
          </div>
        </header>
      )}
      <DashboardViewer
        dashboard={query.data}
        mode="preview"
        headerDensity="compact"
        showHeader={false}
        embedded={isEmbedded}
        initialGlobalFilterValues={chartJumpFiltersFromSearch(location.search)}
        initialJumpTargetComponentId={chartJumpTargetFromSearch(location.search)}
      />
    </>
  );
};
