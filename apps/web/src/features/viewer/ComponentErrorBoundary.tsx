import { Alert, Button, Space } from "antd";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface ComponentErrorBoundaryProps {
  readonly children: ReactNode;
  readonly componentId: string;
  readonly componentType: string;
  readonly title: string;
  readonly mode: "editor" | "preview" | "published";
  readonly resetKey?: string | undefined;
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

  override componentDidUpdate(previous: ComponentErrorBoundaryProps): void {
    if (previous.resetKey !== this.props.resetKey && this.state.error !== null) {
      this.setState((state) => ({ error: null, retryKey: state.retryKey + 1 }));
    }
  }

  retry = (): void => {
    this.setState((state) => ({ error: null, retryKey: state.retryKey + 1 }));
  };

  override render(): ReactNode {
    if (this.state.error) {
      if (this.props.mode === "published") {
        return <Alert type="warning" showIcon title="组件暂不可用" />;
      }
      return (
        <Alert
          type="error"
          showIcon
          title={`${this.props.title}渲染失败`}
          description={(
            <Space orientation="vertical">
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
