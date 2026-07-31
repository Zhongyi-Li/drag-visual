import { createDefaultRegistry } from "@drag-visual/component-registry";
import type { ComponentInstance, Dashboard, Dataset } from "@drag-visual/contracts";
import { applyTransforms, validateBinding } from "@drag-visual/data-engine";
import { DashboardComponentRenderer, ResponsiveChartContainer } from "@drag-visual/chart-renderer";
import { useQuery } from "@tanstack/react-query";
import { Alert, Empty, Spin } from "antd";
import { useEffect, useState } from "react";

import { buildDatasetAggregation } from "../datasets/datasetAggregation.js";
import { getDataset, queryDatasetRequest } from "../datasets/datasetApi.js";
import { DateRangeFilterBar } from "../datasets/DateRangeFilterBar.js";
import { defaultDateFilterSelection, filterRowsByDateRange, type RuntimeDateSelection } from "../datasets/dateFilter.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
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
}

interface ResolvedComponentProps extends ViewerComponentProps {
  readonly dataset: Dataset;
  readonly rows: readonly Readonly<Record<string, unknown>>[];
  readonly rowsAreAggregated?: boolean | undefined;
}

const formatBindingMessage = (message: string): string => {
  const missingField = /^Field "([^"]+)" bound to slot "[^"]+" does not exist$/.exec(message);
  return missingField ? `字段 ${missingField[1]} 已不存在` : message;
};

const ResolvedComponent = ({ component, dataset, rows, rowsAreAggregated = false }: ResolvedComponentProps) => {
  const definition = createDefaultRegistry().get(component.type);
  const validation = validateBinding(component.binding, dataset.fields, definition.dataSlots);
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
    : component.binding;
  const transformed = applyTransforms(rows, bindingForRender, dataset.fields);
  return (
    <ResponsiveChartContainer>
      <DashboardComponentRenderer component={component} fields={dataset.fields} rows={transformed} rowsAreAggregated={rowsAreAggregated} />
    </ResponsiveChartContainer>
  );
};

const BoundViewerComponent = ({ component, savedDataset }: ViewerComponentProps) => {
  const localDatasets = useLocalDatasets();
  const datasetId = component.binding!.datasetId;
  const [runtimeDraftParameters, setRuntimeDraftParameters] = useState<RuntimeParameterValues>({});
  const [appliedRuntimeParameters, setAppliedRuntimeParameters] = useState<RuntimeParameterValues>({});
  const dateFilterControl = component.binding!.dateFilter;
  const [activeDateFilter, setActiveDateFilter] = useState<RuntimeDateSelection>(() => defaultDateFilterSelection(dateFilterControl));
  useEffect(() => {
    setActiveDateFilter(defaultDateFilterSelection(dateFilterControl));
  }, [dateFilterControl?.fieldKey, dateFilterControl?.defaultPreset, dateFilterControl?.timezone]);
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
  const data = useQuery({
    queryKey: ["dataset-query", component.id, datasetId, queryParameters, activeDateFilter, aggregation],
    queryFn: () => queryDatasetRequest(datasetId, {
      parameters: queryParameters,
      ...(activeDateFilter === undefined ? {} : { filters: [activeDateFilter] }),
      ...(aggregation === undefined ? {} : { aggregation }),
    }),
    enabled: localResult === undefined && (localSchema !== undefined || schema.data !== undefined),
  });

  const unfilteredResult = localResult ?? data.data;
  const resolvedResult = isUploadedDataset && localResult !== undefined && activeDateFilter !== undefined
    ? { ...localResult, rows: filterRowsByDateRange(localResult.rows, activeDateFilter), total: filterRowsByDateRange(localResult.rows, activeDateFilter).length }
    : unfilteredResult;
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
  if (resolvedResult.rows.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;
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
    {dateFilterControl !== undefined && <DateRangeFilterBar
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
    <ResolvedComponent
      component={component}
      savedDataset={savedDataset}
      dataset={resultDataset}
      rows={resolvedResult.rows}
      rowsAreAggregated={aggregation !== undefined && localResult === undefined}
    />
  </div>;
};

export const ViewerComponent = ({ component, savedDataset, currentDataset }: ViewerComponentProps) => {
  if (component.props.throwInViewer === true) throw new Error("VIEWER_COMPONENT_TEST_ERROR");
  if (component.type === "text") {
    return <ResponsiveChartContainer><DashboardComponentRenderer component={component} rows={[]} /></ResponsiveChartContainer>;
  }
  if (component.binding === undefined) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请配置数据绑定" />;
  }
  if (currentDataset !== undefined) {
    return <ResolvedComponent component={component} savedDataset={savedDataset} dataset={currentDataset} rows={[]} />;
  }
  return <BoundViewerComponent component={component} savedDataset={savedDataset} />;
};
