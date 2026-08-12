import type { ComponentDefinition } from "@drag-visual/component-registry";
import type { DatasetField, MetricAggregation } from "@drag-visual/contracts";
import { CaretRightOutlined, NumberOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { Empty, Select, Typography } from "antd";
import { useState } from "react";
import { useStore } from "zustand";

import { getDataset } from "../datasets/datasetApi.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
import type { EditorStore } from "./store/editorStore.js";

type StoredFieldBinding = { readonly fieldKey: string; readonly aggregation?: MetricAggregation | undefined };
type StoredSlotValue = StoredFieldBinding | readonly StoredFieldBinding[];

const isSlotArray = (value: StoredSlotValue): value is readonly StoredFieldBinding[] => Array.isArray(value);

interface KpiInsightPanelProps {
  readonly store: EditorStore;
  readonly component: {
    readonly id: string;
    readonly props?: Readonly<Record<string, unknown>> | undefined;
    readonly binding?: {
      readonly datasetId: string;
      readonly slots: Readonly<Record<string, StoredSlotValue>>;
    } | undefined;
  };
  readonly definition: ComponentDefinition;
}

const aggregationOptions = [
  { label: "求和", value: "sum" },
  { label: "平均值", value: "avg" },
  { label: "计数", value: "count" },
  { label: "最大值", value: "max" },
  { label: "最小值", value: "min" },
];

const validAggregation = (value: unknown): MetricAggregation => value === "sum" || value === "avg" || value === "count" || value === "max" || value === "min"
  ? value
  : "sum";

const slotValues = (binding: KpiInsightPanelProps["component"]["binding"] | undefined, slot: string): readonly StoredFieldBinding[] => {
  const value = binding?.slots[slot];
  return value === undefined ? [] : isSlotArray(value) ? value : [value];
};

const labelFor = (fields: readonly DatasetField[], key: string): string => fields.find((field) => field.key === key)?.label ?? key;

export const KpiInsightPanel = ({ store, component }: KpiInsightPanelProps) => {
  const localDatasets = useLocalDatasets();
  const [metricsExpanded, setMetricsExpanded] = useState(true);
  const current = useStore(store, (state) => state.history.present.components.find((item) => item.id === component.id) ?? component);
  const binding = current.binding;
  const datasetId = binding?.datasetId;
  const schema = useQuery({
    queryKey: ["datasets", datasetId, "schema"],
    queryFn: () => localDatasets.getDataset(datasetId!) ?? getDataset(datasetId!),
    enabled: datasetId !== undefined,
  });
  const fields = localDatasets.getDataset(datasetId ?? "")?.fields ?? schema.data?.fields ?? [];
  const measures = slotValues(binding, "measure");
  const defaultAggregation = validAggregation(current.props?.aggregation);

  const updateAggregation = (fieldKey: string, aggregation: MetricAggregation) => {
    if (binding === undefined) return;
    const value = binding.slots.measure;
    if (value === undefined) return;
    const nextMeasures = (isSlotArray(value) ? value : [value]).map((item) => item.fieldKey === fieldKey ? { ...item, aggregation } : { ...item });
    store.getState().dispatch({
      type: "component.binding.update",
      componentId: component.id,
      nextBinding: { ...binding, slots: { ...binding.slots, measure: nextMeasures } },
    });
  };

  if (measures.length === 0) {
    return <section className="kpi-insight-panel" aria-label="指标洞察配置">
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先在右侧绑定至少一个主指标" />
    </section>;
  }

  return <section className="kpi-insight-panel" aria-label="指标洞察配置">
    <div className="kpi-insight-panel__tab" aria-current="page">指标配置</div>
    <div className="kpi-insight-panel__summary">
      <div>
        <Typography.Text strong>主指标聚合方式</Typography.Text>
        <Typography.Text type="secondary">配置每个指标的汇总口径，影响当前指标洞察的计算结果。</Typography.Text>
      </div>
      <Typography.Text type="secondary">已选 {measures.length} 个主指标</Typography.Text>
    </div>
    <div className="kpi-insight-table" role="table" aria-label="主指标聚合配置">
      <div className="kpi-insight-table__header" role="row">
        <span role="columnheader">指标名称</span>
        <span role="columnheader">聚合方式</span>
        <span role="columnheader">说明</span>
      </div>
      <div className="kpi-insight-table__group" role="row">
        <button
          aria-controls="kpi-insight-measure-rows"
          aria-expanded={metricsExpanded}
          aria-label={metricsExpanded ? "收起看板指标/度量" : "展开看板指标/度量"}
          className="kpi-insight-table__group-toggle"
          type="button"
          onClick={() => setMetricsExpanded((expanded) => !expanded)}
        >
          <CaretRightOutlined />
          <Typography.Text strong>看板指标/度量</Typography.Text>
        </button>
      </div>
      {metricsExpanded && <div id="kpi-insight-measure-rows">
      {measures.map((measure) => {
        const metricLabel = labelFor(fields, measure.fieldKey);
        const aggregation = validAggregation(measure.aggregation ?? defaultAggregation);
        return <div className="kpi-insight-table__row" key={measure.fieldKey} role="row" aria-label={`${metricLabel}聚合设置`}>
          <div className="kpi-insight-table__metric" role="cell"><NumberOutlined /><span title={metricLabel}>{metricLabel}</span></div>
          <label className="kpi-insight-table__aggregation" role="cell">
            <span className="editor-visually-hidden">{metricLabel}聚合方式</span>
            <Select aria-label={`${metricLabel}聚合方式`} options={aggregationOptions} value={aggregation} onChange={(nextAggregation: MetricAggregation) => updateAggregation(measure.fieldKey, nextAggregation)} />
          </label>
          <Typography.Text type="secondary" role="cell">修改后仅影响该指标的汇总结果</Typography.Text>
        </div>;
      })}
      </div>}
    </div>
  </section>;
};
