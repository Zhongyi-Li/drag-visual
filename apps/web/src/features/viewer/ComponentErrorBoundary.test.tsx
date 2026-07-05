// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { ComponentErrorBoundary } from "./ComponentErrorBoundary.js";

it("isolates one failed component", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const Broken = () => {
    throw new Error("boom");
  };

  render(
    <>
      <ComponentErrorBoundary componentId="bad" componentType="bar" title="坏图表" mode="editor">
        <Broken />
      </ComponentErrorBoundary>
      <div>正常图表</div>
    </>,
  );

  expect(screen.getByText("坏图表渲染失败")).toBeInTheDocument();
  expect(screen.getByText("正常图表")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "重试坏图表" })).toBeInTheDocument();
});

it("hides error details in published mode", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const Broken = () => {
    throw new Error("secret");
  };

  render(
    <ComponentErrorBoundary componentId="bad" componentType="bar" title="坏图表" mode="published">
      <Broken />
    </ComponentErrorBoundary>,
  );

  expect(screen.getByText("组件暂不可用")).toBeInTheDocument();
  expect(screen.queryByText(/secret/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "重试坏图表" })).not.toBeInTheDocument();
});

it("recovers when the component configuration reset key changes", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  const MaybeBroken = ({ broken }: { broken: boolean }) => {
    if (broken) throw new Error("boom");
    return <div>修复后的图表</div>;
  };
  const { rerender } = render(
    <ComponentErrorBoundary componentId="chart" componentType="bar" title="图表" mode="preview" resetKey="v1">
      <MaybeBroken broken />
    </ComponentErrorBoundary>,
  );
  expect(screen.getByText("图表渲染失败")).toBeInTheDocument();

  rerender(
    <ComponentErrorBoundary componentId="chart" componentType="bar" title="图表" mode="preview" resetKey="v2">
      <MaybeBroken broken={false} />
    </ComponentErrorBoundary>,
  );

  expect(screen.getByText("修复后的图表")).toBeInTheDocument();
});
