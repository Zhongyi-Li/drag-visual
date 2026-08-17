import {
  BarChartOutlined,
  CalculatorOutlined,
  CloseOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  PlusCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { DataBinding, DatasetField, MetricAggregation } from "@drag-visual/contracts";
import { Alert, Button, Drawer, Input, Select, Tooltip, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";

const operators = ["+", "-", "*", "/", "(", ")"] as const;
type Operator = typeof operators[number];
type MetricTokens = NonNullable<DataBinding["calculatedMetrics"]>[number]["tokens"];

interface CalculatedMetricDrawerProps {
  readonly open: boolean;
  readonly fields: readonly DatasetField[];
  readonly initialMetric?: NonNullable<DataBinding["calculatedMetrics"]>[number] | undefined;
  readonly onClose: () => void;
  readonly onSave: (metric: NonNullable<DataBinding["calculatedMetrics"]>[number]) => void;
}

const aggregation: MetricAggregation = "sum";
const aggregationOptions: Array<{ label: string; value: MetricAggregation }> = [
  { label: "求和", value: "sum" },
  { label: "平均值", value: "avg" },
  { label: "计数", value: "count" },
  { label: "最大值", value: "max" },
  { label: "最小值", value: "min" },
];

const validTokenOrder = (tokens: MetricTokens) => {
  if (tokens.length < 3) return false;
  let expectsMetric = true;
  let depth = 0;
  for (const token of tokens) {
    if (token.kind === "metric") {
      if (!expectsMetric) return false;
      expectsMetric = false;
    } else if (token.value === "(") {
      if (!expectsMetric) return false;
      depth += 1;
    } else if (token.value === ")") {
      if (expectsMetric || depth === 0) return false;
      depth -= 1;
    } else {
      if (expectsMetric) return false;
      expectsMetric = true;
    }
  }
  return !expectsMetric && depth === 0;
};

export const CalculatedMetricDrawer = ({ open, fields, initialMetric, onClose, onSave }: CalculatedMetricDrawerProps) => {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<"number" | "percent" | "currency">("number");
  const [divideByZero, setDivideByZero] = useState<"dash" | "zero">("dash");
  const [tokens, setTokens] = useState<MetricTokens>([]);
  const [keyword, setKeyword] = useState("");
  const numericFields = useMemo(() => fields.filter((field) => field.type === "number"), [fields]);
  const availableMetrics = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase();
    if (normalizedKeyword.length === 0) return numericFields;
    return numericFields.filter((field) => `${field.label} ${field.key}`.toLocaleLowerCase().includes(normalizedKeyword));
  }, [keyword, numericFields]);
  const formulaValid = validTokenOrder(tokens);

  useEffect(() => {
    if (!open) return;
    setName(initialMetric?.name ?? "");
    setFormat(initialMetric?.format ?? "number");
    setDivideByZero(initialMetric?.divideByZero ?? "dash");
    setTokens(initialMetric?.tokens.map((token) => token.kind === "metric"
      ? { kind: "metric" as const, reference: { ...token.reference } }
      : { kind: "operator" as const, value: token.value }) ?? []);
    setKeyword("");
  }, [initialMetric, open]);

  const addMetric = (fieldKey: string) => setTokens((current) => [
    ...current,
    { kind: "metric", reference: { fieldKey, aggregation } },
  ]);
  const addOperator = (value: Operator) => setTokens((current) => [...current, { kind: "operator", value }]);
  const removeToken = (index: number) => setTokens((current) => current.filter((_, tokenIndex) => tokenIndex !== index));
  const updateMetricAggregation = (index: number, nextAggregation: MetricAggregation) => setTokens((current) => current.map((token, tokenIndex) => {
    if (tokenIndex !== index || token.kind !== "metric") return token;
    return { ...token, reference: { ...token.reference, aggregation: nextAggregation } };
  }));
  const save = () => {
    const nextName = name.trim();
    if (nextName.length === 0 || !formulaValid) return;
    onSave({
      id: initialMetric?.id ?? `calculated-${Date.now().toString(36)}`,
      name: nextName,
      tokens,
      format,
      decimals: 2,
      divideByZero,
    });
  };

  return <Drawer
    className="calculated-metric-drawer"
    destroyOnHidden
    footer={<div className="calculated-metric-drawer__footer">
      <Button block size="large" type="primary" disabled={name.trim().length === 0 || !formulaValid} onClick={save}>{initialMetric === undefined ? "保存计算指标" : "保存修改"}</Button>
    </div>}
    open={open}
    placement="right"
    title={initialMetric === undefined ? "新建计算指标" : "编辑计算指标"}
    width={420}
    onClose={onClose}
  >
    <section className="calculated-metric-form" aria-label="计算指标配置">
      <section className="calculated-metric-section" aria-labelledby="calculated-metric-settings-title">
        <div className="calculated-metric-section__title" id="calculated-metric-settings-title"><span aria-hidden="true" />指标设置</div>
        <div className="calculated-metric-form__settings">
          <label>
            <span>指标名称</span>
            <Input aria-label="指标名称" placeholder="例如：毛利率" showCount value={name} maxLength={50} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span>格式</span>
            <Select aria-label="计算指标格式" value={format} options={[
              { label: "数值", value: "number" },
              { label: "百分比", value: "percent" },
              { label: "金额", value: "currency" },
            ]} onChange={setFormat} />
          </label>
        </div>
      </section>

      <section className="calculated-metric-section calculated-metric-section--formula" aria-labelledby="calculated-metric-formula-title">
        <div className="calculated-metric-section__title" id="calculated-metric-formula-title"><span aria-hidden="true" />公式</div>
        <Typography.Text className="calculated-metric-section__help" type="secondary">计算在聚合之后进行，支持引用已聚合的指标。</Typography.Text>
        <div className="calculated-metric-form__formula-shell">
          <div className="calculated-metric-form__formula" aria-label="公式编辑器">
            {tokens.length === 0 ? <span className="calculated-metric-form__placeholder">从下方选择指标开始编辑公式</span> : tokens.map((token, index) => {
              if (token.kind === "operator") return <button className="calculated-metric-token calculated-metric-token--operator" type="button" key={`${token.value}-${index}`} onClick={() => removeToken(index)} aria-label={`删除运算符 ${token.value}`}>{token.value === "*" ? "×" : token.value === "/" ? "÷" : token.value}</button>;
              const label = numericFields.find((field) => field.key === token.reference.fieldKey)?.label ?? token.reference.fieldKey;
              return <span className="calculated-metric-token" key={`${token.reference.fieldKey}-${index}`}>
                <BarChartOutlined />
                <span className="calculated-metric-token__label">{label}</span>
                <Select
                  aria-label={`${label}的聚合方式`}
                  className="calculated-metric-token__aggregation"
                  options={aggregationOptions}
                  size="small"
                  value={token.reference.aggregation}
                  onChange={(nextAggregation: MetricAggregation) => updateMetricAggregation(index, nextAggregation)}
                />
                <Button aria-label={`删除指标 ${label}`} className="calculated-metric-token__remove" icon={<CloseOutlined />} size="small" type="text" onClick={() => removeToken(index)} />
              </span>;
            })}
            {tokens.length > 0 && <Tooltip title="清空公式"><Button aria-label="清空公式" className="calculated-metric-form__clear" icon={<DeleteOutlined />} size="small" type="text" onClick={() => setTokens([])} /></Tooltip>}
            <CalculatorOutlined className="calculated-metric-form__calculator" aria-hidden="true" />
          </div>
          <div className="calculated-metric-form__operators" aria-label="公式运算符">
            {operators.map((operator) => <Button key={operator} type="text" onClick={() => addOperator(operator)}>{operator === "*" ? "×" : operator === "/" ? "÷" : operator}</Button>)}
          </div>
        </div>
        {!formulaValid && tokens.length > 0 && <Alert className="calculated-metric-form__validation" type="warning" showIcon message="公式需由指标与运算符依次组成，例如：销售毛利 ÷ 销售额。" />}
        <div className="calculated-metric-form__safe-divide">
          <span>除数为 0 时显示 <Tooltip title="当公式中的除数为 0 时，按此设置显示结果"><InfoCircleOutlined /></Tooltip></span>
          <Select aria-label="除数为零处理" value={divideByZero} options={[{ label: "—", value: "dash" }, { label: "0", value: "zero" }]} onChange={setDivideByZero} />
        </div>
      </section>

      <section className="calculated-metric-available" aria-labelledby="calculated-metric-available-title">
        <div className="calculated-metric-available__title" id="calculated-metric-available-title">可用指标 <Typography.Text type="secondary">添加后可选择聚合方式</Typography.Text></div>
        <Input aria-label="搜索指标" className="calculated-metric-available__search" placeholder="搜索指标" prefix={<SearchOutlined />} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <div className="calculated-metric-available__list">
          {availableMetrics.length === 0 ? <div className="calculated-metric-available__empty">未找到匹配的数值指标</div> : availableMetrics.map((field) => <button type="button" className="calculated-metric-available__item" key={field.key} onClick={() => addMetric(field.key)}>
            <span><BarChartOutlined />{field.label}（求和）</span><PlusCircleOutlined />
          </button>)}
        </div>
      </section>
    </section>
  </Drawer>;
};
