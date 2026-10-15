import type { DatasetQueryResult } from "@drag-visual/contracts";
import { Alert, Space, Table, Typography, type TableColumnsType } from "antd";
import { useEffect, useState } from "react";

import "./DataPreview.css";

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

export interface PreviewValidationIssue {
  readonly columnKey: string;
  readonly columnLabel: string;
  readonly rowNumbers: readonly number[];
}

export const summarizePreviewRows = (result: DatasetQueryResult): PreviewValidationIssue[] => result.columns.flatMap((column) => {
  if (column.nullable) return [];
  const rowNumbers = result.rows.flatMap((row, rowIndex) => row[column.key] === null ? [rowIndex + 1] : []);
  return rowNumbers.length === 0 ? [] : [{ columnKey: column.key, columnLabel: column.label, rowNumbers }];
});

const rowNumberSummary = (rowNumbers: readonly number[], limit = 6): string => {
  const visibleRows = rowNumbers.slice(0, limit).join("、");
  const remaining = rowNumbers.length - limit;
  return `第 ${visibleRows} 行${remaining > 0 ? `等 ${rowNumbers.length} 行` : ""}`;
};

const PreviewValidationAlert = ({ result }: { readonly result: DatasetQueryResult }) => {
  const issues = summarizePreviewRows(result);
  const invalidCellCount = issues.reduce((total, issue) => total + issue.rowNumbers.length, 0);
  const affectedRowCount = new Set(issues.flatMap((issue) => issue.rowNumbers)).size;

  return (
    <Alert
      className="data-preview-validation"
      type="error"
      showIcon
      title={`${issues.length} 个必填字段存在空值`}
      description={(
        <div className="data-preview-validation__content">
          <p>共发现 {invalidCellCount} 处空值，影响 {affectedRowCount} 行。请检查数据整合配置或原始数据。</p>
          <ul className="data-preview-validation__issues">
            {issues.map((issue) => (
              <li key={issue.columnKey}>
                <span className="data-preview-validation__field">
                  <strong>{issue.columnLabel}</strong>
                  {issue.columnLabel !== issue.columnKey && <code>{issue.columnKey}</code>}
                </span>
                <span>{rowNumberSummary(issue.rowNumbers)}</span>
                <span className="data-preview-validation__count">{issue.rowNumbers.length} 处</span>
              </li>
            ))}
          </ul>
          <div className="data-preview-validation__hint">
            可将字段设置为允许为空、为空值填写默认值，或检查关联和追加步骤的字段映射。
          </div>
          <details className="data-preview-validation__details">
            <summary>查看全部异常行</summary>
            {issues.map((issue) => (
              <p key={issue.columnKey}>
                <strong>{issue.columnLabel}：</strong>第 {issue.rowNumbers.join("、")} 行
              </p>
            ))}
          </details>
        </div>
      )}
    />
  );
};

export interface DataPreviewProps {
  readonly result: DatasetQueryResult;
  readonly scrollY?: number | string;
}

export const DataPreview = ({ result, scrollY }: DataPreviewProps) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  useEffect(() => setPage(1), [result]);
  const validationIssues = summarizePreviewRows(result);
  if (validationIssues.length > 0) {
    return <PreviewValidationAlert result={result} />;
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
