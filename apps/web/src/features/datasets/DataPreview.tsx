import type { DatasetQueryResult } from "@drag-visual/contracts";
import { Alert, Space, Table, Typography, type TableColumnsType } from "antd";

const PREVIEW_LIMIT = 100;

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
}

export const DataPreview = ({ result }: DataPreviewProps) => {
  const messages = validatePreviewRows(result);
  if (messages.length > 0) {
    return <Alert type="error" showIcon message="数据预览无效" description={messages.join("; ")} />;
  }

  const columns: TableColumnsType<DatasetQueryResult["rows"][number]> = result.columns.map((column) => ({
    key: column.key,
    dataIndex: column.key,
    title: column.label,
    render: (value: unknown) => value === null ? "—" : String(value),
  }));
  const rows = result.rows.slice(0, PREVIEW_LIMIT);
  const rowKeys = new Map(rows.map((row, index) => [row, String(index)]));

  return (
    <Space orientation="vertical" style={{ width: "100%" }}>
      {result.rows.length > PREVIEW_LIMIT && (
        <Typography.Text type="secondary">
          仅显示前 {PREVIEW_LIMIT} 行，共 {result.rows.length} 行
        </Typography.Text>
      )}
      <Table
        columns={columns}
        dataSource={rows}
        pagination={false}
        rowKey={(row) => rowKeys.get(row) ?? "unknown"}
        size="small"
      />
    </Space>
  );
};
