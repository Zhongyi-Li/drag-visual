import { createDefaultRegistry } from "@drag-visual/component-registry";
import type { ChartJumpRule, ComponentInstance, Dashboard, Dataset, DatasetFilter, DatasetQueryResult } from "@drag-visual/contracts";
import { applyTransforms, validateBinding } from "@drag-visual/data-engine";
import { DashboardComponentRenderer, ResponsiveChartContainer } from "@drag-visual/chart-renderer";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Alert, Empty, Spin } from "antd";
import { useEffect, useState } from "react";

import { buildDatasetAggregation } from "../datasets/datasetAggregation.js";
import { aggregateLocalRows, applyCalculatedMetrics, calculatedMetricFields, hasActiveCalculatedMetrics } from "../datasets/calculatedMetrics.js";
import { getDataset, getDatasetFieldOptions, queryDatasetRequest } from "../datasets/datasetApi.js";
import { DateRangeFilterBar } from "../datasets/DateRangeFilterBar.js";
import { ChartQueryFilterBar, type ChartQueryFilterControl } from "../datasets/ChartQueryFilterBar.js";
import { ChartDisplayHints } from "../editor/ChartDisplayHints.js";
import { defaultDateFilterSelection, type RuntimeDateSelection } from "../datasets/dateFilter.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
import { componentQueryFilterControls, componentQueryFilters, dashboardGlobalFilters, filterRowsByDashboardFilters, filtersForComponent, hasDashboardGlobalDateTarget, type DashboardGlobalFilterValues, type DashboardGlobalFilters } from "./dashboardGlobalFilters.js";
import {
  RuntimeDatasetRequestBar,
  buildRuntimeParameters,
  runtimeParameters,
  type RuntimeParameterValues,
} from "../datasets/RuntimeDatasetRequestBar.js";

interface ViewerComponentProps {
  readonly component: ComponentInstance;
  readonly savedDataset?: Dashboard["datasets"][number] | undefined;
  readonly currentDataset?: Dataset | undefined;
  readonly globalFilterValues?: DashboardGlobalFilterValues | undefined;
  readonly globalFilters?: DashboardGlobalFilters | undefined;
  readonly globalFilterOptions?: Readonly<Record<string, readonly string[]>> | undefined;
  readonly onGlobalFilterChange?: ((filterId: string, value: unknown) => void) | undefined;
  readonly globalFilterApplyVersion?: number | undefined;
  readonly onGlobalFilterQuerySettled?: ((componentId: string, version: number) => void) | undefined;
  readonly globalFiltersLoading?: boolean | undefined;
  readonly onGlobalFiltersApply?: (() => boolean) | undefined;
  /** Invoked by chart renderers when a configured data point is selected. */
  readonly onChartJump?: ((rule: ChartJumpRule, values: Readonly<Record<string, unknown>>) => void) | undefined;
  readonly analysisGroupFilters?: readonly DatasetFilter[] | undefined;
}

interface ResolvedComponentProps extends ViewerComponentProps {
  readonly dataset: Dataset;
  readonly rows: readonly DatasetQueryResult["rows"][number][];
  readonly rowsAreAggregated?: boolean | undefined;
}

const formatBindingMessage = (message: string): string => {
  const missingField = /^Field "([^"]+)" bound to slot "[^"]+" does not exist$/.exec(message);
  return missingField ? `字段 ${missingField[1]} 已不存在` : message;
};

