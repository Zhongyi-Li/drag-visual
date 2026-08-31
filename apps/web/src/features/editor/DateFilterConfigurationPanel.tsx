import { DataBinding, type ComponentInstance, type DateFilterControl, type Dataset } from "@drag-visual/contracts";
import { useQuery } from "@tanstack/react-query";
import { CloseOutlined } from "@ant-design/icons";
import { Alert, Button, DatePicker, Popover, Spin, Switch, Typography } from "antd";
import zhCN from "antd/es/date-picker/locale/zh_CN";
import dayjs from "dayjs";
import { type DragEvent, useState } from "react";
import { useStore } from "zustand";

import { getDataset } from "../datasets/datasetApi.js";
import { dateFilterPresetLabel, defaultDateFilterSelection } from "../datasets/dateFilter.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
import { FIELD_DRAG_TYPE } from "./fieldDrag.js";
import type { EditorStore } from "./store/editorStore.js";

interface DateFilterConfigurationPanelProps {
  readonly store: EditorStore;
  readonly component: {
    readonly id: string;
    readonly type: ComponentInstance["type"];
    readonly binding?: {
      readonly datasetId: string;
      readonly dateFilter?: DateFilterControl | undefined;
    } | undefined;
  };
}

const defaultControl = (fieldKey: string, showControl: boolean): NonNullable<DataBinding["dateFilter"]> => ({
  fieldKey,
  defaultPreset: "all",
  allowCustom: true,
  showControl,
  timezone: "Asia/Shanghai",
});

export const DateFilterConfigurationPanel = ({ store, component }: DateFilterConfigurationPanelProps) => {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
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
  const dateControlVisibleByDefault = component.type !== "goalTaskProgress";
  const showDateControl = control?.showControl ?? dateControlVisibleByDefault;
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
  const defaultRangeLabel = control === undefined
    ? "未设置"
    : control.defaultRange === undefined
      ? dateFilterPresetLabel(control.defaultPreset)
      : `${control.defaultRange.start.replaceAll("-", "/")} – ${control.defaultRange.end.replaceAll("-", "/")}`;
  const acceptsDateField = (event: DragEvent<HTMLElement>) => Array.from(event.dataTransfer.types).includes(FIELD_DRAG_TYPE);
  const dropDateField = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDropTarget(false);
    const fieldKey = event.dataTransfer.getData(FIELD_DRAG_TYPE);
    const field = dateFields.find((candidate) => candidate.key === fieldKey);
    if (field !== undefined) update(control === undefined ? defaultControl(field.key, dateControlVisibleByDefault) : { ...control, fieldKey: field.key });
  };
  const selectPreset = (defaultPreset: NonNullable<DataBinding["dateFilter"]>["defaultPreset"]) => {
    if (control === undefined) return;
    const { defaultRange: _defaultRange, ...withoutDefaultRange } = control;
    update({ ...withoutDefaultRange, defaultPreset });
    setCustomRangeOpen(false);
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
            <span>{control === undefined ? "未绑定日期字段" : "日期筛选已就绪"}</span>
          </div>
          {control === undefined && <Typography.Text className="date-filter-configuration__hint" type="secondary">从右侧数据面板选择日期字段后，可设置默认展示范围。</Typography.Text>}
          {control !== undefined && <div className="date-filter-configuration__field-summary">
            <span>日期字段</span>
            <strong>{selectedField?.label ?? control.fieldKey}</strong>
            <Button aria-label="移除日期筛选" icon={<CloseOutlined />} size="small" type="text" onClick={() => update(undefined)} />
          </div>}
          {control !== undefined && <div className="date-filter-configuration__default-range">
            <div className="date-filter-configuration__default-heading"><span>默认展示</span><strong>{defaultRangeLabel}</strong></div>
            <div aria-label="默认日期范围" className="date-filter-configuration__preset-list" role="group">
              {[
                { preset: "all" as const, label: "全部" },
                { preset: "thisMonth" as const, label: "本月" },
                { preset: "lastMonth" as const, label: "上月" },
              ].map(({ preset, label }) => <button aria-pressed={control.defaultRange === undefined && control.defaultPreset === preset} className={control.defaultRange === undefined && control.defaultPreset === preset ? "is-active" : ""} key={preset} type="button" onClick={() => selectPreset(preset)}>{label}</button>)}
              <Popover
                content={<div className="date-filter-configuration__custom-popover"><span>自定义日期范围</span><DatePicker.RangePicker
                  allowClear
                  aria-label="日期筛选范围"
                  format="YYYY/MM/DD"
                  locale={zhCN}
                  placeholder={["开始日期", "结束日期"]}
                  value={configuredDefaultRange === undefined ? null : [dayjs(configuredDefaultRange.start), dayjs(configuredDefaultRange.end)]}
                  onChange={(range) => {
                    if (range === null || range[0] === null || range[1] === null) {
                      selectPreset("all");
                      return;
                    }
                    update({ ...control, defaultPreset: "all", defaultRange: { start: range[0].format("YYYY-MM-DD"), end: range[1].format("YYYY-MM-DD") } });
                    setCustomRangeOpen(false);
                  }}
                /></div>}
                open={customRangeOpen}
                placement="bottomRight"
                trigger="click"
                onOpenChange={setCustomRangeOpen}
              ><button aria-pressed={control.defaultRange !== undefined || customRangeOpen} className={control.defaultRange !== undefined || customRangeOpen ? "is-active" : ""} type="button">自定义</button></Popover>
            </div>
          </div>}
          {control !== undefined && <div className="date-filter-configuration__visibility">
            <span>显示日期选择控件</span>
            <Switch aria-label="显示日期选择控件" checked={showDateControl} size="small" onChange={(showControl) => update({ ...control, showControl })} />
          </div>}
          {control !== undefined && !dateFields.some((field) => field.key === control.fieldKey) && <Alert type="warning" showIcon title="原日期字段已不存在，请重新选择。" />}
        </>}
  </section>;
};
