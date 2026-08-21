import type { ComponentDefinition } from "@drag-visual/component-registry";
import type { ComponentInstance } from "@drag-visual/contracts";
import {
  EyeOutlined,
  InfoCircleOutlined,
  MinusOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  RightOutlined,
  WarningFilled,
} from "@ant-design/icons";
import { Button, Collapse, Input, InputNumber, Segmented, Select, Space, Switch, Tooltip, Typography } from "antd";
import { useEffect, useRef, useState } from "react";

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
  alertLabel: "预警标签",
  operator: "预警条件",
  threshold: "预警阈值",
  scopeText: "适用范围",
  headlineTemplate: "预警标题",
  messageTemplate: "提示文案",
  detailTemplate: "详情文案",
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
  multiMetricScale: "多指标刻度",
  prefix: "数值前缀",
  showLegend: "显示图例",
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
  multiMetricScale: [
    { label: "自动", value: "auto" },
    { label: "独立刻度", value: "independent" },
    { label: "统一刻度", value: "shared" },
  ],
  operator: [
    { label: "大于", value: "gt" },
    { label: "大于等于", value: "gte" },
    { label: "小于", value: "lt" },
    { label: "小于等于", value: "lte" },
    { label: "等于", value: "eq" },
    { label: "不等于", value: "neq" },
  ],
};

const numberBounds = (key: string): { readonly min: number; readonly max: number } | undefined => {
  if (key === "decimals") return { min: 0, max: 6 };
  if (key === "threshold") return { min: -1_000_000_000, max: 1_000_000_000 };
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

interface MetricAlertInsertRequest {
  readonly id: number;
  readonly key: string;
  readonly token: string;
}

interface DeferredTextControlProps {
  readonly ariaLabel: string;
  readonly autoFocus?: boolean;
  readonly fieldKey?: string;
  readonly insertRequest?: MetricAlertInsertRequest | null;
  readonly multiline: boolean;
  readonly onFocus?: () => void;
  readonly value: string;
  readonly onCommit: (value: string) => void;
}

/** Avoids rebuilding the editor canvas for each character in long alert copy. */
const DeferredTextControl = ({ ariaLabel, autoFocus = false, fieldKey, insertRequest, multiline, onFocus, value, onCommit }: DeferredTextControlProps) => {
  const [draft, setDraft] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const commit = (nextValue: string) => {
    if (timerRef.current !== undefined) clearTimeout(timerRef.current);
    timerRef.current = undefined;
    if (nextValue !== value) onCommit(nextValue);
  };

  const updateDraft = (nextValue: string) => {
    setDraft(nextValue);
    if (timerRef.current !== undefined) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commit(nextValue), 360);
  };

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => () => {
    if (timerRef.current !== undefined) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    if (insertRequest === undefined || insertRequest === null || insertRequest.key !== fieldKey) return;
    const separator = draft.length > 0 && !/\s$/.test(draft) ? " " : "";
    updateDraft(`${draft}${separator}${insertRequest.token}`);
  // Insertion is intentionally keyed by request id: each click should append once,
  // while normal typing continues to use the deferred update path above.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertRequest?.id]);

  if (multiline) {
    return <Input.TextArea aria-label={ariaLabel} autoFocus={autoFocus} autoSize={{ minRows: 2, maxRows: 6 }} value={draft} onBlur={() => commit(draft)} onChange={(event) => updateDraft(event.target.value)} onFocus={onFocus} />;
  }

  return <Input aria-label={ariaLabel} autoFocus={autoFocus} value={draft} onBlur={() => commit(draft)} onChange={(event) => updateDraft(event.target.value)} onFocus={onFocus} onPressEnter={() => commit(draft)} />;
};

type MetricAlertCopyKey = "alertLabel" | "scopeText" | "headlineTemplate" | "messageTemplate" | "detailTemplate";

const metricAlertVariableOptions = [
  { token: "{{metric}}", label: "指标名称", description: "当前预警的指标名称" },
  { token: "{{value}}", label: "当前值", description: "当前实际值" },
  { token: "{{threshold}}", label: "阈值", description: "触发预警的阈值" },
  { token: "{{operator}}", label: "条件", description: "预警判断条件" },
  { token: "{{label}}", label: "预警标签", description: "当前预警标签" },
  { token: "{{scope}}", label: "适用范围", description: "预警适用范围" },
  { token: "{{count}}", label: "命中项数", description: "触发预警的项目数量" },
] as const;

const metricAlertOperatorLabels: Readonly<Record<string, string>> = {
  gt: "大于",
  gte: "大于等于",
  lt: "小于",
  lte: "小于等于",
  eq: "等于",
  neq: "不等于",
};

const metricAlertVariableLabels: Readonly<Record<string, string>> = Object.fromEntries(
  metricAlertVariableOptions.map((variable) => [variable.token, variable.label]),
);

const resolveMetricAlertTemplate = (template: string, variables: Readonly<Record<string, string>>): string =>
  template.replace(/\{\{(metric|value|threshold|operator|label|scope|dimension|dimensionLabel|count)\}\}/g, (_match, key: string) => variables[key] ?? `{{${key}}}`);

const formatMetricAlertNumber = (value: number, decimals: number): string => new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: decimals,
  minimumFractionDigits: decimals,
}).format(value);

