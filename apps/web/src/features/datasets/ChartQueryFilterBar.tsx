import { DatasetFilter, type DatasetField, type DatasetFilter as DatasetFilterValue, type QueryFilterControl } from "@drag-visual/contracts";
import { useQueries } from "@tanstack/react-query";
import { Button, DatePicker, Input, InputNumber, Select, Space } from "antd";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

import { getDatasetFieldOptions } from "./datasetApi.js";
import "./ChartQueryFilterBar.css";

interface Props {
  readonly filters: readonly ChartQueryFilterControl[];
  readonly fields: readonly DatasetField[];
  readonly datasetId?: string | undefined;
  readonly localFieldOptions?: Readonly<Record<string, readonly string[]>> | undefined;
  /** Describes the owning surface for assistive technology. */
  readonly ariaLabel?: string | undefined;
  /** Keeps repeated controls distinguishable when multiple filter bars exist. */
  readonly controlLabelPrefix?: string | undefined;
  readonly loading?: boolean;
  readonly onApply: (filters: readonly DatasetFilterValue[], controls: readonly ChartQueryFilterControl[]) => void;
}

export type ChartQueryFilterControl = QueryFilterControl | { readonly kind: "numberComparison"; readonly fieldKey: string; readonly operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; readonly value: null };

const copyFilters = (filters: readonly ChartQueryFilterControl[]): ChartQueryFilterControl[] => filters.map((filter) => filter.kind === "fieldValue"
  ? { ...filter, values: [...filter.values] }
  : { ...filter });

const labelFor = (filter: ChartQueryFilterControl, fields: readonly DatasetField[]): string =>
  fields.find((field) => field.key === filter.fieldKey)?.label ?? filter.fieldKey;

const activeFilters = (filters: readonly ChartQueryFilterControl[]): DatasetFilterValue[] => filters.flatMap((filter) => {
  if (filter.kind === "numberComparison" && filter.value === null) return [];
  if (filter.kind === "fieldText" && filter.value.trim().length === 0) return [];
  if (filter.kind === "fieldValue" && filter.values.every((value) => typeof value === "string" && value.trim().length === 0)) return [];
  const parsed = DatasetFilter.safeParse(filter);
  return parsed.success ? [parsed.data] : [];
});

const clearedFilters = (filters: readonly ChartQueryFilterControl[]): ChartQueryFilterControl[] => filters.map((filter) => {
  if (filter.kind === "dateRange") return filter;
  if (filter.kind === "fieldText") return { ...filter, value: "" };
  if (filter.kind === "fieldValue") return { ...filter, values: [""] };
  if (filter.kind === "fieldNull") return filter;
  return { ...filter, value: null };
});

const operatorLabel = (operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"): string => ({
  eq: "等于", neq: "不等于", gt: "大于", gte: "大于等于", lt: "小于", lte: "小于等于",
})[operator];

export const ChartQueryFilterBar = ({ filters, fields, datasetId, localFieldOptions, ariaLabel = "图表查询条件", controlLabelPrefix = "图表查询", loading = false, onApply }: Props) => {
  const [draft, setDraft] = useState<ChartQueryFilterControl[]>(() => copyFilters(filters));
  const filtersKey = JSON.stringify(filters);
  useEffect(() => setDraft(copyFilters(filters)), [filtersKey]);
  const optionQueries = useQueries({
    queries: draft.map((filter) => ({
      queryKey: ["dataset-field-options", datasetId, filter.fieldKey],
      queryFn: () => getDatasetFieldOptions(datasetId!, filter.fieldKey),
      enabled: datasetId !== undefined && localFieldOptions?.[filter.fieldKey] === undefined && filter.kind === "fieldValue",
    })),
  });
  if (filters.length === 0) return null;
  return <div className="chart-query-filter-bar" aria-label={ariaLabel}>
    <div className="chart-query-filter-bar__fields">
      {draft.map((filter, index) => <div className="chart-query-filter-bar__condition" key={`${filter.fieldKey}-${index}`}>
        <span className="chart-query-filter-bar__label">{labelFor(filter, fields)}</span>
        {filter.kind === "dateRange" ? <DatePicker.RangePicker
          aria-label={`${controlLabelPrefix}日期范围${index + 1}`}
          allowClear={false}
          format="YYYY-MM-DD"
          value={[dayjs(filter.start), dayjs(filter.end)]}
          onChange={(range) => {
            if (range === null || range[0] === null || range[1] === null) return;
            setDraft((items) => items.map((item, current) => current !== index ? item : { ...filter, start: range[0]!.format("YYYY-MM-DD"), end: range[1]!.format("YYYY-MM-DD") }));
          }}
        /> : filter.kind === "fieldNull" ? <span className="chart-query-filter-bar__operator">{filter.operator === "isEmpty" ? "为空" : "不为空"}</span> : filter.kind === "numberComparison" ? <>
          <span className="chart-query-filter-bar__operator">{operatorLabel(filter.operator)}</span>
          <InputNumber aria-label={`${controlLabelPrefix}值${index + 1}`} value={filter.value} onChange={(value) => setDraft((items) => items.map((item, current) => current !== index ? item : { ...filter, value: typeof value === "number" ? value : null }))} />
        </> : filter.kind === "fieldValue" ? <>
          <span className="chart-query-filter-bar__operator">等于</span>
          <Select aria-label={`${controlLabelPrefix}值${index + 1}`} showSearch optionFilterProp="label" placeholder="选择或搜索" value={String(filter.values[0] ?? "") || null} options={(localFieldOptions?.[filter.fieldKey] ?? optionQueries[index]?.data ?? []).map((value) => ({ value, label: value }))} onChange={(value: string) => setDraft((items) => items.map((item, current) => current !== index ? item : { ...filter, values: [value] }))} />
        </> : <>
          <span className="chart-query-filter-bar__operator">{filter.operator === "notContains" ? "不包含" : "包含"}</span>
          <Input aria-label={`${controlLabelPrefix}值${index + 1}`} value={filter.value} onChange={(event) => setDraft((items) => items.map((item, current) => current !== index ? item : { ...filter, value: event.target.value }))} />
        </>}
      </div>)}
    </div>
    <Space size={8} className="chart-query-filter-bar__actions">
      <Button disabled={loading} onClick={() => { const next = clearedFilters(draft); setDraft(next); onApply(activeFilters(next), next); }}>重置</Button>
      <Button aria-label="查询" type="primary" loading={loading} onClick={() => onApply(activeFilters(draft), draft)}>查询</Button>
    </Space>
  </div>;
};
