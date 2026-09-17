import type { ReactNode } from "react";

import { resolveDashboardPageLayout, type DashboardPageSource } from "./dashboardPageLayout.js";
import "./DashboardPageInformation.css";

const pageInformationFontFamilies = {
  system: "system-ui, -apple-system, sans-serif",
  "source-han-sans": "Source Han Sans SC, sans-serif",
  "source-han-serif": "Source Han Serif SC, serif",
  "alibaba-puhuiti": "Alibaba PuHuiTi, sans-serif",
  "harmonyos-sans": "HarmonyOS Sans, sans-serif",
  "lxgw-wenkai": "LXGW WenKai, serif",
} as const;

export const DashboardPageHeader = ({ dashboard, headingLevel = 2, navigation, showRevision = false }: {
  readonly dashboard: DashboardPageSource;
  readonly headingLevel?: 1 | 2 | 3;
  readonly navigation?: ReactNode;
  readonly showRevision?: boolean;
}) => {
  const settings = resolveDashboardPageLayout(dashboard);
  if (!settings.titleVisible && navigation === undefined) return null;
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3";
  return (
    <header className="dashboard-page-information" aria-label="页面信息">
      {navigation}
      {settings.titleVisible && <Heading style={{
        fontFamily: pageInformationFontFamilies[settings.titleFontFamily],
        fontSize: settings.titleFontSize,
        letterSpacing: settings.titleLetterSpacing,
      }}>{dashboard.name}</Heading>}
      {settings.titleVisible && showRevision && <small>修订版本 {dashboard.revision}</small>}
    </header>
  );
};

export const DashboardPageFooter = ({ dashboard }: { readonly dashboard: DashboardPageSource }) => {
  const settings = resolveDashboardPageLayout(dashboard);
  if (!settings.footerVisible) return null;
  return (
    <footer className="dashboard-page-footer" aria-label="页面页尾" style={{
      fontFamily: pageInformationFontFamilies[settings.footerFontFamily],
      fontSize: settings.footerFontSize,
      letterSpacing: settings.footerLetterSpacing,
    }}>
      {settings.footerText.trim() || `${dashboard.name} · 数据看板`}
    </footer>
  );
};
