import { ConfigProvider, theme as antdTheme } from "antd";
import type { ReactNode } from "react";
import type { ChartTheme } from "./chartTheme.js";

/** Scope dashboard interactions without recoloring the editor or data series. */
export const DashboardInteractionTheme = ({ theme, children }: { readonly theme: ChartTheme | undefined; readonly children: ReactNode }) => theme === undefined ? children : (
  <ConfigProvider theme={{
    algorithm: theme.mode === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: { colorPrimary: theme.primaryColor, colorLink: theme.primaryColor, ...(theme.mode === "dark" ? { colorBgContainer: "#102344", colorBgElevated: "#162e52", colorText: "#dbe7f5", colorTextSecondary: "#9fb3cf", colorBorder: "#294366" } : {}) },
    components: { Segmented: { itemSelectedBg: `${theme.primaryColor}18`, itemSelectedColor: theme.primaryColor } },
  }}>{children}</ConfigProvider>
);
