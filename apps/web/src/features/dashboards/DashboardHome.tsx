import {
  BarChartOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  FolderAddOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  SwapOutlined,
  UploadOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Avatar, Button, Checkbox, Dropdown, Input, Modal, Space, Spin, Tag, Tooltip, Typography } from "antd";
import type { Dashboard } from "@drag-visual/contracts";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createDashboard, deleteDashboard, listDashboards, publishDashboard } from "./dashboardApi.js";
import { clearAuthSession, readAuthSession } from "../auth/authSession.js";
import "./dashboardHome.css";

const { Text } = Typography;

const formatUpdatedAt = (value: string): string => new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}).format(new Date(value)).replaceAll("/", "/");

export const DashboardHome = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [dashboardToDelete, setDashboardToDelete] = useState<Dashboard | null>(null);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const account = readAuthSession()?.user;
  const accountName = account?.username ?? "当前用户";
  const dashboardQuery = useQuery({
    queryKey: ["dashboards"],
    queryFn: () => listDashboards(),
  });
  const createMutation = useMutation({
    mutationFn: () => createDashboard("未命名看板"),
    onSuccess: (dashboard) => {
      void queryClient.invalidateQueries({ queryKey: ["dashboards"] });
      navigate(`/editor/${dashboard.id}`);
    },
  });
  const publishMutation = useMutation({
    mutationFn: (id: string) => publishDashboard(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["dashboards"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDashboard(id),
    onSuccess: () => {
      setDashboardToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });

  const dashboards = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase();
    if (!normalizedKeyword) return dashboardQuery.data ?? [];
    return (dashboardQuery.data ?? []).filter((dashboard) =>
      dashboard.name.toLocaleLowerCase().includes(normalizedKeyword));
  }, [dashboardQuery.data, keyword]);

  const create = () => createMutation.mutate();
  const refresh = () => void dashboardQuery.refetch();
  const returnToAccountEntry = () => {
    clearAuthSession();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="dashboard-home">
      <header className="dashboard-home__header">
        <div className="dashboard-home__brand" aria-label="ZHBi">
          <span>ZH</span><span className="dashboard-home__brand-bi">Bi</span>
        </div>
        <div className="dashboard-home__header-actions">
          <Dropdown
            trigger={["hover", "click"]}
            placement="bottomRight"
            menu={{
              items: [
                { key: "settings", icon: <SettingOutlined />, label: "账号设置", onClick: () => setAccountSettingsOpen(true) },
                { key: "switch", icon: <SwapOutlined />, label: "切换账号", onClick: returnToAccountEntry },
                { type: "divider" },
                { key: "logout", icon: <LogoutOutlined />, label: "退出登录", danger: true, onClick: returnToAccountEntry },
              ],
            }}
          >
            <button className="dashboard-home__account-trigger" type="button" aria-label={`打开 ${accountName} 的账号菜单`}>
              <span className="dashboard-home__account-copy"><span>Hello,</span><strong title={accountName}>{accountName}</strong></span>
              <Avatar className="dashboard-home__avatar" size={42} src="/images/zhbi-avatar.png" alt="默认头像" />
            </button>
          </Dropdown>
        </div>
      </header>

      <main className="dashboard-home__main">
        <nav className="dashboard-home__breadcrumbs" aria-label="面包屑">
          <span>工作台</span><span aria-hidden="true">/</span><span>ZHBi 看板中心</span>
        </nav>

        <section className="dashboard-home__workspace" aria-label="仪表板列表">
          <div className="dashboard-home__toolbar">
            <Space size={14} wrap>
              <Checkbox checked={onlyMine} onChange={(event) => setOnlyMine(event.target.checked)}>仅展示我的</Checkbox>
              <Input
                className="dashboard-home__search"
                aria-label="搜索看板"
                allowClear
                prefix={<SearchOutlined aria-hidden="true" />}
                placeholder="搜索看板"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </Space>
            <Space size={10} wrap>
              <Text className="dashboard-home__count" type="secondary">{dashboardQuery.data?.length ?? 0} 个看板</Text>
              <Button icon={<FolderAddOutlined />} disabled title="文件夹管理将在后续版本提供">新建文件夹</Button>
              <Button
                type="primary"
                aria-label={createMutation.isPending ? "正在创建看板" : "新建看板"}
                icon={<PlusOutlined />}
                loading={createMutation.isPending}
                disabled={createMutation.isPending}
                onClick={create}
              >
                {createMutation.isPending ? "正在创建看板" : "新建仪表板"}
              </Button>
            </Space>
          </div>

          {dashboardQuery.isError || createMutation.isError || publishMutation.isError || deleteMutation.isError ? (
            <Alert
              className="dashboard-home__error"
              type="error"
              showIcon
              role="alert"
              title={createMutation.isError ? "创建看板失败" : publishMutation.isError ? "发布看板失败" : deleteMutation.isError ? "删除看板失败" : "加载看板失败"}
              description={createMutation.isError ? "暂时无法创建看板，请检查服务状态后重试。" : publishMutation.isError ? "暂时无法发布看板，请稍后重试。" : deleteMutation.isError ? "暂时无法删除看板，请稍后重试。" : "暂时无法获取看板列表，请稍后重试。"}
              action={createMutation.isError ? <Button danger aria-label="重试" onClick={create}>重试</Button> : undefined}
            />
          ) : null}

          {dashboardQuery.isLoading ? (
            <div className="dashboard-home__loading"><Spin size="small" /><Text type="secondary">正在加载看板</Text></div>
          ) : dashboards.length > 0 ? (
            <div className="dashboard-home__grid" role="list">
              {dashboards.map((dashboard) => (
                <article className="dashboard-home__tile" key={dashboard.id} role="listitem">
                  <div className="dashboard-home__tile-header">
                    <button className="dashboard-home__name" onClick={() => navigate(`/editor/${dashboard.id}`)}>
                      <span className="dashboard-home__name-icon"><BarChartOutlined aria-hidden="true" /></span>
                      <span>
                        <strong>{dashboard.name}</strong>
                        <span className="dashboard-home__name-hint">打开并继续编辑</span>
                      </span>
                    </button>
                    <Space size={2} className="dashboard-home__actions">
                      <Tooltip title="编辑看板">
                        <Button
                          type="text"
                          aria-label={`编辑 ${dashboard.name}`}
                          icon={<EditOutlined />}
                          onClick={() => navigate(`/editor/${dashboard.id}`)}
                        />
                      </Tooltip>
                      <Dropdown
                        menu={{
                          items: [
                            {
                              key: "publish",
                              label: "发布",
                              icon: <UploadOutlined />,
                              onClick: () => publishMutation.mutate(dashboard.id),
                            },
                            { type: "divider" },
                            {
                              key: "delete",
                              label: "删除",
                              icon: <DeleteOutlined />,
                              danger: true,
                              onClick: () => setDashboardToDelete(dashboard),
                            },
                          ],
                        }}
                        trigger={["click"]}
                      >
                        <Button type="text" aria-label={`${dashboard.name} 的更多操作`} icon={<MoreOutlined />} />
                      </Dropdown>
                    </Space>
                  </div>
                  <div className="dashboard-home__tile-meta">
                    <Tag className="dashboard-home__draft-tag" variant="filled">草稿</Tag>
                    <Text type="secondary">{dashboard.components.length} 个组件</Text>
                  </div>
                  <div className="dashboard-home__tile-footer">
                    <Text className="dashboard-home__modifier">当前用户</Text>
                    <span aria-hidden="true">·</span>
                    <Text type="secondary">修改于 {formatUpdatedAt(dashboard.updatedAt)}</Text>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="dashboard-home__empty">
              <span className="dashboard-home__empty-icon"><FileTextOutlined aria-hidden="true" /></span>
              <Text strong>还没有仪表板</Text>
              <Text type="secondary">创建第一个仪表板，开始组织你的业务数据。</Text>
              <Button type="primary" onClick={create} disabled={createMutation.isPending} icon={<PlusOutlined />}>新建仪表板</Button>
            </div>
          )}
        </section>

        <Modal
          title={`删除“${dashboardToDelete?.name ?? ""}”？`}
          open={dashboardToDelete !== null}
          okText="删除"
          cancelText="取消"
          okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
          onCancel={() => setDashboardToDelete(null)}
          onOk={() => {
            if (dashboardToDelete) deleteMutation.mutate(dashboardToDelete.id);
          }}
        >
          <Text type="secondary">删除后将无法恢复该看板及其已发布快照。</Text>
        </Modal>

        <Modal
          title="账号设置"
          open={accountSettingsOpen}
          footer={<Button type="primary" onClick={() => setAccountSettingsOpen(false)}>知道了</Button>}
          onCancel={() => setAccountSettingsOpen(false)}
        >
          <p className="dashboard-home__account-detail">当前账号：<strong>{accountName}</strong></p>
          <Text type="secondary">账号资料与密码管理将在后续版本开放。</Text>
        </Modal>

        <div className="dashboard-home__status" aria-label="数据服务状态">
          <Text type="secondary">数据由统一业务 API 提供</Text>
          <Button type="link" icon={<ReloadOutlined />} onClick={refresh} loading={dashboardQuery.isFetching}>刷新列表</Button>
        </div>
      </main>
    </div>
  );
};
