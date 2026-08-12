import { DataBinding, type DateFilterControl, type Dataset } from "@drag-visual/contracts";
import { useQuery } from "@tanstack/react-query";
import { CalendarOutlined } from "@ant-design/icons";
import { Alert, DatePicker, Spin, Switch, Typography } from "antd";
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
  const selectedField = dateFields.find((field) => field.key === control?.fieldKey);
  const configuredDefaultRange = control === undefined ? undefined : defaultDateFilterSelection(control);
  const acceptsDateField = (event: DragEvent<HTMLDivElement>) => event.dataTransfer.types.includes(FIELD_DRAG_TYPE);
  const dropDateField = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDropTarget(false);
    const fieldKey = event.dataTransfer.getData(FIELD_DRAG_TYPE);
    const field = dateFields.find((candidate) => candidate.key === fieldKey);
    if (control !== undefined && field !== undefined) update({ ...control, fieldKey: field.key });
  };

  return <section className="date-filter-configuration" aria-label="日期筛选配置">
    <div className="date-filter-configuration__switch">
      <Typography.Text>启用日期筛选</Typography.Text>
      <Switch
        aria-label="启用日期筛选"
        checked={control !== undefined}
        disabled={binding === undefined || dateFields.length === 0}
        onChange={(enabled) => {
          if (enabled) {
            const first = dateFields[0];
            if (first !== undefined) update(defaultControl(first.key));
          } else update(undefined);
        }}
      />
    </div>
    {schema.isLoading && <Spin size="small" />}
    {binding === undefined ? <Typography.Text type="secondary">请先在“字段”中绑定数据源。</Typography.Text>
      : !schema.isLoading && dateFields.length === 0 ? <Typography.Text type="secondary">当前数据源没有可用于筛选的日期字段。</Typography.Text>
        : control !== undefined && <div className="date-filter-configuration__fields">
          <label className="date-filter-configuration__field">筛选字段
            <div
              aria-label="筛选字段拖放区域"
              className={`date-filter-field-drop${isDropTarget ? " date-filter-field-drop--active" : ""}`}
              onDragEnter={(event) => { if (acceptsDateField(event)) setIsDropTarget(true); }}
              onDragLeave={(event) => { if (event.currentTarget === event.target) setIsDropTarget(false); }}
              onDragOver={(event) => { if (acceptsDateField(event)) event.preventDefault(); }}
              onDrop={dropDateField}
            >
              <span className="date-filter-field-drop__value">
                <CalendarOutlined aria-hidden="true" />
                <span>{selectedField?.label ?? control.fieldKey}</span>
              </span>
              <Typography.Text type="secondary">从右侧点击或拖入日期字段</Typography.Text>
            </div>
          </label>
          <label className="date-filter-configuration__field">范围
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
          </label>
        </div>}
    {control !== undefined && !dateFields.some((field) => field.key === control.fieldKey) && <Alert type="warning" showIcon title="原日期字段已不存在，请重新选择。" />}
  </section>;
};
