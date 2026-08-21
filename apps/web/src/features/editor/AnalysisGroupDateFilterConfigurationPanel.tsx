import { AnalysisGroupDateFilterControl, type ComponentInstance, type Dataset, type DatasetField } from "@drag-visual/contracts";
import { useQueries } from "@tanstack/react-query";
import { CalendarOutlined, FormOutlined } from "@ant-design/icons";
import { Alert, Button, Drawer, Select, Switch, Typography } from "antd";
import { useMemo, useState } from "react";
import { useStore } from "zustand";

import { getDataset } from "../datasets/datasetApi.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
import { dateFilterPresetLabel } from "../datasets/dateFilter.js";
import type { EditorStore } from "./store/editorStore.js";

interface Props {
  readonly component: { readonly id: string; readonly props: Readonly<Record<string, unknown>> };
  readonly store: EditorStore;
}

const presetOptions = ["all", "today", "yesterday", "last7Days", "last30Days", "thisMonth", "lastMonth", "thisYear"] as const;

const defaultControl = (): AnalysisGroupDateFilterControl => ({
  defaultPreset: "all",
  defaultRange: null,
  allowCustom: true,
  timezone: "Asia/Shanghai",
  targets: [],
});

export const AnalysisGroupDateFilterConfigurationPanel = ({ component, store }: Props) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const localDatasets = useLocalDatasets();
  const dashboard = useStore(store, (state) => state.history.present);
  const current = dashboard.components.find((candidate) => candidate.id === component.id) ?? component;
  const parsed = AnalysisGroupDateFilterControl.safeParse(current.props.dateFilter);
  const control = parsed.success ? parsed.data : undefined;
  const children = useMemo(() => dashboard.components.filter((candidate) => candidate.parentId === current.id && candidate.binding !== undefined), [current.id, dashboard.components]);
  const childDatasetIds = useMemo(() => children.map((child) => child.binding!.datasetId), [children]);
  const schemas = useQueries({
    queries: childDatasetIds.map((datasetId) => ({
      queryKey: ["dataset-schema", datasetId],
      queryFn: () => getDataset(datasetId),
      enabled: !localDatasets.isUploadedDataset(datasetId),
    })),
  });
  const childSchemas = useMemo(() => new Map<string, Dataset | undefined>(children.map((child, index) => [
    child.id,
    localDatasets.getDataset(child.binding!.datasetId) ?? schemas[index]?.data,
  ])), [children, localDatasets, schemas]);
  const update = (next: AnalysisGroupDateFilterControl | undefined) => {
    const { dateFilter: _removedDateFilter, ...propsWithoutDateFilter } = current.props;
    store.getState().dispatch({
      type: "component.props.update",
      componentId: current.id,
      nextProps: (next === undefined ? propsWithoutDateFilter : { ...propsWithoutDateFilter, dateFilter: next }) as ComponentInstance["props"],
    });
  };
  const updateTarget = (componentId: string, fieldKey: string | undefined) => {
    if (control === undefined) return;
    const targets = control.targets.filter((target) => target.componentId !== componentId);
    update({ ...control, targets: fieldKey === undefined ? targets : [...targets, { componentId, fieldKey }] });
  };
  const openEditor = () => {
    if (control === undefined) update(defaultControl());
    setDrawerOpen(true);
  };
  const configuredTargetSummary = control === undefined
    ? ""
    : control.targets.length === 0 ? "未关联图表" : `已关联 ${control.targets.length} 个图表`;

  return <section className="date-filter-configuration analysis-group-date-filter-configuration" aria-label="复合分析日期筛选配置">
    <div className="date-filter-configuration__status" aria-label="复合分析日期筛选状态">
      <span>{control === undefined ? "未配置" : "已配置"}</span>
      <Button aria-label="编辑复合分析日期筛选" icon={<FormOutlined />} size="small" type="text" onClick={openEditor} />
    </div>
    {control !== undefined && <div className="date-filter-configuration__field-summary">
      <span>日期筛选</span>
      <strong>{configuredTargetSummary}</strong>
    </div>}
    <Drawer
      className="date-filter-drawer"
      destroyOnHidden
      extra={<Button type="primary" onClick={() => setDrawerOpen(false)}>完成</Button>}
      open={drawerOpen}
      placement="bottom"
      size={500}
      title="日期筛选设置"
      onClose={() => setDrawerOpen(false)}
    >
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>复合分析不需要绑定数据源；请选择每个子图表实际使用的日期字段。</Typography.Paragraph>
      {control !== undefined && <div className="analysis-group-date-filter-configuration__content">
        <label>默认范围
          <Select aria-label="复合分析默认日期范围" options={presetOptions.map((preset) => ({ value: preset, label: dateFilterPresetLabel(preset) }))} value={control.defaultPreset} onChange={(defaultPreset) => update({ ...control, defaultPreset })} />
        </label>
        <label className="analysis-group-date-filter-configuration__switch">允许自定义日期范围
          <Switch aria-label="允许自定义复合分析日期范围" checked={control.allowCustom} onChange={(allowCustom) => update({ ...control, allowCustom })} />
        </label>
        <div className="analysis-group-date-filter-configuration__targets">
          <div className="analysis-group-date-filter-configuration__heading"><CalendarOutlined />关联子图表时间字段</div>
          {children.length === 0 ? <Typography.Text type="secondary">请先在容器中添加已绑定数据源的图表。</Typography.Text> : children.map((child) => {
            const fields = (childSchemas.get(child.id)?.fields ?? []).filter((field: DatasetField) => field.type === "date");
            const target = control.targets.find((candidate) => candidate.componentId === child.id);
            return <label className="analysis-group-date-filter-configuration__target" key={child.id}>
              <span>{child.title || child.type}</span>
              <Select
                allowClear
                aria-label={`${child.title || child.type}时间字段`}
                disabled={fields.length === 0}
                placeholder={fields.length === 0 ? "没有日期字段" : "选择日期字段"}
                value={target?.fieldKey}
                options={fields.map((field) => ({ value: field.key, label: field.label }))}
                onChange={(fieldKey: string | undefined) => updateTarget(child.id, fieldKey)}
              />
            </label>;
          })}
        </div>
        {control.targets.length === 0 && <Alert type="info" showIcon message="尚未关联子图表。保存后时间选择器会展示，但不会筛选任何图表。" />}
        <Button danger size="small" type="text" onClick={() => { update(undefined); setDrawerOpen(false); }}>停用日期筛选</Button>
      </div>}
    </Drawer>
  </section>;
};
