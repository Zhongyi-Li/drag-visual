import type { ComponentDefinition } from "@drag-visual/component-registry";
import type { ComponentInstance } from "@drag-visual/contracts";
import { Button, Input, InputNumber, Select, Space, Switch, Typography } from "antd";

import type { EditorStore } from "./store/editorStore.js";

interface ComponentStylePanelProps {
  readonly store: EditorStore;
  readonly component: {
    readonly id: string;
    readonly props: Readonly<Record<string, unknown>>;
  };
  readonly definition: ComponentDefinition;
}

const propertyLabels: Readonly<Record<string, string>> = {
  aggregation: "聚合方式",
  barColor: "柱状颜色",
  color: "主题颜色",
  content: "文本内容",
  decimals: "小数位数",
  fontSize: "字号",
  fontWeight: "字重",
  hideZeroValues: "隐藏全零类目",
  maxItems: "最大显示条数",
  lineColor: "折线颜色",
  maxEmployees: "最多展示员工数",
  pageSize: "每页行数",
  prefix: "数值前缀",
  showLegend: "显示图例",
  showEmployeeRanking: "显示员工排行",
  showSummary: "显示汇总",
  showTotals: "显示合计",
  showValue: "显示数值",
  showValues: "显示数值",
  smartLineScale: "折线轴智能缩放",
  smooth: "平滑曲线",
  striped: "斑马纹",
  suffix: "数值后缀",
  periodLabel: "周期标签",
  textAlign: "文本对齐",
};

const selectOptions: Readonly<Record<string, readonly { readonly label: string; readonly value: string }[]>> = {
  aggregation: [
    { label: "首项", value: "first" },
    { label: "求和", value: "sum" },
    { label: "平均值", value: "avg" },
    { label: "最大值", value: "max" },
    { label: "最小值", value: "min" },
  ],
  fontWeight: [
    { label: "常规", value: "normal" },
    { label: "加粗", value: "bold" },
  ],
  textAlign: [
    { label: "左对齐", value: "left" },
    { label: "居中", value: "center" },
    { label: "右对齐", value: "right" },
  ],
};

const numberBounds = (key: string): { readonly min: number; readonly max: number } | undefined => {
  if (key === "decimals") return { min: 0, max: 6 };
  if (key === "fontSize") return { min: 12, max: 72 };
  if (key === "maxItems") return { min: 3, max: 20 };
  if (key === "pageSize") return { min: 1, max: 100 };
  return undefined;
};

const isEditable = (key: string): boolean =>
  key !== "area"
  && key !== "aggregation"
  && key !== "color"
  && key !== "showLegend"
  && key !== "timeGranularity"
  && key !== "metricWeights"
  && key !== "metricSettings"
  && key !== "rankingMode";

const schemaProps = (
  defaults: Readonly<Record<string, unknown>>,
  props: Readonly<Record<string, unknown>>,
): Record<string, unknown> => Object.fromEntries(
  Object.keys(defaults).map((key) => [key, props[key] ?? defaults[key]]),
);

export const ComponentStylePanel = ({ store, component, definition }: ComponentStylePanelProps) => {
  const defaults = definition.createDefaults() as Readonly<Record<string, unknown>>;
  // Runtime-only values such as resultLimit and dataRefreshVersion share the
  // component props record, but are not visual style controls.
  const props = schemaProps(defaults, component.props);
  const update = (key: string, value: string | number | boolean) => {
    const latestComponent = store.getState().history.present.components.find((candidate) => candidate.id === component.id);
    const latestProps = latestComponent?.props ?? {};
    const parsed = definition.propsSchema.safeParse({ ...schemaProps(defaults, latestProps), [key]: value });
    if (!parsed.success) return;
    store.getState().dispatch({
      type: "component.props.update",
      componentId: component.id,
      nextProps: { ...latestProps, ...parsed.data } as ComponentInstance["props"],
    });
  };

  return (
    <section className="component-style-panel" aria-label="图表样式">
      <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
        {Object.entries(props).filter(([key]) => isEditable(key)).map(([key, value]) => {
          const label = propertyLabels[key] ?? key;
          const textValue = typeof value === "string" ? value : "";
          if (typeof value === "boolean") {
            return (
              <div className="binding-field" key={key}>
                <div className="binding-field__label"><Typography.Text strong>{label}</Typography.Text></div>
                <Switch aria-label={label} checked={value} onChange={(checked) => update(key, checked)} />
              </div>
            );
          }
          if (typeof value === "number") {
            const bounds = numberBounds(key);
            return (
              <div className="binding-field" key={key}>
                <div className="binding-field__label"><Typography.Text strong>{label}</Typography.Text></div>
                <InputNumber
                  aria-label={label}
                  {...bounds}
                  style={{ width: "100%" }}
                  value={value}
                  onChange={(nextValue) => { if (nextValue !== null) update(key, nextValue); }}
                />
              </div>
            );
          }
          if (key === "color" || key.endsWith("Color")) {
            return (
              <div className="binding-field" key={key}>
                <div className="binding-field__label"><Typography.Text strong>{label}</Typography.Text></div>
                <input aria-label={label} type="color" value={textValue} onChange={(event) => update(key, event.target.value)} />
              </div>
            );
          }
          const availableOptions = selectOptions[key]?.filter((option) => definition.propsSchema.safeParse({ ...props, [key]: option.value }).success);
          if (availableOptions !== undefined) {
            return (
              <div className="binding-field" key={key}>
                <div className="binding-field__label"><Typography.Text strong>{label}</Typography.Text></div>
                <Select aria-label={label} options={availableOptions} style={{ width: "100%" }} value={textValue} onChange={(nextValue: string) => update(key, nextValue)} />
              </div>
            );
          }
          return (
            <div className="binding-field" key={key}>
              <div className="binding-field__label"><Typography.Text strong>{label}</Typography.Text></div>
              {key === "content" ? (
                <Input.TextArea aria-label={label} autoSize={{ minRows: 2, maxRows: 6 }} value={textValue} onChange={(event) => update(key, event.target.value)} />
              ) : (
                <Input aria-label={label} value={textValue} onChange={(event) => update(key, event.target.value)} />
              )}
            </div>
          );
        })}
      </Space>
    </section>
  );
};
