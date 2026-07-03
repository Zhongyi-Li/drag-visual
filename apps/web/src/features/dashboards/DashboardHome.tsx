import { ApiOutlined, PlusOutlined } from "@ant-design/icons";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Card, Space, Typography } from "antd";
import { useNavigate } from "react-router-dom";

import { createDashboard } from "./dashboardApi.js";
import "./dashboardHome.css";

const { Paragraph, Text, Title } = Typography;

export const DashboardHome = () => {
  const navigate = useNavigate();
  const createMutation = useMutation({
    mutationFn: () => createDashboard("未命名看板"),
    onSuccess: (dashboard) => navigate(`/editor/${dashboard.id}`),
  });

  const create = () => createMutation.mutate();

  return (
    <div className="dashboard-home">
      <header className="dashboard-home__header">
        <div className="dashboard-home__brand">可视化看板</div>
        <div className="dashboard-home__environment">内部工作台</div>
      </header>
      <main className="dashboard-home__main">
        <section className="dashboard-home__intro" aria-labelledby="home-title">
          <Text className="dashboard-home__eyebrow">看板配置</Text>
          <Title id="home-title" level={1}>可视化看板</Title>
          <Paragraph>
            创建并配置内部业务看板，将统一业务数据整理为清晰、可发布的可视化页面。
          </Paragraph>
        </section>

        <Card className="dashboard-home__action-card">
          <div className="dashboard-home__action-content">
            <div>
              <Title level={2}>开始配置看板</Title>
              <Paragraph>新看板将以空白布局创建，随后进入编辑工作台。</Paragraph>
            </div>
            <Button
              type="primary"
              size="large"
              aria-label={createMutation.isPending ? "正在创建看板" : "新建看板"}
              icon={<PlusOutlined />}
              loading={createMutation.isPending}
              disabled={createMutation.isPending}
              onClick={create}
            >
              {createMutation.isPending ? "正在创建看板" : "新建看板"}
            </Button>
          </div>

          {createMutation.isError && (
            <Alert
              className="dashboard-home__error"
              type="error"
              showIcon
              role="alert"
              title="创建看板失败"
              description="暂时无法创建看板，请检查服务状态后重试。"
              action={<Button danger aria-label="重试" onClick={create}>重试</Button>}
            />
          )}
        </Card>

        <div className="dashboard-home__status" aria-label="数据服务状态">
          <Space size={8}>
            <ApiOutlined aria-hidden="true" />
            <Text type="secondary">数据由统一业务 API 提供</Text>
          </Space>
        </div>
      </main>
    </div>
  );
};