interface MetricAlertTemplateDisplayProps {
  readonly ariaLabel: string;
  readonly onEdit: () => void;
  readonly value: string;
}

/** Displays configured variables as readable chips until the author chooses to edit the raw copy. */
const MetricAlertTemplateDisplay = ({ ariaLabel, onEdit, value }: MetricAlertTemplateDisplayProps) => (
  <button aria-label={ariaLabel} className="metric-alert-style-panel__template-editor" type="button" onClick={onEdit}>
    {value.length === 0 ? <span className="metric-alert-style-panel__template-placeholder">点击输入文案</span> : value.split(/(\{\{[a-zA-Z]+\}\})/g).map((part, index) => {
      const tokenLabel = metricAlertVariableLabels[part];
      return tokenLabel === undefined
        ? <span key={`${part}-${index}`} className="metric-alert-style-panel__template-text">{part}</span>
        : <span key={`${part}-${index}`} className="metric-alert-style-panel__template-token">{tokenLabel}</span>;
    })}
  </button>
);

interface MetricAlertCopyFieldProps {
  readonly active: boolean;
  readonly fieldKey: MetricAlertCopyKey;
  readonly help: string;
  readonly insertRequest: MetricAlertInsertRequest | null;
  readonly label: string;
  readonly multiline?: boolean;
  readonly onActivate: (key: MetricAlertCopyKey) => void;
  readonly onCommit: (value: string) => void;
  readonly preview: string;
  readonly value: string;
}

const MetricAlertCopyField = ({
  active,
  fieldKey,
  help,
  insertRequest,
  label,
  multiline = false,
  onActivate,
  onCommit,
  preview,
  value,
}: MetricAlertCopyFieldProps) => (
  <div className={`metric-alert-style-panel__form-field${active ? " is-active" : ""}`}>
    <div className="metric-alert-style-panel__field-heading">
      <Typography.Text strong>{label}</Typography.Text>
      <Tooltip title={help}>
        <InfoCircleOutlined aria-label={`${label}说明`} />
      </Tooltip>
    </div>
    {active ? (
      <DeferredTextControl
        ariaLabel={label}
        autoFocus
        fieldKey={fieldKey}
        insertRequest={insertRequest}
        multiline={multiline}
        value={value}
        onCommit={onCommit}
        onFocus={() => onActivate(fieldKey)}
      />
    ) : <MetricAlertTemplateDisplay ariaLabel={`编辑${label}`} value={value} onEdit={() => onActivate(fieldKey)} />}
    <Typography.Text className="metric-alert-style-panel__field-hint" type="secondary">示例效果：{preview}</Typography.Text>
  </div>
);

interface MetricAlertStylePanelProps {
  readonly props: Readonly<Record<string, unknown>>;
  readonly update: (key: string, value: string | number | boolean) => void;
}

