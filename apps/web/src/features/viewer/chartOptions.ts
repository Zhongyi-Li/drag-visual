interface BuildBarOptionInput {
  readonly rows: readonly Record<string, unknown>[];
  readonly dimension: string;
  readonly measure: string;
  readonly props: {
    readonly title: string;
    readonly color: string;
    readonly showLegend: boolean;
  };
}

export interface BarOption {
  readonly title: { readonly text: string };
  readonly color: readonly string[];
  readonly legend: { readonly show: boolean };
  readonly xAxis: { readonly type: "category"; readonly data: readonly string[] };
  readonly yAxis: { readonly type: "value" };
  readonly series: readonly [{ readonly type: "bar"; readonly data: readonly number[] }];
}

export const buildBarOption = ({
  rows,
  dimension,
  measure,
  props,
}: BuildBarOptionInput): BarOption => {
  const categories = new Array<string>(rows.length);
  const values = new Array<number>(rows.length);
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]!;
    categories[index] = String(row[dimension] ?? "");
    const value = row[measure];
    values[index] = typeof value === "number" && Number.isFinite(value) ? value : 0;
  }
  return {
    title: { text: props.title },
    color: [props.color],
    legend: { show: props.showLegend },
    xAxis: { type: "category", data: categories },
    yAxis: { type: "value" },
    series: [{ type: "bar", data: values }],
  };
};
