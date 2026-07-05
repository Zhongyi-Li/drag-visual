import type { ComponentInstance } from "@drag-visual/contracts";
import type { CSSProperties } from "react";

import { EChart } from "./EChart.js";
import {
  buildBarOption,
  buildKpiValue,
  buildLineOption,
  buildPieOption,
  buildTableModel,
  componentFieldKeys,
} from "./options.js";

interface Props {
  readonly component: ComponentInstance;
  readonly rows: readonly Readonly<Record<string, unknown>>[];
}

const stringProp = (component: ComponentInstance, key: string, fallback: string): string =>
  typeof component.props[key] === "string" ? component.props[key] : fallback;

const numberProp = (component: ComponentInstance, key: string, fallback: number): number =>
  typeof component.props[key] === "number" ? component.props[key] : fallback;

export const DashboardComponentRenderer = ({ component, rows }: Props) => {
  if (component.type === "bar") {
    return <EChart option={buildBarOption(component, rows)} ariaLabel={`${component.title ?? "柱图"}图表`} />;
  }
  if (component.type === "line") {
    return <EChart option={buildLineOption(component, rows)} ariaLabel={`${component.title ?? "折线图"}图表`} />;
  }
  if (component.type === "pie") {
    return <EChart option={buildPieOption(component, rows)} ariaLabel={`${component.title ?? "饼图"}图表`} />;
  }
  if (component.type === "kpi") {
    const measure = componentFieldKeys(component, "measure")[0] ?? "";
    const values = rows.flatMap((row) => typeof row[measure] === "number" ? [row[measure] as number] : []);
    const aggregation = stringProp(component, "aggregation", "first") as "first" | "sum" | "avg" | "max" | "min";
    const value = buildKpiValue(values, aggregation);
    const decimals = numberProp(component, "decimals", 0);
    const formatted = value === null ? "—" : value.toFixed(decimals);
    return (
      <div aria-label={`${component.title ?? "指标"}指标值`} style={{ fontSize: 32, fontWeight: 600 }}>
        {stringProp(component, "prefix", "")}{formatted}{stringProp(component, "suffix", "")}
      </div>
    );
  }
  if (component.type === "table") {
    const model = buildTableModel(component, rows);
    return (
      <div style={{ overflow: "auto" }}>
        <table>
          <thead><tr>{model.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead>
          <tbody>{model.rows.map((row, index) => (
            <tr key={index}>{model.columns.map((column) => <td key={column}>{String(row[column] ?? "—")}</td>)}</tr>
          ))}</tbody>
        </table>
      </div>
    );
  }
  const style: CSSProperties = {
    color: stringProp(component, "color", "#1f1f1f"),
    fontSize: numberProp(component, "fontSize", 16),
    fontWeight: stringProp(component, "fontWeight", "normal"),
    textAlign: stringProp(component, "textAlign", "left") as CSSProperties["textAlign"],
    whiteSpace: "pre-wrap",
  };
  return <div style={style}>{stringProp(component, "content", "")}</div>;
};
