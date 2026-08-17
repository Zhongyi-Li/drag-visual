import { createDefaultRegistry } from "@drag-visual/component-registry";
import { AnalysisGroupDateFilterControl, type Dashboard, type Dataset, type DatasetField } from "@drag-visual/contracts";
import { Alert, Card, Empty, Space, Spin, Typography } from "antd";
import { useQueries } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { detectDatasetSchemaDrift } from "../datasets/useDatasetSchemaDrift.js";
import { getDataset } from "../datasets/datasetApi.js";
import { ChartQueryFilterBar, type ChartQueryFilterControl } from "../datasets/ChartQueryFilterBar.js";
import { ComponentErrorBoundary } from "./ComponentErrorBoundary.js";
import { chartTopLeftHint } from "../editor/ChartDisplayHints.js";
import { ViewerComponent } from "./ViewerComponent.js";
import { AnalysisGroupDateFilterBar } from "./AnalysisGroupDateFilterBar.js";
import { analysisGroupDateFiltersForChildren, defaultAnalysisGroupDateSelection } from "./analysisGroupDateFilter.js";
import { activeQueryFilters, analysisGroupQueryFilterControls, dashboardGlobalFilters, defaultDashboardGlobalFilterValues, type DashboardGlobalFilterValues } from "./dashboardGlobalFilters.js";

interface DashboardViewerProps {
  readonly dashboard: Dashboard;
  readonly mode?: "preview" | "published";
  readonly currentDatasets?: ReadonlyMap<string, Dataset> | undefined;
  /** Keeps the preview identity visible without pushing the canvas too far down. */
  readonly headerDensity?: "default" | "compact";
  /** Hides revision metadata when the route should show only the dashboard identity. */
  readonly showRevision?: boolean;
  /** Route navigation rendered in document flow above the dashboard identity. */
  readonly headerNavigation?: ReactNode;
  /** Hides the built-in dashboard identity when the route supplies its own toolbar. */
  readonly showHeader?: boolean;
  /** Uses the real dashboard canvas in a compact visual thumbnail. */
  readonly embedded?: boolean;
}

interface GlobalFilterQueryState {
  readonly version: number;
  readonly pendingComponentIds: readonly string[];
}

interface AnalysisGroupViewerProps {
  readonly parent: Dashboard["components"][number];
  readonly dashboard: Dashboard;
  readonly currentDatasets?: ReadonlyMap<string, Dataset> | undefined;
  readonly globalFilters: ReturnType<typeof dashboardGlobalFilters>;
  readonly globalFilterValues: DashboardGlobalFilterValues;
  readonly onGlobalFilterChange: (filterId: string, value: unknown) => void;
  readonly globalFilterApplyVersion: number;
  readonly onGlobalFilterQuerySettled: (componentId: string, version: number) => void;
  readonly globalFiltersLoading: boolean;
  readonly onGlobalFiltersApply: () => boolean;
}

