import type { ComponentDefinition } from "@drag-visual/component-registry";
import type { ComponentType, DataBinding, Dataset, QueryParameter } from "@drag-visual/contracts";
import { validateBinding } from "@drag-visual/data-engine";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Select, Space, Spin, Typography } from "antd";
import { useState } from "react";
import { useStore } from "zustand";

import { getDataset, listDatasets } from "../datasets/datasetApi.js";
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
  readonly binding?: StoredBinding | undefined;
}

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : "未知错误";

const isSlotArray = (value: StoredSlotValue): value is readonly { readonly fieldKey: string }[] => Array.isArray(value);

const toBindableComponent = (component: BindableComponent): BindableComponent => ({
  id: component.id,
  type: component.type,
  ...(component.title !== undefined ? { title: component.title } : {}),
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

export const ComponentBindingPanel = ({ store, component, definition }: ComponentBindingPanelProps) => {
  const queryClient = useQueryClient();
  const [selectionError, setSelectionError] = useState<unknown>(null);
  const [selectingDatasetId, setSelectingDatasetId] = useState<string | null>(null);
  const storedComponent = useStore(store, (state) =>
    state.history.present.components.find((candidate) => candidate.id === component.id),
  );
  const currentComponent = toBindableComponent(storedComponent ?? component);
  const binding = currentComponent.binding;
  const datasetId = binding?.datasetId;
  const datasets = useQuery({ queryKey: ["datasets"], queryFn: () => listDatasets() });
  const schema = useQuery({
    queryKey: ["datasets", datasetId, "schema"],
    queryFn: () => getDataset(datasetId!),
    enabled: datasetId !== undefined,
  });

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

  const fields = schema.data?.fields ?? [];
  const validation = schema.data && binding
    ? validateBinding(cloneBinding(binding), schema.data.fields, definition.dataSlots)
    : null;

  return (
    <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
      {datasets.isError && <Alert type="error" showIcon title="加载数据集失败" description={errorMessage(datasets.error)} />}
      <Select
        aria-label="数据集"
        loading={datasets.isLoading}
        options={datasets.data?.map((dataset) => ({ label: dataset.name, value: dataset.id })) ?? []}
        placeholder="选择数据集"
        style={{ width: "100%" }}
        {...(datasetId !== undefined ? { value: datasetId } : {})}
        onChange={async (nextDatasetId: string) => {
          setSelectingDatasetId(nextDatasetId);
          setSelectionError(null);
          try {
            const dataset = await queryClient.fetchQuery({
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

      {definition.dataSlots.map((slot) => {
        const value = selectedKeys(binding, slot.key, slot.multiple);
        return (
          <Select
            key={slot.key}
            aria-label={slot.title}
            allowClear={!slot.required}
            disabled={datasetId === undefined || schema.data === undefined}
            {...(slot.multiple ? { mode: "multiple" as const } : {})}
            options={fields
              .filter((field) => slot.acceptedTypes.includes(field.type))
              .map((field) => ({ label: field.label, value: field.key }))}
            placeholder={`选择${slot.title}`}
            style={{ width: "100%" }}
            {...(value !== undefined ? { value } : {})}
            onChange={(nextValue) => updateSlot(slot.key, nextValue, slot.multiple)}
          />
        );
      })}

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
      <Typography.Text type="secondary">数据绑定会保存到当前组件。</Typography.Text>
    </Space>
  );
};
