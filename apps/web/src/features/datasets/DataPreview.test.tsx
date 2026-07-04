// @vitest-environment jsdom

import type { DatasetQueryResult } from "@drag-visual/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataPreview, validatePreviewRows } from "./DataPreview.js";

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
  it("renders only the first 100 rows and labels truncation", () => {
    render(<DataPreview result={result} />);
    expect(screen.getByText("仅显示前 100 行，共 101 行")).toBeInTheDocument();
    expect(screen.getByText("row-99")).toBeInTheDocument();
    expect(screen.queryByText("row-100")).not.toBeInTheDocument();
  });

  it("accepts null only for nullable columns", () => {
    expect(validatePreviewRows(result)).toEqual([]);
    expect(validatePreviewRows({
      ...result,
      rows: [{ name: null, amount: 1 }],
    })).toEqual(['Row 1 column "name" is null but the column is not nullable']);
  });
});
