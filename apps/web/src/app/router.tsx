import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Result } from "antd";
import { Navigate, Outlet, createBrowserRouter, type RouteObject, useLocation } from "react-router-dom";

import { AuthRoute } from "../features/auth/AuthRoute.js";
import { readAuthSession } from "../features/auth/authSession.js";
import { DashboardHome } from "../features/dashboards/DashboardHome.js";

const NotFound = () => (
  <main style={{ minHeight: "100vh", padding: "48px 24px", background: "#f5f7fa" }}>
    <Result
      status="404"
      title={<h1 style={{ fontSize: 24, margin: 0 }}>页面未找到</h1>}
      subTitle="当前地址不存在，请返回看板首页。"
      extra={<Button type="primary" href="/" aria-label="返回看板首页" icon={<ArrowLeftOutlined />}>返回看板首页</Button>}
    />
  </main>
);

const ProtectedRoute = () => {
  const location = useLocation();
  return readAuthSession() ? <Outlet /> : <Navigate to="/auth" replace state={{ from: location.pathname }} />;
};

export const appRoutes: RouteObject[] = [
  { path: "/auth", Component: AuthRoute },
  {
    Component: ProtectedRoute,
    children: [
      { path: "/", Component: DashboardHome },
      { path: "/editor/:id", lazy: () => import("../features/editor/EditorRoute.js") },
    ],
  },
  { path: "/preview/:id", lazy: () => import("../features/preview/PreviewRoute.js") },
  { path: "/view/:id", lazy: () => import("../features/view/ViewRoute.js") },
  { path: "*", Component: NotFound },
];

export const router = createBrowserRouter(appRoutes);
