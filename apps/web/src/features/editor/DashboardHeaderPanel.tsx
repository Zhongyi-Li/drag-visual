import type { ComponentDefinition } from "@drag-visual/component-registry";
import { DashboardGlobalFilterConfig, type Dataset, type DatasetField } from "@drag-visual/contracts";
import { CalendarOutlined, DeleteOutlined, FormOutlined, HolderOutlined, MoreOutlined, PlusOutlined, SearchOutlined, TagsOutlined } from "@ant-design/icons";
import { useQueries } from "@tanstack/react-query";
import { Button, Checkbox, Drawer, Input, Segmented, Select, Typography } from "antd";
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
  const [newFilterOpen, setNewFilterOpen] = useState(false);
  const [newFilterQuery, setNewFilterQuery] = useState("");
  const dashboardComponents = useStore(store, (state) => state.history.present.components);
  const currentComponent = dashboardComponents.find((candidate) => candidate.id === component.id);
  const props = { ...definition.createDefaults(), ...component.props, ...currentComponent?.props } as Record<string, unknown>;
  const stringValue = (key: string) => typeof props[key] === "string" ? props[key] : "";
  const globalFilters = DashboardGlobalFilterConfig.array().safeParse(props.globalFilters).success
    ? DashboardGlobalFilterConfig.array().parse(props.globalFilters)
    : [];
  const filterOperatorLabel = (filter: (typeof globalFilters)[number]) => {
    if (filter.controlType === "dateRange") return "范围";
    if (filter.operator === "isEmpty") return "为空";
    if (filter.operator === "isNotEmpty") return "不为空";
    if (filter.operator === "notContains") return "不包含";
    return filter.operator === "equals" || filter.controlType === "select" ? "等于" : "包含";
  };
  const filterControlLabel = (filter: (typeof globalFilters)[number]) => filter.controlType === "dateRange" ? "日期范围" : filter.controlType === "select" ? "下拉选择" : "输入框";
  const update = (nextValues: Record<string, unknown>) => {
    const latest = store.getState().history.present.components.find((candidate) => candidate.id === component.id);
    const parsed = definition.propsSchema.safeParse({ ...definition.createDefaults(), ...latest?.props, ...nextValues });
    if (!parsed.success) return;
    store.getState().dispatch({ type: "component.props.update", componentId: component.id, nextProps: parsed.data });
  };
  const updateFilter = (id: string, nextValues: Partial<(typeof globalFilters)[number]>) => update({
    globalFilters: globalFilters.map((filter) => filter.id === id ? { ...filter, ...nextValues } : filter),
  });
  const removeFilter = (id: string) => {
    const nextFilters = globalFilters.filter((filter) => filter.id !== id);
    update({ globalFilters: nextFilters });
    setActiveFilterId(nextFilters[0]?.id);
  };
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
  const availableFilterFields = [...new Map(targetCandidates.flatMap((candidate, index) => {
    const datasetId = candidate.binding!.datasetId;
    const schema: Dataset | undefined = localDatasets.getDataset(datasetId) ?? targetSchemas[index]?.data;
    return (schema?.fields ?? [])
      .filter((field) => field.type === "date" || field.type === "string" || field.type === "boolean")
      .map((field) => [field.key, field] as const);
  })).values()]
    .filter((field) => !globalFilters.some((filter) => filter.fieldKey === field.key));
  const matchingAvailableFields = availableFilterFields.filter((field) => {
    const query = newFilterQuery.trim().toLocaleLowerCase();
    return query.length === 0 || field.label.toLocaleLowerCase().includes(query) || field.key.toLocaleLowerCase().includes(query);
  });
  const activeFilter = globalFilters.find((filter) => filter.id === activeFilterId) ?? globalFilters[0];
  const filterIcon = (filter: (typeof globalFilters)[number]) => filter.controlType === "dateRange"
    ? <CalendarOutlined />
    : filter.controlType === "input" ? <FormOutlined /> : <TagsOutlined />;
  const addFilter = (field: DatasetField) => {
    const id = `filter-${field.key}`;
    update({ globalFilters: [...globalFilters, { id, fieldKey: field.key, label: field.label, controlType: field.type === "date" ? "dateRange" : "select", targets: [] }] });
    setActiveFilterId(id);
    setNewFilterOpen(false);
    setNewFilterQuery("");
  };
  const updateDateTarget = (componentId: string, fieldKey: string | undefined) => {
    if (activeFilter === undefined) return;
    const targets = activeFilter.targets.filter((target) => target.componentId !== componentId);
    if (fieldKey !== undefined) targets.push({ componentId, fieldKey });
    updateFilter(activeFilter.id, { targets });
  };
  const updateAllTargets = (checked: boolean) => {
    if (activeFilter === undefined) return;
    const targets = checked ? targetCandidates.flatMap((candidate) => {
      if (activeFilter.controlType !== "dateRange") return [{ componentId: candidate.id, fieldKey: activeFilter.fieldKey }];
      const firstDateField = (targetDateFields.get(candidate.id) ?? [])[0];
      return firstDateField === undefined ? [] : [{ componentId: candidate.id, fieldKey: firstDateField.key }];
    }) : [];
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
        <div className="inspector-analysis__config-label dashboard-header-panel__config-label">筛选条件配置</div>
        <div
          className={`inspector-analysis__card inspector-analysis__query-card dashboard-header-panel__filter-card dashboard-header-panel__configured-filters${isFilterDropTarget ? " is-dragging" : ""}`}
          onDragEnter={(event) => { if (event.dataTransfer.types.includes(FIELD_DRAG_METADATA_TYPE)) setIsFilterDropTarget(true); }}
          onDragLeave={(event) => { if (event.currentTarget === event.target) setIsFilterDropTarget(false); }}
          onDragOver={(event) => { if (event.dataTransfer.types.includes(FIELD_DRAG_METADATA_TYPE)) event.preventDefault(); }}
          onDrop={addFilterFromDrop}
        >
          <div className="query-filters-panel__status" aria-label="全局筛选条件状态">
            <span>{globalFilters.length > 0 ? "已配置" : "未配置"}</span>
            <Button aria-label="编辑全局筛选条件" icon={<FormOutlined />} size="small" type="text" onClick={() => { setActiveFilterId(globalFilters[0]?.id); setDrawerOpen(true); }} />
          </div>
          {globalFilters.length > 0 && <div className="query-filters-panel__summary" aria-label="已配置全局筛选条件">{globalFilters.map((filter) => <article className="query-filters-panel__summary-item" key={filter.id}>
            <div>
              <strong>{filter.label}</strong>
              <span className="query-filters-panel__operator">{filterOperatorLabel(filter)}</span>
              <span className="query-filters-panel__value">{filterControlLabel(filter)}</span>
            </div>
          </article>)}</div>}
        </div>
      </div>
      <Drawer
        className="dashboard-filter-drawer"
        destroyOnHidden
        size="min(1120px, calc(100vw - 48px))"
        open={drawerOpen}
        placement="right"
        title={<div className="dashboard-filter-drawer__title"><strong>全局筛选器配置</strong><Typography.Text type="secondary">定义一组全局可用的筛选条件，联动全局图表与看板</Typography.Text></div>}
        onClose={() => setDrawerOpen(false)}
        extra={<Button type="primary" onClick={() => setDrawerOpen(false)}>完成</Button>}
      >
        <div className="dashboard-filter-drawer__layout">
          <aside className="dashboard-filter-drawer__list">
            <div className="dashboard-filter-drawer__list-heading"><span>筛选条件</span><Typography.Text type="secondary"><HolderOutlined /> 拖拽调整顺序</Typography.Text></div>
            <Button className="dashboard-filter-drawer__add-button" icon={<PlusOutlined />} onClick={() => setNewFilterOpen((open) => !open)}>新增筛选条件</Button>
            {newFilterOpen && <div className="dashboard-filter-drawer__add-panel" aria-label="新增全局筛选条件">
              <Input aria-label="搜索可用字段" placeholder="搜索字段" prefix={<SearchOutlined />} value={newFilterQuery} onChange={(event) => setNewFilterQuery(event.target.value)} />
              <div className="dashboard-filter-drawer__field-options">
                {matchingAvailableFields.length === 0 ? <Typography.Text type="secondary">没有可添加的日期或维度字段。</Typography.Text> : matchingAvailableFields.map((field) => <button key={field.key} type="button" onClick={() => addFilter(field)}>
                  {field.type === "date" ? <CalendarOutlined /> : <span className="dashboard-filter-drawer__field-mark" />}
                  <span><strong>{field.label}</strong><small>{field.type === "date" ? "日期范围" : "下拉选择"} · {field.key}</small></span>
                </button>)}
              </div>
            </div>}
            <div className="dashboard-filter-drawer__filter-list">
              {globalFilters.length === 0 ? <Typography.Text type="secondary">从上方选择字段，创建全局筛选条件。</Typography.Text> : globalFilters.map((filter) => <button className={activeFilter?.id === filter.id ? "is-active" : ""} key={filter.id} type="button" onClick={() => setActiveFilterId(filter.id)}><span className="dashboard-filter-drawer__filter-card-start"><HolderOutlined /><i>{filterIcon(filter)}</i><span><strong>{filter.label}</strong><small>{filterControlLabel(filter)}</small></span></span><MoreOutlined /></button>)}
            </div>
            <Typography.Text className="dashboard-filter-drawer__filter-count" type="secondary">{globalFilters.length} 条筛选条件</Typography.Text>
          </aside>
          {!activeFilter && <section className="dashboard-filter-drawer__empty-state">
            <div>
              <span><PlusOutlined /></span>
              <Typography.Title level={4}>从字段开始创建筛选条件</Typography.Title>
              <Typography.Text type="secondary">选择日期或维度字段后，可设置控件类型，并指定哪些图表接收此筛选条件。</Typography.Text>
            </div>
          </section>}
          {activeFilter && <section className="dashboard-filter-drawer__config">
            <div className="dashboard-filter-drawer__config-heading"><div><span>配置筛选条件</span><Typography.Title level={4}>{activeFilter.label}</Typography.Title><Typography.Text type="secondary">字段 · {activeFilter.fieldKey}</Typography.Text></div><Button danger icon={<DeleteOutlined />} size="small" type="text" onClick={() => removeFilter(activeFilter.id)}>删除筛选条件</Button></div>
            {activeFilter.controlType === "dateRange"
              ? <div className="dashboard-filter-drawer__locked-control"><Typography.Text>控件类型</Typography.Text><strong><CalendarOutlined />日期范围</strong><Typography.Text type="secondary">日期字段使用统一的时间范围选择器。</Typography.Text></div>
              : <><div className="dashboard-filter-drawer__control-type"><Typography.Text>控件类型</Typography.Text><div><button className={activeFilter.controlType === "select" ? "is-active" : ""} type="button" onClick={() => updateFilter(activeFilter.id, { controlType: "select", operator: "equals" })}>下拉选择<small>从列表选择值</small></button><button className={activeFilter.controlType === "input" ? "is-active" : ""} type="button" onClick={() => updateFilter(activeFilter.id, { controlType: "input", operator: activeFilter.operator === "notContains" ? "notContains" : "contains" })}>输入框<small>输入筛选关键词</small></button></div></div><label>匹配方式<Segmented aria-label={`${activeFilter.label}匹配方式`} options={[
                { label: "包含", value: "contains" }, { label: "不包含", value: "notContains" }, { label: "等于", value: "equals" }, { label: "为空", value: "isEmpty" }, { label: "不为空", value: "isNotEmpty" },
              ]} value={activeFilter.operator ?? (activeFilter.controlType === "select" ? "equals" : "contains")} onChange={(operator) => updateFilter(activeFilter.id, { operator: operator as Exclude<typeof activeFilter.operator, null>, ...(operator === "contains" || operator === "notContains" ? { controlType: "input" } : { controlType: "select" }) })} /></label></>}
            {(activeFilter.operator === "isEmpty" || activeFilter.operator === "isNotEmpty") && <Typography.Text type="secondary">该条件为固定条件，预览页不显示值输入，应用时直接筛选{activeFilter.operator === "isEmpty" ? "为空" : "不为空"}的数据。</Typography.Text>}
            {activeFilter.controlType === "select" && <Typography.Text type="secondary">下拉项由数据源字段去重生成，默认最多展示 200 项；输入关键字时按服务端搜索。</Typography.Text>}
            {activeFilter.controlType === "input" && <Typography.Text type="secondary">输入框支持包含、不包含与精确匹配，适合订单号、客户名称等高基数字段。</Typography.Text>}
          </section>}
          {activeFilter && <section className="dashboard-filter-drawer__targets">
            <div className="dashboard-filter-drawer__targets-heading"><div><Typography.Title level={5}>联动图表</Typography.Title><Typography.Text type="secondary">选择接收该筛选条件的图表。</Typography.Text></div><span>{activeFilter.targets.length} 已关联</span></div>
            <div className="dashboard-filter-drawer__target-list">{targetCandidates.length === 0 ? <Typography.Text type="secondary">暂无可联动图表</Typography.Text> : <><div className="dashboard-filter-drawer__target-head"><Checkbox checked={activeFilter.targets.length > 0 && activeFilter.targets.length === targetCandidates.length} indeterminate={activeFilter.targets.length > 0 && activeFilter.targets.length < targetCandidates.length} onChange={(event) => updateAllTargets(event.target.checked)}>已表联动 {activeFilter.targets.length} / {targetCandidates.length}</Checkbox><span>图表类型</span><span>状态</span></div>{targetCandidates.map((candidate) => {
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
                <Typography.Text type="secondary">{candidate.type}</Typography.Text>
                {isDateFilter && target !== undefined ? <Select aria-label={`${candidate.title?.trim() || candidate.type}联动日期字段`} options={dateFields.map((field: DatasetField) => ({ label: field.label, value: field.key }))} value={target.fieldKey} onChange={(fieldKey: string) => updateDateTarget(candidate.id, fieldKey)} /> : isDateFilter && dateFields.length === 0 ? <Typography.Text type="secondary">无日期字段</Typography.Text> : <Typography.Text className={target === undefined ? "is-idle" : "is-linked"}>{target === undefined ? "未关联" : "已关联"}</Typography.Text>}
              </div>;
            })}</>}</div>
          </section>}
        </div>
      </Drawer>
    </section>
  );
};
