// @vitest-environment jsdom

import { createDefaultRegistry } from "@drag-visual/component-registry";
import { DashboardSchema } from "@drag-visual/contracts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { InspectorPanel } from "./InspectorPanel.js";
import { createEditorStore } from "./store/editorStore.js";

const dashboard = DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [],
  components: [],
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
});

describe("InspectorPanel", () => {
  it("shows the component and analysis configuration tabs", () => {
    const store = createEditorStore(dashboard);
    render(
      <AppProviders>
        <InspectorPanel store={store} registry={createDefaultRegistry()} collapsed={false} onToggleCollapsed={() => undefined} />
      </AppProviders>,
    );

    expect(screen.getByRole("tab", { name: "字段" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "分析" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "主题" })).not.toBeInTheDocument();
  });

  it("keeps the data panel available when only configuration is collapsed", () => {
    const store = createEditorStore(dashboard);
    render(
      <AppProviders>
        <InspectorPanel store={store} registry={createDefaultRegistry()} collapsed onToggleCollapsed={() => undefined} />
      </AppProviders>,
    );

    expect(screen.getByRole("button", { name: "展开配置栏" })).toBeInTheDocument();
    expect(screen.getByText("数据")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "收起数据栏" })).toBeInTheDocument();
  });

  it("expands analysis placeholders without exposing unfinished controls", async () => {
    const store = createEditorStore(dashboard);
    render(
      <AppProviders>
        <InspectorPanel store={store} registry={createDefaultRegistry()} collapsed={false} onToggleCollapsed={() => undefined} />
      </AppProviders>,
    );

    await userEvent.click(screen.getByRole("tab", { name: "分析" }));
    await userEvent.click(screen.getByText("数据交互"));

    expect(screen.getByText("数据交互配置功能开发中。")).toBeInTheDocument();
    expect(screen.getByText("高级设置")).toBeInTheDocument();
    expect(document.querySelector(".inspector-analysis")).toBeInTheDocument();
  });
});
