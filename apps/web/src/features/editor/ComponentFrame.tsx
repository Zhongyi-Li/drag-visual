import { MoreOutlined } from "@ant-design/icons";
import { DashboardComponentRenderer, ResponsiveChartContainer } from "@drag-visual/chart-renderer";
import type { ComponentRegistry } from "@drag-visual/component-registry";
import { DashboardGlobalFilterConfig, type ComponentInstance, type DatasetFilter, type DatasetQueryRequest, type DatasetQueryResult } from "@drag-visual/contracts";
import { applyTransforms } from "@drag-visual/data-engine";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, Drawer, Empty, Dropdown, Space, Spin, Typography, type MenuProps } from "antd";
import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";

import { DataPreview } from "../datasets/DataPreview.js";
import { DateRangeFilterBar } from "../datasets/DateRangeFilterBar.js";
import { defaultDateFilterSelection, type RuntimeDateSelection } from "../datasets/dateFilter.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
import {
  RuntimeDatasetRequestBar,
  buildRuntimeParameters,
  runtimeParameters,
  type RuntimeParameterValues,
} from "../datasets/RuntimeDatasetRequestBar.js";
import { buildDatasetAggregation } from "../datasets/datasetAggregation.js";
import { aggregateLocalRows, applyCalculatedMetrics, calculatedMetricFields, hasActiveCalculatedMetrics } from "../datasets/calculatedMetrics.js";
import { getDataset, queryDatasetRequest } from "../datasets/datasetApi.js";
import { findAvailableLayout } from "./canvasLayout.js";
import { AnalysisGroupCanvas } from "./AnalysisGroupCanvas.js";
import { chartTopLeftHint, ChartDisplayHints } from "./ChartDisplayHints.js";
import type { EditorStore } from "./store/editorStore.js";
import { analysisGroupQueryFilters, componentQueryFilters, filterRowsByDashboardFilters, filtersForComponent, type DashboardGlobalFilters, type DashboardGlobalFilterValues } from "../viewer/dashboardGlobalFilters.js";

interface ComponentFrameProps {
  component: {
    readonly id: ComponentInstance["id"];
    readonly type: ComponentInstance["type"];
    readonly title?: ComponentInstance["title"];
    readonly subtitle?: ComponentInstance["subtitle"];
    readonly props: Readonly<Record<string, unknown>>;
    readonly binding?: unknown;
  };
  store: EditorStore;
  createComponentId: () => string;
  isInteracting: boolean;
  globalFilters?: DashboardGlobalFilters;
  globalFilterValues?: DashboardGlobalFilterValues;
  onGlobalFilterChange?: ((filterId: string, value: unknown) => void) | undefined;
  globalFilterApplyVersion?: number | undefined;
  onGlobalFilterQuerySettled?: ((componentId: string, version: number) => void) | undefined;
  globalFiltersLoading?: boolean | undefined;
  onGlobalFiltersApply?: (() => boolean) | undefined;
  /** Static conditions inherited from the owning analysis group. */
  analysisGroupFilters?: readonly DatasetFilter[] | undefined;
  registry?: ComponentRegistry | undefined;
  activeAnalysisGroupDropId?: string | null | undefined;
}

// Keep the acknowledgement visible long enough to register, even when the
// chart itself can remount faster than a network request.
const REFRESH_INDICATOR_DURATION = 650;
const DEFAULT_CHART_RESULT_LIMIT = 1_000;

const isDateBoundByDashboardHeader = (
  componentId: string,
  components: readonly Readonly<{ type: ComponentInstance["type"]; props: Readonly<Record<string, unknown>>; }>[],
): boolean => components.some((candidate) => {
  if (candidate.type !== "dashboardHeader") return false;
  const parsed = DashboardGlobalFilterConfig.array().safeParse(candidate.props.globalFilters);
  return parsed.success && parsed.data.some((filter) => filter.controlType === "dateRange" && filter.targets.some((target) => target.componentId === componentId));
});

