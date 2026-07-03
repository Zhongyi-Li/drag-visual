import { ApiError } from "./ApiError.js";

export interface ApiClient {
  request<T = unknown>(path: string, init?: RequestInit): Promise<T>;
}

const internalError = (status: number, message: string): ApiError =>
  new ApiError(status, "INTERNAL_ERROR", message);

export const createApiClient = (baseUrl: string): ApiClient => {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    async request<T>(path: string, init: RequestInit = {}): Promise<T> {
      const headers = new Headers(init.headers);
      if (!headers.has("Accept")) headers.set("Accept", "application/json");
      if (init.body != null && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const response = await fetch(`${normalizedBaseUrl}/${path.replace(/^\/+/, "")}`, {
        ...init,
        headers,
      });
      const text = await response.text();
      if (text.length === 0) {
        if (response.ok) return null as T;
        throw internalError(response.status, "Request failed");
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("application/json")) {
        if (!response.ok) throw internalError(response.status, "Request failed");
        throw internalError(response.status, "Response was not JSON");
      }

      let value: unknown;
      try {
        value = JSON.parse(text) as unknown;
      } catch {
        throw internalError(response.status, "Response was not valid JSON");
      }

      if (!response.ok) {
        if (
          typeof value === "object" && value !== null &&
          typeof (value as { code?: unknown }).code === "string" &&
          typeof (value as { message?: unknown }).message === "string"
        ) {
          const error = value as { code: string; message: string };
          throw new ApiError(response.status, error.code, error.message);
        }
        throw internalError(response.status, "Request failed");
      }

      return value as T;
    },
  };
};

export const apiClient = createApiClient(import.meta.env.VITE_API_BASE_URL ?? "");
