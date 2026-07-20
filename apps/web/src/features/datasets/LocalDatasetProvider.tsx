import {
  Dataset,
  DatasetQueryResult,
  type Dataset as DatasetValue,
  type DatasetField,
  type DatasetQueryResult as DatasetQueryResultValue,
  type DatasetSummary as DatasetSummaryValue,
} from "@drag-visual/contracts";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import type { ImportedDataset } from "./fileImport.js";

interface LocalDatasetRecord extends ImportedDataset {}

type FieldUpdate = Partial<Pick<DatasetField, "label" | "type">>;

interface LocalDatasetContextValue {
  readonly summaries: readonly DatasetSummaryValue[];
  readonly addDataset: (dataset: ImportedDataset) => void;
  readonly renameDataset: (datasetId: string, name: string) => void;
  readonly deleteDataset: (datasetId: string) => void;
  readonly replaceDataset: (datasetId: string, dataset: ImportedDataset) => void;
  readonly updateField: (datasetId: string, fieldKey: string, update: FieldUpdate) => void;
  readonly getDataset: (datasetId: string) => DatasetValue | undefined;
  readonly queryDataset: (datasetId: string) => DatasetQueryResultValue | undefined;
}

const LocalDatasetContext = createContext<LocalDatasetContextValue | null>(null);

interface LocalDatasetProviderProps {
  readonly children: ReactNode;
}

const STORAGE_KEY = "drag-visual.local-datasets.v1";

const canUseLocalStorage = (): boolean => typeof window !== "undefined" && "localStorage" in window;

const parseRecord = (value: unknown): LocalDatasetRecord | null => {
  if (typeof value !== "object" || value === null || !("schema" in value) || !("result" in value)) return null;
  const schema = Dataset.safeParse(value.schema);
  const result = DatasetQueryResult.safeParse(value.result);
  if (!schema.success || !result.success) return null;
  return { schema: schema.data, result: result.data };
};

const loadStoredDatasets = (): ReadonlyMap<string, LocalDatasetRecord> => {
  if (!canUseLocalStorage()) return new Map();
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return new Map();
    return new Map(parsed
      .map(parseRecord)
      .filter((record): record is LocalDatasetRecord => record !== null)
      .map((record) => [record.schema.id, record]));
  } catch {
    return new Map();
  }
};

const persistDatasets = (datasets: ReadonlyMap<string, LocalDatasetRecord>): void => {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(datasets.values())));
};

const normalizeDataset = (dataset: ImportedDataset): LocalDatasetRecord => {
  const schema = Dataset.parse(dataset.schema);
  const result = DatasetQueryResult.parse({
    ...dataset.result,
    columns: schema.fields,
  });
  return { schema, result };
};

const coerceFieldValue = (value: unknown, type: DatasetField["type"]): string | number | boolean | null => {
  if (value === null || value === undefined || value === "") return null;
  if (type === "number") {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
  }
  return String(value);
};

const updateDatasetField = (
  record: LocalDatasetRecord,
  fieldKey: string,
  update: FieldUpdate,
): LocalDatasetRecord => {
  const field = record.schema.fields.find((candidate) => candidate.key === fieldKey);
  if (field === undefined) return record;
  const nextType = update.type ?? field.type;
  const rows: DatasetQueryResultValue["rows"] = record.result.rows.map((row) => {
    const nextRow: DatasetQueryResultValue["rows"][number] = { ...row };
    nextRow[fieldKey] = update.type === undefined ? row[fieldKey] ?? null : coerceFieldValue(row[fieldKey], nextType);
    return nextRow;
  });
  const nullable = rows.some((row) => row[fieldKey] === null);
  const fields = record.schema.fields.map((candidate) => candidate.key === fieldKey
    ? {
        ...candidate,
        label: update.label?.trim() || candidate.label,
        type: nextType,
        nullable,
      }
    : candidate);
  return normalizeDataset({
    schema: {
      ...record.schema,
      fields,
      schemaVersion: `local-${Date.now()}`,
    },
    result: {
      ...record.result,
      columns: fields,
      rows,
    },
  });
};

export const LocalDatasetProvider = ({ children }: LocalDatasetProviderProps) => {
  const [datasets, setDatasets] = useState<ReadonlyMap<string, LocalDatasetRecord>>(loadStoredDatasets);

  useEffect(() => {
    persistDatasets(datasets);
  }, [datasets]);

  const value = useMemo<LocalDatasetContextValue>(() => ({
    summaries: Array.from(datasets.values()).map(({ schema }) => ({
      id: schema.id,
      name: schema.name,
      schemaVersion: schema.schemaVersion,
    })),
    addDataset: (dataset) => {
      setDatasets((current) => {
        const next = new Map(current);
        const normalized = normalizeDataset(dataset);
        next.set(normalized.schema.id, normalized);
        return next;
      });
    },
    renameDataset: (datasetId, name) => {
      const nextName = name.trim();
      if (nextName.length === 0) return;
      setDatasets((current) => {
        const record = current.get(datasetId);
        if (record === undefined) return current;
        const next = new Map(current);
        next.set(datasetId, normalizeDataset({
          ...record,
          schema: { ...record.schema, name: nextName },
        }));
        return next;
      });
    },
    deleteDataset: (datasetId) => {
      setDatasets((current) => {
        if (!current.has(datasetId)) return current;
        const next = new Map(current);
        next.delete(datasetId);
        return next;
      });
    },
    replaceDataset: (datasetId, dataset) => {
      setDatasets((current) => {
        const currentRecord = current.get(datasetId);
        const normalized = normalizeDataset(dataset);
        const nextRecord = normalizeDataset({
          schema: {
            ...normalized.schema,
            id: datasetId,
            name: currentRecord?.schema.name ?? normalized.schema.name,
          },
          result: normalized.result,
        });
        const next = new Map(current);
        next.set(datasetId, nextRecord);
        return next;
      });
    },
    updateField: (datasetId, fieldKey, update) => {
      setDatasets((current) => {
        const record = current.get(datasetId);
        if (record === undefined) return current;
        const next = new Map(current);
        next.set(datasetId, updateDatasetField(record, fieldKey, update));
        return next;
      });
    },
    getDataset: (datasetId) => datasets.get(datasetId)?.schema,
    queryDataset: (datasetId) => datasets.get(datasetId)?.result,
  }), [datasets]);

  return (
    <LocalDatasetContext.Provider value={value}>
      {children}
    </LocalDatasetContext.Provider>
  );
};

export const useLocalDatasets = (): LocalDatasetContextValue => {
  const value = useContext(LocalDatasetContext);
  if (value === null) throw new Error("LocalDatasetProvider is missing");
  return value;
};
