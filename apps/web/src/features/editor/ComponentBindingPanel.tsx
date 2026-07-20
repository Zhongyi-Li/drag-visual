import { QuestionCircleOutlined } from "@ant-design/icons";
import type { ComponentDefinition } from "@drag-visual/component-registry";
import type { ComponentType, DataBinding, Dataset, DatasetField, QueryParameter } from "@drag-visual/contracts";
import { validateBinding } from "@drag-visual/data-engine";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Select, Space, Spin, Tooltip, Typography } from "antd";
import { useState } from "react";
import { useStore } from "zustand";

import { getDataset, listDatasets } from "../datasets/datasetApi.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
import type { EditorStore } from "./store/editorStore.js";

interface ComponentBindingPanelProps {
  readonly store: EditorStore;
  readonly component: BindableComponent;
  readonly definition: ComponentDefinition;
}

type StoredSlotValue = { readonly fieldKey: string } | readonly { readonly fieldKey: string }[];
interface StoredBinding {
  readonly datasetId: string;
  readonly slots: Readonly<Record<string, StoredSlotValue>>;
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

const isSlotArray = (value: StoredSlotValue): value is readonly { readonly fieldKey: string }[] => Array.isArray(value);

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
      .filter((parameter) => parameter.required)
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
        return [key, slotValue.map((field) => ({ fieldKey: field.fieldKey }))];
      }
      return [key, { fieldKey: slotValue.fieldKey }];
    }),
  )
);

const cloneBinding = (binding: StoredBinding): DataBinding => {
  const cloned: DataBinding = {
    datasetId: binding.datasetId,
    slots: cloneSlots(binding.slots),
  };
  if (binding.sort !== undefined) cloned.sort = { ...binding.sort };
  if (binding.limit !== undefined) cloned.limit = binding.limit;
  return cloned;
};

const slotHelpText = (slotKey: string, slotTitle: string, componentType: ComponentType): string => {
  if (componentType === "metricTrend" && slotKey === "timeDimension") return "作为指标趋势的时间或分类横轴，可选择天级日期，也可选择已整理好的年、季度、月、周、日等维度字段。";
  if (slotKey === "timeDimension") return "作为趋势分析的基础日期字段，只支持天级日期，系统会按时间粒度聚合为周、月、季度或年。";
  if (slotKey === "dateDimension") return "作为时间分析的基础日期字段，只支持天级日期，系统会按时间粒度聚合为周、月、季度或年。";
  if (slotKey === "dimensions") return "作为多维分析的分组层级，可选择地区、品类、渠道等多个分类字段。";
  if (slotKey === "measures") return "作为多维分析要汇总的数值指标，可选择销售额、订单数、访客数等多个指标。";
  if (componentType === "bar" && slotKey === "measure") return "可选择一个或多个数值指标；多个指标会按同一维度并列展示为多组柱。";
  if (componentType === "kpi" && slotKey === "measure") return "作为指标看板展示的数值字段，可多选收入、目标、同期、订单等指标。第一项会作为主指标展示。";
  if (componentType === "flipNumber" && slotKey === "measure") return "作为翻牌器展示的多个数值指标，每个指标会生成一张翻牌卡。";
  if (componentType === "progressBar" && slotKey === "measure") return "作为进度条展示的多个数值指标，每个指标会生成一条进度。";
  if (componentType === "progressBar" && slotKey === "target") return "可选目标值字段，会按顺序与指标配对；不选择时目标默认等于实际值。";
  if (componentType === "sunburst" && slotKey === "measure") return "可选择多个指标。图表默认展示第一项，可在图表右上角切换当前展示的指标。";
  if (componentType === "radar" && slotKey === "measure") return "可选择多个指标。每个指标会作为一块半透明面积，围绕同一组维度进行比较。";
  if (componentType === "treemap" && slotKey === "measure") return "可选择多个指标。图表默认展示第一项，可在图表右上角切换当前展示的指标；系统按维度汇总后，用矩形面积和百分比展示占比。";
  if ((componentType === "pie" || componentType === "rose") && slotKey === "measure") return "可选择多个指标。第一项决定扇区角度或玫瑰半径；鼠标悬浮扇区时会展示全部已选指标。";
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
): ComponentDefinition["dataSlots"] => {
  if (componentType !== "kpi") return definition.dataSlots;
  return definition.dataSlots.filter((slot) =>
    slot.key !== "target" && slot.key !== "comparison" && slot.key !== "secondaryMeasures");
};