const ResolvedComponent = ({ component, dataset, rows, rowsAreAggregated = false, globalFilterValues, globalFilters, globalFilterOptions, onGlobalFilterChange, globalFiltersLoading, onGlobalFiltersApply, onChartJump }: ResolvedComponentProps) => {
  const definition = createDefaultRegistry().get(component.type);
  const fields = calculatedMetricFields(dataset.fields, component.binding);
  const validation = validateBinding(component.binding, fields, definition.dataSlots);
  if (!validation.valid) {
    return (
      <Alert
        type="warning"
        showIcon
        title="数据绑定需要检查"
        description={validation.messages.map(formatBindingMessage).join("；")}
      />
    );
  }
  const bindingForRender = component.type === "ranking" && component.binding !== undefined
    ? { datasetId: component.binding.datasetId, slots: component.binding.slots }
    : component.type === "barLine" && component.binding !== undefined
      ? {
        datasetId: component.binding.datasetId,
        slots: component.binding.slots,
        ...(component.binding.sort === undefined ? {} : { sort: component.binding.sort }),
      }
      : component.binding;
  const calculatedRows = applyCalculatedMetrics(rows, component.binding);
  const transformed = applyTransforms(calculatedRows, bindingForRender, fields);
  return <div style={{ position: "relative", display: "flex", flex: "1 1 auto", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
    <ResponsiveChartContainer>
      <DashboardComponentRenderer component={component} fields={fields} rows={transformed} rowsAreAggregated={rowsAreAggregated} dashboardFilterValues={globalFilterValues} dashboardFilterOptions={globalFilterOptions} onDashboardFilterChange={onGlobalFilterChange} dashboardFiltersLoading={globalFiltersLoading} onDashboardFiltersApply={onGlobalFiltersApply} onChartJump={onChartJump} />
    </ResponsiveChartContainer>
    {component.type !== "analysisGroup" && component.type !== "dashboardHeader" && <ChartDisplayHints component={component} />}
  </div>;
};

const BoundViewerComponent = ({ component, savedDataset, globalFilterValues = {}, globalFilters = [], onGlobalFilterChange, globalFilterApplyVersion = 0, onGlobalFilterQuerySettled, globalFiltersLoading = false, onGlobalFiltersApply, onChartJump, analysisGroupFilters = [] }: ViewerComponentProps) => {
  const localDatasets = useLocalDatasets();
  const datasetId = component.binding!.datasetId;
  const [runtimeDraftParameters, setRuntimeDraftParameters] = useState<RuntimeParameterValues>({});
  const [appliedRuntimeParameters, setAppliedRuntimeParameters] = useState<RuntimeParameterValues>({});
  const dateFilterControl = component.binding!.dateFilter;
  const [activeDateFilter, setActiveDateFilter] = useState<RuntimeDateSelection>(() => defaultDateFilterSelection(dateFilterControl));
  useEffect(() => {
    setActiveDateFilter(defaultDateFilterSelection(dateFilterControl));
  }, [dateFilterControl?.defaultPreset, dateFilterControl?.defaultRange?.end, dateFilterControl?.defaultRange?.start, dateFilterControl?.fieldKey, dateFilterControl?.timezone]);
  const isUploadedDataset = localDatasets.isUploadedDataset(datasetId);
  const localSchema = isUploadedDataset ? localDatasets.getDataset(datasetId) : undefined;
  const localResult = isUploadedDataset ? localDatasets.queryDataset(datasetId) : undefined;
  const schema = useQuery({
    queryKey: ["dataset-schema", datasetId],
    queryFn: () => getDataset(datasetId),
    enabled: localSchema === undefined,
  });
  const resolvedSchema = localSchema ?? schema.data;
  const runtimeParameterDefinitions = runtimeParameters(resolvedSchema?.parameters ?? []);
  const runtimeParameterKeys = new Set(runtimeParameterDefinitions.map((parameter) => parameter.key));
  const configuredParameters = Object.fromEntries(Object.entries(savedDataset?.parameters ?? {}).filter(([key]) => !runtimeParameterKeys.has(key)));
  const runtimeQueryParameters = buildRuntimeParameters(runtimeParameterDefinitions, appliedRuntimeParameters);
  const queryParameters = { ...configuredParameters, ...runtimeQueryParameters };
  const aggregation = buildDatasetAggregation(component);
  const activeGlobalFilters = filtersForComponent(component, globalFilters, globalFilterValues);
  const savedComponentQueryFilterControls = componentQueryFilterControls(component);
  const savedComponentQueryFilterControlsKey = JSON.stringify(savedComponentQueryFilterControls);
  const savedComponentQueryFilters = componentQueryFilters(component);
  const [runtimeComponentQueryFilters, setRuntimeComponentQueryFilters] = useState(() => savedComponentQueryFilters);
  const [runtimeComponentQueryFilterControls, setRuntimeComponentQueryFilterControls] = useState<ChartQueryFilterControl[]>(() => [...savedComponentQueryFilterControls]);
  useEffect(() => {
    setRuntimeComponentQueryFilters(savedComponentQueryFilters);
    setRuntimeComponentQueryFilterControls(savedComponentQueryFilterControls);
  }, [savedComponentQueryFilterControlsKey]);
  const compatibleAnalysisGroupFilters = resolvedSchema === undefined
    ? []
    : analysisGroupFilters.filter((filter) => resolvedSchema.fields.some((field) => field.key === filter.fieldKey));
  const hasGlobalFilterTarget = globalFilters.some((filter) => filter.targets.some((target) => target.componentId === component.id));
  const isDateBoundByGlobalFilter = hasDashboardGlobalDateTarget(component, globalFilters);
  // A globally bound range is the single source of truth. Do not silently
  // retain the chart's default date range after its control is hidden.
  const effectiveDateFilter = isDateBoundByGlobalFilter ? undefined : activeDateFilter;
  const activeComponentFilters = [...compatibleAnalysisGroupFilters, ...runtimeComponentQueryFilters, ...(effectiveDateFilter === undefined ? [] : [effectiveDateFilter])];
  const activeFilters = [...activeGlobalFilters, ...activeComponentFilters];
  const headerFilters = component.type === "dashboardHeader" ? dashboardGlobalFilters(component) : [];
  const optionQueries = useQueries({
    queries: headerFilters.filter((filter) => filter.controlType === "select").map((filter) => ({
      queryKey: ["dataset-field-options", datasetId, filter.fieldKey],
      queryFn: () => getDatasetFieldOptions(datasetId, filter.fieldKey),
      enabled: !isUploadedDataset,
    })),
  });
  const headerOptions = Object.fromEntries(headerFilters.filter((filter) => filter.controlType === "select").map((filter, index) => [filter.id, optionQueries[index]?.data ?? []]));
  const data = useQuery({
    queryKey: ["dataset-query", component.id, datasetId, queryParameters, activeFilters, aggregation, globalFilterApplyVersion],
    queryFn: async () => {
      try {
        return await queryDatasetRequest(datasetId, {
          parameters: queryParameters,
          ...(activeGlobalFilters.length === 0 ? {} : { globalFilters: activeGlobalFilters }),
          ...(activeComponentFilters.length === 0 ? {} : { componentFilters: activeComponentFilters }),
          ...(aggregation === undefined ? {} : { aggregation }),
        });
      } finally {
        if (globalFilterApplyVersion > 0 && hasGlobalFilterTarget) onGlobalFilterQuerySettled?.(component.id, globalFilterApplyVersion);
      }
    },
    enabled: localResult === undefined && (localSchema !== undefined || schema.data !== undefined),
  });
  useEffect(() => {
    if (globalFilterApplyVersion > 0 && hasGlobalFilterTarget && isUploadedDataset) {
      onGlobalFilterQuerySettled?.(component.id, globalFilterApplyVersion);
    }
  }, [component.id, globalFilterApplyVersion, hasGlobalFilterTarget, isUploadedDataset, onGlobalFilterQuerySettled]);

  const unfilteredResult = localResult ?? data.data;
  const localFilters = activeFilters;
  const unaggregatedResult = isUploadedDataset && localResult !== undefined && localFilters.length > 0
    ? { ...localResult, rows: filterRowsByDashboardFilters(localResult.rows, localFilters), total: filterRowsByDashboardFilters(localResult.rows, localFilters).length }
    : unfilteredResult;
  const resolvedResult = isUploadedDataset && unaggregatedResult !== undefined && aggregation !== undefined && hasActiveCalculatedMetrics(component.binding)
    ? { ...unaggregatedResult, rows: aggregateLocalRows(unaggregatedResult.rows, aggregation), total: aggregateLocalRows(unaggregatedResult.rows, aggregation).length }
    : unaggregatedResult;
  const localQueryFilterOptions = isUploadedDataset && localResult !== undefined
    ? Object.fromEntries(savedComponentQueryFilterControls.filter((filter) => filter.kind === "fieldValue").map((filter) => [
        filter.fieldKey,
        [...new Set(localResult.rows.map((row) => row[filter.fieldKey]).filter((value): value is string | boolean => typeof value === "string" || typeof value === "boolean").map(String))].sort(),
      ]))
    : undefined;
  const requestRuntimeData = () => {
    const nextParameters = buildRuntimeParameters(runtimeParameterDefinitions, runtimeDraftParameters);
    if (JSON.stringify(nextParameters) === JSON.stringify(runtimeQueryParameters)) {
      void data.refetch();
      return;
    }
    setAppliedRuntimeParameters(nextParameters);
  };

  if (resolvedSchema === undefined || resolvedResult === undefined) return <Spin size="small" aria-label={`正在加载${component.title ?? component.type}`} />;
  if (schema.isError) return <Alert type="error" showIcon title="加载数据集失败" />;
  if (data.isError) return <Alert type="error" showIcon title="查询组件数据失败" />;
  // Interface schemas are discovered from the query response. A preview or
  // published page starts without the editor's runtime cache, so validating
  // against the discovery schema alone would incorrectly mark every bound
  // business field as missing.
  const resultDataset: Dataset = {
    ...resolvedSchema,
    ...(resolvedResult.datasetName === undefined ? {} : { name: resolvedResult.datasetName }),
    fields: resolvedResult.columns,
  };
  return <div className="viewer-component">
    {dateFilterControl !== undefined && !isDateBoundByGlobalFilter && <DateRangeFilterBar
      control={dateFilterControl}
      fieldLabel={resolvedSchema.fields.find((field) => field.key === dateFilterControl.fieldKey)?.label ?? dateFilterControl.fieldKey}
      value={activeDateFilter}
      onChange={setActiveDateFilter}
      loading={data.isFetching}
    />}
    <RuntimeDatasetRequestBar
      parameters={runtimeParameterDefinitions}
      values={runtimeDraftParameters}
      onChange={(key, value) => setRuntimeDraftParameters((current) => ({ ...current, [key]: value }))}
      onRequest={requestRuntimeData}
      loading={data.isFetching}
    />
    <ChartQueryFilterBar
      filters={runtimeComponentQueryFilterControls}
      fields={resolvedSchema.fields}
      datasetId={isUploadedDataset ? undefined : datasetId}
      localFieldOptions={localQueryFilterOptions}
      loading={data.isFetching}
      onApply={(filters, controls) => {
        setRuntimeComponentQueryFilters([...filters]);
        setRuntimeComponentQueryFilterControls([...controls]);
      }}
    />
    {resolvedResult.rows.length === 0
      ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
      : <ResolvedComponent
          component={component}
          savedDataset={savedDataset}
          dataset={resultDataset}
          rows={resolvedResult.rows}
          rowsAreAggregated={aggregation !== undefined && (localResult === undefined || hasActiveCalculatedMetrics(component.binding))}
          globalFilterValues={globalFilterValues}
          globalFilters={globalFilters}
          globalFilterOptions={headerOptions}
          onGlobalFilterChange={onGlobalFilterChange}
          globalFiltersLoading={globalFiltersLoading}
          onGlobalFiltersApply={onGlobalFiltersApply}
          onChartJump={onChartJump}
        />}
  </div>;
};

export const ViewerComponent = ({ component, savedDataset, currentDataset, globalFilterValues, globalFilters, globalFilterOptions, onGlobalFilterChange, globalFilterApplyVersion, onGlobalFilterQuerySettled, globalFiltersLoading, onGlobalFiltersApply, onChartJump, analysisGroupFilters }: ViewerComponentProps) => {
  const hasGlobalFilterTarget = (globalFilters ?? []).some((filter) => filter.targets.some((target) => target.componentId === component.id));
  // Preview callers can provide a materialized dataset directly. Those
  // components have no query lifecycle to report, so acknowledge the global
  // filter batch after their local render has received the new values.
  useEffect(() => {
    if ((globalFilterApplyVersion ?? 0) > 0 && hasGlobalFilterTarget && (component.binding === undefined || currentDataset !== undefined)) {
      onGlobalFilterQuerySettled?.(component.id, globalFilterApplyVersion ?? 0);
    }
  }, [component.binding, component.id, currentDataset, globalFilterApplyVersion, hasGlobalFilterTarget, onGlobalFilterQuerySettled]);
  if (component.props.throwInViewer === true) throw new Error("VIEWER_COMPONENT_TEST_ERROR");
  if (component.type === "text") {
    return <ResponsiveChartContainer><DashboardComponentRenderer component={component} rows={[]} dashboardFilterValues={globalFilterValues} dashboardFilterOptions={globalFilterOptions} onDashboardFilterChange={onGlobalFilterChange} dashboardFiltersLoading={globalFiltersLoading} onDashboardFiltersApply={onGlobalFiltersApply} onChartJump={onChartJump} /></ResponsiveChartContainer>;
  }
  if (component.type === "dashboardHeader" && component.binding === undefined) {
    return <ResponsiveChartContainer><DashboardComponentRenderer
      component={component}
      rows={[]}
      dashboardFilterValues={globalFilterValues}
      dashboardFilterOptions={globalFilterOptions}
      onDashboardFilterChange={onGlobalFilterChange}
      dashboardFiltersLoading={globalFiltersLoading}
      onDashboardFiltersApply={onGlobalFiltersApply}
      onChartJump={onChartJump}
    /></ResponsiveChartContainer>;
  }
  if (component.binding === undefined) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请配置数据绑定" />;
  }
  if (currentDataset !== undefined) {
    return <ResolvedComponent component={component} savedDataset={savedDataset} dataset={currentDataset} rows={[]} globalFilterValues={globalFilterValues} globalFilters={globalFilters} globalFilterOptions={globalFilterOptions} onGlobalFilterChange={onGlobalFilterChange} globalFiltersLoading={globalFiltersLoading} onGlobalFiltersApply={onGlobalFiltersApply} onChartJump={onChartJump} />;
  }
  return <BoundViewerComponent
    component={component}
    savedDataset={savedDataset}
    globalFilterValues={globalFilterValues}
    globalFilters={globalFilters}
    onGlobalFilterChange={onGlobalFilterChange}
    globalFilterApplyVersion={globalFilterApplyVersion}
    onGlobalFilterQuerySettled={onGlobalFilterQuerySettled}
    globalFiltersLoading={globalFiltersLoading}
    onGlobalFiltersApply={onGlobalFiltersApply}
    onChartJump={onChartJump}
    analysisGroupFilters={analysisGroupFilters}
  />;
};