const MetricAlertStylePanel = ({ props, update }: MetricAlertStylePanelProps) => {
  const [activeTab, setActiveTab] = useState<"summary" | "detail">("summary");
  const [activeCopyField, setActiveCopyField] = useState<MetricAlertCopyKey | null>(null);
  const [insertRequest, setInsertRequest] = useState<MetricAlertInsertRequest | null>(null);
  const [showPreviewDetail, setShowPreviewDetail] = useState(false);
  const requestSequence = useRef(0);

  const decimals = typeof props.decimals === "number" ? props.decimals : 0;
  const threshold = typeof props.threshold === "number" ? props.threshold : 0;
  const operator = typeof props.operator === "string" ? props.operator : "gte";
  const alertLabel = typeof props.alertLabel === "string" ? props.alertLabel : "指标预警 {{count}} 项";
  const scopeText = typeof props.scopeText === "string" ? props.scopeText : "全部范围";
  const headlineTemplate = typeof props.headlineTemplate === "string" ? props.headlineTemplate : "{{metric}}触发预警";
  const messageTemplate = typeof props.messageTemplate === "string" ? props.messageTemplate : "当前值 {{value}}，已达到预警阈值 {{threshold}}。";
  const detailTemplate = typeof props.detailTemplate === "string" ? props.detailTemplate : "当前值 {{value}}。预警条件：{{metric}} {{operator}} {{threshold}}。";
  const previewVariables = {
    count: "12",
    dimension: "商品 A、商品 B",
    dimensionLabel: "商品名称",
    label: resolveMetricAlertTemplate(alertLabel, { count: "12" }),
    metric: "周转天数",
    operator: metricAlertOperatorLabels[operator] ?? operator,
    scope: scopeText || "全部范围",
    threshold: formatMetricAlertNumber(threshold, decimals),
    value: formatMetricAlertNumber(1840, decimals),
  };
  const previewLabel = resolveMetricAlertTemplate(alertLabel, previewVariables);
  const previewHeadline = resolveMetricAlertTemplate(headlineTemplate, previewVariables);
  const previewMessage = resolveMetricAlertTemplate(messageTemplate, previewVariables);
  const previewDetail = resolveMetricAlertTemplate(detailTemplate, previewVariables);

  const insertVariable = (token: string) => {
    const target = activeCopyField ?? (activeTab === "detail" ? "detailTemplate" : "headlineTemplate");
    setActiveCopyField(target);
    requestSequence.current += 1;
    setInsertRequest({ id: requestSequence.current, key: target, token });
  };
  const updateCopy = (key: MetricAlertCopyKey) => (value: string) => update(key, value);

  return (
    <section className="component-style-panel metric-alert-style-panel" aria-label="指标预警显示配置">
      <div className="metric-alert-style-panel__preview-heading">
        <span>效果预览</span>
        <Typography.Text type="secondary">· 示例数据</Typography.Text>
        <Button aria-pressed={showPreviewDetail} icon={<EyeOutlined />} size="small" type="text" onClick={() => setShowPreviewDetail((visible) => !visible)}>
          {showPreviewDetail ? "收起详情" : "查看详情"}
        </Button>
      </div>

      <div className="metric-alert-style-panel__preview-card">
        <div className="metric-alert-style-panel__preview-alert">
          <WarningFilled aria-hidden="true" />
          <div>
            <Typography.Text strong>{previewLabel}</Typography.Text>
            <span className="metric-alert-style-panel__preview-divider">·</span>
            <Typography.Text strong>{previewHeadline}</Typography.Text>
          </div>
          <RightOutlined aria-hidden="true" />
        </div>
        <Typography.Text className="metric-alert-style-panel__preview-meta" type="secondary">
          预警范围：{previewVariables.scope}<span />预警标签：{previewLabel}
        </Typography.Text>
        {showPreviewDetail && (
          <div className="metric-alert-style-panel__preview-detail" aria-live="polite">
            <Typography.Text>{previewMessage}</Typography.Text>
            <Typography.Text type="secondary">{previewDetail}</Typography.Text>
          </div>
        )}
      </div>

      <Segmented
        aria-label="预警文案类型"
        className="metric-alert-style-panel__segmented"
        options={[
          { label: "摘要文案", value: "summary" },
          { label: "弹窗文案", value: "detail" },
        ]}
        value={activeTab}
        onChange={(value) => {
          setActiveTab(value as "summary" | "detail");
          setActiveCopyField(null);
        }}
      />

      {activeTab === "summary" ? (
        <div className="metric-alert-style-panel__content">
          <div className="metric-alert-style-panel__compact-row">
            <div className="metric-alert-style-panel__field-heading">
              <Typography.Text strong>小数位数</Typography.Text>
              <Tooltip title="影响数值类变量在预警摘要和详情中的显示精度。"><InfoCircleOutlined aria-label="小数位数说明" /></Tooltip>
            </div>
            <Space.Compact className="metric-alert-style-panel__stepper">
              <Button aria-label="减少小数位数" disabled={decimals <= 0} icon={<MinusOutlined />} onClick={() => update("decimals", decimals - 1)} />
              <InputNumber aria-label="小数位数" controls={false} max={6} min={0} value={decimals} onChange={(value) => { if (value !== null) update("decimals", value); }} />
              <Button aria-label="增加小数位数" disabled={decimals >= 6} icon={<PlusOutlined />} onClick={() => update("decimals", decimals + 1)} />
            </Space.Compact>
            <Typography.Text className="metric-alert-style-panel__row-hint" type="secondary">影响数值变量的显示精度</Typography.Text>
          </div>
          <MetricAlertCopyField
            active={activeCopyField === "alertLabel"}
            fieldKey="alertLabel"
            help="用于区分预警类型，适合使用简短、易识别的标签。"
            insertRequest={insertRequest}
            label="预警标签"
            preview={previewLabel}
            value={alertLabel}
            onActivate={setActiveCopyField}
            onCommit={updateCopy("alertLabel")}
          />
          <MetricAlertCopyField
            active={activeCopyField === "scopeText"}
            fieldKey="scopeText"
            help="说明预警所覆盖的业务范围；它可以通过“适用范围”变量带入文案。"
            insertRequest={insertRequest}
            label="适用范围"
            preview={previewVariables.scope}
            value={scopeText}
            onActivate={setActiveCopyField}
            onCommit={updateCopy("scopeText")}
          />
          <div className="metric-alert-style-panel__copy-divider" />
          <MetricAlertCopyField
            active={activeCopyField === "headlineTemplate"}
            fieldKey="headlineTemplate"
            help="展示在预警摘要的主标题中。"
            insertRequest={insertRequest}
            label="标题"
            preview={previewHeadline}
            value={headlineTemplate}
            onActivate={setActiveCopyField}
            onCommit={updateCopy("headlineTemplate")}
          />
          <MetricAlertCopyField
            active={activeCopyField === "messageTemplate"}
            fieldKey="messageTemplate"
            help="展示在预警摘要中，帮助浏览者快速理解预警。"
            insertRequest={insertRequest}
            label="消息文案"
            multiline
            preview={previewMessage}
            value={messageTemplate}
            onActivate={setActiveCopyField}
            onCommit={updateCopy("messageTemplate")}
          />
        </div>
      ) : (
        <div className="metric-alert-style-panel__content metric-alert-style-panel__content--detail">
          <MetricAlertCopyField
            active={activeCopyField === "detailTemplate"}
            fieldKey="detailTemplate"
            help="展示在预警弹窗和详情页，适合补充业务处理建议。"
            insertRequest={insertRequest}
            label="详情文案"
            multiline
            preview={previewDetail}
            value={detailTemplate}
            onActivate={setActiveCopyField}
            onCommit={updateCopy("detailTemplate")}
          />
          <Typography.Text className="metric-alert-style-panel__detail-note" type="secondary">详情弹窗会自动补充预警维度、指标和触发条件；此处只需要描述业务判断和处置建议。</Typography.Text>
        </div>
      )}

      <Collapse
        className="metric-alert-style-panel__variables"
        defaultActiveKey={["variables"]}
        ghost
        items={[{
          key: "variables",
          label: <span>
            <strong>插入变量</strong>
            <Tooltip title="点击变量后，将其添加到当前正在编辑的文案。">
              <QuestionCircleOutlined aria-label="插入变量说明" className="metric-alert-style-panel__variables-help" />
            </Tooltip>
          </span>,
          children: <div className="metric-alert-style-panel__variable-grid">
            {metricAlertVariableOptions.map((variable) => (
              <Button key={variable.token} className="metric-alert-style-panel__variable" onClick={() => insertVariable(variable.token)}>
                <span>{variable.label}</span>
                <Typography.Text type="secondary">{variable.description}</Typography.Text>
              </Button>
            ))}
          </div>,
        }]}
      />
    </section>
  );
};

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

  if (definition.type === "metricAlert") {
    return <MetricAlertStylePanel props={props} update={update} />;
  }

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
          const multiline = key === "content" || key === "messageTemplate" || key === "detailTemplate";
          const textControl = multiline ? (
            <Input.TextArea aria-label={label} autoSize={{ minRows: 2, maxRows: 6 }} value={textValue} onChange={(event) => update(key, event.target.value)} />
          ) : (
            <Input aria-label={label} value={textValue} onChange={(event) => update(key, event.target.value)} />
          );
          return (
            <div className="binding-field" key={key}>
              <div className="binding-field__label"><Typography.Text strong>{label}</Typography.Text></div>
              {textControl}
            </div>
          );
        })}
      </Space>
    </section>
  );
};
