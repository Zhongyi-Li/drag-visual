export interface AuthUser {
  id: string;
  username: string;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
}

const sessionKey = "zhbi.auth.session";

const storage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

export const readAuthSession = (): AuthSession | null => {
  const value = storage()?.getItem(sessionKey) ?? (typeof window === "undefined" ? null : window.sessionStorage.getItem(sessionKey));
  if (!value) return null;
  try {
    const session = JSON.parse(value) as AuthSession;
    return typeof session.accessToken === "string" && typeof session.user?.id === "string" && typeof session.user?.username === "string"
      ? session
      : null;
  } catch {
    return null;
  }
};

export const saveAuthSession = (session: AuthSession): void => storage()?.setItem(sessionKey, JSON.stringify(session));

export const clearAuthSession = (): void => {
  storage()?.removeItem(sessionKey);
  if (typeof window !== "undefined") window.sessionStorage.removeItem(sessionKey);
};
