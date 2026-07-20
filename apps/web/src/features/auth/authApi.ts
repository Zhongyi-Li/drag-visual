import { apiClient } from "../../api/client.js";
import type { AuthSession } from "./authSession.js";

export interface Credentials {
  username: string;
  password: string;
}

export const login = (credentials: Credentials): Promise<AuthSession> => apiClient.request("/api/auth/login", {
  method: "POST",
  body: JSON.stringify(credentials),
});

export const register = (credentials: Credentials): Promise<AuthSession> => apiClient.request("/api/auth/register", {
  method: "POST",
  body: JSON.stringify(credentials),
});
