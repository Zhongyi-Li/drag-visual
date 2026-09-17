import { DashboardPageLayout } from "@drag-visual/contracts";
import type { CSSProperties } from "react";

export interface DashboardPageSource {
  readonly name: string;
  readonly revision: number;
  readonly theme: {
    readonly backgroundColor: string;
    readonly pageLayout?: unknown;
  };
}

export const resolveDashboardPageLayout = (dashboard: DashboardPageSource) =>
  DashboardPageLayout.parse(dashboard.theme.pageLayout ?? {});

export const pageMargin = (settings: ReturnType<typeof resolveDashboardPageLayout>): string => {
  const { marginPreset: preset, customMargins } = settings;
  if (preset === "wide") return "8px";
  if (preset === "custom") return `${customMargins.top}px ${customMargins.right}px ${customMargins.bottom}px ${customMargins.left}px`;
  return "10px 12px";
};

const safeBackgroundImage = (value: string): string | undefined => {
  const trimmed = value.trim();
  return /^(https?:\/\/|data:image\/)/i.test(trimmed) ? trimmed : undefined;
};

export const pageSurfaceStyle = (
  dashboard: DashboardPageSource,
  options: { readonly editor?: boolean; readonly viewportInset?: number } = {},
): CSSProperties => {
  const settings = resolveDashboardPageLayout(dashboard);
  const image = settings.backgroundImageEnabled ? safeBackgroundImage(settings.backgroundImage) : undefined;
  // The page background belongs to the canvas, not just to the rectangle
  // occupied by the current components. Keep the surface at least as tall as
  // the visible canvas in both layout modes; it can still grow with content.
  // The editor page now reaches every edge of the workbench canvas. Its only
  // viewport inset is the 96px editor toolbar; page margins remain inner
  // content padding and therefore do not expose the gray canvas underneath.
  const viewportInset = options.viewportInset ?? (options.editor ? 96 : 48);
  return {
    boxSizing: "border-box",
    width: settings.widthMode === "fixed" ? settings.fixedWidth : "100%",
    minWidth: settings.widthMode === "fixed" ? settings.fixedWidth : 0,
    minHeight: `calc(100vh - ${viewportInset}px)`,
    marginInline: settings.widthMode === "fixed" ? "auto" : undefined,
    padding: pageMargin(settings),
    backgroundColor: image === undefined ? dashboard.theme.backgroundColor : "transparent",
    backgroundImage: image === undefined ? undefined : `url(${JSON.stringify(image)})`,
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "cover",
  };
};
