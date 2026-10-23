import { ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, DatabaseOutlined, FormOutlined, HistoryOutlined, PlusOutlined } from "@ant-design/icons";
import type { DatasetProcessingRecord, DatasetProcessingTask, DatasetSummary } from "@drag-visual/contracts";
import { Alert, Button, Card, Empty, List, Modal, Select, Space, Spin, Statistic, Tag, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { appPath } from "../../app/appPath.js";
import { listDatasetProcessingRecords, listDatasetProcessingTasks, listDatasets } from "../datasets/datasetApi.js";
import "./dataCenter.css";

const platformDatasetIds = new Set(["retail-delivery-orders", "retail-delivery-orders-v2", "storage-turnover", "storage-turnover-v1", "order-profit-report", "order-profit-report-v1", "sg-storage", "sg-storage-v1"]);
const editableDatasets = (datasets: readonly DatasetSummary[]): readonly DatasetSummary[] => datasets.filter((dataset) => !platformDatasetIds.has(dataset.id) && !dataset.id.startsWith("database-"));
const dateTime = (value: string | null): string => value ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "—";
const combineLabel = (kind: DatasetProcessingTask["combineKind"]): string => kind === "join" ? "关联" : kind === "union" ? "合并" : kind === "pipeline" ? "多步整合" : "未整合";

export const DataProcessingHub = () => {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [sourceId, setSourceId] = useState<string>();
  const tasks = useQuery({ queryKey: ["datasets", "processing", "tasks"], queryFn: () => listDatasetProcessingTasks() });
  const records = useQuery({ queryKey: ["datasets", "processing", "records"], queryFn: () => listDatasetProcessingRecords() });
  const datasets = useQuery({ queryKey: ["datasets"], queryFn: () => listDatasets() });
  const sources = useMemo(() => editableDatasets(datasets.data ?? []), [datasets.data]);
  const publishedCount = (tasks.data ?? []).filter((task) => task.status === "published").length;

  return <div className="data-center data-center--processing">
    <header className="data-center__header">
      <div className="data-center__brand-cluster"><a className="data-center__brand" href={appPath()} aria-label="返回看板中心"><img src={appPath("images/jimou-orbit-lens-mark.png")} alt="" /><span>极眸</span></a><nav aria-label="主导航"><a href={appPath()}>看板中心</a><a href={appPath("data")}>数据中心</a><span className="is-active">数据加工</span></nav></div>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate("/data")}>返回数据中心</Button>
    </header>
    <main className="data-center__main">
      <div className="data-center__intro"><div><Typography.Text className="data-center__eyebrow">数据加工工作台</Typography.Text><Typography.Title level={1}>数据加工</Typography.Title><Typography.Paragraph>管理加工草稿，发布独立结果数据集，并追踪每一次发布记录。</Typography.Paragraph></div><Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建加工任务</Button></div>
      <div className="data-center__stats data-center__processing-stats"><Card><Statistic title="加工任务" value={tasks.data?.length ?? 0} suffix="个" /></Card><Card><Statistic title="草稿" value={(tasks.data ?? []).filter((task) => task.status === "draft").length} suffix="个" /></Card><Card><Statistic title="已发布" value={publishedCount} suffix="个" /></Card><Card><Statistic title="加工记录" value={records.data?.length ?? 0} suffix="条" /></Card></div>
      <section className="data-center__processing-grid">
        <Card className="data-center__processing-card" title={<span className="data-center__card-title"><FormOutlined /> 加工任务</span>}>
          {tasks.isLoading ? <div className="data-center__loading"><Spin /></div> : tasks.isError ? <Alert type="error" showIcon title="加载加工任务失败" /> : (tasks.data?.length ?? 0) === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有保存的加工任务"><Button type="primary" onClick={() => setCreateOpen(true)}>新建第一个任务</Button></Empty> : <List dataSource={tasks.data ?? []} renderItem={(task) => <List.Item className="data-center__processing-item" actions={[<Button key="open" type="link" onClick={() => navigate(`/data/datasets/${task.sourceDatasetId}`)}>继续加工</Button>]}>
            <List.Item.Meta avatar={<span className={`data-center__task-icon is-${task.status}`}>{task.status === "published" ? <CheckCircleOutlined /> : <ClockCircleOutlined />}</span>} title={<Space size={8}><span>{task.sourceDatasetName}</span><Tag color={task.status === "published" ? "green" : "gold"}>{task.status === "published" ? "已发布" : "草稿"}</Tag></Space>} description={<span>{task.calculatedFieldCount} 个计算字段 · {combineLabel(task.combineKind)} · 更新于 {dateTime(task.updatedAt)}</span>} />
          </List.Item>} />}
        </Card>
        <Card className="data-center__processing-card" title={<span className="data-center__card-title"><HistoryOutlined /> 加工记录</span>}>
          {records.isLoading ? <div className="data-center__loading"><Spin /></div> : records.isError ? <Alert type="error" showIcon title="加载加工记录失败" /> : (records.data?.length ?? 0) === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="发布后会在这里生成记录" /> : <List dataSource={records.data ?? []} renderItem={(record: DatasetProcessingRecord) => <List.Item className="data-center__processing-item" actions={record.resultDatasetId ? [<Button key="result" type="link" onClick={() => navigate(`/data?dataset=${encodeURIComponent(record.resultDatasetId!)}`)}>查看结果</Button>] : []}>
            <List.Item.Meta avatar={<span className="data-center__task-icon is-record"><DatabaseOutlined /></span>} title={<Space size={8}><span>{record.resultDatasetName ?? record.sourceDatasetName}</span><Tag color={record.status === "published" ? "blue" : "red"}>{record.status === "published" ? `版本 ${record.version}` : "失败"}</Tag></Space>} description={<span>来源：{record.sourceDatasetName} · {record.rowCount ?? 0} 行 · {dateTime(record.createdAt)}</span>} />
          </List.Item>} />}
        </Card>
      </section>
    </main>
    <Modal title="新建加工任务" open={createOpen} okText="开始加工" cancelText="取消" okButtonProps={{ disabled: sourceId === undefined }} onCancel={() => setCreateOpen(false)} onOk={() => { if (sourceId) navigate(`/data/datasets/${sourceId}`); }}>
      <div className="data-center__create-task"><Typography.Paragraph type="secondary">选择一张数据集作为加工来源。保存草稿后，它会出现在任务列表中。</Typography.Paragraph><label><span>来源数据集</span><Select showSearch optionFilterProp="label" placeholder="选择数据集" value={sourceId} options={sources.map((dataset) => ({ label: dataset.name, value: dataset.id }))} onChange={setSourceId} /></label></div>
    </Modal>
  </div>;
};
