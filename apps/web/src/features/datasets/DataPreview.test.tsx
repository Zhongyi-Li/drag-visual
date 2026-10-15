// @vitest-environment jsdom

import type { DatasetQueryResult } from "@drag-visual/contracts";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataPreview, summarizePreviewRows, validatePreviewRows } from "./DataPreview.js";

const result: DatasetQueryResult = {
  columns: [
    { key: "name", label: "名称", type: "string", nullable: false },
    { key: "amount", label: "金额", type: "number", nullable: true },
  ],
  rows: Array.from({ length: 101 }, (_, index) => ({ name: `row-${index}`, amount: index === 0 ? null : index })),
  total: 101,
  sampledAt: "2026-07-02T08:00:00.000Z",
};

describe("DataPreview", () => {
  it("renders a paginated preview instead of the full result", () => {
    render(<DataPreview result={result} />);
    expect(screen.getByText("共 101 行，当前显示第 1-20 行")).toBeInTheDocument();
    expect(screen.getByText("row-19")).toBeInTheDocument();
    expect(screen.queryByText("row-20")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Next Page"));
    expect(screen.getByText("row-20")).toBeInTheDocument();
  });

  it("accepts null only for nullable columns", () => {
    expect(validatePreviewRows(result)).toEqual([]);
    expect(validatePreviewRows({
      ...result,
      rows: [{ name: null, amount: 1 }],
    })).toEqual(['Row 1 column "name" is null but the column is not nullable']);
  });

  it("groups invalid cells by field and presents a readable Chinese summary", () => {
    const invalidResult: DatasetQueryResult = {
      ...result,
      rows: [
        { name: null, amount: 1 },
        { name: "有效名称", amount: null },
        { name: null, amount: 3 },
      ],
    };

    expect(summarizePreviewRows(invalidResult)).toEqual([{
      columnKey: "name",
      columnLabel: "名称",
      rowNumbers: [1, 3],
    }]);

    render(<DataPreview result={invalidResult} />);
    expect(screen.getByText("1 个必填字段存在空值")).toBeInTheDocument();
    expect(screen.getByText("共发现 2 处空值，影响 2 行。请检查数据整合配置或原始数据。")).toBeInTheDocument();
    expect(screen.getAllByText("第 1、3 行")).toHaveLength(2);
    expect(screen.getByText("2 处")).toBeInTheDocument();
    expect(screen.queryByText(/column .* is null/)).not.toBeInTheDocument();
  });

  it("keeps wide headers on one line and makes the preview horizontally scrollable", () => {
    render(<DataPreview result={{
      ...result,
      columns: [{ key: "longField", label: "销售关联的成本价格", type: "number", nullable: false }],
      rows: [{ longField: 168.09 }],
    }} />);

    expect(screen.getByRole("columnheader", { name: "销售关联的成本价格" })).toHaveStyle({ whiteSpace: "nowrap" });
    expect(screen.getByTestId("data-preview-table").querySelector(".ant-table-content")).toHaveStyle({ overflowX: "auto" });
  });

  it("shows non-blocking data integration warnings above the result", () => {
    render(<DataPreview result={{ ...result, warnings: ["关联键存在重复值，结果行数可能增加。"] }} />);

    expect(screen.getByText("数据整合提示")).toBeInTheDocument();
    expect(screen.getByText("关联键存在重复值，结果行数可能增加。")).toBeInTheDocument();
  });
});
