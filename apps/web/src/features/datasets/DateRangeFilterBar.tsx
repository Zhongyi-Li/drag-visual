import type { DateFilterControl } from "@drag-visual/contracts";
import { DatePicker } from "antd";
import zhCN from "antd/es/date-picker/locale/zh_CN";
import dayjs from "dayjs";
import { useEffect, useState } from "react";

import {
  defaultDateFilterSelection,
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

const selectionMatches = (filter: RuntimeDateSelection, control: DateFilterControl): boolean =>
  filter?.fieldKey === control.fieldKey && filter.timezone === control.timezone;

export const DateRangeFilterBar = ({ control, fieldLabel, value, onChange, loading = false }: DateRangeFilterBarProps) => {
  const [range, setRange] = useState(() => value === undefined ? null : [dayjs(value.start), dayjs(value.end)] as [dayjs.Dayjs, dayjs.Dayjs]);

  useEffect(() => {
    const next = defaultDateFilterSelection(control);
    setRange(next === undefined ? null : [dayjs(next.start), dayjs(next.end)]);
  }, [control.defaultPreset, control.defaultRange?.end, control.defaultRange?.start, control.fieldKey, control.timezone]);

  useEffect(() => {
    if (!selectionMatches(value, control)) return;
    setRange(value === undefined ? null : [dayjs(value.start), dayjs(value.end)]);
  }, [control, value]);

  return <div className="date-range-filter" onClick={(event) => event.stopPropagation()}>
    <span className="date-range-filter__label">{fieldLabel}</span>
    <DatePicker.RangePicker
      aria-label={`${fieldLabel}日期范围`}
      allowClear
      className="date-range-filter__picker"
      disabled={loading}
      format="YYYY/MM/DD"
      locale={zhCN}
      size="small"
      value={range}
      onChange={(nextRange) => {
        if (nextRange === null) {
          setRange(null);
          onChange(undefined);
          return;
        }
        const [start, end] = nextRange;
        if (start === null || end === null) return;
        setRange([start, end]);
        onChange({ kind: "dateRange", fieldKey: control.fieldKey, start: start.format("YYYY-MM-DD"), end: end.format("YYYY-MM-DD"), timezone: control.timezone });
      }}
    />
  </div>;
};
