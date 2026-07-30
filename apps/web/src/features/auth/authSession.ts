export interface AuthUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface AuthSession {
  user: AuthUser;
}

export type AuthStatus = "unknown" | "authenticated" | "anonymous";

interface AuthState {
  status: AuthStatus;
  session: AuthSession | null;
}

let state: AuthState = { status: "unknown", session: null };
let restorePromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

const notify = (): void => listeners.forEach((listener) => listener());

const setState = (next: AuthState): void => {
  state = next;
  notify();
};

const apiBaseUrl = (): string => (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

export const readAuthSession = (): AuthSession | null => state.session;
export const readAuthStatus = (): AuthStatus => state.status;
export const subscribeAuthSession = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const saveAuthSession = (session: AuthSession): void => setState({ status: "authenticated", session });
export const clearAuthSession = (): void => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("zhbi.auth.session");
    window.sessionStorage.removeItem("zhbi.auth.session");
  }
  setState({ status: "anonymous", session: null });
};

export const restoreAuthSession = async (): Promise<void> => {
  if (restorePromise) return restorePromise;
  restorePromise = (async () => {
    try {
      const response = await fetch(`${apiBaseUrl()}/api/auth/me`, {
        headers: { Accept: "application/json" },
        credentials: "include",
      });
      if (!response.ok) {
        clearAuthSession();
        return;
      }
      const value = await response.json() as { user?: AuthUser };
      if (!value.user || typeof value.user.id !== "string" || typeof value.user.username !== "string") {
        clearAuthSession();
        return;
      }
      saveAuthSession({ user: value.user });
    } catch {
      clearAuthSession();
    }
  })();
  return restorePromise;
};
