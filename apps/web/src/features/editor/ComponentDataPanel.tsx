import { CalendarOutlined, MenuFoldOutlined, MenuUnfoldOutlined, NumberOutlined, SearchOutlined, TagOutlined } from "@ant-design/icons";
import type { ComponentDefinition, ComponentRegistry } from "@drag-visual/component-registry";
import { DataBinding, type Dataset, type DatasetField, type MetricAggregation } from "@drag-visual/contracts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Empty, Input, Select, Spin, Tooltip, Typography } from "antd";
import { useMemo, useState } from "react";
import { useStore } from "zustand";

import { getDataset, listDatasets } from "../datasets/datasetApi.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
import { FIELD_DRAG_METADATA_TYPE, FIELD_DRAG_TYPE } from "./fieldDrag.js";
import { editorSelectors, type EditorStore } from "./store/editorStore.js";

type MutableFieldBinding = { fieldKey: string; aggregation?: MetricAggregation | undefined };
type MutableSlots = Record<string, MutableFieldBinding | MutableFieldBinding[]>;
type ReadonlySlotValue = Readonly<MutableFieldBinding> | readonly Readonly<MutableFieldBinding>[];

const cloneSlots = (slots: Readonly<Record<string, ReadonlySlotValue>>): MutableSlots => {
  const cloned: MutableSlots = {};
  for (const [key, value] of Object.entries(slots)) {
    cloned[key] = "fieldKey" in value
      ? { fieldKey: value.fieldKey, aggregation: value.aggregation }
      : value.map((binding) => ({ fieldKey: binding.fieldKey, aggregation: binding.aggregation }));
  }
  return cloned;
};

interface ComponentDataPanelProps {
  readonly store: EditorStore;
  readonly registry: ComponentRegistry;
  readonly collapsed?: boolean;
  readonly onToggleCollapsed?: () => void;
}

const slotPriority = (
  slot: ComponentDefinition["dataSlots"][number],
  field: DatasetField,
  selected: NonNullable<ReturnType<typeof editorSelectors.selectedComponent>>,
): number => {
  if (selected.type === "targetProgress") {
    if (field.type === "number") {
      const measureBound = selected.binding?.slots.measure !== undefined;
      const targetBound = selected.binding?.slots.target !== undefined;
      const semanticName = `${field.key} ${field.label}`.toLowerCase();
      const looksLikeTarget = /目标|target/.test(semanticName);
      const looksLikeActual = /完成|actual|completed/.test(semanticName);
      if (slot.key === "measure") return !measureBound && (looksLikeActual || !looksLikeTarget) ? 110 : targetBound ? 80 : 70;
      if (slot.key === "target") return !targetBound && (looksLikeTarget || measureBound) ? 105 : measureBound ? 75 : 65;
      return 0;
    }
    return slot.key === "dimension" ? 100 : 0;
  }
  if (selected.type === "progressIndicator") {
    if (field.type === "number") {
      const semanticName = `${field.key} ${field.label}`.toLowerCase();
      const looksLikeTarget = /目标|target/.test(semanticName);
      if (slot.key === "target") return looksLikeTarget ? 120 : 35;
      if (slot.key === "measure") return looksLikeTarget ? 45 : 115;
      return 0;
    }
    return field.type === "string" ? (slot.key === "employeeDimension" ? 105 : 0) : 0;
  }
  if ((selected.type === "progressBar" || selected.type === "gauge" || selected.type === "liquid") && field.type === "number") {
    const measureBound = selected.binding?.slots.measure !== undefined;
    const targetBound = selected.binding?.slots.target !== undefined;
    const semanticName = `${field.key} ${field.label}`.toLowerCase();
    const looksLikeTarget = /目标|target/.test(semanticName);
    if (slot.key === "measure") return !measureBound && !looksLikeTarget ? 110 : !measureBound ? 60 : targetBound ? 80 : 70;
    if (slot.key === "target") return !targetBound && looksLikeTarget ? 110 : !targetBound && measureBound ? 100 : 55;
    return 0;
  }
  if ((selected.type === "crosstab" || selected.type === "heatmap") && (field.type === "date" || field.type === "string")) {
    const rowBound = selected.binding?.slots.rowDimension !== undefined;
    const columnBound = selected.binding?.slots.columnDimension !== undefined;
    if (slot.key === "rowDimension") return !rowBound ? 110 : 60;
    if (slot.key === "columnDimension") return !columnBound ? 100 : 50;
    return 0;
  }
  if (field.type === "number") {
    if (selected.type === "barLine") {
      const barMeasureBound = selected.binding?.slots.barMeasure !== undefined;
      const lineMeasureBound = selected.binding?.slots.lineMeasure !== undefined;
      if (slot.key === "barMeasure") return !barMeasureBound ? 120 : lineMeasureBound ? 0 : 80;
      if (slot.key === "lineMeasure") return !lineMeasureBound && barMeasureBound ? 115 : !lineMeasureBound ? 100 : 0;
      return 0;
    }
    if (selected.type === "kpiInsight") {
      // Each double-click adds another primary metric. The selected metric's
      // target/comparison/secondary fields are configured inside its drawer
      // group, where they have an unambiguous owner.
      if (slot.key === "measure") return 120;
      return 0;
    }
    if (slot.key === "tooltipMeasures") return 90;
    if (slot.key === "measure" || slot.key === "measures") {
      return selected.binding?.slots[slot.key] === undefined || slot.multiple ? 100 : 40;
    }
    return 0;
  }
  if (field.type === "date") return slot.key === "timeDimension" || slot.key === "dateDimension" ? 100 : slot.key.includes("Dimension") ? 60 : 0;
  return slot.key === "dimension" || slot.key === "dimensions" ? 100 : slot.key.includes("Dimension") ? 70 : 0;
};

