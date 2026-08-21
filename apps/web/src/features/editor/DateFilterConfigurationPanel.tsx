import { DataBinding, type DateFilterControl, type Dataset } from "@drag-visual/contracts";
import { useQuery } from "@tanstack/react-query";
import { FormOutlined } from "@ant-design/icons";
import { Alert, Button, DatePicker, Drawer, Spin, Typography } from "antd";
import zhCN from "antd/es/date-picker/locale/zh_CN";
import dayjs from "dayjs";
import { type DragEvent, useState } from "react";
import { useStore } from "zustand";

import { getDataset } from "../datasets/datasetApi.js";
import { defaultDateFilterSelection } from "../datasets/dateFilter.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
import { FIELD_DRAG_TYPE } from "./fieldDrag.js";
import type { EditorStore } from "./store/editorStore.js";

interface DateFilterConfigurationPanelProps {
  readonly store: EditorStore;
  readonly component: {
    readonly id: string;
    readonly binding?: {
      readonly datasetId: string;
      readonly dateFilter?: DateFilterControl | undefined;
    } | undefined;
  };
}

const defaultControl = (fieldKey: string): NonNullable<DataBinding["dateFilter"]> => ({
  fieldKey,
  defaultPreset: "all",
  allowCustom: true,
  timezone: "Asia/Shanghai",
});

export const DateFilterConfigurationPanel = ({ store, component }: DateFilterConfigurationPanelProps) => {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const localDatasets = useLocalDatasets();
  const storedBinding = useStore(store, (state) => state.history.present.components.find((candidate) => candidate.id === component.id)?.binding);
  const binding = storedBinding ?? component.binding;
  const datasetId = binding?.datasetId;
  const localSchema = datasetId === undefined ? undefined : localDatasets.getDataset(datasetId);
  const schema = useQuery({
    queryKey: ["datasets", datasetId, "schema"],
    queryFn: () => getDataset(datasetId!),
    enabled: datasetId !== undefined && localSchema === undefined,
  });
  const dataset: Dataset | undefined = localSchema ?? schema.data;
  const dateFields = (dataset?.fields ?? []).filter((field) => field.type === "date");
  const control = binding?.dateFilter;
  const selectedField = dateFields.find((field) => field.key === control?.fieldKey);
  const update = (dateFilter: DataBinding["dateFilter"]) => {
    if (binding === undefined) return;
    const nextBinding = dateFilter === undefined
      ? (() => {
          const { dateFilter: _removed, ...withoutDateFilter } = binding;
          return DataBinding.parse(withoutDateFilter);
        })()
      : DataBinding.parse({ ...binding, dateFilter });
    store.getState().dispatch({
      type: "component.binding.update",
      componentId: component.id,
      nextBinding,
    });
  };
  const configuredDefaultRange = control === undefined ? undefined : defaultDateFilterSelection(control);
  const acceptsDateField = (event: DragEvent<HTMLElement>) => Array.from(event.dataTransfer.types).includes(FIELD_DRAG_TYPE);
  const dropDateField = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDropTarget(false);
    const fieldKey = event.dataTransfer.getData(FIELD_DRAG_TYPE);
    const field = dateFields.find((candidate) => candidate.key === fieldKey);
    if (field !== undefined) update(control === undefined ? defaultControl(field.key) : { ...control, fieldKey: field.key });
  };
  const openEditor = () => {
    if (binding === undefined || dateFields.length === 0) return;
    if (control === undefined) update(defaultControl(dateFields[0]!.key));
    setDrawerOpen(true);
  };

  return <section
    aria-label="筛选字段拖放区域"
    className={`date-filter-configuration${isDropTarget ? " date-filter-configuration--drop-target" : ""}`}
    onDragEnter={(event) => { if (acceptsDateField(event)) setIsDropTarget(true); }}
    onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDropTarget(false); }}
    onDragOver={(event) => { if (acceptsDateField(event)) event.preventDefault(); }}
    onDrop={dropDateField}
  >
    {schema.isLoading && <Spin size="small" />}
    {binding === undefined ? <Typography.Text type="secondary">请先在“字段”中绑定数据源。</Typography.Text>
      : !schema.isLoading && dateFields.length === 0 ? <Typography.Text type="secondary">当前数据源没有可用于筛选的日期字段。</Typography.Text>
        : <>
          <div className="date-filter-configuration__status" aria-label="日期筛选配置状态">
            <span>{control === undefined ? "未配置" : "已配置"}</span>
            <Button aria-label="编辑日期筛选" disabled={dateFields.length === 0} icon={<FormOutlined />} size="small" type="text" onClick={openEditor} />
          </div>
          {control !== undefined && <div className="date-filter-configuration__field-summary">
            <span>日期字段</span>
            <strong>{selectedField?.label ?? control.fieldKey}</strong>
          </div>}
          {control !== undefined && !dateFields.some((field) => field.key === control.fieldKey) && <Alert type="warning" showIcon title="原日期字段已不存在，请重新选择。" />}
          <Drawer
            className="date-filter-drawer"
            destroyOnHidden
            extra={<Button type="primary" onClick={() => setDrawerOpen(false)}>完成</Button>}
            open={drawerOpen}
            placement="bottom"
            size={420}
            title="日期筛选设置"
            onClose={() => setDrawerOpen(false)}
          >
            {control === undefined ? <Typography.Text type="secondary">请先从右侧数据面板选择日期字段。</Typography.Text> : <label className="date-filter-drawer__range">范围
              <DatePicker.RangePicker
                allowClear
                aria-label="日期筛选范围"
                format="YYYY/MM/DD"
                locale={zhCN}
                placeholder={["开始日期", "结束日期"]}
                value={configuredDefaultRange === undefined ? null : [dayjs(configuredDefaultRange.start), dayjs(configuredDefaultRange.end)]}
                onChange={(range) => {
                  if (range === null || range[0] === null || range[1] === null) {
                    const { defaultRange: _defaultRange, ...withoutDefaultRange } = control;
                    update({ ...withoutDefaultRange, defaultPreset: "all" });
                    return;
                  }
                  update({
                    ...control,
                    defaultPreset: "all",
                    defaultRange: { start: range[0].format("YYYY-MM-DD"), end: range[1].format("YYYY-MM-DD") },
                  });
                }}
              />
              <Typography.Text type="secondary">留空时默认展示全部数据。</Typography.Text>
            </label>}
          </Drawer>
        </>}
  </section>;
};
