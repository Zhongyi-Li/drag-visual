import type { ComponentDefinition } from "@drag-visual/component-registry";
import { DashboardGlobalFilterConfig, type Dataset, type DatasetField } from "@drag-visual/contracts";
import { SettingOutlined } from "@ant-design/icons";
import { useQueries } from "@tanstack/react-query";
import { Button, Checkbox, DatePicker, Drawer, Input, Select, Typography } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { type DragEvent, useState } from "react";
import { useStore } from "zustand";

import { getDataset } from "../datasets/datasetApi.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
import { FIELD_DRAG_METADATA_TYPE } from "./fieldDrag.js";
import type { EditorStore } from "./store/editorStore.js";

interface DashboardHeaderPanelProps {
  readonly store: EditorStore;
  readonly component: {
    readonly id: string;
    readonly props: Readonly<Record<string, unknown>>;
    readonly binding?: { readonly datasetId: string } | undefined;
  };
  readonly definition: ComponentDefinition;
}

export const DashboardHeaderPanel = ({ store, component, definition }: DashboardHeaderPanelProps) => {
  const localDatasets = useLocalDatasets();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeFilterId, setActiveFilterId] = useState<string | undefined>();
  const [isFilterDropTarget, setIsFilterDropTarget] = useState(false);
  const props = { ...definition.createDefaults(), ...component.props } as Record<string, unknown>;
  const stringValue = (key: string) => typeof props[key] === "string" ? props[key] : "";
  const defaultDateRange = (): [Dayjs, Dayjs] => {
    const fallback = stringValue("date") || dayjs().format("YYYY-MM-DD");
    const value = props.dateRange;
    const record = typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
    const start = typeof record?.start === "string" ? record.start : fallback;
    const end = typeof record?.end === "string" ? record.end : fallback;
    return [dayjs(start), dayjs(end)];
  };
  const globalFilters = DashboardGlobalFilterConfig.array().safeParse(props.globalFilters).success
    ? DashboardGlobalFilterConfig.array().parse(props.globalFilters)
    : [];
  const dashboardComponents = useStore(store, (state) => state.history.present.components);
  const update = (nextValues: Record<string, unknown>) => {
    const latest = store.getState().history.present.components.find((candidate) => candidate.id === component.id);
    const parsed = definition.propsSchema.safeParse({ ...definition.createDefaults(), ...latest?.props, ...nextValues });
    if (!parsed.success) return;
    store.getState().dispatch({ type: "component.props.update", componentId: component.id, nextProps: parsed.data });
  };
  const updateFilter = (id: string, nextValues: Partial<(typeof globalFilters)[number]>) => update({
    globalFilters: globalFilters.map((filter) => filter.id === id ? { ...filter, ...nextValues } : filter),
  });
  const addFilterFromDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsFilterDropTarget(false);
    const rawField = event.dataTransfer.getData(FIELD_DRAG_METADATA_TYPE);
    try {
      const field = JSON.parse(rawField) as { key?: unknown; label?: unknown; type?: unknown };
      if (typeof field.key !== "string" || typeof field.label !== "string" || (field.type !== "date" && field.type !== "string" && field.type !== "boolean")) return;
      if (globalFilters.some((filter) => filter.fieldKey === field.key)) return;
      update({ globalFilters: [...globalFilters, { id: `filter-${field.key}`, fieldKey: field.key, label: field.label, controlType: field.type === "date" ? "dateRange" : "select", targets: [] }] });
    } catch {
      // Ignore unrelated drag payloads.
    }
  };
  const targetCandidates = dashboardComponents.filter((candidate) => candidate.id !== component.id && candidate.binding !== undefined);
  const targetSchemas = useQueries({
    queries: targetCandidates.map((candidate) => {
      const datasetId = candidate.binding!.datasetId;
      const localDataset = localDatasets.getDataset(datasetId);
      return {
        queryKey: ["datasets", datasetId, "schema"],
        queryFn: () => getDataset(datasetId),
        enabled: localDataset === undefined,
      };
    }),
  });
  const targetDateFields = new Map(targetCandidates.map((candidate, index) => {
    const datasetId = candidate.binding!.datasetId;
    const schema: Dataset | undefined = localDatasets.getDataset(datasetId) ?? targetSchemas[index]?.data;
    return [candidate.id, (schema?.fields ?? []).filter((field) => field.type === "date")] as const;
  }));
  const activeFilter = globalFilters.find((filter) => filter.id === activeFilterId) ?? globalFilters[0];
  const updateDateTarget = (componentId: string, fieldKey: string | undefined) => {
    if (activeFilter === undefined) return;
    const targets = activeFilter.targets.filter((target) => target.componentId !== componentId);
    if (fieldKey !== undefined) targets.push({ componentId, fieldKey });
    updateFilter(activeFilter.id, { targets });
  };

  return (
    <section className="dashboard-header-panel" aria-label="看板信息栏设置">
      <div className="dashboard-header-panel__section">
        <Typography.Text strong>主要展示信息</Typography.Text>
        <Typography.Text type="secondary">左侧内容用于说明这份看板的业务口径。</Typography.Text>
        <label>标题<Input aria-label="看板信息栏标题" maxLength={80} value={stringValue("headline")} onChange={(event) => update({ headline: event.target.value })} /></label>
        <label>说明<Input.TextArea aria-label="看板信息栏说明" autoSize={{ minRows: 2, maxRows: 4 }} maxLength={180} value={stringValue("description")} onChange={(event) => update({ description: event.target.value })} /></label>
        <label>更新时间<Input aria-label="看板信息栏更新时间" maxLength={80} value={stringValue("updatedAt")} onChange={(event) => update({ updatedAt: event.target.value })} /></label>
      </div>
      <div className="dashboard-header-panel__section">
        <Typography.Text strong>全局筛选</Typography.Text>
        <Typography.Text type="secondary">先在右侧数据面板选择数据源，再点击日期字段和维度字段添加筛选器。筛选器只会影响下方选定的联动图表。</Typography.Text>
        <label>默认日期范围<DatePicker.RangePicker aria-label="默认筛选日期范围" format="YYYY/MM/DD" value={defaultDateRange()} onChange={(range) => {
          if (range === null) return;
          const [start, end] = range;
          if (start !== null && end !== null) update({ dateRange: { start: start.format("YYYY-MM-DD"), end: end.format("YYYY-MM-DD") } });
        }} /></label>
        <div
          className={`dashboard-header-panel__configured-filters${isFilterDropTarget ? " is-dragging" : ""}`}
          onDragEnter={(event) => { if (event.dataTransfer.types.includes(FIELD_DRAG_METADATA_TYPE)) setIsFilterDropTarget(true); }}
          onDragLeave={(event) => { if (event.currentTarget === event.target) setIsFilterDropTarget(false); }}
          onDragOver={(event) => { if (event.dataTransfer.types.includes(FIELD_DRAG_METADATA_TYPE)) event.preventDefault(); }}
          onDrop={addFilterFromDrop}
        >
          <div className="dashboard-header-panel__configured-filters-heading">
            <span>已添加筛选器</span>
            <span className="dashboard-header-panel__configured-filters-count">{globalFilters.length}</span>
          </div>
          {globalFilters.length === 0
            ? <Typography.Text type="secondary">双击右侧字段或拖入此处添加；已添加字段可在右侧单击移除。</Typography.Text>
            : <div className="dashboard-header-panel__filter-tags">{globalFilters.map((filter) => <span className="dashboard-header-panel__filter-tag" key={filter.id}>{filter.label}<Button aria-label={`移除${filter.label}筛选器`} size="small" type="text" onClick={() => update({ globalFilters: globalFilters.filter((item) => item.id !== filter.id) })}>×</Button></span>)}</div>}
          <Button block className="dashboard-header-panel__manage-filters" icon={<SettingOutlined />} onClick={() => { setActiveFilterId(globalFilters[0]?.id); setDrawerOpen(true); }}>管理筛选器</Button>
        </div>
      </div>
      <Drawer
        className="dashboard-filter-drawer"
        destroyOnHidden
        size="66vh"
        open={drawerOpen}
        placement="bottom"
        title="全局筛选器配置"
        onClose={() => setDrawerOpen(false)}
        extra={<Button type="primary" onClick={() => setDrawerOpen(false)}>完成</Button>}
      >
        <div className="dashboard-filter-drawer__layout">
          <aside className="dashboard-filter-drawer__list">
            <Typography.Text type="secondary">筛选器</Typography.Text>
            {globalFilters.length === 0 ? <Typography.Text type="secondary">请先从右侧数据面板添加字段。</Typography.Text> : globalFilters.map((filter) => <button className={activeFilter?.id === filter.id ? "is-active" : ""} key={filter.id} type="button" onClick={() => setActiveFilterId(filter.id)}>{filter.label}<small>{filter.controlType === "dateRange" ? "日期范围" : filter.controlType === "select" ? "下拉选择" : "输入框"}</small></button>)}
          </aside>
          {activeFilter && <section className="dashboard-filter-drawer__config">
            <div><Typography.Title level={5}>{activeFilter.label}</Typography.Title><Typography.Text type="secondary">字段：{activeFilter.fieldKey}</Typography.Text></div>
            {activeFilter.controlType === "dateRange"
              ? <div className="dashboard-filter-drawer__locked-control"><Typography.Text>控件类型</Typography.Text><strong>日期范围</strong><Typography.Text type="secondary">日期字段固定使用时间选择器。</Typography.Text></div>
              : <label>控件类型<Select aria-label={`${activeFilter.label}控件类型`} value={activeFilter.controlType} options={[
                { label: "下拉选择", value: "select" }, { label: "输入框", value: "input" },
              ]} onChange={(controlType) => updateFilter(activeFilter.id, { controlType })} /></label>}
            {activeFilter.controlType === "select" && <Typography.Text type="secondary">下拉项由数据源字段去重生成，默认最多展示 200 项；输入关键字时按服务端搜索。</Typography.Text>}
            {activeFilter.controlType === "input" && <Typography.Text type="secondary">输入框使用包含匹配，适合订单号、客户名称等高基数字段。</Typography.Text>}
          </section>}
          {activeFilter && <section className="dashboard-filter-drawer__targets">
            <Typography.Title level={5}>联动图表</Typography.Title>
            <Typography.Text type="secondary">仅勾选的图表会收到此筛选条件。日期筛选可为每个图表选择其数据源中的对应日期字段。</Typography.Text>
            <div className="dashboard-filter-drawer__target-list">{targetCandidates.length === 0 ? <Typography.Text type="secondary">暂无可联动图表</Typography.Text> : targetCandidates.map((candidate) => {
              const target = activeFilter.targets.find((item) => item.componentId === candidate.id);
              const dateFields = targetDateFields.get(candidate.id) ?? [];
              const isDateFilter = activeFilter.controlType === "dateRange";
              const defaultField = isDateFilter ? dateFields[0]?.key : activeFilter.fieldKey;
              return <div className="dashboard-filter-drawer__target-row" key={candidate.id}>
                <Checkbox
                  checked={target !== undefined}
                  disabled={isDateFilter && dateFields.length === 0}
                  onChange={(event) => updateDateTarget(candidate.id, event.target.checked ? defaultField : undefined)}
                >{candidate.title?.trim() || candidate.type}</Checkbox>
                {isDateFilter && target !== undefined && <Select
                  aria-label={`${candidate.title?.trim() || candidate.type}联动日期字段`}
                  options={dateFields.map((field: DatasetField) => ({ label: field.label, value: field.key }))}
                  value={target.fieldKey}
                  onChange={(fieldKey: string) => updateDateTarget(candidate.id, fieldKey)}
                />}
                {isDateFilter && dateFields.length === 0 && <Typography.Text type="secondary">该数据源没有日期字段</Typography.Text>}
              </div>;
            })}</div>
          </section>}
        </div>
      </Drawer>
    </section>
  );
};
