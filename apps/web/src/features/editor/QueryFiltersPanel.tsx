import type { ComponentDefinition } from "@drag-visual/component-registry";
import { QueryFilterControl, type ComponentInstance, type DatasetField, type QueryFilterControl as QueryFilterControlValue } from "@drag-visual/contracts";
import { useQueries, useQuery } from "@tanstack/react-query";
import { DeleteOutlined, FormOutlined, PlusOutlined } from "@ant-design/icons";
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
  useEffect(() => { setDraft(savedFilters); setError(null); }, [savedKey]);

  const add = () => {
    const field = queryFields[0];
    if (field === undefined) return;
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

  const remove = (index: number) => setDraft((items) => items.filter((_, currentIndex) => currentIndex !== index));
  const finishEditing = () => {
    if (apply()) setDrawerOpen(false);
  };
  const openDrawer = () => {
    setDraft(savedFilters);
    setError(null);
    setDrawerOpen(true);
  };
  const closeDrawer = () => {
    setDraft(savedFilters);
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
        className="query-filters-drawer"
        destroyOnClose={false}
        extra={<Button type="primary" onClick={finishEditing}>完成编辑</Button>}
        open={drawerOpen}
        placement="bottom"
        size={540}
        title="配置筛选条件"
        onClose={closeDrawer}
      >
        <div className="query-filters-drawer__intro">所有条件以“且”组合。完成配置后返回分析面板执行查询。</div>
        <div className="query-filters-drawer__conditions">
          {draft.map((filter, index) => {
            const field = queryFields.find((candidate) => candidate.key === filter.fieldKey) ?? queryFields[0]!;
            const matchingOptions = filter.kind !== "fieldValue" ? [] : commonOptions(optionDatasetIds.map((datasetId, datasetIndex) => {
              const localRows = localDatasets.queryDataset(datasetId)?.rows;
              if (localRows !== undefined) return [...new Set(localRows
                .map((row) => row[filter.fieldKey])
                .filter((value): value is string | boolean => typeof value === "string" || typeof value === "boolean")
                .map(String))];
              return optionQueries[index * optionDatasetIds.length + datasetIndex]?.data ?? [];
            }));
            const textValue = filter.kind === "fieldValue"
              ? String(filter.values[0] ?? "")
              : filter.kind === "fieldText" ? filter.value : "";
            return <div aria-label={`筛选条件${index + 1}`} className="query-filters-drawer__condition" key={`${filter.fieldKey}-${index}`} role="group">
              <Select aria-label={`查询字段${index + 1}`} className="query-filters-drawer__field" value={filter.fieldKey} options={queryFields.map((candidate) => ({ value: candidate.key, label: fieldLabel(candidate) }))} onChange={(fieldKey: string) => {
                const nextField = queryFields.find((candidate) => candidate.key === fieldKey);
                if (nextField !== undefined) setDraft((items) => replaceAt(items, index, filterForField(nextField)));
              }} />
              <Select aria-label={`查询运算符${index + 1}`} className="query-filters-drawer__operator" value={filter.kind === "fieldNull" ? filter.operator : field.type === "number" ? filter.kind === "numberComparison" ? filter.operator : "gte" : filter.kind === "fieldValue" ? "equals" : filter.kind === "fieldText" ? filter.operator ?? "contains" : "contains"} options={field.type === "number" ? [{ value: "eq", label: "等于" }, { value: "neq", label: "不等于" }, { value: "gt", label: "大于" }, { value: "gte", label: "大于等于" }, { value: "lt", label: "小于" }, { value: "lte", label: "小于等于" }, { value: "isEmpty", label: "为空" }, { value: "isNotEmpty", label: "不为空" }] : field.type === "boolean" ? [{ value: "equals", label: "等于" }, { value: "isEmpty", label: "为空" }, { value: "isNotEmpty", label: "不为空" }] : [{ value: "contains", label: "包含" }, { value: "notContains", label: "不包含" }, { value: "equals", label: "等于" }, { value: "isEmpty", label: "为空" }, { value: "isNotEmpty", label: "不为空" }]} onChange={(operator: string) => {
                if (operator === "isEmpty" || operator === "isNotEmpty") {
                  setDraft((items) => replaceAt(items, index, { kind: "fieldNull", fieldKey: field.key, operator }));
                  return;
                }
                if (field.type === "number") {
                  setDraft((items) => replaceAt(items, index, { kind: "numberComparison", fieldKey: field.key, operator: operator as "eq" | "neq" | "gt" | "gte" | "lt" | "lte", value: filter.kind === "numberComparison" ? filter.value : 0 }));
                  return;
                }
                setDraft((items) => replaceAt(items, index, operator === "equals" ? { kind: "fieldValue", fieldKey: field.key, values: [textValue] } : { kind: "fieldText", fieldKey: field.key, operator: operator === "notContains" ? "notContains" : "contains", value: textValue }));
              }} />
              {filter.kind === "fieldNull" ? <span className="query-filters-drawer__value query-filters-drawer__empty-value">无需填写值</span> : field.type === "number" ? <InputNumber aria-label={`查询值${index + 1}`} className="query-filters-drawer__value" value={filter.kind === "numberComparison" ? filter.value : 0} onChange={(value) => setDraft((items) => replaceAt(items, index, { kind: "numberComparison", fieldKey: field.key, operator: filter.kind === "numberComparison" ? filter.operator : "gte", value: typeof value === "number" ? value : 0 }))} /> : field.type === "boolean" ? <Select aria-label={`查询值${index + 1}`} className="query-filters-drawer__value" value={filter.kind === "fieldValue" ? String(filter.values[0] ?? "true") : "true"} options={[{ value: "true", label: "是" }, { value: "false", label: "否" }]} onChange={(value: string) => setDraft((items) => replaceAt(items, index, { kind: "fieldValue", fieldKey: field.key, values: [value] }))} /> : filter.kind === "fieldValue" ? <Select allowClear aria-label={`查询值${index + 1}`} className="query-filters-drawer__value" showSearch optionFilterProp="label" placeholder="选择或搜索精确值" value={textValue || null} options={matchingOptions.map((value) => ({ value, label: value }))} onChange={(value: string | undefined) => setDraft((items) => replaceAt(items, index, { kind: "fieldValue", fieldKey: field.key, values: [value ?? ""] }))} /> : <Input aria-label={`查询值${index + 1}`} className="query-filters-drawer__value" placeholder="输入关键字" value={textValue} onChange={(event) => setDraft((items) => replaceAt(items, index, { kind: "fieldText", fieldKey: field.key, operator: filter.kind === "fieldText" ? filter.operator : "contains", value: event.target.value }))} />}
              <Button aria-label={`删除配置条件${index + 1}`} className="query-filters-drawer__remove" type="text" danger icon={<DeleteOutlined />} onClick={() => remove(index)} />
            </div>;
          })}
        </div>
        <Button className="query-filters-drawer__add" icon={<span aria-hidden="true"><PlusOutlined /></span>} onClick={add} disabled={draft.length >= 6}>添加筛选条件</Button>
      </Drawer>
    </>}
  </section>;
};
