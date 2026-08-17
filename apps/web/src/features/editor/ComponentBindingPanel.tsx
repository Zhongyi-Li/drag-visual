import { ArrowRightOutlined, CalculatorOutlined, CheckOutlined, DeleteOutlined, DownOutlined, EditOutlined, MoreOutlined, QuestionCircleOutlined, TagOutlined } from "@ant-design/icons";
import type { ComponentDefinition } from "@drag-visual/component-registry";
import type { CalculatedMetric, ComponentType, DataBinding, Dataset, DatasetField, MetricAggregation, QueryParameter } from "@drag-visual/contracts";
import { validateBinding } from "@drag-visual/data-engine";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Dropdown, InputNumber, Select, Space, Spin, Tooltip, Typography } from "antd";
import { type DragEvent, type ReactNode, useEffect, useState } from "react";
import { useStore } from "zustand";

import { getDataset, listDatasets } from "../datasets/datasetApi.js";
import { calculatedMetricFields } from "../datasets/calculatedMetrics.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
import { CalculatedMetricDrawer } from "./CalculatedMetricDrawer.js";
import { ParameterForm } from "../datasets/ParameterForm.js";
import { FIELD_DRAG_TYPE } from "./fieldDrag.js";
import type { EditorStore } from "./store/editorStore.js";

interface ComponentBindingPanelProps {
  readonly store: EditorStore;
  readonly component: BindableComponent;
  readonly definition: ComponentDefinition;
  /** Restrict the panel to selected slots when the remaining fields live in a focused surface. */
  readonly slotKeys?: readonly string[] | undefined;
  /** Optional actions rendered beside a slot label, such as a component-specific settings entry. */
  readonly slotActions?: Readonly<Partial<Record<string, ReactNode>>> | undefined;
  /** Hide dataset/query/ordering controls when this panel is embedded in a focused configuration surface. */
  readonly compact?: boolean | undefined;
  /** Keep the data refresh action available in a compact, component-specific panel. */
  readonly showRefreshButton?: boolean | undefined;
}

type StoredFieldBinding = { readonly fieldKey: string; readonly aggregation?: MetricAggregation | undefined };
type StoredSlotValue = StoredFieldBinding | readonly StoredFieldBinding[];
type StoredCalculatedMetric = {
  readonly id: string;
  readonly name: string;
  readonly tokens: readonly (
    | { readonly kind: "metric"; readonly reference: { readonly fieldKey: string; readonly aggregation: MetricAggregation } }
    | { readonly kind: "operator"; readonly value: "+" | "-" | "*" | "/" | "(" | ")" }
  )[];
  readonly format: "number" | "percent" | "currency";
  readonly decimals: number;
  readonly divideByZero: "dash" | "zero";
};
interface StoredBinding {
  readonly datasetId: string;
  readonly slots: Readonly<Record<string, StoredSlotValue>>;
  readonly calculatedMetrics?: readonly StoredCalculatedMetric[] | undefined;
  readonly sort?: { readonly fieldKey: string; readonly direction: "asc" | "desc" } | undefined;
  readonly limit?: number | undefined;
}

interface BindableComponent {
  readonly id: string;
  readonly type: ComponentType;
  readonly title?: string | undefined;
  readonly props?: Readonly<Record<string, unknown>> | undefined;
  readonly binding?: StoredBinding | undefined;
}

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : "未知错误";

const isSlotArray = (value: StoredSlotValue): value is readonly StoredFieldBinding[] => Array.isArray(value);

const toBindableComponent = (component: BindableComponent): BindableComponent => ({
  id: component.id,
  type: component.type,
  ...(component.title !== undefined ? { title: component.title } : {}),
  ...(component.props !== undefined ? { props: component.props } : {}),
  ...(component.binding !== undefined ? { binding: component.binding } : {}),
});

const defaultParameterValue = (parameter: QueryParameter): string | number | boolean => {
  switch (parameter.type) {
    case "number":
      return 0;
    case "date":
      return "2026-01-01";
    case "boolean":
      return false;
    case "string":
      return "";
  }
};

const buildRequiredParameters = (parameters: readonly QueryParameter[]): Record<string, string | number | boolean> => (
  Object.fromEntries(
    parameters
      .filter((parameter) => parameter.required && parameter.runtime !== true)
      .map((parameter) => [parameter.key, defaultParameterValue(parameter)]),
  )
);

const formatValidationMessage = (
  message: string,
  definition: ComponentDefinition,
): string => {
  const required = /^Required slot "([^"]+)" is not bound$/.exec(message);
  if (required) {
    const slot = definition.dataSlots.find((candidate) => candidate.key === required[1]);
    return `请配置${slot?.title ?? required[1]}`;
  }
  const missingField = /^Field "([^"]+)" bound to slot "[^"]+" does not exist$/.exec(message);
  if (missingField) return `字段 ${missingField[1]} 已不存在`;
  return message;
};

const selectedKeys = (
  binding: StoredBinding | undefined,
  slotKey: string,
  multiple: boolean,
): string | string[] | undefined => {
  const value = binding?.slots[slotKey];
  if (value !== undefined && isSlotArray(value)) return value.map((field) => field.fieldKey);
  if (value === undefined) return multiple ? [] : undefined;
  return multiple ? [value.fieldKey] : value.fieldKey;
};

const cloneSlots = (slots: StoredBinding["slots"]): DataBinding["slots"] => (
  Object.fromEntries(
    Object.entries(slots).map(([key, slotValue]) => {
      if (isSlotArray(slotValue)) {
        return [key, slotValue.map((field) => ({
          fieldKey: field.fieldKey,
          ...(field.aggregation === undefined ? {} : { aggregation: field.aggregation }),
        }))];
      }
      return [key, {
        fieldKey: slotValue.fieldKey,
        ...(slotValue.aggregation === undefined ? {} : { aggregation: slotValue.aggregation }),
      }];
    }),
  )
);

const aggregationOptions: readonly { readonly label: string; readonly value: MetricAggregation }[] = [
  { label: "求和", value: "sum" },
  { label: "平均值", value: "avg" },
  { label: "计数", value: "count" },
  { label: "最大值", value: "max" },
  { label: "最小值", value: "min" },
];

const aggregationLabel = (
  aggregation: MetricAggregation | undefined,
  fallback: MetricAggregation = "sum",
): string => aggregationOptions.find((option) => option.value === (aggregation ?? fallback))?.label ?? "求和";

const percentBarAggregationWarning = (componentType: ComponentType, binding: StoredBinding | undefined): string | undefined => {
  if (componentType !== "percentBar") return undefined;
  const selected = binding?.slots.measures;
  if (selected === undefined) return undefined;
  const measures = isSlotArray(selected) ? selected : [selected];
  const aggregations = new Set(measures.map((measure) => measure.aggregation ?? "sum"));
  if (aggregations.size < 2) return undefined;
  return "百分比图的所有指标必须使用相同聚合方式；“计数”和“求和”等不同量纲不能直接计算构成占比。";
};

const cloneBinding = (binding: StoredBinding): DataBinding => {
  const cloned: DataBinding = {
    datasetId: binding.datasetId,
    slots: cloneSlots(binding.slots),
  };
  if (binding.sort !== undefined) cloned.sort = { ...binding.sort };
  if (binding.limit !== undefined) cloned.limit = binding.limit;
  if (binding.calculatedMetrics !== undefined) cloned.calculatedMetrics = binding.calculatedMetrics.map((metric) => ({
    ...metric,
    tokens: metric.tokens.map((token) => token.kind === "metric"
      ? { kind: "metric" as const, reference: { ...token.reference } }
      : { kind: "operator" as const, value: token.value }),
  }));
  return cloned;
};

