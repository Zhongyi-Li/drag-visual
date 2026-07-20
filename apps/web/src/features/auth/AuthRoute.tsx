import {
  BarChartOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
  PieChartOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Alert, Button, Checkbox, Input } from "antd";
import { useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "../../api/ApiError.js";
import { login, register } from "./authApi.js";
import { saveAuthSession } from "./authSession.js";
import "./auth.css";

type AuthMode = "login" | "register";

const strongRegistrationPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,}$/;
const passwordRule = "至少 8 位，且包含大写字母、小写字母、数字和符号。";

const featureItems = [
  ["连通全域数据", "连接多源数据，统一治理，打破数据孤岛。", "chart"],
  ["洞察业务趋势", "丰富分析模型与可视化，洞察趋势，发现机会。", "pie"],
  ["驱动高效决策", "数据驱动业务闭环，提升效率，加速增长。", "shield"],
] as const;

const nextPath = (state: unknown): string => {
  if (typeof state !== "object" || state === null || !("from" in state)) return "/";
  const from = (state as { from?: unknown }).from;
  return typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : "/";
};

export const AuthRoute = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitLabel = mode === "login" ? "登录" : "创建账号";
  const helper = useMemo(() => mode === "login" ? "登录后即可进入 ZHBi 数据工作台" : "使用账号和密码创建你的 ZHBi 工作台入口", [mode]);

  const switchMode = (nextMode: AuthMode) => {
    if (submitting || mode === nextMode) return;
    setMode(nextMode);
    setError(null);
    setConfirmPassword("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedUsername = username.trim();
    if (normalizedUsername.length < 4 || normalizedUsername.length > 40) {
      setError("账号需为 4–40 个字符。");
      return;
    }
    if (password.length < 8) {
      setError("密码至少需要 8 位。");
      return;
    }
    if (mode === "register" && !strongRegistrationPassword.test(password)) {
      setError(passwordRule);
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("两次输入的密码不一致。");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const session = mode === "login"
        ? await login({ username: normalizedUsername, password })
        : await register({ username: normalizedUsername, password });
      if (remember) saveAuthSession(session);
      else window.sessionStorage.setItem("zhbi.auth.session", JSON.stringify(session));
      navigate(nextPath(location.state), { replace: true });
    } catch (requestError: unknown) {
      if (requestError instanceof ApiError) {
        setError(requestError.message);
      } else {
        setError("暂时无法完成请求，请确认服务已启动后重试。");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <header className="auth-page__header">
        <div className="auth-page__brand" aria-label="ZHBi"><span>ZH</span><span>Bi</span></div>
      </header>
      <div className="auth-page__backdrop" aria-hidden="true" />
      <section className="auth-page__gateway" aria-label="ZHBi 账号入口">
        <aside className="auth-page__intro">
          <h1>进入你的数据工作台</h1>
          <p>ZHBi 帮助企业汇通数据、洞察趋势、驱动决策，让数据真正创造业务价值。</p>
          <ul>
            {featureItems.map(([title, description, icon]) => (
              <li key={title}>
                <span className={`auth-page__feature-icon auth-page__feature-icon--${icon}`} aria-hidden="true">
                  {icon === "chart" ? <BarChartOutlined /> : icon === "pie" ? <PieChartOutlined /> : <SafetyCertificateOutlined />}
                </span>
                <span><strong>{title}</strong><small>{description}</small></span>
              </li>
            ))}
          </ul>
        </aside>

        <section className="auth-page__form-area">
          <div className={`auth-page__mode-switch auth-page__mode-switch--${mode}`} role="tablist" aria-label="账号入口模式">
            <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "is-active" : ""} onClick={() => switchMode("login")}>登录</button>
            <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "is-active" : ""} onClick={() => switchMode("register")}>注册</button>
          </div>
          <p className="auth-page__helper">{helper}</p>
          <form key={mode} className="auth-page__form auth-page__form--enter" onSubmit={submit} noValidate>
            <label htmlFor="auth-username">账号</label>
            <Input
              id="auth-username"
              size="large"
              autoComplete="username"
              prefix={<UserOutlined aria-hidden="true" />}
              placeholder="请输入账号"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={submitting}
            />
            <label htmlFor="auth-password">密码</label>
            <Input
              id="auth-password"
              size="large"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              prefix={<LockOutlined aria-hidden="true" />}
              suffix={<button className="auth-page__visibility" type="button" aria-label={passwordVisible ? "隐藏密码" : "显示密码"} onClick={() => setPasswordVisible((visible) => !visible)}>{passwordVisible ? <EyeOutlined /> : <EyeInvisibleOutlined />}</button>}
              type={passwordVisible ? "text" : "password"}
              placeholder={mode === "register" ? "请输入符合规则的密码" : "请输入密码"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
            />
            {mode === "register" ? <p className="auth-page__password-rule">{passwordRule}</p> : null}
            {mode === "register" ? <>
              <label htmlFor="auth-confirm-password">确认密码</label>
              <Input id="auth-confirm-password" size="large" autoComplete="new-password" prefix={<LockOutlined aria-hidden="true" />} type="password" placeholder="请再次输入密码" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={submitting} />
            </> : null}
            {error ? <Alert className="auth-page__error" type="error" showIcon message={error} /> : null}
            <Checkbox checked={remember} onChange={(event) => setRemember(event.target.checked)} disabled={submitting}>记住我</Checkbox>
            <Button className="auth-page__submit" type="primary" htmlType="submit" size="large" loading={submitting} disabled={submitting}>{submitLabel}</Button>
          </form>
          <p className="auth-page__footer-switch">
            {mode === "login" ? "没有账号？" : "已有账号？"}
            <button type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "立即注册" : "去登录"}</button>
          </p>
        </section>
      </section>
    </main>
  );
};
