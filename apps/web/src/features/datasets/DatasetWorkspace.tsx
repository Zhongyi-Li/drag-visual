import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Card, Select, Space, Spin, Tag, Typography } from "antd";
import { useState } from "react";

import { DataPreview } from "./DataPreview.js";
import { getDataset, listDatasets, queryDataset } from "./datasetApi.js";
import { ParameterForm } from "./ParameterForm.js";

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : "未知错误";

export const DatasetWorkspace = () => {
  const [datasetId, setDatasetId] = useState<string>();
  const datasets = useQuery({ queryKey: ["datasets"], queryFn: () => listDatasets() });
  const schema = useQuery({
    queryKey: ["datasets", datasetId, "schema"],
    queryFn: () => getDataset(datasetId!),
    enabled: datasetId !== undefined,
  });
  const query = useMutation({
    mutationFn: (parameters: Record<string, string | number | boolean>) => queryDataset(datasetId!, parameters),
  });

  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <Typography.Title level={3}>数据集</Typography.Title>
      {datasets.isError && <Alert type="error" showIcon message="加载数据集失败" description={errorMessage(datasets.error)} />}
      <Select
        aria-label="数据集"
        loading={datasets.isLoading}
        options={datasets.data?.map((dataset) => ({ label: dataset.name, value: dataset.id })) ?? []}
        placeholder="选择数据集"
        style={{ width: 280 }}
        value={datasetId}
        onChange={(value) => {
          setDatasetId(value);
          query.reset();
        }}
      />

      {schema.isLoading && <Spin />}
      {schema.isError && <Alert type="error" showIcon message="加载 Schema 失败" description={errorMessage(schema.error)} />}
      {schema.data !== undefined && (
        <>
          <Card title="字段">
            <ul aria-label="字段列表">
              {schema.data.fields.map((field) => (
                <li key={field.key}>
                  <Space>
                    <Typography.Text>{field.label}</Typography.Text>
                    <Typography.Text type="secondary">{field.key}</Typography.Text>
                    <Tag>{field.type}</Tag>
                    {field.nullable && <Tag>nullable</Tag>}
                  </Space>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="查询参数">
            <ParameterForm
              key={`${schema.data.id}:${schema.data.schemaVersion}`}
              parameters={schema.data.parameters}
              submitting={query.isPending}
              onSubmit={(parameters) => query.mutate(parameters)}
            />
          </Card>
        </>
      )}

      {query.isError && <Alert type="error" showIcon message="查询数据失败" description={errorMessage(query.error)} />}
      {query.data !== undefined && <Card title="数据预览"><DataPreview result={query.data} /></Card>}
    </Space>
  );
};
