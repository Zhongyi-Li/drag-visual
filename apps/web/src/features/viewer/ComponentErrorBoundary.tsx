import { Alert, Button, Space } from "antd";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface ComponentErrorBoundaryProps {
  readonly children: ReactNode;
  readonly componentId: string;
  readonly componentType: string;
  readonly title: string;
  readonly mode: "editor" | "preview" | "published";
}

interface ComponentErrorBoundaryState {
  readonly error: Error | null;
  readonly retryKey: number;
}

export class ComponentErrorBoundary extends Component<
  ComponentErrorBoundaryProps,
  ComponentErrorBoundaryState
> {
  override state: ComponentErrorBoundaryState = { error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Pick<ComponentErrorBoundaryState, "error"> {
    return { error };
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    console.error("Dashboard component render failed", {
      componentId: this.props.componentId,
      componentType: this.props.componentType,
      errorName: error.name,
    });
  }

  retry = (): void => {
    this.setState((state) => ({ error: null, retryKey: state.retryKey + 1 }));
  };

  override render(): ReactNode {
    if (this.state.error) {
      if (this.props.mode === "published") {
        return <Alert type="warning" showIcon message="组件暂不可用" />;
      }
      return (
        <Alert
          type="error"
          showIcon
          message={`${this.props.title}渲染失败`}
          description={(
            <Space direction="vertical">
              <span>该组件发生错误，其他组件不受影响。</span>
              <Button size="small" onClick={this.retry} aria-label={`重试${this.props.title}`}>重试</Button>
            </Space>
          )}
        />
      );
    }

    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}
