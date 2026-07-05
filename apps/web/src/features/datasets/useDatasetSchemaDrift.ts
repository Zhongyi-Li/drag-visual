import type { ComponentRegistry } from "@drag-visual/component-registry";
import type { Dashboard, Dataset } from "@drag-visual/contracts";

export interface DatasetSchemaDrift {
  readonly componentId: string;
  readonly datasetId: string;
  readonly messages: readonly string[];
}

export const detectDatasetSchemaDrift = (
  dashboard: Dashboard,
  currentDatasets: ReadonlyMap<string, Dataset>,
  registry: ComponentRegistry,
): DatasetSchemaDrift[] => {
  const savedDatasetRefs = new Map(dashboard.datasets.map((dataset) => [dataset.datasetId, dataset]));
  const results: DatasetSchemaDrift[] = [];

  for (const component of dashboard.components) {
    const binding = component.binding;
    if (!binding) continue;
    const currentDataset = currentDatasets.get(binding.datasetId);
    if (!currentDataset) {
      results.push({
        componentId: component.id,
        datasetId: binding.datasetId,
        messages: [`数据集 ${binding.datasetId} 已不存在`],
      });
      continue;
    }

    const messages: string[] = [];
    const savedRef = savedDatasetRefs.get(binding.datasetId);
    if (savedRef && savedRef.schemaVersion !== currentDataset.schemaVersion) {
      messages.push(`数据集 ${binding.datasetId} 已从 ${savedRef.schemaVersion} 更新到 ${currentDataset.schemaVersion}`);
    }
    const definition = registry.get(component.type);
    const fieldsByKey = new Map(currentDataset.fields.map((field) => [field.key, field]));
    for (const slot of definition.dataSlots) {
      const value = binding.slots[slot.key];
      const boundFields = value === undefined ? [] : Array.isArray(value) ? value : [value];
      if (slot.required && boundFields.length === 0) messages.push(`${slot.title}为必填项`);
      if (!slot.multiple && boundFields.length > 1) messages.push(`${slot.title}只能绑定一个字段`);
      for (const fieldBinding of boundFields) {
        const field = fieldsByKey.get(fieldBinding.fieldKey);
        if (!field) messages.push(`字段 ${fieldBinding.fieldKey} 已不存在`);
        else if (!slot.acceptedTypes.includes(field.type)) messages.push(`${field.label}不能绑定到${slot.title}`);
      }
    }

    if (messages.length > 0) {
      results.push({
        componentId: component.id,
        datasetId: binding.datasetId,
        messages,
      });
    }
  }

  return results;
};
