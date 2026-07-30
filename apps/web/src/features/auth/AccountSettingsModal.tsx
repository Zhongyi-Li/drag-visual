import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Input, List, Modal, Space, Tabs, Typography } from "antd";
import { useEffect, useState } from "react";

import { ApiError } from "../../api/ApiError.js";
import {
  changePassword,
  getProfile,
  listLoginSessions,
  logoutOtherSessions,
  revokeLoginSession,
  updateProfile,
  updateSessionUser,
} from "./authApi.js";
import { saveAuthSession } from "./authSession.js";

interface AccountSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const errorMessage = (error: unknown, fallback: string): string => error instanceof ApiError ? error.message : fallback;
const time = (value: string): string => new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", hour12: false }).format(new Date(value));

export const AccountSettingsModal = ({ open, onClose }: AccountSettingsModalProps) => {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["account", "profile"], queryFn: getProfile, enabled: open });
  const sessions = useQuery({ queryKey: ["account", "sessions"], queryFn: listLoginSessions, enabled: open });
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");

  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.user.displayName ?? profile.data.user.username);
    setAvatarUrl(profile.data.user.avatarUrl ?? "");
  }, [profile.data]);

  const profileMutation = useMutation({
    mutationFn: () => updateProfile({ displayName: displayName.trim(), avatarUrl: avatarUrl.trim() || null }),
    onSuccess: (result) => {
      saveAuthSession(updateSessionUser(result));
      void queryClient.invalidateQueries({ queryKey: ["account", "profile"] });
    },
  });
  const passwordMutation = useMutation({
    mutationFn: () => changePassword(currentPassword, nextPassword),
    onSuccess: () => {
      setCurrentPassword("");
      setNextPassword("");
      void queryClient.invalidateQueries({ queryKey: ["account", "sessions"] });
    },
  });
  const revokeMutation = useMutation({
    mutationFn: revokeLoginSession,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["account", "sessions"] }),
  });
  const revokeOthersMutation = useMutation({
    mutationFn: logoutOtherSessions,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["account", "sessions"] }),
  });

  return (
    <Modal title="账号设置" open={open} footer={<Button onClick={onClose}>关闭</Button>} onCancel={onClose} width={640} destroyOnHidden>
      {profile.isError ? <Alert type="error" showIcon message="无法加载账号信息" description={errorMessage(profile.error, "请稍后重试。")} /> : null}
      <Tabs
        items={[
          {
            key: "profile",
            label: "个人资料",
            children: <Space direction="vertical" size={12} style={{ width: "100%", paddingTop: 8 }}>
              <label>账号<Input value={profile.data?.user.username ?? ""} disabled /></label>
              <label>展示名称<Input maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="请输入展示名称" /></label>
              <label>头像地址<Input value={avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} placeholder="https://…（可选）" /></label>
              {profileMutation.isError ? <Alert type="error" showIcon message={errorMessage(profileMutation.error, "保存个人资料失败")} /> : null}
              <Button type="primary" loading={profileMutation.isPending} disabled={!displayName.trim()} onClick={() => profileMutation.mutate()}>保存资料</Button>
            </Space>,
          },
          {
            key: "security",
            label: "安全设置",
            children: <Space direction="vertical" size={12} style={{ width: "100%", paddingTop: 8 }}>
              <Typography.Text strong>修改密码</Typography.Text>
              <Input.Password value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" placeholder="当前密码" />
              <Input.Password value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} autoComplete="new-password" placeholder="新密码（至少 8 位，含大小写、数字和符号）" />
              {passwordMutation.isError ? <Alert type="error" showIcon message={errorMessage(passwordMutation.error, "修改密码失败")} /> : null}
              <Button loading={passwordMutation.isPending} disabled={!currentPassword || !nextPassword} onClick={() => passwordMutation.mutate()}>修改密码并下线其他设备</Button>
              <Typography.Text strong style={{ marginTop: 8 }}>登录设备</Typography.Text>
              <List
                loading={sessions.isLoading}
                dataSource={sessions.data ?? []}
                locale={{ emptyText: "暂无有效登录设备" }}
                renderItem={(session) => <List.Item actions={session.current ? [<Typography.Text key="current" type="success">当前设备</Typography.Text>] : [<Button key="revoke" type="link" danger loading={revokeMutation.isPending} onClick={() => revokeMutation.mutate(session.id)}>下线</Button>]}>
                  <List.Item.Meta title={session.userAgent || "未知设备"} description={`最近活跃：${time(session.lastSeenAt)} · 到期：${time(session.expiresAt)}`} />
                </List.Item>}
              />
              {revokeOthersMutation.isError ? <Alert type="error" showIcon message={errorMessage(revokeOthersMutation.error, "下线其他设备失败")} /> : null}
              <Button danger loading={revokeOthersMutation.isPending} onClick={() => revokeOthersMutation.mutate()}>下线其他所有设备</Button>
            </Space>,
          },
        ]}
      />
    </Modal>
  );
};