export const ComponentFrame = ({ component: suppliedComponent, store, createComponentId, isInteracting, globalFilters = [], globalFilterValues = {}, onGlobalFilterChange, globalFilterApplyVersion = 0, onGlobalFilterQuerySettled, globalFiltersLoading = false, onGlobalFiltersApply, analysisGroupFilters = [], registry, activeAnalysisGroupDropId }: ComponentFrameProps) => {
  const localDatasets = useLocalDatasets();
  const [dataPreviewOpen, setDataPreviewOpen] = useState(false);
  const [renderVersion, setRenderVersion] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [runtimeDraftParameters, setRuntimeDraftParameters] = useState<RuntimeParameterValues>({});
  const [appliedRuntimeParameters, setAppliedRuntimeParameters] = useState<RuntimeParameterValues>({});
  const [runtimeDataResult, setRuntimeDataResult] = useState<DatasetQueryResult | undefined>();
  const [activeDateFilter, setActiveDateFilter] = useState<RuntimeDateSelection>(() =>
    defaultDateFilterSelection((suppliedComponent as ComponentInstance).binding?.dateFilter),
  );
  const [selectedSunburstMeasure, setSelectedSunburstMeasure] = useState<string | null>(null);
  const [selectedTreemapMeasure, setSelectedTreemapMeasure] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInput = useRef<HTMLInputElement | null>(null);
  const titleEditSettled = useRef(false);
  // Grid layout libraries may preserve child elements while their dashboard
  // data changes. Subscribe here as well so an inspector “更新” is always
  // observed by the query key of the matching chart.
  const component = useStore(store, (state) =>
    state.history.present.components.find((candidate) => candidate.id === suppliedComponent.id) ?? suppliedComponent,
  );
  const selected = useStore(store, (state) => state.selectedComponentId === component.id);
  const isDateBoundByGlobalFilter = useStore(store, (state) => isDateBoundByDashboardHeader(component.id, state.history.present.components));
  // An empty string is an intentional, saved title state. Do not fall back to
  // the component type in that case, otherwise authors can never remove a
  // chart title after it has been created.
  const title = component.title ?? component.type;
  const hasTitle = title.trim().length > 0;
  const isDashboardHeader = component.type === "dashboardHeader";
  const topLeftHint = isDashboardHeader || component.type === "analysisGroup" ? undefined : chartTopLeftHint(component as ComponentInstance);
  const analysisGroupDescription = component.type === "analysisGroup" && typeof component.props.description === "string"
    ? component.props.description.trim()
    : "";
  const hasHeaderHint = topLeftHint !== undefined || analysisGroupDescription.length > 0;
  const datasetId = typeof component.binding === "object" && component.binding !== null && "datasetId" in component.binding
    ? String(component.binding.datasetId)
    : undefined;
  const isUploadedDataset = datasetId !== undefined && localDatasets.isUploadedDataset(datasetId);
  const cachedDataset = datasetId ? localDatasets.getDataset(datasetId) : undefined;
  const cachedResult = datasetId ? localDatasets.queryDataset(datasetId) : undefined;
  const localDataset = isUploadedDataset ? cachedDataset : undefined;
  const localResult = isUploadedDataset ? cachedResult : undefined;
  // InterfaceDatasetBootstrap keeps an initial remote snapshot in memory for
  // fast first paint. It is not an uploaded file and must never suppress a
  // later explicit query from the inspector.
  const runtimeSnapshot = isUploadedDataset ? undefined : cachedResult;
  const savedDataset = useStore(store, (state) => datasetId === undefined
    ? undefined
    : state.history.present.datasets.find((dataset) => dataset.datasetId === datasetId));
  const remoteSchema = useQuery({
    queryKey: ["dataset-schema", datasetId],
    queryFn: () => getDataset(datasetId!),
    enabled: datasetId !== undefined && localDataset === undefined,
  });
  const hasDatasetSchema = localDataset !== undefined || cachedDataset !== undefined || remoteSchema.data !== undefined;
  const datasetParameters = localDataset?.parameters ?? cachedDataset?.parameters ?? remoteSchema.data?.parameters ?? [];
  const runtimeParameterDefinitions = runtimeParameters(datasetParameters);
  const isBootstrappedInterface = runtimeParameterDefinitions.length > 0;
  const runtimeParameterKeys = new Set(runtimeParameterDefinitions.map((parameter) => parameter.key));
  // Runtime parameters are deliberately left out of the dashboard snapshot.
  // They remain controllable by a chart after the dashboard is published.
  const savedParameters = savedDataset?.parameters as DatasetQueryRequest["parameters"] | undefined;
  const configuredParameters = Object.fromEntries(Object.entries(savedParameters ?? {}).filter(([key]) => !runtimeParameterKeys.has(key) && key !== "limit"));
  const runtimeQueryParameters = buildRuntimeParameters(runtimeParameterDefinitions, appliedRuntimeParameters);
  const supportsResultLimit = datasetParameters.some((parameter) => parameter.key === "limit" && parameter.type === "number");
  // `resultLimit` is the inspector draft. It becomes `appliedResultLimit`
  // only when the author clicks 更新, avoiding an API request for each edit.
  const appliedResultLimit = typeof component.props.appliedResultLimit === "number" && Number.isInteger(component.props.appliedResultLimit)
    ? component.props.appliedResultLimit
    : DEFAULT_CHART_RESULT_LIMIT;
  const queryParameters = {
    ...configuredParameters,
    ...runtimeQueryParameters,
    ...(supportsResultLimit ? { limit: appliedResultLimit } : {}),
  } as DatasetQueryRequest["parameters"];
  const chartComponent = component as ComponentInstance;
  const dateFilterControl = chartComponent.binding?.dateFilter;
  useEffect(() => {
    setActiveDateFilter(defaultDateFilterSelection(dateFilterControl));
  }, [dateFilterControl?.defaultPreset, dateFilterControl?.defaultRange?.end, dateFilterControl?.defaultRange?.start, dateFilterControl?.fieldKey, dateFilterControl?.timezone]);
  const aggregation = buildDatasetAggregation(chartComponent);
  const activeGlobalFilters = filtersForComponent(chartComponent, globalFilters, globalFilterValues);
  const activeComponentQueryFilters = componentQueryFilters(chartComponent);
  const queryableFields = localDataset?.fields ?? cachedDataset?.fields ?? remoteSchema.data?.fields;
  const compatibleAnalysisGroupFilters = queryableFields === undefined
    ? []
    : analysisGroupFilters.filter((filter) => queryableFields.some((field) => field.key === filter.fieldKey));
  const hasGlobalFilterTarget = globalFilters.some((filter) => filter.targets.some((target) => target.componentId === component.id));
  const effectiveDateFilter = isDateBoundByGlobalFilter ? undefined : activeDateFilter;
  const activeComponentFilters = [...compatibleAnalysisGroupFilters, ...activeComponentQueryFilters, ...(effectiveDateFilter === undefined ? [] : [effectiveDateFilter])];
  const activeFilters = [...activeGlobalFilters, ...activeComponentFilters];
  const [initialAggregationEnabled] = useState(() => buildDatasetAggregation(component as ComponentInstance) !== undefined);
  const hasAppliedRuntimeParameters = Object.keys(appliedRuntimeParameters).length > 0;
  const dataRefreshVersion = typeof component.props.dataRefreshVersion === "number" && Number.isSafeInteger(component.props.dataRefreshVersion)
    ? component.props.dataRefreshVersion
    : 0;
  const remoteQuery = useQuery({
    // Data bindings are edited freely in the inspector. The explicit “更新”
    // action increments dataRefreshVersion, so changing an aggregation does
    // not issue a database query until the author is ready.
    queryKey: ["dataset-query", component.id, datasetId, queryParameters, activeFilters, dataRefreshVersion, globalFilterApplyVersion],
    queryFn: async () => {
      try {
        return await queryDatasetRequest(datasetId!, {
          parameters: queryParameters!,
          ...(activeGlobalFilters.length === 0 ? {} : { globalFilters: activeGlobalFilters }),
          ...(activeComponentFilters.length === 0 ? {} : { componentFilters: activeComponentFilters }),
          ...(aggregation === undefined ? {} : { aggregation }),
        });
      } finally {
        if (globalFilterApplyVersion > 0 && hasGlobalFilterTarget) onGlobalFilterQuerySettled?.(component.id, globalFilterApplyVersion);
      }
    },
    // Interface data is fetched once by InterfaceDatasetBootstrap when the
    // editor opens. Individual charts wait for that shared snapshot instead
    // of sending one identical request per component.
    // Wait for schema discovery so interface requests include their runtime
    // parameters instead of emitting an early `{ parameters: {} }` request.
    enabled: datasetId !== undefined && localDataset === undefined && hasDatasetSchema && (
      !isBootstrappedInterface || initialAggregationEnabled || dataRefreshVersion > 0 || globalFilterApplyVersion > 0 || hasAppliedRuntimeParameters || activeFilters.length > 0
    ),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    if (globalFilterApplyVersion > 0 && hasGlobalFilterTarget && (datasetId === undefined || isUploadedDataset)) {
      onGlobalFilterQuerySettled?.(component.id, globalFilterApplyVersion);
    }
  }, [component.id, datasetId, globalFilterApplyVersion, hasGlobalFilterTarget, isUploadedDataset, onGlobalFilterQuerySettled]);
  // Interface data is materialized once when the editor opens. A component
  // only keeps a private override after its own runtime pagination changes.
  const rawDataResult = runtimeDataResult ?? localResult ?? remoteQuery.data ?? runtimeSnapshot;
  const dataResult = isUploadedDataset && localResult !== undefined && activeFilters.length > 0
    ? { ...localResult, rows: filterRowsByDashboardFilters(localResult.rows, activeFilters), total: filterRowsByDashboardFilters(localResult.rows, activeFilters).length }
    : rawDataResult;
  const sourceFields = localDataset?.fields ?? dataResult?.columns;
  const fields = calculatedMetricFields(sourceFields ?? [], chartComponent.binding);
  const sourceRows = dataResult?.rows ?? [];
  const calculateAfterAggregation = hasActiveCalculatedMetrics(chartComponent.binding);
  const rows = isUploadedDataset && aggregation !== undefined && calculateAfterAggregation
    ? aggregateLocalRows(sourceRows, aggregation)
    : sourceRows;
  const rowsAreAggregated = aggregation !== undefined && (remoteQuery.data === dataResult || (isUploadedDataset && calculateAfterAggregation));
  const bindingForRender = chartComponent.type === "ranking" && chartComponent.binding !== undefined
    ? { datasetId: chartComponent.binding.datasetId, slots: chartComponent.binding.slots }
    : chartComponent.type === "barLine" && chartComponent.binding !== undefined
      ? {
        datasetId: chartComponent.binding.datasetId,
        slots: chartComponent.binding.slots,
        ...(chartComponent.binding.sort === undefined ? {} : { sort: chartComponent.binding.sort }),
      }
      : chartComponent.binding;
  const calculatedRows = applyCalculatedMetrics(rows, chartComponent.binding);
  const transformedRows = applyTransforms(calculatedRows, bindingForRender, fields);
  const isLoadingRemoteData = remoteQuery.isLoading && dataResult === undefined;
  const remoteDataError = remoteQuery.isError
    ? remoteQuery.error instanceof Error ? remoteQuery.error.message : "查询图表数据失败"
    : undefined;
  const isSunburst = chartComponent.type === "sunburst" || (chartComponent.type === "pie" && (chartComponent.title ?? "").includes("旭日"));
  const isTreemap = chartComponent.type === "treemap" || (chartComponent.type === "pie" && (chartComponent.title ?? "").includes("矩形"));
  const measureBinding = chartComponent.binding?.slots.measure;
  const sunburstMeasures = (Array.isArray(measureBinding) ? measureBinding : measureBinding === undefined ? [] : [measureBinding])
    .map((binding) => binding.fieldKey);
  const activeSunburstMeasure = sunburstMeasures.includes(selectedSunburstMeasure ?? "")
    ? selectedSunburstMeasure!
    : sunburstMeasures[0];
  const treemapMeasures = sunburstMeasures;
  const activeTreemapMeasure = treemapMeasures.includes(selectedTreemapMeasure ?? "")
    ? selectedTreemapMeasure!
    : treemapMeasures[0];
  const fieldLabels = new Map(fields.map((field) => [field.key, field.label]));
  const dateFilterFieldLabel = (localDataset?.fields ?? cachedDataset?.fields ?? remoteSchema.data?.fields ?? []).find(
    (field) => field.key === dateFilterControl?.fieldKey,
  )?.label ?? dateFilterControl?.fieldKey;
  const dataTransformDescription = chartComponent.type === "ranking" ? "" : [
    chartComponent.binding?.sort === undefined
      ? undefined
      : `${fieldLabels.get(chartComponent.binding.sort.fieldKey) ?? chartComponent.binding.sort.fieldKey}${chartComponent.binding.sort.direction === "asc" ? "升序" : "降序"}`,
    chartComponent.binding?.limit === undefined ? undefined : `Top ${chartComponent.binding.limit}`,
  ].filter((item): item is string => item !== undefined).join(" · ");
  const componentDataResult = dataResult === undefined
    ? undefined
    : { ...dataResult, rows: transformedRows, total: transformedRows.length };
  const canRefreshRemoteData = datasetId !== undefined && localDataset === undefined;
  const select = () => store.getState().select(component.id);
  const stopControlEvent = (event: { stopPropagation: () => void }) => event.stopPropagation();
  const beginTitleEdit = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    select();
    titleEditSettled.current = false;
    setDraftTitle(title);
    setIsEditingTitle(true);
  };
  const cancelTitleEdit = () => {
    titleEditSettled.current = true;
    setIsEditingTitle(false);
  };
  const commitTitleEdit = () => {
    if (titleEditSettled.current) return;
    titleEditSettled.current = true;
    setIsEditingTitle(false);
    const nextTitle = draftTitle.trim();
    if (nextTitle !== title) {
      store.getState().dispatch({ type: "component.title.update", componentId: component.id, nextTitle });
    }
  };
  useEffect(() => () => {
    if (refreshTimer.current !== null) clearTimeout(refreshTimer.current);
  }, []);
  useEffect(() => {
    if (isEditingTitle) {
      titleInput.current?.focus();
      titleInput.current?.select();
    }
  }, [isEditingTitle]);
  const duplicate = () => {
    const state = store.getState();
    const sourceLayout = state.history.present.layout.find((item) => item.i === component.id);
    if (!sourceLayout) return;
    const newComponentId = createComponentId();
    const layout = findAvailableLayout(state.history.present.layout, { ...sourceLayout, i: newComponentId });
    state.dispatch({ type: "component.duplicate", sourceId: component.id, newComponentId, layout });
    store.getState().select(newComponentId);
  };
  const remove = () => {
    store.getState().dispatch({ type: "component.remove", componentId: component.id });
    store.getState().select(null);
  };
  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const minimumFeedback = new Promise<void>((resolve) => {
      refreshTimer.current = setTimeout(resolve, REFRESH_INDICATOR_DURATION);
    });
    if (canRefreshRemoteData) await Promise.all([remoteQuery.refetch(), minimumFeedback]);
    else await minimumFeedback;
    setRenderVersion((current) => current + 1);
    setIsRefreshing(false);
    refreshTimer.current = null;
  };
  const requestRuntimeData = () => {
    const nextParameters = buildRuntimeParameters(runtimeParameterDefinitions, runtimeDraftParameters);
    if (JSON.stringify(nextParameters) === JSON.stringify(runtimeQueryParameters)) {
      void remoteQuery.refetch();
      return;
    }
    // The useQuery key owns the request. Updating its parameters is enough to
    // fetch once; calling the API here as well would duplicate every click.
    setRuntimeDataResult(undefined);
    setAppliedRuntimeParameters(nextParameters);
  };
  const menuItems: MenuProps["items"] = [
    { key: "duplicate", label: "复制" },
    { key: "delete", label: "删除", danger: true },
    { type: "divider" },
    { key: "refresh", label: isRefreshing ? "正在刷新" : "刷新", disabled: isRefreshing },
    { key: "view-data", label: "查看数据" },
  ];
  const onMenuClick: MenuProps["onClick"] = ({ key, domEvent }) => {
    stopControlEvent(domEvent);
    select();
    if (key === "duplicate") duplicate();
    if (key === "delete") remove();
    if (key === "refresh") void refresh();
    if (key === "view-data") setDataPreviewOpen(true);
  };

  return (
    <section
      aria-label={hasTitle ? title : topLeftHint ?? component.type}
      className={`component-frame${selected ? " component-frame--selected" : ""}${hasTitle ? "" : " component-frame--untitled"}${hasHeaderHint ? " component-frame--has-header-hint" : ""}${isDashboardHeader ? " component-frame--dashboard-header" : ""}${chartComponent.type === "analysisGroup" ? " component-frame--analysis-group" : ""}`}
      role="group"
      tabIndex={0}
      onClick={select}
      onFocus={(event) => { if (event.target === event.currentTarget) select(); }}
    >
      <header className="component-frame__header">
        <div className="component-frame__heading">
          {isEditingTitle ? (
            <input
              ref={titleInput}
              className="component-frame__title-input"
              aria-label="图表名称"
              maxLength={100}
              value={draftTitle}
              onBlur={commitTitleEdit}
              onChange={(event) => setDraftTitle(event.target.value)}
              onClick={stopControlEvent}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") commitTitleEdit();
                if (event.key === "Escape") cancelTitleEdit();
              }}
            />
          ) : (
            <button className={`component-frame__title-button${hasTitle ? "" : " component-frame__title-button--empty"}`} type="button" onClick={beginTitleEdit}>
              {hasTitle ? title : "添加标题"}
            </button>
          )}
          {topLeftHint !== undefined && <span className="component-frame__header-hint" title={topLeftHint}>{topLeftHint}</span>}
          {analysisGroupDescription.length > 0 && <span className="component-frame__analysis-group-description" title={analysisGroupDescription}>{analysisGroupDescription}</span>}
        </div>
        <div className="component-frame__header-controls">
          {isSunburst && sunburstMeasures.length > 1 && (
            <select
              className="component-frame__sunburst-select"
              aria-label="切换旭日图指标"
              value={activeSunburstMeasure}
              onChange={(event) => setSelectedSunburstMeasure(event.target.value)}
            >
              {sunburstMeasures.map((measure) => <option key={measure} value={measure}>{fieldLabels.get(measure) ?? measure}</option>)}
            </select>
          )}
          {isTreemap && treemapMeasures.length > 1 && (
            <select
              className="component-frame__sunburst-select"
              aria-label="切换矩形树图指标"
              value={activeTreemapMeasure}
              onChange={(event) => setSelectedTreemapMeasure(event.target.value)}
            >
              {treemapMeasures.map((measure) => <option key={measure} value={measure}>{fieldLabels.get(measure) ?? measure}</option>)}
            </select>
          )}
          <Dropdown menu={{ items: menuItems, onClick: onMenuClick }} placement="bottomLeft" trigger={["click"]}>
            <Button
              className="component-frame__menu-trigger"
              type="text"
              size="small"
              aria-label={`更多操作${title}`}
              icon={<MoreOutlined />}
              onClick={stopControlEvent}
            />
          </Dropdown>
        </div>
      </header>
      <div className="component-frame__renderer" data-testid="component-renderer" data-interacting={String(isInteracting)}>
        {dateFilterControl !== undefined && !isDateBoundByGlobalFilter && dateFilterFieldLabel !== undefined && (
          <DateRangeFilterBar
            control={dateFilterControl}
            fieldLabel={dateFilterFieldLabel}
            value={activeDateFilter}
            onChange={setActiveDateFilter}
            loading={remoteQuery.isFetching}
          />
        )}
        <RuntimeDatasetRequestBar
          parameters={runtimeParameterDefinitions}
          values={runtimeDraftParameters}
          onChange={(key, value) => setRuntimeDraftParameters((current) => ({ ...current, [key]: value }))}
          onRequest={requestRuntimeData}
            loading={remoteQuery.isFetching}
        />
        <div className="component-frame__chart-content">
          {chartComponent.type !== "analysisGroup" && chartComponent.type !== "dashboardHeader" && <ChartDisplayHints component={chartComponent} />}
          {chartComponent.type === "analysisGroup" && registry !== undefined ? (
            <AnalysisGroupCanvas
              component={chartComponent}
              store={store}
              registry={registry}
              createComponentId={createComponentId}
              globalFilters={globalFilters}
              globalFilterValues={globalFilterValues}
              onGlobalFilterChange={onGlobalFilterChange}
              globalFilterApplyVersion={globalFilterApplyVersion}
              onGlobalFilterQuerySettled={onGlobalFilterQuerySettled}
              globalFiltersLoading={globalFiltersLoading}
              onGlobalFiltersApply={onGlobalFiltersApply}
              analysisGroupFilters={analysisGroupQueryFilters(chartComponent)}
              activePaletteDrop={activeAnalysisGroupDropId === chartComponent.id}
              outerIsInteracting={isInteracting}
            />
          ) : remoteDataError !== undefined ? (
            <Alert type="error" showIcon title="加载图表数据失败" description={remoteDataError} />
          ) : (
            <ResponsiveChartContainer>
              <DashboardComponentRenderer
                key={renderVersion}
                component={chartComponent}
                fields={fields}
                rows={transformedRows}
                rowsAreAggregated={rowsAreAggregated}
                hideSurfaceHeaders
                activeSunburstMeasure={isSunburst ? activeSunburstMeasure : undefined}
                onSunburstMeasureChange={isSunburst ? setSelectedSunburstMeasure : undefined}
                activeTreemapMeasure={isTreemap ? activeTreemapMeasure : undefined}
                onTreemapMeasureChange={isTreemap ? setSelectedTreemapMeasure : undefined}
                dashboardFilterValues={globalFilterValues}
                onDashboardFilterChange={onGlobalFilterChange}
                dashboardFiltersLoading={globalFiltersLoading}
                onDashboardFiltersApply={onGlobalFiltersApply}
                onComponentPropsChange={(nextProps) => store.getState().dispatch({ type: "component.props.update", componentId: chartComponent.id, nextProps })}
              />
            </ResponsiveChartContainer>
          )}
        </div>
        {isLoadingRemoteData && !isDashboardHeader && (
          <div className="component-frame__refresh-mask" role="status" aria-live="polite">
            <Spin size="small" />
            <span>正在加载图表数据</span>
          </div>
        )}
        {isRefreshing && (
          <div className="component-frame__refresh-mask" role="status" aria-live="polite">
            <Spin size="small" />
            <span>正在刷新图表</span>
          </div>
        )}
      </div>
      <Drawer title={`${title}的数据`} placement="right" size="large" open={dataPreviewOpen} onClose={() => setDataPreviewOpen(false)}>
        {componentDataResult === undefined ? <Empty description="暂无可查看的数据" /> : (
          <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
            {dataTransformDescription && <Typography.Text type="secondary">已应用组件配置：{dataTransformDescription}</Typography.Text>}
            <DataPreview result={componentDataResult} />
          </Space>
        )}
      </Drawer>
    </section>
  );
};
