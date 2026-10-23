import { DatabaseOutlined, DeleteOutlined, FileTextOutlined, FormOutlined, ReloadOutlined, UploadOutlined } from "@ant-design/icons";
import type { DatasetQueryResult, DatasetSummary } from "@drag-visual/contracts";
import { Alert, Button, Card, Empty, Input, List, Modal, Space, Spin, Statistic, Tag, Tooltip, Typography } from "antd";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { DatabaseSourceModal } from "./DatabaseSourceModal.js";
import { appPath } from "../../app/appPath.js";
import { deleteDatabaseDataset, deleteUploadedDataset, getDataset, listDatasetProcessingTasks, listDatasets, queryDataset, uploadDataset } from "../datasets/datasetApi.js";
import { importDatasetFile } from "../datasets/fileImport.js";
import { DataPreview } from "../datasets/DataPreview.js";
import { useLocalDatasets } from "../datasets/LocalDatasetProvider.js";
import { typeLabel, previewParameters } from "./dataCenterHelpers.js";
import "./dataCenter.css";

const errorMessage = (error: unknown): string => error instanceof Error ? error.message : "未知错误";

// Older uploaded records used a `file-*` id while the current upload API uses
// `uploaded-*`. Keep both forms editable and treat the small built-in catalog
// as platform data; this also makes old records usable after an upgrade.
const platformDatasetIds = new Set([
  "retail-delivery-orders",
  "retail-delivery-orders-v2",
  "storage-turnover",
  "storage-turnover-v1",
  "order-profit-report",
  "order-profit-report-v1",
  "sg-storage",
  "sg-storage-v1",
]);
const isUploadedDataset = (dataset: Pick<DatasetSummary, "id">): boolean =>
  !dataset.id.startsWith("database-") && (dataset.id.startsWith("uploaded-") || !platformDatasetIds.has(dataset.id));

