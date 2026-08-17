import type { AnalysisGroupDateFilterControl } from "@drag-visual/contracts";
import { DatePicker } from "antd";
import dayjs from "dayjs";

import type { RuntimeAnalysisGroupDateSelection } from "./analysisGroupDateFilter.js";
import "./AnalysisGroupDateFilterBar.css";

interface Props {
  readonly control: AnalysisGroupDateFilterControl | undefined;
  readonly value: RuntimeAnalysisGroupDateSelection | undefined;
  readonly loading?: boolean;
  readonly onChange: (next: RuntimeAnalysisGroupDateSelection | undefined) => void;
}

export const AnalysisGroupDateFilterBar = ({ control, value, loading = false, onChange }: Props) => {
  if (control === undefined) return null;
  return <div className="analysis-group-date-filter" aria-label="复合分析时间筛选">
    <DatePicker.RangePicker
      allowClear={control.allowCustom}
      aria-label="复合分析时间范围"
      disabled={loading}
      format="YYYY-MM-DD"
      placeholder={["开始日期", "结束日期"]}
      value={value === undefined ? null : [dayjs(value.start), dayjs(value.end)]}
      onChange={(range) => {
        if (range === null || range[0] === null || range[1] === null) {
          onChange(undefined);
          return;
        }
        onChange({ start: range[0].format("YYYY-MM-DD"), end: range[1].format("YYYY-MM-DD") });
      }}
    />
  </div>;
};
