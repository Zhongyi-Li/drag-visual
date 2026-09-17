import { DashboardBackground } from "@drag-visual/contracts";

const safeBackgroundImage = (value: string) => {
  const trimmed = value.trim();
  return /^(https?:\/\/|data:image\/|\/images\/)/i.test(trimmed) ? trimmed : undefined;
};

interface DashboardBackgroundSource {
  readonly theme: {
    readonly dashboardBackground?: unknown;
  };
}

export const DashboardBackgroundLayers = ({ dashboard }: { readonly dashboard: DashboardBackgroundSource }) => {
  const background = DashboardBackground.parse(dashboard.theme.dashboardBackground ?? {});
  const topImage = background.topVisible ? safeBackgroundImage(background.topImage) : undefined;
  const bottomImage = background.bottomVisible ? safeBackgroundImage(background.bottomImage) : undefined;
  if (topImage === undefined && bottomImage === undefined) return null;
  return <div className="dashboard-background-layers" aria-hidden="true">
    {topImage !== undefined && <div className="dashboard-background-layer dashboard-background-layer--top"><img alt="" src={topImage} /></div>}
    {bottomImage !== undefined && <div className="dashboard-background-layer dashboard-background-layer--bottom"><img alt="" src={bottomImage} /></div>}
  </div>;
};
