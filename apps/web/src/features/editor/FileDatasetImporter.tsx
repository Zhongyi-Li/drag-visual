import { CheckOutlined, CloseOutlined, DatabaseOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import type { DatasetField } from "@drag-visual/contracts";
import { Alert, Button, Card, Empty, Input, Modal, Popconfirm, Select, Space, Table, Tooltip, Typography, type TableColumnsType } from "antd";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { DataPreview } from "../datasets/DataPreview.js";
import { getDataset, listDatasets, queryDataset, uploadDataset } from "../datasets/datasetApi.js";
import { importDatasetFile } from "../datasets/fileImport.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";

const fieldTypeOptions: { label: string; value: DatasetField["type"] }[] = [
  { label: "文本", value: "string" },
  { label: "数值", value: "number" },
  { label: "日期", value: "date" },
  { label: "布尔", value: "boolean" },
];

export const FileDatasetImporter = () => {
  const localDatasets = useLocalDatasets();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDatasetId, setActiveDatasetId] = useState<string | undefined>();
  const [editingDatasetId, setEditingDatasetId] = useState<string | undefined>();
  const [datasetNameDrafts, setDatasetNameDrafts] = useState<Record<string, string>>({});
  const [fieldLabelDrafts, setFieldLabelDrafts] = useState<Record<string, string>>({});

  const remoteDatasets = useQuery({
    queryKey: ["datasets"],
    queryFn: () => listDatasets(),
    enabled: open,
  });
  // Uploaded datasets have an explicit id namespace. Keep platform/interface
  // datasets out of this file-management modal while making persisted uploads
  // visible again after a browser refresh.
  const uploadedRemoteSummaries = (remoteDatasets.data ?? []).filter((dataset) => dataset.id.startsWith("uploaded-"));
  const summaries = Array.from(new Map([
    ...uploadedRemoteSummaries,
    ...localDatasets.summaries,
  ].map((dataset) => [dataset.id, dataset])).values());
  const activeLocalDataset = activeDatasetId === undefined ? undefined : localDatasets.getDataset(activeDatasetId);
  const activeLocalResult = activeDatasetId === undefined ? undefined : localDatasets.queryDataset(activeDatasetId);
  const activeRemoteSchema = useQuery({
    queryKey: ["datasets", activeDatasetId, "schema"],
    queryFn: () => getDataset(activeDatasetId!),
    enabled: open && activeDatasetId !== undefined && activeLocalDataset === undefined,
  });
  const activeRemoteResult = useQuery({
    queryKey: ["datasets", activeDatasetId, "query", "file-management-preview"],
    queryFn: () => queryDataset(activeDatasetId!, {}),
    enabled: open && activeDatasetId !== undefined && activeLocalResult === undefined,
  });
  const activeDataset = activeLocalDataset ?? activeRemoteSchema.data;
  const activeResult = activeLocalResult ?? activeRemoteResult.data;
  const activeIsLegacyLocalDataset = activeDatasetId !== undefined && localDatasets.isUploadedDataset(activeDatasetId);

  useEffect(() => {
    if (activeDatasetId !== undefined && localDatasets.getDataset(activeDatasetId) !== undefined) return;
    if (activeDatasetId !== undefined && summaries.some((dataset) => dataset.id === activeDatasetId)) return;
    setActiveDatasetId(summaries[0]?.id);
  }, [activeDatasetId, localDatasets, summaries]);

  useEffect(() => {
    setEditingDatasetId(undefined);
  }, [activeDatasetId]);

  const beginDatasetNameEdit = () => {
    if (activeDataset === undefined || !activeIsLegacyLocalDataset) return;
    setDatasetNameDrafts((current) => ({ ...current, [activeDataset.id]: activeDataset.name }));
    setEditingDatasetId(activeDataset.id);
    setMessage(null);
  };

  const cancelDatasetNameEdit = () => {
    if (activeDataset !== undefined) {
      setDatasetNameDrafts((current) => ({ ...current, [activeDataset.id]: activeDataset.name }));
    }
    setEditingDatasetId(undefined);
  };

  const saveDatasetName = () => {
    if (activeDataset === undefined || !activeIsLegacyLocalDataset) return;
    const nextName = (datasetNameDrafts[activeDataset.id] ?? activeDataset.name).trim();
    if (nextName.length === 0) return;
    localDatasets.renameDataset(activeDataset.id, nextName);
    setDatasetNameDrafts((current) => ({ ...current, [activeDataset.id]: nextName }));
    setEditingDatasetId(undefined);
    setMessage(`已将数据集重命名为 ${nextName}。`);
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setError(null);
    setMessage(null);
    void importDatasetFile(file)
      .then((dataset) => uploadDataset(file, dataset))
      .then((uploaded) => {
        // The server response carries the generated persisted id. Retain a
        // session snapshot for immediate preview while all later reads use the
        // normal dataset API and therefore survive browser refreshes.
        localDatasets.upsertRuntimeDataset({ schema: uploaded.dataset, result: uploaded.result });
        queryClient.setQueryData(["datasets", uploaded.dataset.id, "schema"], uploaded.dataset);
        queryClient.setQueryData(["datasets", uploaded.dataset.id, "query", "file-management-preview"], uploaded.result);
        void queryClient.invalidateQueries({ queryKey: ["datasets"] });
        setActiveDatasetId(uploaded.dataset.id);
        setMessage(`已上传 ${uploaded.dataset.name}，共 ${uploaded.result.rows.length} 行数据。`);
      })
      .catch((caught: unknown) => {
        setError(caught instanceof Error ? caught.message : "导入数据文件失败");
      })
      .finally(() => setImporting(false));
  };

  const fieldColumns: TableColumnsType<NonNullable<typeof activeDataset>["fields"][number]> = [
    {
      key: "label",
      title: "显示名",
      render: (_, field) => (
        <Input
          aria-label={`字段 ${field.key} 显示名`}
          value={fieldLabelDrafts[`${activeDatasetId ?? ""}:${field.key}`] ?? field.label}
          onChange={(event) => {
            if (!activeIsLegacyLocalDataset) return;
            const nextLabel = event.target.value;
            const draftKey = `${activeDatasetId ?? ""}:${field.key}`;
            setFieldLabelDrafts((current) => ({ ...current, [draftKey]: nextLabel }));
            if (activeDatasetId !== undefined) {
              localDatasets.updateField(activeDatasetId, field.key, { label: nextLabel });
            }
          }}
          disabled={!activeIsLegacyLocalDataset}
        />
      ),
    },
    {
      dataIndex: "key",
      key: "key",
      title: "字段键",
      width: 140,
    },
    {
      key: "type",
      title: "类型",
      width: 140,
      render: (_, field) => (
        <Select
          aria-label={`字段 ${field.key} 类型`}
          options={fieldTypeOptions}
          value={field.type}
          style={{ width: "100%" }}
          onChange={(type) => {
            if (activeDatasetId !== undefined && activeIsLegacyLocalDataset) {
              localDatasets.updateField(activeDatasetId, field.key, { type });
            }
          }}
          disabled={!activeIsLegacyLocalDataset}
        />
      ),
    },
  ];

  return (
    <>
      <Button
        type="text"
        icon={<DatabaseOutlined />}
        aria-label="数据集"
        onClick={() => {
          setOpen(true);
          setError(null);
          setMessage(null);
        }}
      >数据集</Button>
      <Modal
        className="dataset-management-modal"
        open={open}
        title="数据集管理"
        onCancel={() => setOpen(false)}
        footer={null}
        width={960}
        destroyOnHidden
      >
        <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            上传 CSV 或 Excel 文件后，系统会读取表头并自动推断字段类型。原始文件和解析后的数据会安全保存至服务端，可在图表配置的数据集下拉框中选择。
          </Typography.Paragraph>
          <input
            ref={inputRef}
            aria-label="选择数据文件"
            className="editor-file-import-input"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            type="file"
            onChange={onFileChange}
          />
          <div className="dataset-management-toolbar">
            <Button
              aria-label="选择文件"
              type="primary"
              loading={importing}
              onClick={() => inputRef.current?.click()}
            >
              选择文件
            </Button>
            <Typography.Text type="secondary">支持 CSV、XLSX</Typography.Text>
          </div>
          {message && <Alert type="success" showIcon message={message} />}
          {error && <Alert type="error" showIcon message={error} />}
          {summaries.length === 0 ? (
            <Empty description="暂无数据集" />
          ) : (
            <>
              <section className="dataset-library" aria-label="已有数据集">
                <div className="dataset-library__header">
                  <strong>已有数据集</strong>
                  <Typography.Text type="secondary">共 {summaries.length} 个</Typography.Text>
                </div>
                <div className="dataset-library__grid">
                  {summaries.map((dataset) => {
                    const schema = localDatasets.getDataset(dataset.id);
                    const result = localDatasets.queryDataset(dataset.id);
                    const active = dataset.id === activeDatasetId;
                    const legacyLocal = localDatasets.isUploadedDataset(dataset.id);
                    return (
                      <div key={dataset.id} className={`dataset-library-item${active ? " dataset-library-item--active" : ""}`}>
                        <button
                          type="button"
                          className="dataset-library-item__select"
                          aria-label={`查看数据集 ${dataset.name}`}
                          aria-pressed={active}
                          onClick={() => setActiveDatasetId(dataset.id)}
                        >
                          <strong title={dataset.name}>{dataset.name}</strong>
                          <span>{result?.rows.length ?? 0} 行 · {schema?.fields.length ?? 0} 个字段</span>
                        </button>
                        {legacyLocal && <Popconfirm
                          title={`删除“${dataset.name}”？`}
                          description="删除后，已绑定该数据集的图表将无法继续读取数据。"
                          okText="删除"
                          cancelText="取消"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => {
                            const nextDatasetId = summaries.find((candidate) => candidate.id !== dataset.id)?.id;
                            localDatasets.deleteDataset(dataset.id);
                            if (active) setActiveDatasetId(nextDatasetId);
                            setMessage(`已删除 ${dataset.name}。`);
                          }}
                        >
                          <Button
                            type="text"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            aria-label={`删除数据集 ${dataset.name}`}
                          />
                        </Popconfirm>}
                      </div>
                    );
                  })}
                </div>
              </section>
              {activeDataset && (
                <Card size="small" title="数据集信息">
                  <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                    {!activeIsLegacyLocalDataset && (
                      <Typography.Text type="secondary">
                        此数据集已保存至服务端；当前仅支持查看字段和预览数据。
                      </Typography.Text>
                    )}
                    <div className="dataset-name-field">
                      <span className="dataset-name-field__label">数据集名称</span>
                      {activeIsLegacyLocalDataset && editingDatasetId === activeDataset.id ? (
                        <div className="dataset-name-field__editor">
                          <Input
                            autoFocus
                            aria-label="编辑数据集名称"
                            maxLength={100}
                            value={datasetNameDrafts[activeDataset.id] ?? activeDataset.name}
                            onChange={(event) => {
                              const nextName = event.target.value;
                              setDatasetNameDrafts((current) => ({ ...current, [activeDataset.id]: nextName }));
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                saveDatasetName();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelDatasetNameEdit();
                              }
                            }}
                          />
                          <Tooltip title="保存名称">
                            <Button
                              type="primary"
                              size="small"
                              icon={<CheckOutlined />}
                              aria-label="保存数据集名称"
                              disabled={(datasetNameDrafts[activeDataset.id] ?? activeDataset.name).trim().length === 0}
                              onClick={saveDatasetName}
                            />
                          </Tooltip>
                          <Tooltip title="取消修改">
                            <Button
                              type="text"
                              size="small"
                              icon={<CloseOutlined />}
                              aria-label="取消修改数据集名称"
                              onClick={cancelDatasetNameEdit}
                            />
                          </Tooltip>
                        </div>
                      ) : (
                        <div className="dataset-name-field__readonly">
                          <strong title={activeDataset.name}>{activeDataset.name}</strong>
                          {activeIsLegacyLocalDataset && <Tooltip title="修改名称">
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              aria-label={`修改数据集名称 ${activeDataset.name}`}
                              onClick={beginDatasetNameEdit}
                            />
                          </Tooltip>}
                        </div>
                      )}
                    </div>
                    <Table
                      columns={fieldColumns}
                      dataSource={activeDataset.fields}
                      pagination={false}
                      rowKey="key"
                      size="small"
                    />
                  </Space>
                </Card>
              )}
              {activeResult && (
                <Card size="small" title="数据预览">
                  <DataPreview result={activeResult} />
                </Card>
              )}
            </>
          )}
        </Space>
      </Modal>
    </>
  );
};
