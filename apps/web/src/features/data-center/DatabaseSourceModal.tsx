import { DatabaseOutlined } from "@ant-design/icons";
import { DatabaseConnection, type DatabaseTable, type Dataset } from "@drag-visual/contracts";
import { Alert, Button, Checkbox, Form, Input, InputNumber, Modal, Select, Space, Typography } from "antd";
import { useRef, useState } from "react";
import { createDatabaseDataset, listDatabaseTables } from "../datasets/datasetApi.js";

interface Props { open: boolean; onClose: () => void; onCreated: (dataset: Dataset) => void | Promise<void> }

export const DatabaseSourceModal = ({ open, onClose, onCreated }: Props) => {
  const [form] = Form.useForm<DatabaseConnection>();
  const [tables, setTables] = useState<DatabaseTable[] | null>(null);
  const [selected, setSelected] = useState<string>();
  const [name, setName] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const sequence = useRef(0);
  const tested = useRef<DatabaseConnection | null>(null);
  const resetConnection = () => { sequence.current++; tested.current = null; setTables(null); setSelected(undefined); setError(undefined); };
  const close = () => { resetConnection(); form.resetFields(); setName(""); setConnecting(false); onClose(); };

  const connect = async () => {
    let input: DatabaseConnection;
    try { input = DatabaseConnection.parse(await form.validateFields()); }
    catch { return; }
    const current = ++sequence.current;
    tested.current = null; setTables(null); setSelected(undefined); setError(undefined); setConnecting(true);
    try {
      const result = await listDatabaseTables(input);
      if (current !== sequence.current) return;
      tested.current = input; setTables(result.tables);
    } catch (caught) {
      if (current === sequence.current) setError(caught instanceof Error ? caught.message : "数据库连接失败");
    } finally { if (current === sequence.current) setConnecting(false); }
  };

  const create = async () => {
    const table = tables?.find((item) => JSON.stringify(item) === selected);
    if (!tested.current || !table || !name.trim()) return;
    setSaving(true); setError(undefined);
    try {
      const dataset = await createDatabaseDataset({ connection: tested.current, table, name: name.trim() });
      await onCreated(dataset); close();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "创建数据源失败"); }
    finally { setSaving(false); }
  };

  return <Modal title={<Space><DatabaseOutlined />连接数据库</Space>} open={open} onCancel={close} closable={!saving} mask={{ closable: !saving }} keyboard={!saving} width={640} destroyOnHidden footer={[
    <Button key="cancel" disabled={saving} onClick={close}>取消</Button>,
    <Button key="create" type="primary" loading={saving} disabled={!tested.current || !selected || !name.trim()} onClick={() => void create()}>创建数据源</Button>,
  ]}>
    <Typography.Paragraph type="secondary">填写数据库连接信息，连接成功后选择一张表作为数据源。图表查询时会读取表中的当前数据。</Typography.Paragraph>
    <Form form={form} layout="vertical" disabled={connecting || saving} initialValues={{ type: "mysql", host: "", port: 3306, database: "", username: "", password: "", ssl: false }} onValuesChange={(changed: Partial<DatabaseConnection>) => {
      resetConnection();
      if (changed.type) form.setFieldValue("port", changed.type === "mysql" ? 3306 : 5432);
    }}>
      <Form.Item name="type" label="数据库类型"><Select options={[{ label: "MySQL", value: "mysql" }, { label: "PostgreSQL", value: "postgresql" }]} /></Form.Item>
      <div className="database-source__address">
        <Form.Item name="host" label="数据库地址" rules={[{ required: true, message: "请输入数据库主机名或 IP" }, { pattern: /^[^\s/\\?#@]+$/, message: "只填写主机名或 IP，不包含协议和路径" }]}><Input placeholder="例如 10.12.32.165" autoComplete="off" /></Form.Item>
        <Form.Item name="port" label="端口" rules={[{ required: true, message: "请输入端口" }]}><InputNumber min={1} max={65535} precision={0} /></Form.Item>
      </div>
      <Form.Item name="database" label="数据库名称" extra="填写数据库中的实际库名，不是连接名称。" rules={[{ required: true, whitespace: true, message: "请输入数据库名称" }]}><Input placeholder="需要连接的实际数据库名" autoComplete="off" maxLength={128} /></Form.Item>
      <div className="database-source__credentials">
        <Form.Item name="username" label="账号" rules={[{ required: true, whitespace: true, message: "请输入数据库账号" }]}><Input autoComplete="off" maxLength={128} /></Form.Item>
        <Form.Item name="password" label="密码"><Input.Password autoComplete="new-password" maxLength={2048} /></Form.Item>
      </div>
      <Form.Item name="ssl" valuePropName="checked"><Checkbox>使用 TLS 加密连接</Checkbox></Form.Item>
    </Form>
    <Button loading={connecting} disabled={saving} onClick={() => void connect()}>连接并获取表</Button>
    {error && <Alert className="database-source__notice" type="error" showIcon title={error} />}
    {tables !== null && <div className="database-source__tables">
      <Alert type={tables.length ? "success" : "info"} showIcon title={tables.length ? `连接成功，找到 ${tables.length} 张表` : "连接成功，当前账号下没有可选择的表"} />
      {tables.length > 0 && <>
        <label htmlFor="database-source-table">选择数据表</label>
        <Select id="database-source-table" aria-label="选择数据表" showSearch optionFilterProp="label" placeholder="搜索并选择数据表" value={selected ?? null} disabled={saving} options={tables.map((table) => ({ value: JSON.stringify(table), label: `${table.schema}.${table.name}` }))} onChange={(value: string) => {
          setSelected(value); const table = tables.find((item) => JSON.stringify(item) === value); setName(table?.name ?? "");
        }} />
        <label htmlFor="database-source-name">数据源名称</label>
        <Input id="database-source-name" placeholder="数据中心中显示的名称" value={name} disabled={saving} maxLength={100} onChange={(event) => setName(event.target.value)} />
      </>}
    </div>}
  </Modal>;
};