const slotHelpText = (slotKey: string, slotTitle: string, componentType: ComponentType): string => {
  if (componentType === "metricTrend" && slotKey === "timeDimension") return "作为指标趋势的时间或分类横轴，可选择天级日期，也可选择已整理好的年、季度、月、周、日等维度字段。";
  if (slotKey === "timeDimension") return "作为趋势分析的基础日期字段，只支持天级日期，系统会按时间粒度聚合为周、月、季度或年。";
  if (slotKey === "dateDimension") return "作为时间分析的基础日期字段，只支持天级日期，系统会按时间粒度聚合为周、月、季度或年。";
  if (slotKey === "dimensions") return "作为多维分析的分组层级，可选择地区、品类、渠道等多个分类字段。";
  if (slotKey === "measures") return "作为多维分析要汇总的数值指标，可选择销售额、订单数、访客数等多个指标。";
  if (componentType === "bar" && slotKey === "measure") return "可选择一个或多个数值指标；多个指标会按同一维度并列展示为多组柱。";
  if (componentType === "horizontalBar" && slotKey === "measure") return "建议选择不超过两个数值指标，按第一个指标从高到低排列。单位不同或量级相差较大时，系统会自动使用独立刻度。";
  if (componentType === "barLine" && slotKey === "barMeasure") return "选择以柱状展示的主指标，例如库存金额或销售额。";
  if (componentType === "barLine" && slotKey === "lineMeasure") return "选择以折线展示的对比指标，例如库存数量或订单数；该指标使用右侧纵轴。";
  if (componentType === "ringBar" && slotKey === "measure") return "主指标决定各维度同心环的长度，系统会按所选聚合方式汇总。";
  if (componentType === "ringBar" && slotKey === "tooltipMeasures") return "可选的辅助指标，只在鼠标悬浮同心环时显示，不会生成新的环。";
  if (componentType === "ranking" && slotKey === "measure") return "只选择参与排名的业务指标，例如订单数、访客数。只选一个指标时会自动按该指标从高到低排行；选择多个指标后，可决定按主指标或综合加权结果排行。";
  if (componentType === "kpi" && slotKey === "measure") return "作为指标看板展示的数值字段，可多选收入、目标、同期、订单等指标。第一项会作为主指标展示。";
  if (componentType === "flipNumber" && slotKey === "measure") return "作为翻牌器展示的多个数值指标，每个指标会生成一张翻牌卡。";
  if (componentType === "progressBar" && slotKey === "measure") return "作为进度条展示的多个实际指标。请在“指标与目标配对”中为每项明确选择目标值。";
  if (componentType === "progressBar" && slotKey === "target") return "目标值会在“指标与目标配对”中与实际指标成对保存；不选择时该项默认按 100% 展示。";
  if (componentType === "targetProgress" && slotKey === "dimension") return "按该字段分组生成完成率行，例如商品、门店或渠道。";
  if (componentType === "targetProgress" && slotKey === "measure") return "每个维度实际完成的数值，会与同一维度的目标值计算完成率。选择字段后，可在字段项的更多操作中设置求和、平均值、计数等聚合方式。";
  if (componentType === "targetProgress" && slotKey === "target") return "每个维度对应的目标数值，用于计算完成百分比。目标通常会在明细行重复出现，因此默认取最大值；可在字段项的更多操作中按业务语义改为求和、平均值、计数等。";
  if (componentType === "sunburst" && slotKey === "dimension") return "作为旭日扇区的分类标签，例如商品、品类、地区或门店。";
  if (componentType === "sunburst" && slotKey === "measure") return "决定扇区角度和面积。可选择多个指标，图表默认展示第一项，并可在图表右上角切换。";
  if (componentType === "sunburst" && slotKey === "tooltipMeasures") return "可选的辅助指标，只在鼠标悬浮扇区时展示，不会改变扇区大小。";
  if (componentType === "radar" && slotKey === "measure") return "可选择多个指标。每个指标会作为一块半透明面积，围绕同一组维度进行比较。";
  if (componentType === "treemap" && slotKey === "measure") return "可选择多个指标。图表默认展示第一项，可在图表右上角切换当前展示的指标；系统按维度汇总后，用矩形面积和百分比展示占比。";
  if ((componentType === "pie" || componentType === "donut" || componentType === "rose") && slotKey === "measure") return "可选择多个指标。第一项决定扇区角度或玫瑰半径；鼠标悬浮扇区时会展示全部已选指标。";
  if (componentType === "metricBreakdown" && slotKey === "dimension") return "作为指标拆解的归因维度，可选择产品线、渠道、地区、门店或品类。";
  if (componentType === "metricBreakdown" && slotKey === "measure") return "作为要拆解的核心指标，系统会按维度汇总、排序并计算贡献占比。";
  if ((componentType === "gauge" || componentType === "liquid") && slotKey === "dimension") return "按该字段拆分为多张图，每个分组会分别按组件的聚合方式计算实际值和目标值。";
  if (componentType === "gauge" && slotKey === "measure") return "仪表盘中心显示的实际数值；未选择分组维度时会汇总全部数据。";
  if (componentType === "gauge" && slotKey === "target") return "仪表盘的目标数值，用于计算完成率和指针位置。";
  if (componentType === "liquid" && slotKey === "measure") return "水波图显示的实际数值；未选择分组维度时会汇总全部数据。";
  if (componentType === "liquid" && slotKey === "target") return "水波图的目标数值，用于计算液面高度和完成率。";
  if (componentType === "heatmap" && slotKey === "rowDimension") return "作为热力图纵向分组，例如星期、地区、门店或品类。";
  if (componentType === "heatmap" && slotKey === "columnDimension") return "作为热力图横向分组，例如时段、月份、渠道或状态。";
  if (componentType === "heatmap" && slotKey === "measure") return "作为热力格子的颜色强度指标，例如访客数、销售额、订单数或转化次数。";
  if (slotKey === "rowDimension") return "作为交叉表左侧的行分组，通常选择地区、门店、品类等分类字段。";
  if (slotKey === "columnDimension") return "作为交叉表顶部的列分组，通常选择月份、季度、状态等分类字段。";
  if (slotKey === "dimension") return "作为图表的分类维度，决定图表按哪个字段分组展示。";
  if (slotKey === "measure") return "作为图表要统计的数值指标，交叉表会按行列组合汇总这个字段。";
  return `选择用于${slotTitle}的数据字段。`;
};

const visibleDataSlots = (
  definition: ComponentDefinition,
  componentType: ComponentType,
  slotKeys?: readonly string[],
): ComponentDefinition["dataSlots"] => {
  const componentSlots = componentType !== "kpi"
    ? definition.dataSlots
    : definition.dataSlots.filter((slot) =>
    slot.key !== "target" && slot.key !== "comparison" && slot.key !== "secondaryMeasures");
  return slotKeys === undefined ? componentSlots : componentSlots.filter((slot) => slotKeys.includes(slot.key));
};

export const fieldOptionsForSlot = (
  fields: readonly DatasetField[],
  slot: ComponentDefinition["dataSlots"][number],
): { readonly label: string; readonly value: string }[] =>
  fields
    .filter((field) => slot.acceptedTypes.includes(field.type))
    .map((field) => ({ label: field.label, value: field.key }));

