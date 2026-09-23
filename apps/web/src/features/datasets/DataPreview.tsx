import type { DatasetQueryResult } from "@drag-visual/contracts";
import { Alert, Space, Table, Typography, type TableColumnsType } from "antd";
import { useEffect, useState } from "react";

const DEFAULT_PAGE_SIZE = 20;
const previewColumnWidth = (label: string): number => Math.max(128, Math.min(260, label.length * 16 + 48));

export const validatePreviewRows = (result: DatasetQueryResult): string[] => {
  const messages: string[] = [];
  result.rows.forEach((row, rowIndex) => {
    result.columns.forEach((column) => {
      if (row[column.key] === null && !column.nullable) {
        messages.push(`Row ${rowIndex + 1} column "${column.key}" is null but the column is not nullable`);
      }
    });
  });
  return messages;
};

export interface DataPreviewProps {
  readonly result: DatasetQueryResult;
  readonly scrollY?: number | string;
}

export const DataPreview = ({ result, scrollY }: DataPreviewProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  useEffect(() => setPage(1), [result]);
  const messages = validatePreviewRows(result);
  if (messages.length > 0) {
    return <Alert type="error" showIcon message="数据预览无效" description={messages.join("; ")} />;
  }

  const columns: TableColumnsType<DatasetQueryResult["rows"][number]> = result.columns.map((column) => ({
    key: column.key,
    dataIndex: column.key,
    title: column.label,
    width: previewColumnWidth(column.label),
    onHeaderCell: () => ({ style: { whiteSpace: "nowrap" } }),
    onCell: () => ({ style: { whiteSpace: "nowrap" } }),
    render: (value: unknown) => value === null ? "—" : String(value),
  }));
  const rowKeys = new Map(result.rows.map((row, index) => [row, String(index)]));

  return (
    <Space orientation="vertical" style={{ width: "100%" }}>
      {result.warnings?.map((warning) => <Alert key={warning} type="warning" showIcon message="数据整合提示" description={warning} />)}
      <Typography.Text type="secondary">
        共 {result.rows.length} 行，当前显示第 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, result.rows.length)} 行
      </Typography.Text>
      <Table
        data-testid="data-preview-table"
        className="data-preview-table"
        columns={columns}
        dataSource={result.rows}
        pagination={{
          current: page,
          pageSize,
          total: result.rows.length,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 行`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPageSize !== pageSize ? 1 : nextPage);
            setPageSize(nextPageSize);
          },
        }}
        rowKey={(row) => rowKeys.get(row) ?? "unknown"}
        size="small"
        tableLayout="auto"
        scroll={{ x: "max-content", ...(scrollY === undefined ? {} : { y: scrollY }) }}
      />
    </Space>
  );
};
