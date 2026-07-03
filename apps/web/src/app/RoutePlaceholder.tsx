import { ArrowLeftOutlined } from "@ant-design/icons";
import { Button, Result, Typography } from "antd";
import { useParams } from "react-router-dom";

interface RoutePlaceholderProps { title: string; description: string; }

export const RoutePlaceholder = ({ title, description }: RoutePlaceholderProps) => {
  const { id = "" } = useParams();
  return (
    <main style={{ minHeight: "100vh", padding: "48px 24px", background: "#f5f7fa" }}>
      <Result
        status="info"
        title={<h1 style={{ fontSize: 24, margin: 0 }}>{title}</h1>}
        subTitle={description}
        extra={[
          <Typography.Text key="id" type="secondary">看板 ID：{id}</Typography.Text>,
          <Button key="home" href="/" aria-label="返回看板首页" icon={<ArrowLeftOutlined />}>返回看板首页</Button>,
        ]}
      />
    </main>
  );
};