const BindingFieldLabel = ({ label, help, action }: { readonly label: string; readonly help: string; readonly action?: ReactNode }) => (
  <div className="binding-field__label">
    <Typography.Text strong>{label}</Typography.Text>
    <Tooltip title={help} placement="topRight">
      <Button
        type="text"
        size="small"
        className="binding-field__help"
        aria-label={`${label}说明`}
        icon={<QuestionCircleOutlined />}
      />
    </Tooltip>
    {action !== undefined && <span className="binding-field__label-actions">{action}</span>}
  </div>
);

const timeGranularityOptions = [
  { label: "天", value: "day" },
  { label: "周", value: "week" },
  { label: "月", value: "month" },
  { label: "季度", value: "quarter" },
  { label: "年", value: "year" },
];

const isTimeGranularity = (value: unknown): value is string =>
  value === "day" ||
  value === "week" ||
  value === "month" ||
  value === "quarter" ||
  value === "year";

const isLegacyRankingAuxiliaryField = (key: string, label?: string): boolean =>
  /^(权重|调整系数|加权销售额|加权结果|weight|adjustment(?:_?factor)?|weighted(?:sales|revenue|result)?)$/i.test(key) ||
  /^(权重|调整系数|加权销售额|加权结果|weight|adjustment(?:\s*factor)?|weighted(?:\s*sales|\s*revenue|\s*result)?)$/i.test(label ?? "");

const DEFAULT_CHART_RESULT_LIMIT = 1_000;
const MAX_CHART_RESULT_LIMIT = 5_000;

