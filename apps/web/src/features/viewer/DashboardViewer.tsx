import { createDefaultRegistry } from "@drag-visual/component-registry";
import type { Dashboard, Dataset } from "@drag-visual/contracts";
import { Alert, Card, Empty, Space, Typography } from "antd";
import type { ReactNode } from "react";
import { detectDatasetSchemaDrift } from "../datasets/useDatasetSchemaDrift.js";
import { ComponentErrorBoundary } from "./ComponentErrorBoundary.js";
import { ViewerComponent } from "./ViewerComponent.js";

interface DashboardViewerProps {
  readonly dashboard: Dashboard;
  readonly mode?: "preview" | "published";
  readonly currentDatasets?: ReadonlyMap<string, Dataset>;
  /** Keeps the preview identity visible without pushing the canvas too far down. */
  readonly headerDensity?: "default" | "compact";
  /** Hides revision metadata when the route should show only the dashboard identity. */
  readonly showRevision?: boolean;
  /** Route navigation rendered in document flow above the dashboard identity. */
  readonly headerNavigation?: ReactNode;
  /** Hides the built-in dashboard identity when the route supplies its own toolbar. */
  readonly showHeader?: boolean;
  /** Uses the real dashboard canvas in a compact visual thumbnail. */
  readonly embedded?: boolean;
}

export const DashboardViewer = ({
  dashboard,
  mode = "published",
  currentDatasets,
  headerDensity = "default",
  showRevision = true,
  headerNavigation,
  showHeader = true,
  embedded = false,
}: DashboardViewerProps) => {
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
    <main style={{
      minHeight: "100vh",
      background: mode === "preview" ? "#fafafa" : dashboard.theme.backgroundColor,
      padding: embedded ? 12 : headerDensity === "compact" ? "16px 24px 24px" : 24,
    }}>
      <Space orientation="vertical" size={embedded ? 0 : headerDensity === "compact" ? "small" : "large"} style={{ width: "100%" }}>
        {!embedded && showHeader && <header style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: headerDensity === "compact" ? 2 : 6,
        }}>
          {headerNavigation}
          <div>
            <Typography.Title level={headerDensity === "compact" ? 3 : 2} style={{ margin: 0 }}>{dashboard.name}</Typography.Title>
            {showRevision && <Typography.Text type="secondary">修订版本 {dashboard.revision}</Typography.Text>}
          </div>
        </header>}
        {orderedComponents.length === 0 ? (
          <Card><Empty description="该看板还没有组件" /></Card>
        ) : (
          <div
            aria-label="只读看板画布"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
              gridAutoRows: 44,
              gap: 12,
              width: "100%",
            }}
          >
            {orderedComponents.map((component) => {
              const item = layout.get(component.id);
              const drift = driftByComponent.get(component.id);
              const blocksRendering = drift?.messages.some((message) => !/^数据集 .+ 已从 .+ 更新到 .+$/.test(message)) ?? false;
              return (
                <Card
                  key={component.id}
                  title={component.title ?? component.type}
                  style={{
                    gridColumn: item
                      ? `${Math.min(12, Math.max(0, item.x)) + 1} / span ${Math.min(12, Math.max(1, item.w))}`
                      : "span 6",
                    gridRow: item ? `${Math.max(0, item.y) + 1} / span ${Math.max(1, item.h)}` : undefined,
                    // A saved grid area is the source of truth for the preview size.
                    // A larger minimum height makes short editor cards overflow into
                    // the following rows and causes components to overlap.
                    height: item ? "100%" : undefined,
                    minHeight: item ? 0 : 220,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    borderWidth: mode === "preview" ? 0 : undefined,
                  }}
                  styles={{
                    // The chart title belongs to the card frame. Keep it visually
                    // connected to the chart instead of rendering Ant Design's
                    // default divider and 24px body top padding beneath every title.
                    header: { borderBottom: "none", flex: "0 0 auto", minHeight: 44, padding: "0 24px" },
                    body: { display: "flex", flex: "1 1 auto", flexDirection: "column", minHeight: 0, overflow: "hidden", padding: "0 24px 16px" },
                  }}
                >
                  <div style={{ display: "flex", flex: "1 1 auto", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                    {drift && (
                      <Alert
                        type="warning"
                        showIcon
                        title="数据绑定需要检查"
                        description={<ul>{drift.messages.map((message) => <li key={message}>{message}</li>)}</ul>}
                        style={{ marginBottom: 12 }}
                      />
                    )}
                    {!blocksRendering && (
                      <ComponentErrorBoundary
                        componentId={component.id}
                        componentType={component.type}
                        title={component.title ?? component.type}
                        mode={mode}
                        resetKey={JSON.stringify({
                          id: component.id,
                          props: component.props,
                          binding: component.binding,
                          schemaVersion: component.binding ? currentDatasets?.get(component.binding.datasetId)?.schemaVersion : undefined,
                        })}
                      >
                        <ViewerComponent
                          component={component}
                          savedDataset={component.binding ? savedDatasets.get(component.binding.datasetId) : undefined}
                          currentDataset={component.binding ? currentDatasets?.get(component.binding.datasetId) : undefined}
                        />
                      </ComponentErrorBoundary>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Space>
    </main>
  );
};