const AnalysisGroupViewer = ({ parent, dashboard, currentDatasets, globalFilters, globalFilterValues, onGlobalFilterChange, globalFilterApplyVersion, onGlobalFilterQuerySettled, globalFiltersLoading, onGlobalFiltersApply }: AnalysisGroupViewerProps) => {
  const props = parent.props as Record<string, unknown>;
  const description = typeof props.description === "string" ? props.description : "";
  const gap = typeof props.gap === "number" ? props.gap : 12;
  const layout = new Map(dashboard.layout.filter((item) => item.parentId === parent.id).map((item) => [item.i, item]));
  const savedDatasets = new Map(dashboard.datasets.map((dataset) => [dataset.datasetId, dataset]));
  const children = dashboard.components.filter((component) => component.parentId === parent.id);
  const childDatasetIds = useMemo(() => [...new Set(children.flatMap((child) => child.binding === undefined ? [] : [child.binding.datasetId]))], [children]);
  const schemaQueries = useQueries({
    queries: childDatasetIds.map((datasetId) => ({
      queryKey: ["dataset-schema", datasetId],
      queryFn: () => getDataset(datasetId),
      enabled: currentDatasets?.has(datasetId) !== true,
    })),
  });
  const childSchemas = childDatasetIds.map((datasetId, index) => currentDatasets?.get(datasetId) ?? schemaQueries[index]?.data);
  const sharedFields = useMemo<readonly DatasetField[]>(() => {
    const schemas = childSchemas.filter((schema): schema is Dataset => schema !== undefined);
    if (schemas.length === 0) return [];
    return schemas[0]!.fields.filter((field) => schemas.every((schema) => schema.fields.some((candidate) => candidate.key === field.key && candidate.type === field.type)));
  }, [childSchemas]);
  const savedAnalysisGroupFilterControls = analysisGroupQueryFilterControls(parent);
  const savedAnalysisGroupFilterControlsKey = JSON.stringify(savedAnalysisGroupFilterControls);
  const [runtimeAnalysisGroupFilters, setRuntimeAnalysisGroupFilters] = useState(() => activeQueryFilters(savedAnalysisGroupFilterControls));
  const [runtimeAnalysisGroupFilterControls, setRuntimeAnalysisGroupFilterControls] = useState<ChartQueryFilterControl[]>(() => [...savedAnalysisGroupFilterControls]);
  useEffect(() => {
    setRuntimeAnalysisGroupFilters(activeQueryFilters(savedAnalysisGroupFilterControls));
    setRuntimeAnalysisGroupFilterControls([...savedAnalysisGroupFilterControls]);
  }, [savedAnalysisGroupFilterControlsKey]);
  const parsedDateFilter = AnalysisGroupDateFilterControl.safeParse(parent.props.dateFilter);
  const analysisGroupDateFilter = parsedDateFilter.success ? parsedDateFilter.data : undefined;
  const analysisGroupDateFilterKey = JSON.stringify(analysisGroupDateFilter);
  const [runtimeAnalysisGroupDateSelection, setRuntimeAnalysisGroupDateSelection] = useState(() => defaultAnalysisGroupDateSelection(analysisGroupDateFilter));
  useEffect(() => {
    setRuntimeAnalysisGroupDateSelection(defaultAnalysisGroupDateSelection(analysisGroupDateFilter));
  }, [analysisGroupDateFilterKey]);
  const analysisGroupDateFilters = useMemo(() => analysisGroupDateFiltersForChildren(analysisGroupDateFilter, runtimeAnalysisGroupDateSelection), [analysisGroupDateFilter, runtimeAnalysisGroupDateSelection]);
  return <section aria-label={`${parent.title || "复合分析"}内容`} style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%", padding: "4px 0 0", boxSizing: "border-box" }}>
    {description && <p style={{ margin: "0 2px 12px", color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>{description}</p>}
    <AnalysisGroupDateFilterBar control={analysisGroupDateFilter} value={runtimeAnalysisGroupDateSelection} loading={globalFiltersLoading} onChange={setRuntimeAnalysisGroupDateSelection} />
    <ChartQueryFilterBar
      filters={runtimeAnalysisGroupFilterControls}
      fields={sharedFields}
      datasetId={childDatasetIds[0]}
      ariaLabel="复合分析查询条件"
      controlLabelPrefix="复合分析查询"
      onApply={(filters, controls) => {
        setRuntimeAnalysisGroupFilters([...filters]);
        setRuntimeAnalysisGroupFilterControls([...controls]);
      }}
    />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gridAutoRows: 44, gap, flex: "1 1 auto", minHeight: 0 }}>
      {children.map((child) => {
        const item = layout.get(child.id);
        const title = child.title?.trim();
        const topLeftHint = chartTopLeftHint(child);
        const hasHeading = (title?.length ?? 0) > 0 || topLeftHint !== undefined;
        return <div key={child.id} style={{ gridColumn: item ? `${item.x + 1} / span ${item.w}` : "span 6", gridRow: item ? `${item.y + 1} / span ${item.h}` : undefined, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", border: "1px solid #e8ecf1", borderRadius: 8, background: "#fff", boxShadow: "0 2px 8px rgba(15, 23, 42, .045)" }}>
          {hasHeading && <div style={{ flex: "0 0 auto", minWidth: 0, padding: topLeftHint === undefined ? "11px 14px 8px" : "8px 14px 7px" }}>
            {title !== undefined && title.length > 0 && <div style={{ color: "#262626", fontSize: 14, fontWeight: 600, lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>}
            {topLeftHint !== undefined && <div style={{ color: "#64748b", fontSize: 12, fontWeight: 500, lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={topLeftHint}>{topLeftHint}</div>}
          </div>}
          <div style={{ display: "flex", flex: "1 1 auto", flexDirection: "column", minHeight: 0, overflow: "hidden", padding: hasHeading ? "0 14px 12px" : "12px 14px" }}>
            <ViewerComponent component={child} savedDataset={child.binding ? savedDatasets.get(child.binding.datasetId) : undefined} currentDataset={child.binding ? currentDatasets?.get(child.binding.datasetId) : undefined} globalFilters={globalFilters} globalFilterValues={globalFilterValues} onGlobalFilterChange={onGlobalFilterChange} globalFilterApplyVersion={globalFilterApplyVersion} onGlobalFilterQuerySettled={onGlobalFilterQuerySettled} globalFiltersLoading={globalFiltersLoading} onGlobalFiltersApply={onGlobalFiltersApply} analysisGroupFilters={[...runtimeAnalysisGroupFilters, ...(analysisGroupDateFilters[child.id] === undefined ? [] : [analysisGroupDateFilters[child.id]!])]} />
          </div>
        </div>;
      })}
      {children.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该分析组合尚未添加图表" style={{ gridColumn: "1 / -1", alignSelf: "center" }} />}
    </div>
  </section>;
};

const globalFilterQueryIndicatorStyle = {
  position: "fixed" as const,
  zIndex: 1200,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  minHeight: 32,
  padding: "0 12px",
  border: "1px solid #d6e4ff",
  borderRadius: 18,
  color: "#1d39c4",
  background: "rgba(255, 255, 255, .96)",
  boxShadow: "0 6px 18px rgba(22, 119, 255, .14)",
  fontSize: 13,
  lineHeight: 1,
  pointerEvents: "none" as const,
};

const globalFilterQueryOverlayStyle = {
  position: "fixed" as const,
  zIndex: 1200,
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255, 255, 255, .42)",
};

export const DashboardViewer = ({
  dashboard,
  mode = "published",
  currentDatasets,
  headerDensity = "default",
  showRevision = true,
  headerNavigation,
  showHeader = true,
  embedded = false,
}: DashboardViewerProps) => {
  const layout = new Map(dashboard.layout.map((item) => [item.i, item]));
  const savedDatasets = new Map(dashboard.datasets.map((dataset) => [dataset.datasetId, dataset]));
  const driftByComponent = new Map(
    currentDatasets
      ? detectDatasetSchemaDrift(dashboard, currentDatasets, createDefaultRegistry()).map((drift) => [drift.componentId, drift])
      : [],
  );
  const orderedComponents = dashboard.components.filter((component) => component.parentId === undefined).sort((left, right) => {
    const leftLayout = layout.get(left.id);
    const rightLayout = layout.get(right.id);
    return (leftLayout?.y ?? 0) - (rightLayout?.y ?? 0) || (leftLayout?.x ?? 0) - (rightLayout?.x ?? 0);
  });
  const headerComponent = dashboard.components.find((component) => component.type === "dashboardHeader");
  const globalFilters = dashboardGlobalFilters(headerComponent);
  const [globalFilterValues, setGlobalFilterValues] = useState<DashboardGlobalFilterValues>(() => defaultDashboardGlobalFilterValues(headerComponent));
  const [globalFilterQuery, setGlobalFilterQuery] = useState<GlobalFilterQueryState>({ version: 0, pendingComponentIds: [] });
  useEffect(() => setGlobalFilterValues(defaultDashboardGlobalFilterValues(headerComponent)), [headerComponent?.id, JSON.stringify(headerComponent?.props.globalFilters), JSON.stringify(headerComponent?.props.dateRange)]);
  const applyGlobalFilters = (): boolean => {
    const pendingComponentIds = [...new Set(globalFilters.flatMap((filter) => filter.targets.map((target) => target.componentId)))];
    if (pendingComponentIds.length === 0) return false;
    setGlobalFilterQuery((current) => ({ version: current.version + 1, pendingComponentIds }));
    return true;
  };
  const settleGlobalFilterQuery = (componentId: string, version: number) => {
    setGlobalFilterQuery((current) => current.version !== version || !current.pendingComponentIds.includes(componentId)
      ? current
      : { ...current, pendingComponentIds: current.pendingComponentIds.filter((pendingId) => pendingId !== componentId) });
  };

  return (
    <main style={{
      minHeight: "100vh",
      background: mode === "preview" ? "#fafafa" : dashboard.theme.backgroundColor,
      padding: embedded ? 12 : headerDensity === "compact" ? "16px 24px 24px" : 24,
    }}>
      {globalFilterQuery.pendingComponentIds.length > 0 && (
        <div role="status" aria-live="polite" aria-label="正在更新全局筛选结果" style={globalFilterQueryOverlayStyle}>
          <div style={globalFilterQueryIndicatorStyle}>
            <Spin size="small" />
            <span>正在更新 {globalFilterQuery.pendingComponentIds.length} 个图表</span>
          </div>
        </div>
      )}
      <Space orientation="vertical" size={embedded ? 0 : headerDensity === "compact" ? "small" : "large"} style={{ width: "100%" }}>
        {!embedded && showHeader && <header style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: headerDensity === "compact" ? 2 : 6,
        }}>
          {headerNavigation}
          <div>
            <Typography.Title level={headerDensity === "compact" ? 3 : 2} style={{ margin: 0 }}>{dashboard.name}</Typography.Title>
            {showRevision && <Typography.Text type="secondary">修订版本 {dashboard.revision}</Typography.Text>}
          </div>
        </header>}
        {orderedComponents.length === 0 ? (
          <Card><Empty description="该看板还没有组件" /></Card>
        ) : (
          <div
            aria-label="只读看板画布"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
              gridAutoRows: 44,
              gap: 12,
              width: "100%",
            }}
          >
            {orderedComponents.map((component) => {
              const item = layout.get(component.id);
              const drift = driftByComponent.get(component.id);
              const blocksRendering = drift?.messages.some((message) => !/^数据集 .+ 已从 .+ 更新到 .+$/.test(message)) ?? false;
              const componentTitle = component.title?.trim();
              const hasComponentTitle = componentTitle !== undefined && componentTitle.length > 0;
              const isDashboardHeader = component.type === "dashboardHeader";
              const isAnalysisGroup = component.type === "analysisGroup";
              const topLeftHint = isDashboardHeader || isAnalysisGroup ? undefined : chartTopLeftHint(component);
              const hasTopLeftHint = topLeftHint !== undefined;
              const hasComponentHeading = hasComponentTitle || hasTopLeftHint;
              return (
                <Card
                  key={component.id}
                  title={hasComponentHeading ? <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    {hasComponentTitle && <span style={{ color: "#262626", fontSize: 14, fontWeight: 600, lineHeight: 1.45 }}>{componentTitle}</span>}
                    {hasTopLeftHint && <span style={{ overflow: "hidden", color: "#64748b", fontSize: 12, fontWeight: 500, lineHeight: 1.5, textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={topLeftHint}>{topLeftHint}</span>}
                  </div> : undefined}
                  style={{
                    gridColumn: item
                      ? `${Math.min(12, Math.max(0, item.x)) + 1} / span ${Math.min(12, Math.max(1, item.w))}`
                      : "span 6",
                    gridRow: item ? `${Math.max(0, item.y) + 1} / span ${Math.max(1, item.h)}` : undefined,
                    // A saved grid area is the source of truth for the preview size.
                    // A larger minimum height makes short editor cards overflow into
                    // the following rows and causes components to overlap.
                    height: item ? "100%" : undefined,
                    minHeight: item ? 0 : 220,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    borderWidth: mode === "preview" ? 0 : undefined,
                  }}
                  styles={{
                    // The chart title belongs to the card frame. Keep it visually
                    // connected to the chart instead of rendering Ant Design's
                    // default divider and 24px body top padding beneath every title.
                    header: hasComponentHeading
                      ? { borderBottom: "none", flex: "0 0 auto", minHeight: hasTopLeftHint ? 60 : 44, padding: hasTopLeftHint ? "8px 24px" : "0 24px" }
                      : { display: "none" },
                    body: {
                      display: "flex",
                      flex: "1 1 auto",
                      flexDirection: "column",
                      minHeight: 0,
                      overflow: "hidden",
                      // DashboardHeaderSurface owns its own responsive padding. Adding
                      // card padding here consumes the bottom of a short grid row and
                      // clips its filter controls in preview mode.
                      padding: isDashboardHeader ? 0 : hasComponentHeading ? "0 24px 16px" : "12px 24px 16px",
                    },
                  }}
                >
                  <div style={{ display: "flex", flex: "1 1 auto", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                    {drift && (
                      <Alert
                        type="warning"
                        showIcon
                        title="数据绑定需要检查"
                        description={<ul>{drift.messages.map((message) => <li key={message}>{message}</li>)}</ul>}
                        style={{ marginBottom: 12 }}
                      />
                    )}
                    {isDashboardHeader === false && component.type === "analysisGroup" ? (
                      <AnalysisGroupViewer
                        parent={component}
                        dashboard={dashboard}
                        currentDatasets={currentDatasets}
                        globalFilters={globalFilters}
                        globalFilterValues={globalFilterValues}
                        onGlobalFilterChange={(filterId, value) => setGlobalFilterValues((current) => ({ ...current, [filterId]: value }))}
                        globalFilterApplyVersion={globalFilterQuery.version}
                        onGlobalFilterQuerySettled={settleGlobalFilterQuery}
                        globalFiltersLoading={globalFilterQuery.pendingComponentIds.length > 0}
                        onGlobalFiltersApply={applyGlobalFilters}
                      />
                    ) : !blocksRendering && (
                      <ComponentErrorBoundary
                        componentId={component.id}
                        componentType={component.type}
                        title={component.title ?? component.type}
                        mode={mode}
                        resetKey={JSON.stringify({
                          id: component.id,
                          props: component.props,
                          binding: component.binding,
                          schemaVersion: component.binding ? currentDatasets?.get(component.binding.datasetId)?.schemaVersion : undefined,
                        })}
                      >
                        <ViewerComponent
                          component={component}
                          savedDataset={component.binding ? savedDatasets.get(component.binding.datasetId) : undefined}
                          currentDataset={component.binding ? currentDatasets?.get(component.binding.datasetId) : undefined}
                          globalFilters={globalFilters}
                          globalFilterValues={globalFilterValues}
                          onGlobalFilterChange={(filterId, value) => setGlobalFilterValues((current) => ({ ...current, [filterId]: value }))}
                          globalFilterApplyVersion={globalFilterQuery.version}
                          onGlobalFilterQuerySettled={settleGlobalFilterQuery}
                          onGlobalFiltersApply={applyGlobalFilters}
                          globalFiltersLoading={globalFilterQuery.pendingComponentIds.length > 0}
                        />
                      </ComponentErrorBoundary>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Space>
    </main>
  );
};