export const fieldOptionsForSlot = (
  fields: readonly DatasetField[],
  slot: ComponentDefinition["dataSlots"][number],
): { readonly label: string; readonly value: string }[] =>
  fields
    .filter((field) => slot.acceptedTypes.includes(field.type))
    .map((field) => ({ label: field.label, value: field.key }));

const BindingFieldLabel = ({ label, help }: { readonly label: string; readonly help: string }) => (
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

export const ComponentBindingPanel = ({ store, component, definition }: ComponentBindingPanelProps) => {
  const queryClient = useQueryClient();
  const localDatasets = useLocalDatasets();
  const [selectionError, setSelectionError] = useState<unknown>(null);
  const [selectingDatasetId, setSelectingDatasetId] = useState<string | null>(null);
  const storedComponent = useStore(store, (state) =>
    state.history.present.components.find((candidate) => candidate.id === component.id),
  );
  const currentComponent = toBindableComponent(storedComponent ?? component);
  const binding = currentComponent.binding;
  const componentProps = currentComponent.props ?? {};
  const defaultProps = definition.createDefaults();
  const supportsTimeGranularity = isTimeGranularity(componentProps.timeGranularity) || isTimeGranularity(defaultProps.timeGranularity);
  const timeGranularityValue = isTimeGranularity(componentProps.timeGranularity)
    ? componentProps.timeGranularity
    : isTimeGranularity(defaultProps.timeGranularity)
      ? defaultProps.timeGranularity
      : "day";
  const datasetId = binding?.datasetId;
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
      else nextSlots[slotKey] = values.map((fieldKey) => ({ fieldKey }));
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

  const updateTimeGranularity = (timeGranularity: string) => {
    store.getState().dispatch({
      type: "component.props.update",
      componentId: component.id,
      nextProps: { ...componentProps, timeGranularity },
    });
  };

  const fields = schema.data?.fields ?? [];
  const validation = schema.data && binding
    ? validateBinding(cloneBinding(binding), schema.data.fields, definition.dataSlots)
    : null;

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      {showDatasetListError && <Alert type="error" showIcon title="加载数据集失败" description={errorMessage(datasets.error)} />}
      <div className="binding-field">
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
      </div>

      {(schema.isLoading || selectingDatasetId !== null) && <Spin />}
      {(schema.isError || selectionError !== null) && (
        <Alert
          type="error"
          showIcon
          title="加载 Schema 失败"
          description={errorMessage(selectionError ?? schema.error)}
        />
      )}
      {validation !== null && !validation.valid && (
        <Alert
          type="warning"
          showIcon
          title="数据绑定需要检查"
          description={validation.messages.map((message) => formatValidationMessage(message, definition)).join("；")}
        />
      )}

      {visibleDataSlots(definition, currentComponent.type).map((slot) => {
        const value = selectedKeys(binding, slot.key, slot.multiple);
        return (
          <div className="binding-field" key={slot.key}>
            <BindingFieldLabel label={slot.title} help={slotHelpText(slot.key, slot.title, currentComponent.type)} />
            <Select
              aria-label={slot.title}
              allowClear={!slot.required}
              disabled={datasetId === undefined || schema.data === undefined}
              {...(slot.multiple ? { mode: "multiple" as const } : {})}
              options={fieldOptionsForSlot(fields, slot)}
              placeholder={`选择${slot.title}`}
              style={{ width: "100%" }}
              {...(value !== undefined ? { value } : {})}
              onChange={(nextValue) => updateSlot(slot.key, nextValue, slot.multiple)}
            />
          </div>
        );
      })}

      {supportsTimeGranularity && (
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

      <div className="binding-field">
        <div className="binding-field__action-row">
          <Button
            block
            disabled={binding === undefined}
            onClick={() => {
              store.getState().dispatch({
                type: "component.binding.update",
                componentId: component.id,
                nextBinding: undefined,
              });
            }}
          >
            清除数据绑定
          </Button>
          <Tooltip title="移除当前组件的数据集和字段选择，图表会回到未绑定数据的状态。" placement="topRight">
            <Button
              type="text"
              size="small"
              className="binding-field__help"
              aria-label="清除数据绑定说明"
              icon={<QuestionCircleOutlined />}
            />
          </Tooltip>
        </div>
      </div>
      <Typography.Text type="secondary">数据绑定会保存到当前组件。</Typography.Text>
    </Space>
  );
};
