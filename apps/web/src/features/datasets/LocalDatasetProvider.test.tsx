// @vitest-environment jsdom

import type { DatasetField } from "@drag-visual/contracts";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import type { ImportedDataset } from "./fileImport.js";
import { LocalDatasetProvider, useLocalDatasets } from "./LocalDatasetProvider.js";

const storageKey = "drag-visual.local-datasets.v1";

const fields: DatasetField[] = [
  { key: "month", label: "月份", type: "string", nullable: false },
  { key: "revenue", label: "收入", type: "number", nullable: false },
];

const importedDataset = (overrides: Partial<ImportedDataset["schema"]> = {}): ImportedDataset => ({
  schema: {
    id: "local-sales",
    name: "销售导入",
    fields,
    parameters: [],
    schemaVersion: "file-1",
    ...overrides,
  },
  result: {
    columns: overrides.fields ?? fields,
    rows: [{ month: "1月", revenue: 120000 }],
    total: 1,
    sampledAt: "2026-07-07T08:00:00.000Z",
  },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <LocalDatasetProvider>{children}</LocalDatasetProvider>
);

describe("LocalDatasetProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists imported datasets and restores them for a new provider", () => {
    const first = renderHook(() => useLocalDatasets(), { wrapper });

    act(() => first.result.current.addDataset(importedDataset()));

    expect(JSON.parse(localStorage.getItem(storageKey) ?? "[]")).toHaveLength(1);

    const second = renderHook(() => useLocalDatasets(), { wrapper });
    expect(second.result.current.summaries).toEqual([
      { id: "local-sales", name: "销售导入", schemaVersion: "file-1" },
    ]);
    expect(second.result.current.queryDataset("local-sales")?.rows).toEqual([
      { month: "1月", revenue: 120000 },
    ]);
  });

  it("renames, deletes, replaces, and updates field metadata", () => {
    const { result } = renderHook(() => useLocalDatasets(), { wrapper });
    act(() => result.current.addDataset(importedDataset()));

    act(() => result.current.renameDataset("local-sales", "运营销售"));
    expect(result.current.getDataset("local-sales")?.name).toBe("运营销售");

    act(() => result.current.updateField("local-sales", "revenue", { label: "成交额", type: "string" }));
    expect(result.current.getDataset("local-sales")?.fields[1]).toMatchObject({
      key: "revenue",
      label: "成交额",
      type: "string",
      nullable: false,
    });
    expect(result.current.queryDataset("local-sales")?.rows[0]).toEqual({ month: "1月", revenue: "120000" });

    act(() => result.current.replaceDataset("local-sales", importedDataset({
      id: "ignored-new-id",
      name: "替换文件",
      fields: [
        { key: "month", label: "月份", type: "string", nullable: false },
        { key: "revenue", label: "收入", type: "number", nullable: false },
        { key: "quantity", label: "数量", type: "number", nullable: false },
      ],
      schemaVersion: "file-2",
    })));
    expect(result.current.getDataset("local-sales")).toMatchObject({
      id: "local-sales",
      name: "运营销售",
      schemaVersion: "file-2",
    });
    expect(result.current.getDataset("local-sales")?.fields).toHaveLength(3);

    act(() => result.current.deleteDataset("local-sales"));
    expect(result.current.summaries).toEqual([]);
    expect(result.current.getDataset("local-sales")).toBeUndefined();
  });

  it("ignores invalid stored datasets instead of crashing", () => {
    localStorage.setItem(storageKey, JSON.stringify([{ schema: { id: "", name: "" }, result: {} }]));

    const { result } = renderHook(() => useLocalDatasets(), { wrapper });

    expect(result.current.summaries).toEqual([]);
  });
});
