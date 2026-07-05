import { Button, Modal, Space, Typography } from "antd";

interface RevisionConflictModalProps {
  readonly open: boolean;
  readonly onReload: () => void;
  readonly onCopy: () => void;
  readonly onCancel: () => void;
}

export const RevisionConflictModal = ({
  open,
  onReload,
  onCopy,
  onCancel,
}: RevisionConflictModalProps) => (
  <Modal
    open={open}
    title="保存冲突"
    onOk={onReload}
    onCancel={onCancel}
    footer={(
      <Space>
        <Button onClick={onCancel}>继续编辑本地版本</Button>
        <Button onClick={onCopy}>复制为新看板</Button>
        <Button type="primary" onClick={onReload}>重新加载服务端版本</Button>
      </Space>
    )}
  >
    <Typography.Paragraph>
      服务端已有更新，本地未保存内容仍保留。
    </Typography.Paragraph>
    <Typography.Paragraph type="secondary">
      你可以重新加载服务端版本，或把当前本地内容复制成新看板后继续保存。
    </Typography.Paragraph>
  </Modal>
);
