import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN.js";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

import { ApiError } from "../api/ApiError.js";
import { LocalDatasetProvider } from "../features/datasets/LocalDatasetProvider.js";

export const shouldRetryRequest = (failureCount: number, error: Error): boolean => {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
};

export const createAppQueryClient = (): QueryClient => new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryRequest,
      retryDelay: 0,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: shouldRetryRequest,
      retryDelay: 0,
    },
  },
});

interface AppProvidersProps {
  children: ReactNode;
  queryClient?: QueryClient;
}

export const AppProviders = ({ children, queryClient }: AppProvidersProps) => {
  const [localClient] = useState(createAppQueryClient);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: "#1677ff",
          colorBgLayout: "#f5f7fa",
          colorBorder: "#d9d9d9",
          borderRadius: 6,
          fontSize: 14,
        },
      }}
    >
      <QueryClientProvider client={queryClient ?? localClient}>
        <LocalDatasetProvider>
          {children}
        </LocalDatasetProvider>
      </QueryClientProvider>
    </ConfigProvider>
  );
};
