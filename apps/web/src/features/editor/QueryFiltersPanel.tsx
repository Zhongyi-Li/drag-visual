import type { ComponentDefinition } from "@drag-visual/component-registry";
import { QueryFilterControl, type ComponentInstance, type DatasetField, type QueryFilterControl as QueryFilterControlValue } from "@drag-visual/contracts";
import { useQueries, useQuery } from "@tanstack/react-query";
import { DeleteOutlined, FilterOutlined, FormOutlined, HolderOutlined, MoreOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Drawer, Input, InputNumber, Select, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";

import { getDataset, getDatasetFieldOptions } from "../datasets/datasetApi.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
import type { EditorStore } from "./store/editorStore.js";
import { analysisGroupQueryFilterControls, componentQueryFilterControls } from "../viewer/dashboardGlobalFilters.js";

type Scope = "component" | "analysisGroup";
type DraftFilter = QueryFilterControlValue;

interface Props {
  readonly component: { readonly id: string; readonly type: ComponentInstance["type"]; readonly props: Readonly<Record<string, unknown>>; readonly binding?: { readonly datasetId: string } | undefined };
  readonly definition: ComponentDefinition;
  readonly scope: Scope;
  readonly store: EditorStore;
}

const filterForField = (field: DatasetField): DraftFilter => field.type === "number"
    ? { kind: "numberComparison", fieldKey: field.key, operator: "gte", value: 0 }
  : field.type === "boolean"
    ? { kind: "fieldValue", fieldKey: field.key, values: ["true"] }
    : { kind: "fieldText", fieldKey: field.key, operator: "contains", value: "" };

const fieldLabel = (field: DatasetField): string => `${field.label}（${field.key}）`;

const operatorLabel = (filter: DraftFilter): string => {
  if (filter.kind === "numberComparison") return ({ eq: "等于", neq: "不等于", gt: "大于", gte: "大于等于", lt: "小于", lte: "小于等于" })[filter.operator];
  if (filter.kind === "dateRange") return "范围";
  if (filter.kind === "fieldNull") return filter.operator === "isEmpty" ? "为空" : "不为空";
  return filter.kind === "fieldValue" ? "等于" : filter.kind === "fieldText" && filter.operator === "notContains" ? "不包含" : "包含";
};

const valueLabel = (filter: DraftFilter): string => {
  if (filter.kind === "numberComparison") return String(filter.value);
  if (filter.kind === "dateRange") return `${filter.start} 至 ${filter.end}`;
  if (filter.kind === "fieldValue") return String(filter.values[0] ?? "未填写");
  if (filter.kind === "fieldNull") return "无需填写值";
  return filter.value || "未填写";
};

const replaceAt = <Value,>(items: readonly Value[], index: number, next: Value): Value[] => items.map((item, current) => current === index ? next : item);

const commonOptions = (optionGroups: readonly (readonly string[])[]): string[] => {
  if (optionGroups.length === 0) return [];
  const shared = new Set(optionGroups[0]);
  for (const options of optionGroups.slice(1)) {
    const available = new Set(options);
    for (const option of shared) {
      if (!available.has(option)) shared.delete(option);
    }
  }
  return [...shared].sort((left, right) => left.localeCompare(right, "zh-CN"));
};

export const QueryFiltersPanel = ({ component, definition, scope, store }: Props) => {
  const localDatasets = useLocalDatasets();
  const dashboard = useStore(store, (state) => state.history.present);
  const current = dashboard.components.find((candidate) => candidate.id === component.id) ?? component;
  const componentDatasetId = current.binding?.datasetId;
  const childDatasetIds = useMemo(() => [...new Set(dashboard.components
    .filter((candidate) => candidate.parentId === current.id && candidate.binding !== undefined)
    .map((candidate) => candidate.binding!.datasetId))], [current.id, dashboard.components]);
  const componentSchema = useQuery({
    queryKey: ["dataset-schema", componentDatasetId],
    queryFn: () => getDataset(componentDatasetId!),
    enabled: scope === "component" && componentDatasetId !== undefined && !localDatasets.isUploadedDataset(componentDatasetId),
  });
  const groupSchemas = useQueries({
    queries: childDatasetIds.map((datasetId) => ({
      queryKey: ["dataset-schema", datasetId],
      queryFn: () => getDataset(datasetId),
      enabled: scope === "analysisGroup" && !localDatasets.isUploadedDataset(datasetId),
    })),
  });
  const fields = useMemo<readonly DatasetField[]>(() => {
    if (scope === "component") return componentDatasetId === undefined
      ? []
      : localDatasets.getDataset(componentDatasetId)?.fields ?? componentSchema.data?.fields ?? [];
    if (childDatasetIds.length === 0) return [];
    const schemas = childDatasetIds.map((datasetId, index) => localDatasets.getDataset(datasetId)?.fields ?? groupSchemas[index]?.data?.fields ?? []);
    if (schemas.some((schema) => schema.length === 0)) return [];
    return schemas[0]!.filter((field) => schemas.every((schema) => schema.some((candidate) => candidate.key === field.key && candidate.type === field.type)));
  }, [childDatasetIds, componentDatasetId, componentSchema.data?.fields, groupSchemas, localDatasets, scope]);
  // 日期范围由上方的“日期筛选”单独管理，查询条件只承载非日期字段。
  const queryFields = useMemo(() => fields.filter((field) => field.type !== "date"), [fields]);
  const storedFilters = scope === "component" ? componentQueryFilterControls(current) : analysisGroupQueryFilterControls(current);
  const dateFilters = storedFilters.filter((filter) => filter.kind === "dateRange");
  const savedFilters = storedFilters.filter((filter) => filter.kind !== "dateRange");
  const savedKey = JSON.stringify(savedFilters);
  const [draft, setDraft] = useState<readonly DraftFilter[]>(savedFilters);
  const [activeConditionIndex, setActiveConditionIndex] = useState(savedFilters.length > 0 ? 0 : -1);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const optionDatasetIds = scope === "component"
    ? componentDatasetId === undefined ? [] : [componentDatasetId]
    : childDatasetIds;
  const optionQueries = useQueries({
    queries: draft.flatMap((filter) => optionDatasetIds.map((datasetId) => ({
      queryKey: ["dataset-field-options", datasetId, filter.fieldKey],
      queryFn: () => getDatasetFieldOptions(datasetId, filter.fieldKey),
      enabled: !localDatasets.isUploadedDataset(datasetId) && filter.kind === "fieldValue",
    }))),
  });
  useEffect(() => { setDraft(savedFilters); setActiveConditionIndex(savedFilters.length > 0 ? 0 : -1); setError(null); }, [savedKey]);

  const add = () => {
    const field = queryFields[0];
    if (field === undefined) return;
    setActiveConditionIndex(draft.length);
    setDraft((items) => [...items, filterForField(field)]);
  };
  const apply = (): boolean => {
    const parsed = QueryFilterControl.array().max(6).safeParse(draft);
    if (!parsed.success) {
      setError("筛选条件格式不正确，请检查后重试。");
      return false;
    }
    const nextFilters = [...dateFilters, ...parsed.data];
    if (scope === "component") {
      store.getState().dispatch({ type: "component.props.update", componentId: current.id, nextProps: { ...current.props, queryFilters: nextFilters } as ComponentInstance["props"] });
    } else {
      const props = { ...definition.createDefaults(), ...current.props, queryFilters: nextFilters };
      const next = definition.propsSchema.safeParse(props);
      if (!next.success) {
        setError("查询条件保存失败，请检查输入。");
        return false;
      }
      store.getState().dispatch({ type: "component.props.update", componentId: current.id, nextProps: next.data });
    }
    setError(null);
    return true;
  };
  const unavailableMessage = scope === "component"
    ? "请先在“字段”页绑定数据集，再添加查询条件。"
    : "请先在复合分析中添加已绑定数据集的图表。仅展示所有子图共同拥有的字段。";

  const remove = (index: number) => {
    setDraft((items) => items.filter((_, currentIndex) => currentIndex !== index));
    setActiveConditionIndex((currentIndex) => {
      const nextLength = draft.length - 1;
      if (nextLength <= 0) return -1;
      if (index < currentIndex) return currentIndex - 1;
      return Math.min(currentIndex, nextLength - 1);
    });
  };
  const updateOperator = (index: number, filter: DraftFilter, field: DatasetField, textValue: string, operator: string) => {
    if (operator === "isEmpty" || operator === "isNotEmpty") {
      setDraft((items) => replaceAt(items, index, { kind: "fieldNull", fieldKey: field.key, operator }));
      return;
    }
    if (field.type === "number") {
      setDraft((items) => replaceAt(items, index, { kind: "numberComparison", fieldKey: field.key, operator: operator as "eq" | "neq" | "gt" | "gte" | "lt" | "lte", value: filter.kind === "numberComparison" ? filter.value : 0 }));
      return;
    }
    setDraft((items) => replaceAt(items, index, operator === "equals" ? { kind: "fieldValue", fieldKey: field.key, values: [textValue] } : { kind: "fieldText", fieldKey: field.key, operator: operator === "notContains" ? "notContains" : "contains", value: textValue }));
  };
  const updateControlType = (index: number, filter: DraftFilter, controlType: "select" | "input") => {
    const textValue = filter.kind === "fieldValue" ? String(filter.values[0] ?? "") : filter.kind === "fieldText" ? filter.value : "";
    setDraft((items) => replaceAt(items, index, controlType === "select"
      ? { kind: "fieldValue", fieldKey: filter.fieldKey, values: [textValue] }
      : { kind: "fieldText", fieldKey: filter.fieldKey, operator: filter.kind === "fieldText" && filter.operator === "notContains" ? "notContains" : "contains", value: textValue }));
  };
  const finishEditing = () => {
    if (apply()) setDrawerOpen(false);
  };
  const openDrawer = () => {
    setDraft(savedFilters);
    setActiveConditionIndex(savedFilters.length > 0 ? 0 : -1);
    setError(null);
    setDrawerOpen(true);
  };
  const closeDrawer = () => {
    setDraft(savedFilters);
    setActiveConditionIndex(savedFilters.length > 0 ? 0 : -1);
    setError(null);
    setDrawerOpen(false);
  };

  return <section aria-label={scope === "component" ? "图表查询条件" : "复合分析查询条件"} className="query-filters-panel">
    {fields.length === 0 ? <Typography.Text type="secondary">{unavailableMessage}</Typography.Text> : queryFields.length === 0 ? <Typography.Text type="secondary">当前数据集没有可配置的非日期筛选字段。</Typography.Text> : <>
      <div className="query-filters-panel__status" aria-label="筛选配置状态">
        <span>{savedFilters.length > 0 ? "已配置" : "未配置"}</span>
        <Button aria-label="编辑筛选条件" type="text" size="small" icon={<FormOutlined />} onClick={openDrawer} />
      </div>
      {savedFilters.length > 0 && <div className="query-filters-panel__summary" aria-label="已选查询条件">
        {savedFilters.map((filter, index) => {
          const field = queryFields.find((candidate) => candidate.key === filter.fieldKey);
          return <article className="query-filters-panel__summary-item" key={`${filter.fieldKey}-${index}`}>
            <div>
              <strong>{field?.label ?? filter.fieldKey}</strong>
              <span className="query-filters-panel__operator">{operatorLabel(filter)}</span>
              <span className="query-filters-panel__value">{valueLabel(filter)}</span>
            </div>
          </article>;
        })}
      </div>}
      {error !== null && <Alert type="warning" showIcon message={error} style={{ marginTop: 10 }} />}
      <Drawer
        className={`query-filters-drawer query-filters-drawer--${scope === "component" ? "component" : "analysis-group"}`}
        destroyOnClose={false}
        extra={<Button type="primary" onClick={finishEditing}>完成编辑</Button>}
        open={drawerOpen}
        placement="right"
        size={scope === "component" ? "min(680px, calc(100vw - 40px))" : "min(820px, calc(100vw - 56px))"}
        title={<div className="filter-configuration-drawer__title"><strong>{scope === "component" ? "图表筛选器配置" : "复合分析筛选器配置"}</strong><Typography.Text type="secondary">配置查询条件，不改变现有筛选逻辑。</Typography.Text></div>}
        onClose={closeDrawer}
      >
        <div className="query-filters-drawer__workspace">
          <aside className="query-filters-drawer__list">
            <div className="query-filters-drawer__list-heading"><span>筛选条件</span><Typography.Text type="secondary"><HolderOutlined /> 条件列表</Typography.Text></div>
            <Button aria-label="添加筛选条件" className="query-filters-drawer__add" icon={<PlusOutlined />} onClick={add} disabled={draft.length >= 6}>新增筛选条件</Button>
            <div aria-label="筛选条件列表" className="query-filters-drawer__filter-list">
              {draft.length === 0 ? <Typography.Text type="secondary">从上方新增一条筛选条件。</Typography.Text> : draft.map((filter, index) => {
                const field = queryFields.find((candidate) => candidate.key === filter.fieldKey);
                return <button className={activeConditionIndex === index ? "is-active" : ""} key={`${filter.fieldKey}-${index}`} type="button" onClick={() => setActiveConditionIndex(index)}>
                  <span><HolderOutlined /><i><FilterOutlined /></i><span><strong>{field?.label ?? filter.fieldKey}</strong><small>{operatorLabel(filter)} · {valueLabel(filter)}</small></span></span><MoreOutlined />
                </button>;
              })}
            </div>
            <Typography.Text className="query-filters-drawer__filter-count" type="secondary">{draft.length} 条筛选条件</Typography.Text>
          </aside>
          {activeConditionIndex < 0 || draft[activeConditionIndex] === undefined ? <section className="query-filters-drawer__empty-state"><div><FormOutlined /><Typography.Title level={4}>还没有筛选条件</Typography.Title><Typography.Text type="secondary">新增条件后，可在这里配置字段、匹配方式和筛选值。</Typography.Text></div></section> : (() => {
            const filter = draft[activeConditionIndex]!;
            const field = queryFields.find((candidate) => candidate.key === filter.fieldKey) ?? queryFields[0]!;
            const matchingOptions = filter.kind !== "fieldValue" ? [] : commonOptions(optionDatasetIds.map((datasetId, datasetIndex) => {
              const localRows = localDatasets.queryDataset(datasetId)?.rows;
              if (localRows !== undefined) return [...new Set(localRows.map((row) => row[filter.fieldKey]).filter((value): value is string | boolean => typeof value === "string" || typeof value === "boolean").map(String))];
              return optionQueries[activeConditionIndex * optionDatasetIds.length + datasetIndex]?.data ?? [];
            }));
            const textValue = filter.kind === "fieldValue" ? String(filter.values[0] ?? "") : filter.kind === "fieldText" ? filter.value : "";
            return <section aria-label={`筛选条件${activeConditionIndex + 1}`} className="query-filters-drawer__config">
              <div className="query-filters-drawer__config-heading"><div><span>配置筛选条件</span><Typography.Title level={4}>{field.label}</Typography.Title><Typography.Text type="secondary">字段 · {field.key}</Typography.Text></div><Button aria-label={`删除配置条件${activeConditionIndex + 1}`} danger icon={<DeleteOutlined />} size="small" type="text" onClick={() => remove(activeConditionIndex)}>删除筛选条件</Button></div>
              <div className="query-filters-drawer__editor-card">
                <label>字段<Select aria-label={`查询字段${activeConditionIndex + 1}`} value={filter.fieldKey} options={queryFields.map((candidate) => ({ value: candidate.key, label: fieldLabel(candidate) }))} onChange={(fieldKey: string) => { const nextField = queryFields.find((candidate) => candidate.key === fieldKey); if (nextField !== undefined) setDraft((items) => replaceAt(items, activeConditionIndex, filterForField(nextField))); }} /></label>
                {field.type === "string" && <div className="query-filters-drawer__control-type"><span>控件类型</span><div><button aria-pressed={filter.kind === "fieldValue"} className={filter.kind === "fieldValue" ? "is-active" : ""} type="button" onClick={() => updateControlType(activeConditionIndex, filter, "select")}>下拉选择<small>从列表选择值</small></button><button aria-pressed={filter.kind !== "fieldValue"} className={filter.kind !== "fieldValue" ? "is-active" : ""} type="button" onClick={() => updateControlType(activeConditionIndex, filter, "input")}>输入框<small>输入筛选关键词</small></button></div></div>}
                <div className="query-filters-drawer__match"><span>匹配方式</span><div aria-label={`查询运算符${activeConditionIndex + 1}`} role="group">{(field.type === "number" ? [{ value: "eq", label: "等于" }, { value: "neq", label: "不等于" }, { value: "gt", label: "大于" }, { value: "gte", label: "大于等于" }, { value: "lt", label: "小于" }, { value: "lte", label: "小于等于" }, { value: "isEmpty", label: "为空" }, { value: "isNotEmpty", label: "不为空" }] : field.type === "boolean" ? [{ value: "equals", label: "等于" }, { value: "isEmpty", label: "为空" }, { value: "isNotEmpty", label: "不为空" }] : [{ value: "contains", label: "包含" }, { value: "notContains", label: "不包含" }, { value: "equals", label: "等于" }, { value: "isEmpty", label: "为空" }, { value: "isNotEmpty", label: "不为空" }]).map((option) => { const selected = (filter.kind === "fieldNull" ? filter.operator : field.type === "number" ? filter.kind === "numberComparison" ? filter.operator : "gte" : filter.kind === "fieldValue" ? "equals" : filter.kind === "fieldText" ? filter.operator ?? "contains" : "contains") === option.value; return <button aria-pressed={selected} className={selected ? "is-active" : ""} key={option.value} type="button" onClick={() => updateOperator(activeConditionIndex, filter, field, textValue, option.value)}>{option.label}</button>; })}</div></div>
                <label>筛选值{filter.kind === "fieldNull" ? <span className="query-filters-drawer__empty-value">无需填写值</span> : field.type === "number" ? <InputNumber aria-label={`查询值${activeConditionIndex + 1}`} value={filter.kind === "numberComparison" ? filter.value : 0} onChange={(value) => setDraft((items) => replaceAt(items, activeConditionIndex, { kind: "numberComparison", fieldKey: field.key, operator: filter.kind === "numberComparison" ? filter.operator : "gte", value: typeof value === "number" ? value : 0 }))} /> : field.type === "boolean" ? <Select aria-label={`查询值${activeConditionIndex + 1}`} value={filter.kind === "fieldValue" ? String(filter.values[0] ?? "true") : "true"} options={[{ value: "true", label: "是" }, { value: "false", label: "否" }]} onChange={(value: string) => setDraft((items) => replaceAt(items, activeConditionIndex, { kind: "fieldValue", fieldKey: field.key, values: [value] }))} /> : filter.kind === "fieldValue" ? <Select allowClear aria-label={`查询值${activeConditionIndex + 1}`} showSearch optionFilterProp="label" placeholder="选择或搜索精确值" value={textValue || null} options={matchingOptions.map((value) => ({ value, label: value }))} onChange={(value: string | undefined) => setDraft((items) => replaceAt(items, activeConditionIndex, { kind: "fieldValue", fieldKey: field.key, values: [value ?? ""] }))} /> : <Input aria-label={`查询值${activeConditionIndex + 1}`} placeholder="输入关键字" value={textValue} onChange={(event) => setDraft((items) => replaceAt(items, activeConditionIndex, { kind: "fieldText", fieldKey: field.key, operator: filter.kind === "fieldText" ? filter.operator : "contains", value: event.target.value }))} />}</label>
              </div>
            </section>;
          })()}
        </div>
      </Drawer>
    </>}
  </section>;
};
