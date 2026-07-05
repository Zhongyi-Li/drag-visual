import { createDefaultRegistry } from "@drag-visual/component-registry";
import type { Dashboard, Dataset } from "@drag-visual/contracts";
import { Alert, Card, Empty, Space, Typography } from "antd";
import { detectDatasetSchemaDrift } from "../datasets/useDatasetSchemaDrift.js";
import { ComponentErrorBoundary } from "./ComponentErrorBoundary.js";
import { ViewerComponent } from "./ViewerComponent.js";

interface DashboardViewerProps {
  readonly dashboard: Dashboard;
  readonly mode?: "preview" | "published";
  readonly currentDatasets?: ReadonlyMap<string, Dataset>;
}

export const DashboardViewer = ({ dashboard, mode = "published", currentDatasets }: DashboardViewerProps) => {
  const layout = new Map(dashboard.layout.map((item) => [item.i, item]));
  const savedDatasets = new Map(dashboard.datasets.map((dataset) => [dataset.datasetId, dataset]));
  const driftByComponent = new Map(
    currentDatasets
      ? detectDatasetSchemaDrift(dashboard, currentDatasets, createDefaultRegistry()).map((drift) => [drift.componentId, drift])
      : [],
  );
  const orderedComponents = [...dashboard.components].sort((left, right) => {
    const leftLayout = layout.get(left.id);
    const rightLayout = layout.get(right.id);
    return (leftLayout?.y ?? 0) - (rightLayout?.y ?? 0) || (leftLayout?.x ?? 0) - (rightLayout?.x ?? 0);
  });

  return (
    <main style={{ minHeight: "100vh", background: dashboard.theme.backgroundColor, padding: 24 }}>
      <Space orientation="vertical" size="large" style={{ width: "100%" }}>
        <header>
          <Typography.Title level={2} style={{ margin: 0 }}>{dashboard.name}</Typography.Title>
          <Typography.Text type="secondary">修订版本 {dashboard.revision}</Typography.Text>
        </header>
        {orderedComponents.length === 0 ? (
          <Card><Empty description="该看板还没有组件" /></Card>
        ) : (
          <div
            aria-label="只读看板画布"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {orderedComponents.map((component) => {
              const item = layout.get(component.id);
              const drift = driftByComponent.get(component.id);
              return (
                <Card
                  key={component.id}
                  title={component.title ?? component.type}
                  style={{
                    gridColumn: item ? `span ${Math.min(12, Math.max(1, item.w))}` : "span 6",
                    minHeight: item ? Math.max(160, item.h * 44) : 220,
                  }}
                >
                  {drift && (
                    <Alert
                      type="warning"
                      showIcon
                      message="数据绑定需要检查"
                      description={<ul>{drift.messages.map((message) => <li key={message}>{message}</li>)}</ul>}
                      style={{ marginBottom: 12 }}
                    />
                  )}
                  <ComponentErrorBoundary
                    componentId={component.id}
                    componentType={component.type}
                    title={component.title ?? component.type}
                    mode={mode}
                  >
                    <ViewerComponent
                      component={component}
                      savedDataset={component.binding ? savedDatasets.get(component.binding.datasetId) : undefined}
                      currentDataset={component.binding ? currentDatasets?.get(component.binding.datasetId) : undefined}
                    />
                  </ComponentErrorBoundary>
                </Card>
              );
            })}
          </div>
        )}
      </Space>
    </main>
  );
};