const fieldGroup = (field: DatasetField): "日期" | "维度" | "度量" =>
  field.type === "date" ? "日期" : field.type === "number" ? "度量" : "维度";

const groupIcon = (group: ReturnType<typeof fieldGroup>) => {
  if (group === "日期") return <CalendarOutlined />;
  if (group === "度量") return <NumberOutlined />;
  return <TagOutlined />;
};

export const ComponentDataPanel = ({
  store,
  registry,
  collapsed = false,
  onToggleCollapsed = () => undefined,
}: ComponentDataPanelProps) => {
  const queryClient = useQueryClient();
  const localDatasets = useLocalDatasets();
  const selected = useStore(store, editorSelectors.selectedComponent);
  const [keyword, setKeyword] = useState("");
  const definition = selected === null ? null : registry.get(selected.type);
  const datasetId = selected?.binding?.datasetId;
  const datasets = useQuery({ queryKey: ["datasets"], queryFn: () => listDatasets() });
  const schema = useQuery({
    queryKey: ["datasets", datasetId, "schema"],
    queryFn: () => localDatasets.getDataset(datasetId!) ?? getDataset(datasetId!),
    enabled: datasetId !== undefined,
  });
  // Catalog datasets are materialized in the editor as runtime snapshots. Use
  // that snapshot whenever it is ready so the field browser immediately
  // reflects the interface schema/result that was loaded during editor entry.
  const resolvedSchema = datasetId === undefined
    ? undefined
    : localDatasets.getDataset(datasetId) ?? schema.data;
  const options = Array.from(new Map([...(datasets.data ?? []), ...localDatasets.summaries].map((dataset) => [dataset.id, dataset])).values())
    .map((dataset) => ({ label: dataset.name, value: dataset.id }));
  const fields = useMemo(() => (resolvedSchema?.fields ?? []).filter((field) => {
    const query = keyword.trim().toLowerCase();
    return query.length === 0 || `${field.label} ${field.key}`.toLowerCase().includes(query);
  }), [keyword, resolvedSchema?.fields]);

  const selectDataset = async (nextDatasetId: string) => {
    if (selected === null) return;
    const dataset = localDatasets.getDataset(nextDatasetId) ?? await queryClient.fetchQuery<Dataset>({
      queryKey: ["datasets", nextDatasetId, "schema"],
      queryFn: () => getDataset(nextDatasetId),
    });
    store.getState().dispatch({
      type: "dashboard.dataset.upsert",
      dataset: { datasetId: dataset.id, schemaVersion: dataset.schemaVersion, parameters: {} },
    });
    store.getState().dispatch({
      type: "component.binding.update",
      componentId: selected.id,
      nextBinding: { datasetId: dataset.id, slots: {} },
    });
  };

  const bindField = (field: DatasetField, target?: ComponentDefinition["dataSlots"][number]) => {
    if (selected === null || definition === null || selected.binding === undefined) return;
    if (selected.type === "dashboardHeader") {
      const currentProps = { ...definition.createDefaults(), ...selected.props } as Record<string, unknown>;
      if (field.type === "number") return;
      const globalFilters = Array.isArray(currentProps.globalFilters)
        ? currentProps.globalFilters.filter((item): item is { id: string; fieldKey: string; label: string; controlType: "dateRange" | "select" | "input"; targets: unknown[] } => typeof item === "object" && item !== null && !Array.isArray(item) && typeof (item as Record<string, unknown>).id === "string" && typeof (item as Record<string, unknown>).fieldKey === "string" && typeof (item as Record<string, unknown>).label === "string" && ((item as Record<string, unknown>).controlType === "dateRange" || (item as Record<string, unknown>).controlType === "select" || (item as Record<string, unknown>).controlType === "input") && Array.isArray((item as Record<string, unknown>).targets))
        : [];
      const exists = globalFilters.some((item) => item.fieldKey === field.key);
      if (exists) return;
      const nextFilters = [...globalFilters, { id: `filter-${field.key}`, fieldKey: field.key, label: field.label, controlType: field.type === "date" ? "dateRange" : "select", targets: [] }];
      const parsed = definition.propsSchema.safeParse({ ...currentProps, globalFilters: nextFilters });
      if (parsed.success) store.getState().dispatch({ type: "component.props.update", componentId: selected.id, nextProps: parsed.data });
      return;
    }
    const compatibleSlots = definition.dataSlots.filter((slot) => slot.acceptedTypes.includes(field.type));
    const slot = target && target.acceptedTypes.includes(field.type)
      ? target
      : compatibleSlots.sort((left, right) => slotPriority(right, field, selected) - slotPriority(left, field, selected))[0];
    if (slot === undefined) return;
    const nextSlots = cloneSlots(selected.binding.slots);
    const current = nextSlots[slot.key];
    if (slot.multiple) {
      const values = current === undefined ? [] : Array.isArray(current) ? current : [current];
      if (values.some((value) => value.fieldKey === field.key)) return;
      nextSlots[slot.key] = [...values, { fieldKey: field.key }];
    } else {
      nextSlots[slot.key] = { fieldKey: field.key };
    }
    store.getState().dispatch({
      type: "component.binding.update",
      componentId: selected.id,
      nextBinding: DataBinding.parse({ ...selected.binding, slots: nextSlots }),
    });
  };
  const removeHeaderFilter = (fieldKey: string) => {
    if (selected === null || definition === null || selected.type !== "dashboardHeader") return;
    const currentProps = { ...definition.createDefaults(), ...selected.props } as Record<string, unknown>;
    const globalFilters = Array.isArray(currentProps.globalFilters)
      ? currentProps.globalFilters.filter((item): item is { fieldKey: string } => typeof item === "object" && item !== null && !Array.isArray(item) && typeof (item as Record<string, unknown>).fieldKey === "string")
      : [];
    const parsed = definition.propsSchema.safeParse({ ...currentProps, globalFilters: globalFilters.filter((filter) => filter.fieldKey !== fieldKey) });
    if (parsed.success) store.getState().dispatch({ type: "component.props.update", componentId: selected.id, nextProps: parsed.data });
  };

  const setDateFilterField = (field: DatasetField) => {
    if (selected === null || selected.binding?.dateFilter === undefined || field.type !== "date") return;
    store.getState().dispatch({
      type: "component.binding.update",
      componentId: selected.id,
      nextBinding: DataBinding.parse({
        ...selected.binding,
        dateFilter: { ...selected.binding.dateFilter, fieldKey: field.key },
      }),
    });
  };
  const dateFilterEnabled = selected?.binding?.dateFilter !== undefined;
  const isDashboardHeader = selected?.type === "dashboardHeader";
  const headerFilterFields = isDashboardHeader && Array.isArray(selected?.props.globalFilters)
    ? selected.props.globalFilters.filter((item): item is { fieldKey: string } => typeof item === "object" && item !== null && !Array.isArray(item) && typeof (item as Record<string, unknown>).fieldKey === "string")
    : [];

  const groupedFields = (["日期", "维度", "度量"] as const).map((group) => ({
    group,
    fields: fields.filter((field) => fieldGroup(field) === group),
  })).filter(({ fields: entries }) => entries.length > 0);

  return (
    <section className={`component-data-panel${collapsed ? " component-data-panel--collapsed" : ""}`} aria-label="数据面板">
      <div className="component-data-panel__heading">
        {!collapsed && <strong>数据</strong>}
        <Tooltip title={collapsed ? "展开数据栏" : "收起数据栏"} placement="left">
          <Button
            type="text"
            size="small"
            aria-label={collapsed ? "展开数据栏" : "收起数据栏"}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onToggleCollapsed}
          />
        </Tooltip>
      </div>
      {collapsed ? null : selected === null ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择组件后配置数据" />
      ) : (
        <>
          <Select
            aria-label="数据源"
            className="component-data-panel__dataset"
            {...(datasetId === undefined ? {} : { value: datasetId })}
            placeholder="选择数据源"
            options={options}
            loading={datasets.isLoading}
            onChange={(value: string) => void selectDataset(value)}
          />
          {datasetId === undefined ? (
            <Typography.Text type="secondary" className="component-data-panel__hint">选择数据源后，可双击字段或拖拽到左侧槽位。</Typography.Text>
          ) : schema.isLoading && resolvedSchema === undefined ? <Spin className="component-data-panel__loading" /> : schema.isError && resolvedSchema === undefined ? (
            <Alert
              className="component-data-panel__error"
              type="error"
              showIcon
              message="加载字段失败"
              description="数据源字段暂时无法读取，请稍后重试或重新选择数据源。"
            />
          ) : (
            <>
              <Input
                aria-label="搜索数据字段"
                className="component-data-panel__search"
                prefix={<SearchOutlined />}
                placeholder="搜索字段"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
              {groupedFields.length === 0 ? (
                <Empty
                  className="component-data-panel__empty-fields"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={keyword.trim().length > 0 ? "未找到匹配字段" : "该数据源暂无可用字段"}
                />
              ) : <div className="component-data-panel__groups">
                {groupedFields.map(({ group, fields: entries }) => (
                  <section className="component-data-group" key={group} aria-label={group}>
                    <div className="component-data-group__heading">
                      <h3>{group}</h3>
                      {isDashboardHeader && group === "日期" && <span>双击或拖拽添加日期筛选</span>}
                      {isDashboardHeader && group === "维度" && <span>双击或拖拽添加维度筛选</span>}
                      {!isDashboardHeader && group === "日期" && dateFilterEnabled && <span>点击设为筛选字段</span>}
                    </div>
                    {entries.map((field) => (
                      <button
                        aria-pressed={isDashboardHeader ? headerFilterFields.some((item) => item.fieldKey === field.key) : field.type === "date" && dateFilterEnabled ? selected?.binding?.dateFilter?.fieldKey === field.key : undefined}
                        className={`component-data-field component-data-field--${fieldGroup(field)}${isDashboardHeader || field.type === "date" && dateFilterEnabled ? " component-data-field--filter-selectable" : ""}${isDashboardHeader ? headerFilterFields.some((item) => item.fieldKey === field.key) ? " component-data-field--filter-selected" : "" : selected?.binding?.dateFilter?.fieldKey === field.key ? " component-data-field--filter-selected" : ""}`}
                        draggable
                        key={field.key}
                        title={isDashboardHeader ? headerFilterFields.some((item) => item.fieldKey === field.key) ? `点击移除筛选器：${field.label}` : field.type === "date" ? `双击或拖拽添加日期筛选：${field.label}` : field.type === "number" ? `${field.label}（数值字段不能作为维度筛选）` : `双击或拖拽添加维度筛选：${field.label}` : field.type === "date" && dateFilterEnabled ? `点击设为筛选字段：${field.label}` : `${field.label}（${field.key}）`}
                        type="button"
                        onClick={() => isDashboardHeader ? headerFilterFields.some((item) => item.fieldKey === field.key) && removeHeaderFilter(field.key) : setDateFilterField(field)}
                        onDoubleClick={() => bindField(field)}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "copy";
                          event.dataTransfer.setData(FIELD_DRAG_TYPE, field.key);
                          event.dataTransfer.setData(FIELD_DRAG_METADATA_TYPE, JSON.stringify({ key: field.key, label: field.label, type: field.type }));
                        }}
                      >
                        <span aria-hidden="true">{groupIcon(fieldGroup(field))}</span>
                        <span>{field.label}</span>
                      </button>
                    ))}
                  </section>
                ))}
              </div>}
            </>
          )}
        </>
      )}
    </section>
  );
};
