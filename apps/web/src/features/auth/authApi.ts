import { apiClient } from "../../api/client.js";
import type { AuthSession, AuthUser } from "./authSession.js";

export interface Credentials {
  username: string;
  password: string;
  remember: boolean;
}

export interface UserPreference {
  themeMode: "light" | "dark" | "system";
  locale: string;
  timezone: string;
  dashboardListView: "grid" | "list";
}

export interface AccountProfile extends AuthSession {
  preference: UserPreference;
}

export interface LoginSession {
  id: string;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

export const login = (credentials: Credentials): Promise<AuthSession> => apiClient.request("/api/auth/login", {
  method: "POST",
  body: JSON.stringify(credentials),
});

export const register = (credentials: Credentials): Promise<AuthSession> => apiClient.request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify(credentials),
});

export const getProfile = (): Promise<AccountProfile> => apiClient.request("/api/auth/me");

export const updateProfile = (values: {
  displayName?: string;
  avatarUrl?: string | null;
  preference?: Partial<UserPreference>;
}): Promise<AccountProfile> => apiClient.request("/api/auth/me", {
  method: "PATCH",
  body: JSON.stringify(values),
});

export const changePassword = (currentPassword: string, nextPassword: string): Promise<{ changed: true }> => apiClient.request("/api/auth/me/password", {
  method: "PATCH",
  body: JSON.stringify({ currentPassword, nextPassword }),
});

export const listLoginSessions = (): Promise<LoginSession[]> => apiClient.request("/api/auth/sessions");
export const revokeLoginSession = (id: string): Promise<{ revoked: true }> => apiClient.request(`/api/auth/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
export const logout = (): Promise<{ loggedOut: true }> => apiClient.request("/api/auth/logout", { method: "POST" });
export const logoutOtherSessions = (): Promise<{ revoked: true }> => apiClient.request("/api/auth/logout-all", { method: "POST" });

export const updateSessionUser = (profile: AccountProfile): AuthSession => ({ user: profile.user as AuthUser });
