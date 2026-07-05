import { createDefaultRegistry } from "@drag-visual/component-registry";
import type { ComponentInstance, Dashboard, Dataset } from "@drag-visual/contracts";
import { applyTransforms, validateBinding } from "@drag-visual/data-engine";
import { DashboardComponentRenderer } from "@drag-visual/chart-renderer";
import { useQuery } from "@tanstack/react-query";
import { Alert, Empty, Spin } from "antd";

import { getDataset, queryDataset } from "../datasets/datasetApi.js";

interface ViewerComponentProps {
  readonly component: ComponentInstance;
  readonly savedDataset?: Dashboard["datasets"][number] | undefined;
  readonly currentDataset?: Dataset | undefined;
}

interface ResolvedComponentProps extends ViewerComponentProps {
  readonly dataset: Dataset;
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}

const ResolvedComponent = ({ component, dataset, rows }: ResolvedComponentProps) => {
  const definition = createDefaultRegistry().get(component.type);
  const validation = validateBinding(component.binding, dataset.fields, definition.dataSlots);
  if (!validation.valid) {
    return <Alert type="warning" showIcon message="数据绑定无效" description={validation.messages.join("；")} />;
  }
  const transformed = applyTransforms(rows, component.binding, dataset.fields);
  return <DashboardComponentRenderer component={component} rows={transformed} />;
};

const BoundViewerComponent = ({ component, savedDataset }: ViewerComponentProps) => {
  const datasetId = component.binding!.datasetId;
  const schema = useQuery({
    queryKey: ["dataset-schema", datasetId],
    queryFn: () => getDataset(datasetId),
  });
  const data = useQuery({
    queryKey: ["dataset-query", datasetId, savedDataset?.parameters ?? {}],
    queryFn: () => queryDataset(datasetId, savedDataset?.parameters ?? {}),
    enabled: schema.data !== undefined,
  });

  if (schema.isPending || data.isPending) return <Spin size="small" aria-label={`正在加载${component.title ?? component.type}`} />;
  if (schema.isError) return <Alert type="error" showIcon message="加载数据集失败" />;
  if (data.isError) return <Alert type="error" showIcon message="查询组件数据失败" />;
  if (data.data.rows.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />;
  return <ResolvedComponent component={component} savedDataset={savedDataset} dataset={schema.data} rows={data.data.rows} />;
};

export const ViewerComponent = ({ component, savedDataset, currentDataset }: ViewerComponentProps) => {
  if (component.props.throwInViewer === true) throw new Error("VIEWER_COMPONENT_TEST_ERROR");
  if (component.type === "text") return <DashboardComponentRenderer component={component} rows={[]} />;
  if (component.binding === undefined) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请配置数据绑定" />;
  }
  if (currentDataset !== undefined) {
    return <ResolvedComponent component={component} savedDataset={savedDataset} dataset={currentDataset} rows={[]} />;
  }
  return <BoundViewerComponent component={component} savedDataset={savedDataset} />;
};
