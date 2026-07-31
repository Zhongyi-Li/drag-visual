import type { DateFilterControl, DateFilterPreset, DateRangeFilter } from "@drag-visual/contracts";
import { Button, Select } from "antd";
import { useEffect, useState } from "react";

import {
  dateFilterPresetLabel,
  defaultDateFilterSelection,
  resolveDateFilterPreset,
  type RuntimeDateSelection,
} from "./dateFilter.js";
import "./DateRangeFilterBar.css";

interface DateRangeFilterBarProps {
  readonly control: DateFilterControl;
  readonly fieldLabel: string;
  readonly value: RuntimeDateSelection;
  readonly onChange: (filter: RuntimeDateSelection) => void;
  readonly loading?: boolean;
}

const presetOptions: readonly { readonly value: DateFilterPreset | "custom"; readonly label: string }[] = [
  { value: "all", label: "全部数据" },
  { value: "today", label: "今日" },
  { value: "yesterday", label: "昨日" },
  { value: "last7Days", label: "近 7 天" },
  { value: "last30Days", label: "近 30 天" },
  { value: "thisMonth", label: "本月" },
  { value: "lastMonth", label: "上月" },
];

const selectionMatches = (filter: RuntimeDateSelection, control: DateFilterControl): boolean =>
  filter?.fieldKey === control.fieldKey && filter.timezone === control.timezone;

export const DateRangeFilterBar = ({ control, fieldLabel, value, onChange, loading = false }: DateRangeFilterBarProps) => {
  const [selection, setSelection] = useState<DateFilterPreset | "custom">(control.defaultPreset);
  const [start, setStart] = useState(value?.start ?? "");
  const [end, setEnd] = useState(value?.end ?? "");

  useEffect(() => {
    setSelection(control.defaultPreset);
    const next = defaultDateFilterSelection(control);
    setStart(next?.start ?? "");
    setEnd(next?.end ?? "");
  }, [control.fieldKey, control.defaultPreset, control.timezone]);

  useEffect(() => {
    if (!selectionMatches(value, control)) return;
    setStart(value?.start ?? "");
    setEnd(value?.end ?? "");
  }, [control, value]);

  const changePreset = (next: DateFilterPreset | "custom") => {
    setSelection(next);
    if (next === "custom") return;
    const filter = resolveDateFilterPreset(control, next);
    setStart(filter?.start ?? "");
    setEnd(filter?.end ?? "");
    onChange(filter);
  };
  const applyCustom = () => {
    if (start.length !== 10 || end.length !== 10 || start > end) return;
    onChange({ kind: "dateRange", fieldKey: control.fieldKey, start, end, timezone: control.timezone });
  };
  const reset = () => changePreset(control.defaultPreset);
  const options = control.allowCustom
    ? [...presetOptions, { value: "custom" as const, label: "自定义" }]
    : [...presetOptions];

  return <div className="date-range-filter" onClick={(event) => event.stopPropagation()}>
    <span className="date-range-filter__label">{fieldLabel}</span>
    <Select
      aria-label={`${fieldLabel}日期范围`}
      className="date-range-filter__preset"
      size="small"
      value={selection}
      options={options}
      disabled={loading}
      onChange={changePreset}
    />
    {selection === "custom" && <>
      <input aria-label="开始日期" className="date-range-filter__input" type="date" value={start} max={end || undefined} onChange={(event) => setStart(event.target.value)} />
      <span className="date-range-filter__separator">至</span>
      <input aria-label="结束日期" className="date-range-filter__input" type="date" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} />
      <Button size="small" type="primary" disabled={start.length !== 10 || end.length !== 10 || start > end} loading={loading} onClick={applyCustom}>应用</Button>
    </>}
    {selection !== control.defaultPreset && <Button type="link" size="small" disabled={loading} onClick={reset}>重置</Button>}
  </div>;
};