export const ComponentBindingPanel = ({
  store,
  component,
  definition,
  slotKeys,
  slotActions = {},
  compact = false,
  showRefreshButton = false,
}: ComponentBindingPanelProps) => {
  const queryClient = useQueryClient();
  const localDatasets = useLocalDatasets();
  const [selectionError, setSelectionError] = useState<unknown>(null);
  const [selectingDatasetId, setSelectingDatasetId] = useState<string | null>(null);
  const [dropSlotKey, setDropSlotKey] = useState<string | null>(null);
  const [calculatedMetricSlot, setCalculatedMetricSlot] = useState<{ key: string; multiple: boolean; editingMetric?: CalculatedMetric } | null>(null);
  const storedComponent = useStore(store, (state) =>
    state.history.present.components.find((candidate) => candidate.id === component.id),
  );
  const currentComponent = toBindableComponent(storedComponent ?? component);
  const binding = currentComponent.binding;
  const componentProps = currentComponent.props ?? {};
  const savedTopN = binding?.limit ?? null;
  const savedResultLimit = typeof componentProps.resultLimit === "number" && Number.isInteger(componentProps.resultLimit)
    ? componentProps.resultLimit
    : typeof componentProps.appliedResultLimit === "number" && Number.isInteger(componentProps.appliedResultLimit)
      ? componentProps.appliedResultLimit
      : DEFAULT_CHART_RESULT_LIMIT;
  const [draftTopN, setDraftTopN] = useState<number | null>(savedTopN);
  const [draftResultLimit, setDraftResultLimit] = useState<number | null>(savedResultLimit);
  useEffect(() => { setDraftTopN(savedTopN); }, [component.id, savedTopN]);
  useEffect(() => { setDraftResultLimit(savedResultLimit); }, [component.id, savedResultLimit]);
  const defaultProps = definition.createDefaults();
  const supportsTimeGranularity = isTimeGranularity(componentProps.timeGranularity) || isTimeGranularity(defaultProps.timeGranularity);
  const timeGranularityValue = isTimeGranularity(componentProps.timeGranularity)
    ? componentProps.timeGranularity
    : isTimeGranularity(defaultProps.timeGranularity)
      ? defaultProps.timeGranularity
      : "day";
  const datasetId = binding?.datasetId;
  const savedDataset = useStore(store, (state) => datasetId === undefined
    ? undefined
    : state.history.present.datasets.find((dataset) => dataset.datasetId === datasetId));
  const datasets = useQuery({ queryKey: ["datasets"], queryFn: () => listDatasets() });
  const schema = useQuery({
    queryKey: ["datasets", datasetId, "schema"],
    queryFn: () => localDatasets.getDataset(datasetId!) ?? getDataset(datasetId!),
    enabled: datasetId !== undefined,
  });
  const datasetOptions = Array.from(
    new Map([
      ...(datasets.data ?? []),
      ...localDatasets.summaries,
    ].map((dataset) => [dataset.id, dataset])).values(),
  ).map((dataset) => ({ label: dataset.name, value: dataset.id }));
  const showDatasetListError = datasets.isError && localDatasets.summaries.length === 0;

  // KPI insight used to expose a dimension slot. The component now represents
  // one aggregated metric, so old dashboards must not keep an inert grouping
  // binding that would both confuse the query and fail binding validation.
  const legacyInsightSlotKeys = currentComponent.type === "kpiInsight" && binding !== undefined
    ? Object.keys(binding.slots).filter((key) => !definition.dataSlots.some((slot) => slot.key === key))
    : [];

  const dispatchDatasetBinding = (dataset: Dataset) => {
    store.getState().dispatch({
      type: "dashboard.dataset.upsert",
      dataset: {
        datasetId: dataset.id,
        schemaVersion: dataset.schemaVersion,
        parameters: buildRequiredParameters(dataset.parameters),
      },
    });
    store.getState().dispatch({
      type: "component.binding.update",
      componentId: component.id,
      nextBinding: { datasetId: dataset.id, slots: {} },
    });
  };

  const updateSlot = (slotKey: string, value: string | string[] | undefined, multiple: boolean) => {
    if (binding === undefined) return;
    const nextSlots = cloneSlots(binding.slots);
    if (multiple) {
      const values = Array.isArray(value) ? value : [];
      if (values.length === 0) delete nextSlots[slotKey];
      else {
        const previousValue = binding.slots[slotKey];
        const previousFields = previousValue === undefined
          ? []
          : isSlotArray(previousValue) ? previousValue : [previousValue];
        nextSlots[slotKey] = values.map((fieldKey) => {
          const previous = previousFields.find((field) => field.fieldKey === fieldKey);
          return {
            fieldKey,
            ...(previous?.aggregation === undefined ? {} : { aggregation: previous.aggregation }),
          };
        });
      }
    } else if (typeof value === "string") {
      nextSlots[slotKey] = { fieldKey: value };
    } else {
      delete nextSlots[slotKey];
    }
    const nextBinding: DataBinding = { ...cloneBinding(binding), slots: nextSlots };
    store.getState().dispatch({
      type: "component.binding.update",
      componentId: component.id,
      nextBinding,
    });
  };

  const saveCalculatedMetric = (metric: CalculatedMetric) => {
    if (binding === undefined || calculatedMetricSlot === null) return;
    const nextBinding = cloneBinding(binding);
    const editingMetric = calculatedMetricSlot.editingMetric;
    nextBinding.calculatedMetrics = editingMetric === undefined
      ? [...(nextBinding.calculatedMetrics ?? []), metric]
      : (nextBinding.calculatedMetrics ?? []).map((existing) => existing.id === metric.id ? metric : existing);
    if (editingMetric !== undefined) {
      store.getState().dispatch({ type: "component.binding.update", componentId: component.id, nextBinding });
      setCalculatedMetricSlot(null);
      return;
    }
    const current = nextBinding.slots[calculatedMetricSlot.key];
    if (calculatedMetricSlot.multiple) {
      const items = current === undefined ? [] : Array.isArray(current) ? current : [current];
      nextBinding.slots[calculatedMetricSlot.key] = [...items, { fieldKey: metric.id }];
    } else {
      nextBinding.slots[calculatedMetricSlot.key] = { fieldKey: metric.id };
    }
    store.getState().dispatch({
      type: "component.binding.update",
      componentId: component.id,
      nextBinding,
    });
    setCalculatedMetricSlot(null);
  };

  const selectedMetricAggregation = (slotKey: string, fieldKey: string): MetricAggregation | undefined => {
    const selected = binding?.slots[slotKey];
    if (selected === undefined) return undefined;
    if (isSlotArray(selected)) return selected.find((field) => field.fieldKey === fieldKey)?.aggregation;
    return selected.fieldKey === fieldKey ? selected.aggregation : undefined;
  };

  const updateMetricAggregation = (slotKey: string, fieldKey: string, aggregation: MetricAggregation) => {
    if (binding === undefined) return;
    const nextSlots = cloneSlots(binding.slots);
    const selected = nextSlots[slotKey];
    if (selected === undefined) return;
    if (Array.isArray(selected)) {
      nextSlots[slotKey] = selected.map((field) => field.fieldKey === fieldKey ? { ...field, aggregation } : field);
    } else if (selected.fieldKey === fieldKey) {
      nextSlots[slotKey] = { ...selected, aggregation };
    } else {
      return;
    }
    store.getState().dispatch({
      type: "component.binding.update",
      componentId: component.id,
      nextBinding: { ...cloneBinding(binding), slots: nextSlots },
    });
  };

  useEffect(() => {
    if (currentComponent.type !== "ranking" || binding === undefined) return;
    const selectedMeasures = selectedKeys(binding, "measure", true);
    if (!Array.isArray(selectedMeasures)) return;
    const nextMeasures = selectedMeasures.filter((key) => {
      const field = schema.data?.fields.find((candidate) => candidate.key === key);
      return !isLegacyRankingAuxiliaryField(key, field?.label);
    });
    if (nextMeasures.length !== selectedMeasures.length) updateSlot("measure", nextMeasures, true);
  }, [binding, currentComponent.type, schema.data]);

  useEffect(() => {
    if (legacyInsightSlotKeys.length === 0 || binding === undefined) return;
    const nextSlots = cloneSlots(binding.slots);
    legacyInsightSlotKeys.forEach((key) => { delete nextSlots[key]; });
    store.getState().dispatch({
      type: "component.binding.update",
      componentId: component.id,
      nextBinding: { ...cloneBinding(binding), slots: nextSlots },
    });
  }, [binding, component.id, legacyInsightSlotKeys.join("|"), store]);

  const updateTimeGranularity = (timeGranularity: string) => {
    store.getState().dispatch({
      type: "component.props.update",
      componentId: component.id,
      nextProps: { ...componentProps, timeGranularity },
    });
  };

  const rankingMeasureKeys = currentComponent.type === "ranking"
    ? selectedKeys(binding, "measure", true)
    : [];
  const rankingMeasures = (Array.isArray(rankingMeasureKeys) ? rankingMeasureKeys : []).filter((key) => {
    const field = schema.data?.fields.find((candidate) => candidate.key === key);
    return !isLegacyRankingAuxiliaryField(key, field?.label);
  });
  const primaryRankingMeasureLabel = schema.data?.fields.find((field) => field.key === rankingMeasures[0])?.label
    ?? rankingMeasures[0]
    ?? "指标";
  const rankingMode = componentProps.rankingMode === "weighted" && rankingMeasures.length > 1 ? "weighted" : "primary";
  const rawMetricWeights = componentProps.metricWeights;
  const metricWeights = rawMetricWeights !== null && typeof rawMetricWeights === "object" && !Array.isArray(rawMetricWeights)
    ? rawMetricWeights as Readonly<Record<string, unknown>>
    : {};
  const defaultMetricWeight = rankingMeasures.length === 0 ? 0 : 100 / rankingMeasures.length;
  const metricWeightTotal = rankingMeasures.reduce((total, fieldKey) => {
    const weight = metricWeights[fieldKey];
    return total + (typeof weight === "number" && Number.isFinite(weight) ? weight : defaultMetricWeight);
  }, 0);

  const updateRankingProps = (nextValues: Readonly<Record<string, unknown>>) => {
    const { queryFilters, ...schemaComponentProps } = componentProps;
    const preservedQueryFilters = Array.isArray(queryFilters) ? queryFilters : undefined;
    const parsed = definition.propsSchema.safeParse({ ...definition.createDefaults(), ...schemaComponentProps, ...nextValues });
    if (!parsed.success) return;
    store.getState().dispatch({
      type: "component.props.update",
      componentId: component.id,
      nextProps: { ...parsed.data, ...(preservedQueryFilters === undefined ? {} : { queryFilters: preservedQueryFilters }) },
    });
  };

  const updateRankingWeight = (fieldKey: string, nextWeight: number | null) => {
    if (nextWeight === null) return;
    const nextWeights = Object.fromEntries(rankingMeasures.map((key) => {
      const current = metricWeights[key];
      const value = key === fieldKey
        ? nextWeight
        : typeof current === "number" && Number.isFinite(current) ? current : defaultMetricWeight;
      return [key, value];
    }));
    updateRankingProps({ metricWeights: nextWeights, rankingMode: "weighted" });
  };

  const updateDatasetParameters = (parameters: Record<string, string | number | boolean>) => {
    if (datasetId === undefined || schema.data === undefined) return;
    store.getState().dispatch({
      type: "dashboard.dataset.upsert",
      dataset: {
        datasetId,
        schemaVersion: schema.data.schemaVersion,
        parameters: Object.fromEntries(Object.entries(parameters).filter(([key]) =>
          key !== "limit" && schema.data!.parameters.find((parameter) => parameter.key === key)?.runtime !== true,
        )),
      },
    });
  };

  const updateSortField = (fieldKey: string | undefined) => {
    if (binding === undefined) return;
    const nextBinding = cloneBinding(binding);
    if (fieldKey === undefined) delete nextBinding.sort;
    else {
      nextBinding.sort = {
        fieldKey,
        direction: binding.sort?.direction ?? "desc",
      };
    }
    store.getState().dispatch({
      type: "component.binding.update",
      componentId: component.id,
      nextBinding,
    });
  };

  const updateSortDirection = (direction: "asc" | "desc") => {
    if (binding?.sort === undefined) return;
    const nextBinding = cloneBinding(binding);
    nextBinding.sort = { fieldKey: binding.sort.fieldKey, direction };
    store.getState().dispatch({
      type: "component.binding.update",
      componentId: component.id,
      nextBinding,
    });
  };

  const updateLimit = (limit: number | null) => {
    if (binding === undefined) return;
    const nextBinding = cloneBinding(binding);
    if (limit === null) {
      if (binding.limit === undefined) return;
      delete nextBinding.limit;
    } else {
      if (binding.limit === limit) return;
      nextBinding.limit = limit;
    }
    store.getState().dispatch({
      type: "component.binding.update",
      componentId: component.id,
      nextBinding,
    });
  };

  const sourceFields = schema.data?.fields ?? [];
  const fields = calculatedMetricFields(sourceFields, binding as DataBinding | undefined);
  const metricTrendDimensionKey = currentComponent.type === "metricTrend"
    ? selectedKeys(binding, "timeDimension", false)
    : undefined;
  const metricTrendDimension = typeof metricTrendDimensionKey === "string"
    ? fields.find((field) => field.key === metricTrendDimensionKey)
    : undefined;
  // Metric trend also supports a normal category dimension. Time granularity
  // has no effect for those fields, so do not present a misleading control.
  const showTimeGranularity = supportsTimeGranularity && (
    currentComponent.type !== "metricTrend" || metricTrendDimension === undefined || metricTrendDimension.type === "date"
  );
  const isProgressPairingComponent = currentComponent.type === "progressBar" || currentComponent.type === "progressIndicator";
  const progressMeasureKeys = isProgressPairingComponent
    ? (Array.isArray(selectedKeys(binding, "measure", true)) ? selectedKeys(binding, "measure", true) as string[] : [])
    : [];
  const progressTargetKeys = isProgressPairingComponent
    ? (Array.isArray(selectedKeys(binding, "target", true)) ? selectedKeys(binding, "target", true) as string[] : [])
    : [];
  const rawProgressPairs = currentComponent.type === "progressIndicator"
    ? (Array.isArray(componentProps.metricSettings) ? componentProps.metricSettings : [])
    : (Array.isArray(componentProps.progressPairs) ? componentProps.progressPairs : []);
  const savedProgressPairs = rawProgressPairs.flatMap((pair) => {
    const measure = Array.isArray(pair)
      ? pair[0]
      : pair !== null && typeof pair === "object"
        ? ((pair as { readonly measure?: unknown; readonly measureKey?: unknown }).measure ?? (pair as { readonly measureKey?: unknown }).measureKey)
        : undefined;
    const target = Array.isArray(pair)
      ? pair[1]
      : pair !== null && typeof pair === "object"
        ? ((pair as { readonly target?: unknown; readonly targetKey?: unknown }).target ?? (pair as { readonly targetKey?: unknown }).targetKey)
        : undefined;
    if (typeof measure !== "string" || !progressMeasureKeys.includes(measure)) return [];
    return [{ measure, ...(typeof target === "string" ? { target } : {}) }];
  });
  const savedProgressMeasures = new Set(savedProgressPairs.map((pair) => pair.measure));
  const savedProgressTargets = new Set(savedProgressPairs.flatMap((pair) => pair.target === undefined ? [] : [pair.target]));
  const unpairedProgressMeasures = progressMeasureKeys.filter((fieldKey) => !savedProgressMeasures.has(fieldKey));
  const unpairedProgressTargets = progressTargetKeys.filter((fieldKey) => !savedProgressTargets.has(fieldKey));
  const progressPairs = [
    ...savedProgressPairs,
    ...unpairedProgressMeasures.map((measure, index) => ({
      measure,
      ...(unpairedProgressTargets[index] === undefined ? {} : { target: unpairedProgressTargets[index] }),
    })),
  ];
  const updateProgressPairs = (nextPairs: readonly { readonly measure: string; readonly target?: string | undefined }[]) => {
    if (binding === undefined) return;
    const normalizedPairs = nextPairs.filter((pair) => pair.measure.length > 0);
    const nextSlots = cloneSlots(binding.slots);
    const previousMeasures = binding.slots.measure === undefined
      ? []
      : isSlotArray(binding.slots.measure) ? binding.slots.measure : [binding.slots.measure];
    const previousTargets = binding.slots.target === undefined
      ? []
      : isSlotArray(binding.slots.target) ? binding.slots.target : [binding.slots.target];
    nextSlots.measure = normalizedPairs.map((pair) => {
      const previous = previousMeasures.find((field) => field.fieldKey === pair.measure);
      return { fieldKey: pair.measure, ...(previous?.aggregation === undefined ? {} : { aggregation: previous.aggregation }) };
    });
    const targetKeys = [...new Set(normalizedPairs.flatMap((pair) => pair.target === undefined ? [] : [pair.target]))];
    if (targetKeys.length === 0) delete nextSlots.target;
    else {
      nextSlots.target = targetKeys.map((fieldKey) => {
        const previous = previousTargets.find((field) => field.fieldKey === fieldKey);
        return { fieldKey, ...(previous?.aggregation === undefined ? {} : { aggregation: previous.aggregation }) };
      });
    }
    store.getState().dispatch({
      type: "component.binding.update",
      componentId: component.id,
      nextBinding: { ...cloneBinding(binding), slots: nextSlots },
    });
    const nextProps = currentComponent.type === "progressIndicator"
      ? {
          ...componentProps,
          metricSettings: normalizedPairs.map((pair, index) => {
            const previous = rawProgressPairs.find((candidate) => candidate !== null && typeof candidate === "object" && !Array.isArray(candidate) && (candidate as { readonly measureKey?: unknown }).measureKey === pair.measure) as Record<string, unknown> | undefined;
            return {
              measureKey: pair.measure,
              targetKey: pair.target ?? null,
              targetValue: typeof previous?.targetValue === "number" ? previous.targetValue : null,
              label: typeof previous?.label === "string" ? previous.label : "",
              color: typeof previous?.color === "string" ? previous.color : ["#2f6bff", "#ff7a18", "#13b5a6", "#8b5cf6", "#e34d59", "#4f86f7"][index % 6]!,
              weight: typeof previous?.weight === "number" ? previous.weight : 0,
              includeInScore: previous?.includeInScore !== false,
            };
          }),
        }
      : {
          ...componentProps,
          progressPairs: normalizedPairs.map((pair) => pair.target === undefined ? [pair.measure] : [pair.measure, pair.target]),
        };
    store.getState().dispatch({
      type: "component.props.update",
      componentId: component.id,
      nextProps,
    });
  };
  const updateProgressPair = (index: number, slot: "measure" | "target", fieldKey: string | undefined) => {
    const nextPairs = progressPairs.map((pair) => ({ ...pair }));
    if (slot === "measure") {
      if (fieldKey === undefined) nextPairs.splice(index, 1);
      else nextPairs[index] = { ...nextPairs[index]!, measure: fieldKey };
    } else {
      const pair = nextPairs[index];
      if (pair === undefined) return;
      if (fieldKey === undefined) delete pair.target;
      else pair.target = fieldKey;
    }
    updateProgressPairs(nextPairs);
  };
  const dropProgressField = (event: DragEvent<HTMLDivElement>, index: number, slot: "measure" | "target") => {
    event.preventDefault();
    const fieldKey = event.dataTransfer.getData(FIELD_DRAG_TYPE);
    const field = fields.find((candidate) => candidate.key === fieldKey);
    if (field?.type !== "number") return;
    updateProgressPair(index, slot, field.key);
  };
  const canAcceptProgressField = (event: DragEvent<HTMLDivElement>) => event.dataTransfer.types.includes(FIELD_DRAG_TYPE);
  const supportsResultLimit = schema.data?.parameters.some((parameter) => parameter.key === "limit" && parameter.type === "number") === true;
  const updateResultLimit = (limit: number | null) => {
    const nextLimit = limit ?? DEFAULT_CHART_RESULT_LIMIT;
    if (savedResultLimit === nextLimit) return;
    store.getState().dispatch({
      type: "component.props.update",
      componentId: component.id,
      nextProps: { ...componentProps, resultLimit: nextLimit },
    });
  };
  const validationBinding = binding === undefined
    ? undefined
    : legacyInsightSlotKeys.length === 0
      ? cloneBinding(binding)
      : {
        ...cloneBinding(binding),
        slots: Object.fromEntries(Object.entries(cloneBinding(binding).slots).filter(([key]) => !legacyInsightSlotKeys.includes(key))),
      };
  const validation = schema.data && validationBinding
    ? validateBinding(validationBinding, schema.data.fields, definition.dataSlots)
    : null;
  const aggregationWarning = percentBarAggregationWarning(currentComponent.type, binding);
  const canRefresh = binding !== undefined && (validation === null || validation.valid) && aggregationWarning === undefined;
  const refreshData = () => {
    if (!canRefresh) return;
    const currentVersion = componentProps.dataRefreshVersion;
    const nextVersion = typeof currentVersion === "number" && Number.isSafeInteger(currentVersion)
      ? currentVersion + 1
      : 1;
    // ComponentFrame owns the actual request so the result cap and the
    // aggregation are assembled once in one consistent query.
    store.getState().dispatch({
      type: "component.props.update",
      componentId: component.id,
      nextProps: {
        ...componentProps,
        ...(supportsResultLimit ? { appliedResultLimit: draftResultLimit } : {}),
        dataRefreshVersion: nextVersion,
      },
    });
  };

  return (
    <Space className={`binding-panel${compact ? " binding-panel--compact" : ""}`} orientation="vertical" size="middle" style={{ width: "100%" }}>
      {!compact && showDatasetListError && <Alert type="error" showIcon title="加载数据集失败" description={errorMessage(datasets.error)} />}
      {!compact && <div className="binding-field binding-panel__dataset-source">
        <BindingFieldLabel label="数据集" help="选择当前组件要使用的 Excel 或接口数据源，下面的字段选项会来自这个数据集。" />
        <Select
          aria-label="数据集"
          loading={datasets.isLoading && localDatasets.summaries.length === 0}
          options={datasetOptions}
          placeholder="选择数据集"
          style={{ width: "100%" }}
          {...(datasetId !== undefined ? { value: datasetId } : {})}
          onChange={async (nextDatasetId: string) => {
            setSelectingDatasetId(nextDatasetId);
            setSelectionError(null);
            try {
              const localDataset = localDatasets.getDataset(nextDatasetId);
              const dataset = localDataset ?? await queryClient.fetchQuery<Dataset>({
                queryKey: ["datasets", nextDatasetId, "schema"],
                queryFn: () => getDataset(nextDatasetId),
              });
              dispatchDatasetBinding(dataset);
            } catch (error) {
              setSelectionError(error);
            } finally {
              setSelectingDatasetId(null);
            }
          }}
        />
      </div>}

      {(schema.isLoading || selectingDatasetId !== null) && <Spin />}
      {(schema.isError || selectionError !== null) && (
        <Alert
          type="error"
          showIcon
          title="加载 Schema 失败"
          description={errorMessage(selectionError ?? schema.error)}
        />
      )}
      {!compact && schema.data !== undefined && schema.data.parameters.some((parameter) => parameter.runtime !== true && parameter.key !== "limit") && (
        <div className="binding-field">
          <BindingFieldLabel label="查询参数" help="修改后会应用到引用该数据集的所有组件，并自动刷新图表查询。" />
          <ParameterForm
            key={`${schema.data.id}:${schema.data.schemaVersion}:${JSON.stringify(savedDataset?.parameters ?? {})}`}
            parameters={schema.data.parameters.filter((parameter) => parameter.runtime !== true && parameter.key !== "limit")}
            submitLabel="应用参数"
            onSubmit={updateDatasetParameters}
            {...(savedDataset === undefined ? {} : { initialValues: savedDataset.parameters as Record<string, unknown> })}
          />
        </div>
      )}
      {!compact && ((validation !== null && !validation.valid) || aggregationWarning !== undefined) && (
        <Alert
          type="warning"
          showIcon
          title="数据绑定需要检查"
          description={[
            ...(validation !== null && !validation.valid
              ? validation.messages.map((message) => formatValidationMessage(message, definition))
              : []),
            ...(aggregationWarning === undefined ? [] : [aggregationWarning]),
          ].join("；")}
        />
      )}

      {isProgressPairingComponent && (
        <div className="binding-field progress-pair-field">
          <BindingFieldLabel label={currentComponent.type === "progressIndicator" ? "指标配对" : "指标与目标配对"} help="每一行对应一项已完成指标和它的目标指标。可从右侧数据栏双击添加，再拖动字段到对应一行完成配对。" />
          <div className="progress-pair-list">
            {progressPairs.map((pair, index) => {
              const measureAggregation = selectedMetricAggregation("measure", pair.measure) ?? "sum";
              const targetAggregation = pair.target === undefined
                ? undefined
                : selectedMetricAggregation("target", pair.target) ?? "max";
              const measureLabel = fields.find((field) => field.key === pair.measure)?.label ?? pair.measure;
              const targetLabel = pair.target === undefined ? undefined : fields.find((field) => field.key === pair.target)?.label ?? pair.target;
              return (
                <div className="progress-pair" key={`${pair.measure}:${index}`}>
                  <div className="progress-pair__heading">
                    <Typography.Text type="secondary">{currentComponent.type === "progressIndicator" ? "指标" : "进度"} {index + 1}</Typography.Text>
                    <Button aria-label={`移除${currentComponent.type === "progressIndicator" ? "指标" : "进度"} ${index + 1}`} className="progress-pair__remove" danger icon={<DeleteOutlined />} size="small" type="text" onClick={() => updateProgressPair(index, "measure", undefined)} />
                  </div>
                  <div className="progress-pair__controls">
                    <div className="progress-pair__control">
                      <span>{currentComponent.type === "progressIndicator" ? "已完成指标" : "实际指标"}</span>
                      <div
                        className="metric-binding-item progress-pair__field"
                        onDragOver={(event) => { if (canAcceptProgressField(event)) event.preventDefault(); }}
                        onDrop={(event) => dropProgressField(event, index, "measure")}
                      >
                        <span className="metric-binding-item__kind" aria-hidden="true">Nº</span>
                        <span className="metric-binding-item__name">{measureLabel}</span>
                      </div>
                      <Dropdown
                        menu={{
                          items: aggregationOptions.map((option) => ({
                            key: option.value,
                            label: <span className="metric-aggregation-option">{option.label}{measureAggregation === option.value && <CheckOutlined />}</span>,
                          })),
                          onClick: ({ key, domEvent }) => {
                            domEvent.stopPropagation();
                            updateMetricAggregation("measure", pair.measure, key as MetricAggregation);
                          },
                        }}
                        trigger={["click"]}
                      >
                        <Button aria-label={`${currentComponent.type === "progressIndicator" ? "指标" : "进度"} ${index + 1}实际指标聚合方式`} className="progress-pair__aggregation-button" icon={<DownOutlined />} size="small" type="text">
                          {aggregationLabel(measureAggregation)}
                        </Button>
                      </Dropdown>
                    </div>
                    <ArrowRightOutlined className="progress-pair__arrow" aria-hidden="true" />
                    <div className="progress-pair__control">
                      <span>{currentComponent.type === "progressIndicator" ? "目标指标" : "目标值"}</span>
                      {targetLabel === undefined ? (
                        <div
                          className="binding-field__empty progress-pair__drop-target"
                          onDragOver={(event) => { if (canAcceptProgressField(event)) event.preventDefault(); }}
                          onDrop={(event) => dropProgressField(event, index, "target")}
                        >
                          从右侧数据栏双击或拖入{currentComponent.type === "progressIndicator" ? "目标指标" : "目标值"}
                        </div>
                      ) : (
                        <div
                          className="metric-binding-item progress-pair__field"
                          onDragOver={(event) => { if (canAcceptProgressField(event)) event.preventDefault(); }}
                          onDrop={(event) => dropProgressField(event, index, "target")}
                        >
                          <span className="metric-binding-item__kind" aria-hidden="true">Nº</span>
                          <span className="metric-binding-item__name">{targetLabel}</span>
                          <Button aria-label={`移除${currentComponent.type === "progressIndicator" ? "指标" : "进度"} ${index + 1}${currentComponent.type === "progressIndicator" ? "目标指标" : "目标值"}`} className="metric-binding-item__action" icon={<DeleteOutlined />} size="small" type="text" onClick={() => updateProgressPair(index, "target", undefined)} />
                        </div>
                      )}
                      {pair.target === undefined ? (
                        <span className="progress-pair__aggregation-placeholder">未设置目标</span>
                      ) : (
                        <Dropdown
                          menu={{
                            items: aggregationOptions.map((option) => ({
                              key: option.value,
                              label: <span className="metric-aggregation-option">{option.label}{targetAggregation === option.value && <CheckOutlined />}</span>,
                            })),
                            onClick: ({ key, domEvent }) => {
                              domEvent.stopPropagation();
                              updateMetricAggregation("target", pair.target!, key as MetricAggregation);
                            },
                          }}
                          trigger={["click"]}
                        >
                          <Button aria-label={`${currentComponent.type === "progressIndicator" ? "指标" : "进度"} ${index + 1}目标值聚合方式`} className="progress-pair__aggregation-button" icon={<DownOutlined />} size="small" type="text">
                            {aggregationLabel(targetAggregation, "max")}
                          </Button>
                        </Dropdown>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="binding-field__data-panel-hint">从右侧数据栏双击或拖入度量，添加{currentComponent.type === "progressIndicator" ? "指标" : "进度"}</div>
          </div>
        </div>
      )}

      {visibleDataSlots(definition, currentComponent.type, slotKeys).map((slot) => {
        if (isProgressPairingComponent && (slot.key === "measure" || slot.key === "target")) return null;
        const value = selectedKeys(binding, slot.key, slot.multiple);
        const isTargetProgress = currentComponent.type === "targetProgress";
        const isTargetProgressTarget = isTargetProgress && slot.key === "target";
        const isMetricSlot = slot.key === "measure" || slot.key === "measures" || slot.key === "tooltipMeasures" || slot.key === "target" || slot.key === "comparison" || slot.key === "secondaryMeasures";
        const isDimensionSlot = !isMetricSlot;
        const metricFieldKeys = !isMetricSlot
          ? []
          : Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
        const dimensionFieldKeys = !isDimensionSlot
          ? []
          : Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
        const aggregationEnabled = typeof defaultProps.aggregation === "string";
        const dropField = (event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          setDropSlotKey(null);
          const fieldKey = event.dataTransfer.getData(FIELD_DRAG_TYPE);
          const field = fields.find((candidate) => candidate.key === fieldKey);
          if (field === undefined || !slot.acceptedTypes.includes(field.type)) return;
          if (slot.multiple) {
            const selected = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
            if (!selected.includes(field.key)) updateSlot(slot.key, [...selected, field.key], true);
          } else {
            updateSlot(slot.key, field.key, false);
          }
        };
        const canAcceptDrag = (event: DragEvent<HTMLDivElement>) => event.dataTransfer.types.includes(FIELD_DRAG_TYPE);
        return (
          <div
            className={`binding-field${dropSlotKey === slot.key ? " binding-field--drop-target" : ""}`}
            key={slot.key}
            onDragEnter={(event) => { if (canAcceptDrag(event)) setDropSlotKey(slot.key); }}
            onDragLeave={(event) => { if (event.currentTarget === event.target) setDropSlotKey(null); }}
            onDragOver={(event) => { if (canAcceptDrag(event)) event.preventDefault(); }}
            onDrop={dropField}
          >
            <BindingFieldLabel label={slot.title} help={slotHelpText(slot.key, slot.title, currentComponent.type)} action={slotActions[slot.key]} />
            {isMetricSlot ? (
              <div className="metric-binding-list">
                {metricFieldKeys.map((fieldKey) => {
                  const fieldLabel = fields.find((field) => field.key === fieldKey)?.label ?? fieldKey;
                  const calculatedMetric = binding?.calculatedMetrics?.find((metric) => metric.id === fieldKey);
                  const aggregation = selectedMetricAggregation(slot.key, fieldKey)
                    ?? (isTargetProgressTarget ? "max" : undefined);
                  const displayAggregation = aggregationEnabled ? aggregationLabel(aggregation) : "原始值";
                  return (
                    <div className="metric-binding-item" key={fieldKey}>
                      <span className="metric-binding-item__kind" aria-hidden="true">Nº</span>
                      <span className="metric-binding-item__name">{fieldLabel}{displayAggregation === undefined ? "" : `（${displayAggregation}）`}</span>
                      {calculatedMetric !== undefined && <Tooltip title="编辑计算公式"><Button aria-label={`编辑计算指标 ${fieldLabel}`} className="metric-binding-item__action" icon={<EditOutlined />} size="small" type="text" onClick={() => setCalculatedMetricSlot({ key: slot.key, multiple: slot.multiple, editingMetric: { ...calculatedMetric, tokens: calculatedMetric.tokens.map((token) => token.kind === "metric" ? { kind: "metric" as const, reference: { ...token.reference } } : { kind: "operator" as const, value: token.value }) } })} /></Tooltip>}
                      <Dropdown
                        menu={{
                          items: [
                            ...(aggregationEnabled ? [{
                              type: "group" as const,
                              key: "aggregation",
                              label: "聚合方式",
                              children: aggregationOptions.map((option) => ({
                                key: `aggregation:${option.value}`,
                                label: <span className="metric-aggregation-option">{option.label}{aggregation === option.value && <CheckOutlined />}</span>,
                              })),
                            }] : [{
                              key: "aggregation-disabled",
                              label: "聚合方式（当前图表不支持）",
                              disabled: true,
                            }]),
                            { type: "divider" as const },
                            { key: "remove", danger: true, label: "移除指标" },
                          ],
                          onClick: ({ key, domEvent }) => {
                            domEvent.stopPropagation();
                            if (key === "remove") {
                              updateSlot(
                                slot.key,
                                slot.multiple ? metricFieldKeys.filter((key) => key !== fieldKey) : undefined,
                                slot.multiple,
                              );
                            } else if (aggregationEnabled && key.startsWith("aggregation:")) {
                              updateMetricAggregation(slot.key, fieldKey, key.slice("aggregation:".length) as MetricAggregation);
                            }
                          },
                        }}
                        trigger={["click"]}
                      >
                        <Button
                          aria-label={`${fieldLabel}更多操作`}
                          className="metric-binding-item__action"
                          icon={<MoreOutlined />}
                          size="small"
                          type="text"
                        />
                      </Dropdown>
                    </div>
                  );
                })}
                {metricFieldKeys.length === 0
                  ? <div className="binding-field__empty">从右侧数据栏双击或拖入字段</div>
                  : <div className="binding-field__data-panel-hint">从右侧数据栏双击或拖入字段{slot.multiple ? "，添加指标" : "，更换字段"}</div>}
                {datasetId !== undefined && <div className="metric-binding-list__calculated-actions">
                  <Button icon={<CalculatorOutlined />} size="small" type="link" onClick={() => setCalculatedMetricSlot({ key: slot.key, multiple: slot.multiple })}>新建计算指标</Button>
                </div>}
              </div>
            ) : isDimensionSlot ? (
              <div className="dimension-binding-list">
                {dimensionFieldKeys.map((fieldKey) => {
                  const fieldLabel = fields.find((field) => field.key === fieldKey)?.label ?? fieldKey;
                  return (
                    <div className="dimension-binding-item" key={fieldKey}>
                      <TagOutlined className="dimension-binding-item__kind" aria-hidden="true" />
                      <span className="dimension-binding-item__name">{fieldLabel}</span>
                      <Dropdown
                        menu={{
                          items: [{ key: "remove", danger: true, label: "移除维度" }],
                          onClick: ({ domEvent }) => {
                            domEvent.stopPropagation();
                            updateSlot(
                              slot.key,
                              slot.multiple ? dimensionFieldKeys.filter((key) => key !== fieldKey) : undefined,
                              slot.multiple,
                            );
                          },
                        }}
                        trigger={["click"]}
                      >
                        <Button
                          aria-label={`${fieldLabel}更多操作`}
                          className="dimension-binding-item__action"
                          icon={<MoreOutlined />}
                          size="small"
                          type="text"
                        />
                      </Dropdown>
                    </div>
                  );
                })}
                {dimensionFieldKeys.length === 0
                  ? <div className="binding-field__empty">从右侧数据栏双击或拖入字段</div>
                  : <div className="binding-field__data-panel-hint">从右侧数据栏双击或拖入字段{slot.multiple ? "，添加字段" : "，更换字段"}</div>}
              </div>
            ) : null}
          </div>
        );
      })}

      {!compact && currentComponent.type === "ranking" && rankingMeasures.length > 1 && (
        <div className="binding-field">
          <BindingFieldLabel label="排序计算" help="综合加权会直接按“指标值 × 权重”求和。例如订单数 30%、访客数 70%，结果为订单数 × 0.3 + 访客数 × 0.7。" />
          <Select
            aria-label="排序计算"
            options={[
              { label: `按主指标排序（当前：${primaryRankingMeasureLabel}）`, value: "primary" },
              { label: "按综合加权得分排序", value: "weighted" },
            ]}
            style={{ width: "100%" }}
            value={rankingMode}
            onChange={(nextMode: "primary" | "weighted") => updateRankingProps({ rankingMode: nextMode })}
          />
          <Space orientation="vertical" size="small" style={{ width: "100%", marginTop: 12 }}>
            {rankingMode === "primary" && <Typography.Text type="warning">填写任一权重后，会自动切换为综合加权排序。</Typography.Text>}
            <Typography.Text type="secondary">权重以百分比填写，建议合计为 100%。结果按各指标原始数值 × 权重直接求和。</Typography.Text>
            {rankingMeasures.map((fieldKey) => {
              const field = fields.find((candidate) => candidate.key === fieldKey);
              const weight = metricWeights[fieldKey];
              return (
                <div key={fieldKey} className="binding-field__inline-control">
                  <Typography.Text>{field?.label ?? fieldKey}</Typography.Text>
                  <InputNumber
                    aria-label={`${field?.label ?? fieldKey}权重`}
                    min={0}
                    max={100}
                    step={1}
                    addonAfter="%"
                    style={{ width: 132 }}
                    value={typeof weight === "number" && Number.isFinite(weight) ? weight : defaultMetricWeight}
                    onChange={(nextWeight) => updateRankingWeight(fieldKey, nextWeight)}
                  />
                </div>
              );
            })}
            <Typography.Text type={Math.abs(metricWeightTotal - 100) < 0.001 ? "secondary" : "warning"}>
              当前权重合计：{metricWeightTotal.toFixed(1).replace(/\.0$/, "")}%
            </Typography.Text>
          </Space>
        </div>
      )}

      <CalculatedMetricDrawer
        fields={sourceFields}
        initialMetric={calculatedMetricSlot?.editingMetric}
        open={calculatedMetricSlot !== null}
        onClose={() => setCalculatedMetricSlot(null)}
        onSave={saveCalculatedMetric}
      />

      {!compact && showTimeGranularity && (
        <div className="binding-field">
          <BindingFieldLabel label="时间粒度" help="选择日期字段向上聚合的时间单位，例如按天、按月或按季度查看。日期字段仍然使用天级原始日期。" />
          <Select
            aria-label="时间粒度"
            options={timeGranularityOptions}
            style={{ width: "100%" }}
            value={timeGranularityValue}
            onChange={updateTimeGranularity}
          />
        </div>
      )}

      {!compact && currentComponent.type !== "ranking" && <>
        <div className="binding-field">
          <BindingFieldLabel label="排序字段" help="按选定字段排序后再交给图表展示；不选择时保留数据源原有顺序。" />
          <Select
            allowClear
            aria-label="排序字段"
            disabled={datasetId === undefined || schema.data === undefined}
            options={fields.map((field) => ({ label: field.label, value: field.key }))}
            placeholder="不排序"
            style={{ width: "100%" }}
            value={binding?.sort?.fieldKey}
            onChange={(fieldKey: string | undefined) => updateSortField(fieldKey)}
          />
        </div>

        <div className="binding-field">
          <BindingFieldLabel label="排序方式" help="升序会从小到大（或从早到晚）展示；降序则相反。" />
          <Select
            aria-label="排序方式"
            disabled={binding?.sort === undefined}
            options={[
              { label: "降序", value: "desc" },
              { label: "升序", value: "asc" },
            ]}
            style={{ width: "100%" }}
            value={binding?.sort?.direction ?? "desc"}
            onChange={(direction: "asc" | "desc") => updateSortDirection(direction)}
          />
        </div>

        <div className="binding-field">
          <BindingFieldLabel label="Top N" help="只保留排序后的前 N 条数据；清空后展示全部数据。" />
          <InputNumber
            aria-label="Top N"
            disabled={binding === undefined}
            min={1}
            max={10_000}
            placeholder="展示全部"
            style={{ width: "100%" }}
            value={draftTopN}
            onChange={setDraftTopN}
            onBlur={() => updateLimit(draftTopN)}
            onPressEnter={() => updateLimit(draftTopN)}
          />
        </div>
      </>}

      {!compact && supportsResultLimit && (
        <div className="binding-panel__result-limit">
          <Typography.Text>结果展示</Typography.Text>
          <InputNumber
            aria-label="结果展示"
            min={1}
            max={MAX_CHART_RESULT_LIMIT}
            precision={0}
            value={draftResultLimit}
            onChange={setDraftResultLimit}
            onBlur={() => updateResultLimit(draftResultLimit)}
            onPressEnter={() => updateResultLimit(draftResultLimit)}
          />
        </div>
      )}
      {(!compact || showRefreshButton) && <div className="binding-panel__footer">
        <Button aria-label="更新" block type="primary" disabled={!canRefresh} onClick={refreshData}>更新</Button>
      </div>}
    </Space>
  );
};