export const DataCenter = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const localDatasets = useLocalDatasets();
  const [activeId, setActiveId] = useState<string | undefined>(() => searchParams.get("dataset") ?? undefined);
  const [keyword, setKeyword] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [importing, setImporting] = useState(false);
  const [databaseOpen, setDatabaseOpen] = useState(false);
  const [fieldModalOpen, setFieldModalOpen] = useState(false);

  const datasets = useQuery({ queryKey: ["datasets"], queryFn: () => listDatasets() });
  const processingTasks = useQuery({ queryKey: ["datasets", "processing", "tasks"], queryFn: () => listDatasetProcessingTasks() });
  const summaries = useMemo(() => (datasets.data ?? []).filter((dataset) => {
    const normalized = keyword.trim().toLocaleLowerCase();
    return normalized.length === 0 || dataset.name.toLocaleLowerCase().includes(normalized);
  }), [datasets.data, keyword]);
  useEffect(() => {
    if (activeId !== undefined && summaries.some((dataset) => dataset.id === activeId)) return;
    setActiveId(summaries[0]?.id);
  }, [activeId, summaries]);
  useEffect(() => setFieldModalOpen(false), [activeId]);

  const activeSchema = useQuery({
    queryKey: ["datasets", activeId, "schema"],
    queryFn: () => getDataset(activeId!),
    enabled: activeId !== undefined,
    placeholderData: (previousData) => previousData,
  });
  const activePreview = useQuery({
    queryKey: ["datasets", activeId, "query", "data-center-preview", activeSchema.data?.schemaVersion],
    queryFn: () => queryDataset(activeId!, previewParameters(activeSchema.data?.parameters ?? [])),
    enabled: activeId !== undefined && activeSchema.data !== undefined && !activeSchema.isPlaceholderData,
    placeholderData: (previousData) => previousData,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => uploadDataset(file, await importDatasetFile(file)),
    onSuccess: (uploaded) => {
      localDatasets.upsertRuntimeDataset({ schema: uploaded.dataset, result: uploaded.result });
      queryClient.setQueryData(["datasets", uploaded.dataset.id, "schema"], uploaded.dataset);
      queryClient.setQueryData(["datasets", uploaded.dataset.id, "query", "data-center-preview", uploaded.dataset.schemaVersion], uploaded.result);
      void queryClient.invalidateQueries({ queryKey: ["datasets"] });
      setActiveId(uploaded.dataset.id);
      setMessage(`已导入“${uploaded.dataset.name}”，共 ${uploaded.result.rows.length} 行数据。`);
      setError(undefined);
    },
    onError: (caught: unknown) => setError(caught instanceof Error ? caught.message : "导入数据失败"),
  });

  const removeMutation = useMutation({
    mutationFn: (dataset: DatasetSummary) => dataset.id.startsWith("database-") ? deleteDatabaseDataset(dataset.id) : deleteUploadedDataset(dataset.id),
    onSuccess: (_value, dataset) => {
      localDatasets.deleteDataset(dataset.id);
      void queryClient.invalidateQueries({ queryKey: ["datasets"] });
      queryClient.removeQueries({ queryKey: ["datasets", dataset.id] });
      setMessage(`已删除“${dataset.name}”。`);
    },
    onError: (caught: unknown) => setError(caught instanceof Error ? caught.message : "删除数据集失败"),
  });

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setMessage(undefined);
    setError(undefined);
    uploadMutation.mutate(file, { onSettled: () => setImporting(false) });
  };

  const uploadedCount = (datasets.data ?? []).filter(isUploadedDataset).length;
  const activeDataset = summaries.find((dataset) => dataset.id === activeId);
  const isUploaded = activeDataset !== undefined && isUploadedDataset(activeDataset);

  return (
    <div className="data-center">
      <header className="data-center__header">
        <div className="data-center__brand-cluster">
          <a className="data-center__brand" href={appPath()} aria-label="返回看板中心">
            <img src={appPath("images/jimou-orbit-lens-mark.png")} alt="" />
            <span>极眸</span>
          </a>
          <nav aria-label="主导航">
            <a href={appPath()}>看板中心</a>
            <span className="is-active">数据中心</span>
          </nav>
        </div>
        <Button type="text" onClick={() => navigate("/")}>返回看板中心</Button>
      </header>

      <main className="data-center__main">
        <div className="data-center__intro">
          <div>
            <Typography.Title level={1}>数据中心</Typography.Title>
            <Typography.Paragraph>统一管理数据集，预览字段和数据质量，再将已发布的数据用于图表分析。</Typography.Paragraph>
          </div>
          <div className="data-center__actions">
            <input ref={inputRef} className="data-center__file-input" aria-label="选择数据文件" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onFileChange} />
            <Button icon={<DatabaseOutlined />} onClick={() => setDatabaseOpen(true)}>连接数据库</Button>
            <Button type="primary" icon={<UploadOutlined />} loading={importing} onClick={() => inputRef.current?.click()}>上传数据文件</Button>
          </div>
        </div>

        {(message || error) && <Alert className="data-center__alert" type={error ? "error" : "success"} showIcon message={error ?? message} />}

        <div className="data-center__stats">
          <Card><Statistic title="全部数据集" value={datasets.data?.length ?? 0} suffix="个" /></Card>
          <Card><Statistic title="文件数据集" value={uploadedCount} suffix="个" /></Card>
          <Card><Statistic title="可直接用于图表" value={datasets.data?.length ?? 0} suffix="个" /></Card>
          <Card className="data-center__processing-entry" role="button" tabIndex={0} onClick={() => navigate("/data/processing")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") navigate("/data/processing"); }}><Statistic title="数据加工" value={processingTasks.data?.length ?? 0} suffix="个任务" /><small>进入加工工作台</small></Card>
        </div>

        <section className="data-center__workspace" aria-label="数据集管理">
          <Card className="data-center__library" title={<span className="data-center__card-title"><DatabaseOutlined /> 数据集</span>} extra={<Input aria-label="搜索数据集" allowClear placeholder="搜索数据集" value={keyword} onChange={(event) => setKeyword(event.target.value)} /> }>
            {datasets.isLoading ? <div className="data-center__loading"><Spin /></div> : datasets.isError ? <Alert type="error" showIcon message="加载数据集失败" description={errorMessage(datasets.error)} action={<Button icon={<ReloadOutlined />} onClick={() => void datasets.refetch()}>重试</Button>} /> : summaries.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={keyword ? "没有匹配的数据集" : "暂无数据集"}><Button type="primary" icon={<UploadOutlined />} onClick={() => inputRef.current?.click()}>上传第一个数据文件</Button></Empty> : (
              <List dataSource={summaries} renderItem={(dataset) => <List.Item className={dataset.id === activeId ? "is-active" : ""} onClick={() => setActiveId(dataset.id)} actions={[isUploadedDataset(dataset) ? <Tooltip key="process" title="开始数据加工"><Button type="text" icon={<FormOutlined />} aria-label="开始数据加工" onClick={(event) => { event.stopPropagation(); navigate(`/data/datasets/${dataset.id}`); }} /></Tooltip> : null, (isUploadedDataset(dataset) || dataset.id.startsWith("database-")) ? <Button key="delete" danger type="text" icon={<DeleteOutlined />} aria-label={`删除数据集 ${dataset.name}`} loading={removeMutation.isPending && removeMutation.variables?.id === dataset.id} onClick={(event) => { event.stopPropagation(); removeMutation.mutate(dataset); }} /> : null]}>
                <List.Item.Meta avatar={<span className="data-center__dataset-icon"><FileTextOutlined /></span>} title={<button type="button" className="data-center__dataset-select" onClick={() => setActiveId(dataset.id)}>{dataset.name}</button>} description={<span>{dataset.id.startsWith("database-") ? "数据库数据源" : isUploadedDataset(dataset) ? "文件数据集" : "平台数据集"} · {dataset.sourceName ?? dataset.id}</span>} />
              </List.Item>} />
            )}
          </Card>

          <Card className="data-center__detail" aria-busy={activeSchema.isFetching || activePreview.isFetching} title={activeDataset ? <span className="data-center__card-title">{activeDataset.name}<Tag color={isUploaded ? "blue" : "green"}>{activeDataset.id.startsWith("database-") ? "数据库数据源" : isUploaded ? "文件数据集" : "平台数据集"}</Tag>{(activeSchema.isFetching || activePreview.isFetching) && <Spin size="small" />}</span> : "数据集详情"}>
            {!activeDataset ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择一个数据集查看详情" /> : activeSchema.isLoading ? <div className="data-center__loading"><Spin /></div> : activeSchema.isError ? <Alert type="error" showIcon message="加载数据集结构失败" description={errorMessage(activeSchema.error)} /> : (
              <Space className="data-center__detail-content" orientation="vertical" size="large">
                <div className="data-center__detail-summary"><button type="button" className="data-center__summary-trigger" onClick={() => setFieldModalOpen(true)}><Typography.Text type="secondary">字段</Typography.Text><strong>{activeSchema.data?.fields.length ?? 0}</strong><small>点击查看字段列表</small></button><div><Typography.Text type="secondary">预览行数</Typography.Text><strong>{activePreview.data?.rows.length ?? "—"}</strong></div><div><Typography.Text type="secondary">状态</Typography.Text><strong>可用于图表</strong></div></div>
                <div><div className="data-center__preview-heading"><Typography.Title level={5}>数据预览</Typography.Title>{activePreview.isLoading && <Spin size="small" />}</div>{activePreview.isError ? <Alert type="warning" showIcon message="暂时无法预览数据" description={errorMessage(activePreview.error)} /> : activePreview.data ? <DataPreview result={activePreview.data as DatasetQueryResult} /> : <Typography.Text type="secondary">暂无预览数据</Typography.Text>}</div>
                <div className="data-center__next-step">{activeDataset.id.startsWith("database-") ? <><span><strong>数据库实时数据源</strong><small>前往看板中心，在图表的数据面板中选择此数据源。</small></span><Button type="primary" onClick={() => navigate("/")}>前往看板中心</Button></> : <><span><strong>下一步：数据加工</strong><small>配置数据整合与计算字段，保存草稿并发布为新的结果数据集。</small></span><Button type="primary" icon={<FormOutlined />} disabled={!isUploaded} onClick={() => navigate(`/data/datasets/${activeDataset.id}`)}>开始数据加工</Button></>}</div>
                <Modal title={`${activeDataset.name} · 字段列表`} open={fieldModalOpen} onCancel={() => setFieldModalOpen(false)} footer={null} width={760} destroyOnHidden>
                  <div className="data-center__fields data-center__fields--modal">{activeSchema.data?.fields.map((field) => <div className="data-center__field" key={field.key}><span><strong>{field.label}</strong><small>{field.key}</small></span><Tag>{typeLabel[field.type]}</Tag></div>)}</div>
                </Modal>
              </Space>
            )}
          </Card>
        </section>
      </main>
      <DatabaseSourceModal open={databaseOpen} onClose={() => setDatabaseOpen(false)} onCreated={async (dataset) => {
        queryClient.setQueryData(["datasets", dataset.id, "schema"], dataset);
        await queryClient.invalidateQueries({ queryKey: ["datasets"] });
        setActiveId(dataset.id); setKeyword(""); setError(undefined);
        setMessage(`已创建数据库数据源“${dataset.name}”。`);
      }} />
    </div>
  );
};
