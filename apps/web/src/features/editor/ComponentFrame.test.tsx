// @vitest-environment jsdom

import { DashboardSchema } from "@drag-visual/contracts";
import { DashboardComponentRenderer } from "@drag-visual/chart-renderer";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import type { ReactElement, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { server } from "../../mocks/server.js";
import { ComponentFrame } from "./ComponentFrame.js";
import { createEditorStore } from "./store/editorStore.js";
import { useEditorShortcuts } from "./useEditorShortcuts.js";

vi.mock("@drag-visual/chart-renderer", () => ({
  DashboardComponentRenderer: vi.fn(() => <div>当前图表无数据</div>),
  ResponsiveChartContainer: ({ children }: { readonly children: ReactNode }) => <>{children}</>,
}));

const dashboard = DashboardSchema.parse({
  schemaVersion: 1, id: "123e4567-e89b-42d3-a456-426614174000", name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
  components: [{ id: "bar-1", type: "bar", title: "销售额", props: { color: "#1677ff", showLegend: true } }],
  datasets: [], revision: 1, updatedAt: "2026-07-03T08:00:00.000Z",
});

const remoteDashboard = DashboardSchema.parse({
  ...dashboard,
  datasets: [{
    datasetId: "sales",
    schemaVersion: "v1",
    parameters: { year: 2026, fromDate: "2026-01-01" },
  }],
  components: [{
    id: "bar-1",
    type: "bar",
    title: "销售额",
    props: { color: "#1677ff", showLegend: true },
    binding: {
      datasetId: "sales",
      slots: { dimension: { fieldKey: "month" }, measure: { fieldKey: "revenue" } },
    },
  }],
});

const retailFields = [
  { key: "billNo", label: "单据编号", type: "string", nullable: false },
  { key: "orderAmt", label: "订单总额", type: "number", nullable: false },
] as const;

const retailDashboard = DashboardSchema.parse({
  ...dashboard,
  datasets: [{ datasetId: "retail-delivery-orders", schemaVersion: "retail-delivery-orders-v1", parameters: {} }],
  components: [{
    id: "bar-1",
    type: "bar",
    title: "零售订单金额",
    props: { color: "#1677ff", showLegend: true },
    binding: {
      datasetId: "retail-delivery-orders",
      slots: { dimension: { fieldKey: "billNo" }, measure: { fieldKey: "orderAmt" } },
    },
  }],
});

const transformedRemoteDashboard = DashboardSchema.parse({
  ...remoteDashboard,
  components: [{
    ...remoteDashboard.components[0]!,
    binding: {
      ...remoteDashboard.components[0]!.binding!,
      sort: { fieldKey: "revenue", direction: "desc" },
      limit: 1,
    },
  }],
});

const sunburstDashboard = DashboardSchema.parse({
  ...remoteDashboard,
  components: [{
    id: "bar-1",
    type: "sunburst",
    title: "旭日图",
    props: { color: "#1677ff", showLegend: false },
    binding: {
      datasetId: "sales",
      slots: {
        dimension: { fieldKey: "month" },
        measure: [{ fieldKey: "revenue" }, { fieldKey: "discount" }],
      },
    },
  }],
});

const ShortcutFrame = ({ store, onSave }: { store: ReturnType<typeof createEditorStore>; onSave?: () => void }) => {
  useEditorShortcuts(store, onSave);
  return <ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />;
};

const renderFrame = (ui: ReactElement) => render(<AppProviders>{ui}</AppProviders>);

describe("ComponentFrame", () => {
  it("selects by click without rendering a separate drag handle", async () => {
    const store = createEditorStore(dashboard);
    renderFrame(<ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);
    await userEvent.click(screen.getByRole("group", { name: "销售额" }));
    expect(store.getState().selectedComponentId).toBe("bar-1");
    expect(screen.queryByRole("button", { name: "拖动销售额" })).not.toBeInTheDocument();
  });

  it("edits the chart title from its header", async () => {
    const store = createEditorStore(dashboard);
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    renderFrame(<ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);

    await userEvent.click(screen.getByRole("button", { name: "销售额" }));
    const input = screen.getByRole("textbox", { name: "图表名称" });
    expect(input).toHaveValue("销售额");
    await userEvent.clear(input);
    await userEvent.type(input, "月度销售额");
    await userEvent.keyboard("{Enter}");

    expect(dispatch).toHaveBeenCalledWith({
      type: "component.title.update",
      componentId: "bar-1",
      nextTitle: "月度销售额",
    });
    expect(store.getState().history.present.components[0]!.title).toBe("月度销售额");
  });

  it("persists a cleared title and reduces the editor title bar", async () => {
    const store = createEditorStore(dashboard);
    renderFrame(<ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);

    await userEvent.click(screen.getByRole("button", { name: "销售额" }));
    await userEvent.clear(screen.getByRole("textbox", { name: "图表名称" }));
    await userEvent.keyboard("{Enter}");

    expect(store.getState().history.present.components[0]!.title).toBe("");
    const frame = screen.getByRole("group", { name: "bar" });
    expect(frame).toHaveClass("component-frame--untitled", "component-frame--selected");
    expect(frame.querySelector(".component-frame__title-button")).toHaveTextContent("添加标题");
  });

  it("keeps the title unchanged when escaping an edit", async () => {
    const store = createEditorStore(dashboard);
    renderFrame(<ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);

    await userEvent.click(screen.getByRole("button", { name: "销售额" }));
    const input = screen.getByRole("textbox", { name: "图表名称" });
    await userEvent.clear(input);
    await userEvent.type(input, "不会保存");
    await userEvent.keyboard("{Escape}");

    expect(store.getState().history.present.components[0]!.title).toBe("销售额");
  });

  const openMoreActions = async (title = "销售额") => {
    await userEvent.click(screen.getByRole("button", { name: `更多操作${title}` }));
  };

  it("shows the overflow menu instead of direct copy and delete controls", async () => {
    const store = createEditorStore(dashboard);
    renderFrame(<ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);

    expect(screen.queryByRole("button", { name: "复制销售额" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "删除销售额" })).not.toBeInTheDocument();
    await openMoreActions();
    expect(screen.getByRole("menuitem", { name: "复制" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "删除" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "刷新" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "查看数据" })).not.toHaveAttribute("aria-disabled", "true");
  });

  it("opens the component data drawer from the overflow menu", async () => {
    const store = createEditorStore(dashboard);
    renderFrame(<ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);

    await openMoreActions();
    await userEvent.click(screen.getByRole("menuitem", { name: "查看数据" }));

    expect(await screen.findByText("销售额的数据")).toBeInTheDocument();
    expect(screen.getByText("暂无可查看的数据")).toBeInTheDocument();
  });

  it("shows a refresh-in-progress state before remounting the chart", async () => {
    const store = createEditorStore(dashboard);
    renderFrame(<ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);

    await openMoreActions();
    await userEvent.click(screen.getByRole("menuitem", { name: "刷新" }));

    expect(screen.getByRole("status")).toHaveTextContent("正在刷新图表");
  });

  it("re-queries a bound remote dataset when refreshing a chart", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const store = createEditorStore(remoteDashboard);
    renderFrame(<ComponentFrame component={remoteDashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);
    const queryCallCount = () => fetchSpy.mock.calls.filter(([input]) => String(input).includes("/datasets/sales/query")).length;

    await waitFor(() => expect(queryCallCount()).toBe(1));
    await openMoreActions();
    await userEvent.click(screen.getByRole("menuitem", { name: "刷新" }));
    await waitFor(() => expect(queryCallCount()).toBe(2));
    fetchSpy.mockRestore();
  });

  it("sends the configured chart date filter without changing the dashboard configuration", async () => {
    const requests: unknown[] = [];
    server.use(
      http.post("http://localhost/datasets/sales/query", async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({
          columns: [{ key: "month", label: "月份", type: "string", nullable: false }, { key: "revenue", label: "销售额", type: "number", nullable: false }],
          rows: [{ month: "7月", revenue: 100 }], total: 1, sampledAt: "2026-07-31T00:00:00.000Z",
        });
      }),
    );
    const filtered = DashboardSchema.parse({
      ...remoteDashboard,
      components: [{
        ...remoteDashboard.components[0]!,
        binding: {
          ...remoteDashboard.components[0]!.binding!,
          dateFilter: { fieldKey: "businessDate", defaultPreset: "today", allowCustom: true, timezone: "Asia/Shanghai" },
        },
      }],
    });
    const store = createEditorStore(filtered);
    renderFrame(<ComponentFrame component={filtered.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);

    expect((await screen.findAllByRole("textbox", { name: "业务日期日期范围" }))).toHaveLength(2);
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({
      componentFilters: [expect.objectContaining({ kind: "dateRange", fieldKey: "businessDate", timezone: "Asia/Shanghai" })],
    });
    expect(store.getState().history.present.components[0]!.binding?.dateFilter).toEqual(filtered.components[0]!.binding?.dateFilter);
  });

  it("re-queries a chart with the global date field mapped to that chart", async () => {
    const requests: unknown[] = [];
    server.use(
      http.post("http://localhost/datasets/sales/query", async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({
          columns: [
            { key: "month", label: "月份", type: "string", nullable: false },
            { key: "businessDate", label: "业务日期", type: "date", nullable: false },
            { key: "revenue", label: "销售额", type: "number", nullable: false },
          ],
          rows: [{ month: "8月", businessDate: "2026-08-05", revenue: 100 }], total: 1, sampledAt: "2026-08-05T00:00:00.000Z",
        });
      }),
    );
    const globalFilters = [{
      id: "period",
      fieldKey: "orderTime",
      label: "统计周期",
      controlType: "dateRange" as const,
      targets: [{ componentId: "bar-1", fieldKey: "businessDate" }],
    }];
    const store = createEditorStore(remoteDashboard);
    const onGlobalFilterQuerySettled = vi.fn();

    renderFrame(<ComponentFrame
      component={remoteDashboard.components[0]!}
      store={store}
      createComponentId={() => "bar-2"}
      isInteracting={false}
      globalFilters={globalFilters}
      globalFilterValues={{ period: { start: "2026-08-01", end: "2026-08-05" } }}
      globalFilterApplyVersion={1}
      onGlobalFilterQuerySettled={onGlobalFilterQuerySettled}
    />);

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]).toMatchObject({
      globalFilters: [{ kind: "dateRange", fieldKey: "businessDate", start: "2026-08-01", end: "2026-08-05", timezone: "Asia/Shanghai" }],
    });
    expect(onGlobalFilterQuerySettled).toHaveBeenCalledWith("bar-1", 1);
  });

  it("queries an edited aggregation only after the inspector applies its update", async () => {
    const requests: unknown[] = [];
    server.use(
      http.post("http://localhost/datasets/sales/query", async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({
          columns: [
            { key: "month", label: "月份", type: "string", nullable: false },
            { key: "revenue", label: "销售额", type: "number", nullable: false },
          ],
          rows: [{ month: "2026-01", revenue: 100 }],
          total: 1,
          sampledAt: "2026-07-24T00:00:00.000Z",
        });
      }),
    );
    const store = createEditorStore(remoteDashboard);
    renderFrame(<ComponentFrame component={remoteDashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);

    await waitFor(() => expect(requests).toHaveLength(1));
    await act(async () => {
      store.getState().dispatch({
        type: "component.binding.update",
        componentId: "bar-1",
        nextBinding: {
          datasetId: "sales",
          slots: {
            dimension: { fieldKey: "month" },
            measure: { fieldKey: "revenue", aggregation: "avg" },
          },
        },
      });
    });
    expect(requests).toHaveLength(1);

    await act(async () => {
      const current = store.getState().history.present.components[0]!;
      store.getState().dispatch({
        type: "component.props.update",
        componentId: "bar-1",
        nextProps: { ...current.props, dataRefreshVersion: 1 },
      });
    });
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]).toEqual({
      parameters: { year: 2026, fromDate: "2026-01-01" },
      aggregation: { groupBy: ["month"], measures: [{ fieldKey: "revenue", aggregation: "avg" }] },
    });
  });

  it("uses a result cap for retail charts without rendering pagination controls", async () => {
    const requests: unknown[] = [];
    server.use(
      http.get("http://localhost/datasets/retail-delivery-orders/schema", () => HttpResponse.json({
        id: "retail-delivery-orders",
        name: "零售发货单（业务表）",
        fields: retailFields,
        parameters: [
          { key: "limit", label: "结果展示", type: "number", required: false, defaultValue: 1000 },
        ],
        schemaVersion: "retail-delivery-orders-v2",
      })),
      http.post("http://localhost/datasets/retail-delivery-orders/query", async ({ request }) => {
        requests.push(await request.json());
        return HttpResponse.json({ columns: retailFields, rows: [{ billNo: "OM001", orderAmt: 100 }], total: 1, sampledAt: "2026-07-24T00:00:00.000Z" });
      }),
    );
    const store = createEditorStore(retailDashboard);
    renderFrame(<ComponentFrame component={retailDashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);

    await waitFor(() => expect(requests).toEqual([{ parameters: { limit: 1000 } }]));
    expect(screen.queryByRole("spinbutton", { name: "当前页" })).toBeNull();
    expect(screen.queryByRole("spinbutton", { name: "每页条数" })).toBeNull();
    expect(screen.queryByRole("button", { name: "查询" })).toBeNull();
    expect(store.getState().history.present.datasets[0]!.parameters).toEqual({});
  });

  it("shows a query error instead of rendering an empty chart when remote data fails", async () => {
    server.use(
      http.post("http://localhost/datasets/sales/query", () =>
        HttpResponse.json({ code: "DATASET_UPSTREAM_ERROR", message: "数据服务暂时不可用" }, { status: 502 }),
      ),
    );
    const store = createEditorStore(remoteDashboard);
    renderFrame(<ComponentFrame component={remoteDashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);

    expect(await screen.findByText("加载图表数据失败")).toBeInTheDocument();
    expect(screen.getByText("数据服务暂时不可用")).toBeInTheDocument();
  });

  it("applies the binding sort and Top N before rendering editor data", async () => {
    const store = createEditorStore(transformedRemoteDashboard);
    renderFrame(<ComponentFrame component={transformedRemoteDashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);

    await waitFor(() => expect(DashboardComponentRenderer).toHaveBeenLastCalledWith(
      expect.objectContaining({ rows: [expect.objectContaining({ month: "4月", revenue: 120_999 })] }),
      undefined,
    ));
  });

  it("shows the same transformed rows in the component data drawer", async () => {
    const store = createEditorStore(transformedRemoteDashboard);
    renderFrame(<ComponentFrame component={transformedRemoteDashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);

    await waitFor(() => expect(DashboardComponentRenderer).toHaveBeenLastCalledWith(
      expect.objectContaining({ rows: [expect.objectContaining({ revenue: 120_999 })] }),
      undefined,
    ));
    await openMoreActions();
    await userEvent.click(screen.getByRole("menuitem", { name: "查看数据" }));

    expect(await screen.findByText("已应用组件配置：收入降序 · Top 1")).toBeInTheDocument();
    expect(screen.getByText("4月")).toBeInTheDocument();
    expect(screen.queryByText("3月")).not.toBeInTheDocument();
  });

  it("places the sunburst metric selector immediately before the overflow menu", async () => {
    const store = createEditorStore(sunburstDashboard);
    renderFrame(<ComponentFrame component={sunburstDashboard.components[0]!} store={store} createComponentId={() => "sunburst-2"} isInteracting={false} />);

    const selector = screen.getByRole("combobox", { name: "切换旭日图指标" });
    const overflow = screen.getByRole("button", { name: "更多操作旭日图" });
    const controls = selector.closest(".component-frame__header-controls");
    expect(controls?.children[0]).toBe(selector);
    expect(controls?.contains(overflow)).toBe(true);
    expect((selector as HTMLSelectElement).value).toBe("revenue");

    await userEvent.selectOptions(selector, "discount");
    await waitFor(() => expect(DashboardComponentRenderer).toHaveBeenLastCalledWith(
      expect.objectContaining({ activeSunburstMeasure: "discount" }),
      undefined,
    ));
  });

  it("duplicates once from the overflow menu and selects the copy", async () => {
    const store = createEditorStore(dashboard);
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    renderFrame(<ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);
    await openMoreActions();
    await userEvent.click(screen.getByRole("menuitem", { name: "复制" }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "component.duplicate", sourceId: "bar-1", newComponentId: "bar-2" }));
    expect(store.getState().selectedComponentId).toBe("bar-2");
    expect(store.getState().history.present.layout[1]).toMatchObject({ i: "bar-2", y: 5 });
  });

  it("deletes once from the overflow menu and clears selection", async () => {
    const store = createEditorStore(dashboard);
    store.getState().select("bar-1");
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    renderFrame(<ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting={false} />);
    await openMoreActions();
    await userEvent.click(screen.getByRole("menuitem", { name: "删除" }));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(store.getState().history.present.components).toHaveLength(0);
    expect(store.getState().selectedComponentId).toBeNull();
  });

  it("renders the empty-data demo instead of the old placeholder", () => {
    const store = createEditorStore(dashboard);
    renderFrame(<ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "bar-2"} isInteracting />);
    expect(screen.getByText("当前图表无数据")).toBeInTheDocument();
    expect(screen.queryByText("图表渲染将在后续阶段开放")).not.toBeInTheDocument();
    expect(screen.getByTestId("component-renderer")).toHaveAttribute("data-interacting", "true");
    expect(DashboardComponentRenderer).toHaveBeenCalledWith(expect.objectContaining({
      component: dashboard.components[0],
      fields: undefined,
      rows: [],
    }), undefined);
  });

  it.each(["销售额", "更多操作销售额"])("lets undo and save bubble from the %s focus target", async (label) => {
    const store = createEditorStore(dashboard);
    const undo = vi.spyOn(store.getState(), "undo");
    const save = vi.fn();
    renderFrame(<ShortcutFrame store={store} onSave={save} />);
    const target = label === "销售额" ? screen.getByRole("group", { name: label }) : screen.getByRole("button", { name: label });
    target.focus();
    await userEvent.keyboard("{Control>}z{/Control}");
    await userEvent.keyboard("{Meta>}s{/Meta}");
    expect(undo).toHaveBeenCalledOnce();
    expect(save).toHaveBeenCalledOnce();
  });

  it.each(["销售额", "更多操作销售额"])("lets Delete remove the selected component from the %s focus target without activating it", async (label) => {
    const store = createEditorStore(dashboard);
    store.getState().select("bar-1");
    const dispatch = vi.spyOn(store.getState(), "dispatch");
    renderFrame(<ShortcutFrame store={store} />);
    const target = label === "销售额" ? screen.getByRole("group", { name: label }) : screen.getByRole("button", { name: label });
    target.focus();
    await userEvent.keyboard("{Delete}");
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: "component.remove", componentId: "bar-1" });
    expect(store.getState().history.present.components).toHaveLength(0);
  });
});
