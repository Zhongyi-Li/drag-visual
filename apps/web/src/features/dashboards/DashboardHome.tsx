import {
  BarChartOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DownOutlined,
  FormOutlined,
  FileTextOutlined,
  GlobalOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  SwapOutlined,
  StopOutlined,
  UploadOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Avatar, Button, Dropdown, Input, Modal, Space, Spin, Tag, Typography } from "antd";
import type { Dashboard } from "@drag-visual/contracts";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";

import { createDashboard, deleteDashboard, listDashboards, publishDashboard, unpublishDashboard } from "./dashboardApi.js";
import { clearAuthSession, readAuthSession, subscribeAuthSession } from "../auth/authSession.js";
import { logout } from "../auth/authApi.js";
import { AccountSettingsModal } from "../auth/AccountSettingsModal.js";
import { appPath } from "../../app/appPath.js";
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
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [sortMode, setSortMode] = useState<"recent" | "name">("recent");
  const [dashboardToDelete, setDashboardToDelete] = useState<Dashboard | null>(null);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const account = useSyncExternalStore(subscribeAuthSession, readAuthSession, readAuthSession)?.user;
  const accountName = account?.displayName?.trim() || account?.username || "当前用户";
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
  const unpublishMutation = useMutation({
    mutationFn: (id: string) => unpublishDashboard(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["dashboards"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDashboard(id),
    onSuccess: () => {
      setDashboardToDelete(null);
      void queryClient.invalidateQueries({ queryKey: ["dashboards"] });
    },
  });

  const allDashboards = dashboardQuery.data ?? [];

  const featuredDashboard = useMemo(() => [...allDashboards]
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0], [allDashboards]);

  const dashboards = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase();
    return allDashboards
      .filter((dashboard) => !normalizedKeyword || dashboard.name.toLocaleLowerCase().includes(normalizedKeyword))
      .filter((dashboard) => statusFilter === "all"
        || (statusFilter === "published" && dashboard.publishedAt)
        || (statusFilter === "draft" && !dashboard.publishedAt))
      .sort((left, right) => sortMode === "name"
        ? left.name.localeCompare(right.name, "zh-CN")
        : new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  }, [allDashboards, keyword, sortMode, statusFilter]);

  const allDashboardCount = allDashboards.length;
  const publishedDashboardCount = allDashboards.filter((dashboard) => dashboard.publishedAt).length;
  // “最近编辑” is a shortcut, not a list item removed from the selected directory.
  // Keeping the full filtered set below makes the visible count unambiguous.
  const dashboardDirectory = dashboards;

  const create = () => createMutation.mutate();
  const refresh = () => void dashboardQuery.refetch();
  const returnToAccountEntry = async () => {
    try {
      await logout();
    } catch {
      // A locally cleared session is still the safe outcome when the API is unavailable.
    }
    clearAuthSession();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="dashboard-home">
      <header className="dashboard-home__header">
        <div className="dashboard-home__brand" aria-label="极眸">
          <img className="dashboard-home__brand-mark" src={appPath("images/jimou-orbit-lens-mark.png")} alt="" />
          <span>极眸</span>
        </div>
        <Input
          className="dashboard-home__header-search"
          aria-label="搜索看板"
          allowClear
          prefix={<SearchOutlined aria-hidden="true" />}
          placeholder="搜索仪表板（名称、关键词）"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
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
              <Avatar className="dashboard-home__avatar" size={42} src={appPath("images/zhbi-avatar.png")} alt="默认头像" />
            </button>
          </Dropdown>
        </div>
      </header>

      <main className="dashboard-home__main">
        <section className="dashboard-home__workspace" aria-label="仪表板列表">
          <div className="dashboard-home__toolbar">
            <div className="dashboard-home__heading">
              <h1>看板中心</h1>
              <p>继续分析，助力决策。</p>
            </div>
            <Space size={10} wrap>
              <Text className="dashboard-home__count" type="secondary">{allDashboardCount} 个看板</Text>
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

          {dashboardQuery.isError || createMutation.isError || publishMutation.isError || unpublishMutation.isError || deleteMutation.isError ? (
            <Alert
              className="dashboard-home__error"
              type="error"
              showIcon
              role="alert"
              title={createMutation.isError ? "创建看板失败" : publishMutation.isError ? "发布看板失败" : unpublishMutation.isError ? "下线发布页失败" : deleteMutation.isError ? "删除看板失败" : "加载看板失败"}
              description={createMutation.isError ? "暂时无法创建看板，请检查服务状态后重试。" : publishMutation.isError ? "暂时无法发布看板，请稍后重试。" : unpublishMutation.isError ? "暂时无法下线发布页，请稍后重试。" : deleteMutation.isError ? "暂时无法删除看板，请稍后重试。" : "暂时无法获取看板列表，请稍后重试。"}
              action={createMutation.isError ? <Button danger aria-label="重试" onClick={create}>重试</Button> : undefined}
            />
          ) : null}

          {dashboardQuery.isLoading ? (
            <div className="dashboard-home__loading"><Spin size="small" /><Text type="secondary">正在加载看板</Text></div>
          ) : dashboards.length > 0 ? (
            <>
              {featuredDashboard ? <section className="dashboard-home__recent" aria-label="最近编辑">
                <div className="dashboard-home__recent-preview" aria-hidden="true">
                  <iframe
                    className="dashboard-home__recent-preview-frame"
                    src={appPath(`preview/${featuredDashboard.id}?embed=1`)}
                    title={`${featuredDashboard.name} 最近编辑缩略图`}
                    loading="lazy"
                    tabIndex={-1}
                  />
                </div>
                <div className="dashboard-home__recent-copy">
                  <span className="dashboard-home__recent-label"><ClockCircleOutlined aria-hidden="true" /> 最近编辑</span>
                  <div className="dashboard-home__recent-title-row">
                    <h2>{featuredDashboard.name}</h2>
                    {featuredDashboard.publishedAt ? <Tag color="green" variant="filled">已公开</Tag> : <Tag className="dashboard-home__draft-tag" variant="filled">编辑中</Tag>}
                  </div>
                  <p>{featuredDashboard.components.length} 个组件 · 修改于 {formatUpdatedAt(featuredDashboard.updatedAt)}</p>
                </div>
                <Button
                  className="dashboard-home__recent-action"
                  type="primary"
                  onClick={() => navigate(`/editor/${featuredDashboard.id}`)}
                >
                  继续编辑
                </Button>
              </section> : null}

              <div className="dashboard-home__directory-toolbar">
                <div className="dashboard-home__filters" role="tablist" aria-label="看板状态筛选">
                  {([
                    ["all", `全部 ${allDashboardCount}`],
                    ["published", `已发布 ${publishedDashboardCount}`],
                    ["draft", `草稿 ${allDashboardCount - publishedDashboardCount}`],
                  ] as const).map(([value, label]) => <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={statusFilter === value}
                    className={statusFilter === value ? "is-active" : ""}
                    onClick={() => setStatusFilter(value)}
                  >
                    {label}
                  </button>)}
                </div>
                <Dropdown
                  trigger={["click"]}
                  menu={{
                    selectedKeys: [sortMode],
                    items: [
                      { key: "recent", label: "最近编辑", onClick: () => setSortMode("recent") },
                      { key: "name", label: "名称排序", onClick: () => setSortMode("name") },
                    ],
                  }}
                >
                  <Button className="dashboard-home__sort" type="text" icon={<DownOutlined />} iconPlacement="end">
                    {sortMode === "recent" ? "最近编辑" : "名称排序"}
                  </Button>
                </Dropdown>
              </div>

              <div className="dashboard-home__grid" role="list">
              {dashboardDirectory.map((dashboard) => {
                const isPublished = dashboard.publishedAt !== undefined && dashboard.publishedAt !== null;
                return <article
                  className="dashboard-home__tile"
                  key={dashboard.id}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`打开并编辑 ${dashboard.name}`}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest("button, a, [role='menuitem']")) return;
                    navigate(`/editor/${dashboard.id}`);
                  }}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                    event.preventDefault();
                    navigate(`/editor/${dashboard.id}`);
                  }}
                >
                  <div className="dashboard-home__preview" aria-hidden="true">
                    <div className="dashboard-home__preview-canvas">
                      <iframe
                        className="dashboard-home__preview-frame"
                        src={appPath(`preview/${dashboard.id}?embed=1`)}
                        title={`${dashboard.name} 看板缩略图`}
                        loading="lazy"
                        tabIndex={-1}
                      />
                    </div>
                    <span className="dashboard-home__preview-shade" />
                    <span className="dashboard-home__preview-action">继续编辑</span>
                  </div>
                  <div className="dashboard-home__tile-header">
                    <div className="dashboard-home__name">
                      <span className="dashboard-home__name-icon"><BarChartOutlined aria-hidden="true" /></span>
                      <span>
                        <strong>{dashboard.name}</strong>
                        <span className="dashboard-home__name-hint">打开并继续编辑</span>
                      </span>
                    </div>
                    <Space size={2} className="dashboard-home__actions">
                      <Dropdown
                        menu={{
                          items: [
                            {
                              key: "edit",
                              label: "编辑",
                              icon: <FormOutlined />,
                              onClick: () => navigate(`/editor/${dashboard.id}`),
                            },
                            ...(isPublished
                              ? [
                                  {
                                    key: "open-published",
                                    label: "打开发布页",
                                    icon: <GlobalOutlined />,
                                    onClick: () => navigate(`/view/${dashboard.id}`),
                                  },
                                  {
                                    key: "unpublish",
                                    label: "下线发布页",
                                    icon: <StopOutlined />,
                                    onClick: () => unpublishMutation.mutate(dashboard.id),
                                  },
                                ]
                              : [{
                                  key: "publish",
                                  label: "发布",
                                  icon: <UploadOutlined />,
                                  onClick: () => publishMutation.mutate(dashboard.id),
                                }]),
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
                        <Button
                          type="text"
                          aria-label={`${dashboard.name} 的更多操作`}
                          icon={<MoreOutlined />}
                        />
                      </Dropdown>
                    </Space>
                  </div>
                  <div className="dashboard-home__tile-meta">
                    <Tag className="dashboard-home__draft-tag" {...(isPublished ? { color: "green" as const } : {})} variant="filled">
                      {isPublished ? "已发布" : "草稿"}
                    </Tag>
                    <Text type="secondary">{dashboard.components.length} 个组件</Text>
                  </div>
                  <div className="dashboard-home__tile-footer">
          <Text className="dashboard-home__modifier">我</Text>
                    <span aria-hidden="true">·</span>
                    <Text type="secondary">修改于 {formatUpdatedAt(dashboard.updatedAt)}</Text>
                  </div>
                </article>;
              })}
              </div>
            </>
          ) : (
            <div className="dashboard-home__empty" role="status">
              <span className="dashboard-home__empty-icon"><FileTextOutlined aria-hidden="true" /></span>
              <Text className="dashboard-home__empty-title" strong>您还没有BI数据看板</Text>
              <Text className="dashboard-home__empty-copy" type="secondary">创建您的第一个数据看板，开始组织你的业务数据。</Text>
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

        <AccountSettingsModal open={accountSettingsOpen} onClose={() => setAccountSettingsOpen(false)} />

        <div className="dashboard-home__status" aria-label="数据服务状态">
          <Text type="secondary">数据由统一业务 API 提供</Text>
          <Button type="link" icon={<ReloadOutlined />} onClick={refresh} loading={dashboardQuery.isFetching}>刷新列表</Button>
        </div>
      </main>
    </div>
  );
};
