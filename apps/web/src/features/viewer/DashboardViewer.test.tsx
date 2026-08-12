// @vitest-environment jsdom

import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import { Dataset } from "@drag-visual/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { server } from "../../mocks/server.js";
import { DashboardViewer } from "./DashboardViewer.js";

const dashboard = (overrides: Partial<Dashboard> = {}): Dashboard => DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "经营看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
  components: [{ id: "bar-1", type: "bar", title: "月收入", props: { color: "#1677ff", showLegend: true } }],
  datasets: [],
  revision: 2,
  updatedAt: "2026-07-03T09:00:00.000Z",
  ...overrides,
});

it("renders component titles without editor controls", () => {
  render(<DashboardViewer dashboard={dashboard()} />);

  expect(screen.getByRole("heading", { name: "经营看板" })).toBeInTheDocument();
  expect(screen.getByText("月收入")).toBeInTheDocument();
  expect(screen.getByText("月收入").closest(".ant-card")?.querySelector(".ant-card-head")).toHaveStyle({ borderBottomStyle: "none" });
  expect(screen.getByText("月收入").closest(".ant-card")?.querySelector(".ant-card-head")).toHaveStyle({ minHeight: "44px", padding: "0px 24px" });
  expect(screen.getByText("月收入").closest(".ant-card")?.querySelector(".ant-card-body")).toHaveStyle({ padding: "0px 24px 16px" });
  expect(screen.queryByRole("button", { name: /删除/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /复制/ })).not.toBeInTheDocument();
});

it("does not render legacy chart subtitles", () => {
  render(<DashboardViewer dashboard={dashboard({
    components: [{ id: "bar-1", type: "bar", title: "月收入", subtitle: "统计口径：已支付订单", props: { color: "#1677ff", showLegend: true } }],
  })} />);

  expect(screen.queryByText("统计口径：已支付订单")).not.toBeInTheDocument();
  const card = screen.getByText("月收入").closest(".ant-card");
  expect(card?.querySelector(".ant-card-head")).toHaveStyle({ minHeight: "44px", padding: "0px 24px" });
});

it("renders a left-top auxiliary explanation directly below the chart title", () => {
  render(<DashboardViewer dashboard={dashboard({
    components: [{
      id: "bar-1", type: "bar", title: "月收入", props: { color: "#1677ff", showLegend: true },
      displayAnnotations: { annotations: [{ position: "topLeft", text: "统计口径：已支付订单" }], unitText: "" },
    }],
  })} />);

  const hint = screen.getByText("统计口径：已支付订单");
  const card = hint.closest(".ant-card");
  expect(card?.querySelector(".ant-card-head")).toHaveStyle({ minHeight: "60px", padding: "8px 24px" });
});

it("removes the card title bar and reduces top padding when a chart title is cleared", () => {
  render(<DashboardViewer dashboard={dashboard({
    components: [{ id: "bar-1", type: "bar", title: "", props: { color: "#1677ff", showLegend: true } }],
  })} />);

  const card = screen.getByLabelText("只读看板画布").querySelector(".ant-card");
  expect(card?.querySelector(".ant-card-head")).not.toBeInTheDocument();
  expect(card?.querySelector(".ant-card-body")).toHaveStyle({ padding: "12px 24px 16px" });
});

it("lets the dashboard header control its own card padding", () => {
  render(<DashboardViewer dashboard={dashboard({
    layout: [{ i: "dashboard-header", x: 0, y: 0, w: 12, h: 4 }],
    components: [{
      id: "dashboard-header",
      type: "dashboardHeader",
      title: "",
      props: {
        headline: "经营数据看板",
        globalFilters: [
          { id: "store", fieldKey: "storeName", label: "店铺名称", controlType: "select", targets: [] },
          { id: "order", fieldKey: "orderNo", label: "单据编号", controlType: "input", targets: [] },
        ],
      },
    }],
  })} mode="preview" />);

  const header = screen.getByLabelText("看板信息栏与全局筛选");
  expect(header.closest(".ant-card")?.querySelector(".ant-card-body")).toHaveStyle({ padding: "0px" });
  expect(screen.getByRole("button", { name: "应用筛选" })).toBeInTheDocument();
});

it("keeps route navigation in the header flow above the dashboard title", () => {
  render(
    <DashboardViewer
      dashboard={dashboard()}
      headerNavigation={<a href="/" aria-label="返回看板首页">返回看板首页</a>}
    />,
  );

  const header = screen.getByRole("heading", { name: "经营看板" }).closest("header");
  expect(header).toContainElement(screen.getByRole("link", { name: "返回看板首页" }));
});

it("uses a compact header density when a preview needs more space for its canvas", () => {
  render(<DashboardViewer dashboard={dashboard()} headerDensity="compact" />);

  expect(screen.getByRole("main")).toHaveStyle({ padding: "16px 24px 24px" });
  expect(screen.getByRole("heading", { name: "经营看板", level: 3 })).toBeInTheDocument();
});

it("renders every configured analysis-group query control, including empty values", () => {
  const orders = Dataset.parse({
    id: "orders",
    name: "订单",
    schemaVersion: "orders-v1",
    fields: [
      { key: "orderNo", label: "订单编号", type: "string", nullable: false },
      { key: "currency", label: "货币标识", type: "string", nullable: false },
    ],
    parameters: [],
  });
  const grouped = dashboard({
    layout: [
      { i: "group-1", x: 0, y: 0, w: 12, h: 8 },
      { i: "table-1", parentId: "group-1", x: 0, y: 0, w: 12, h: 6 },
    ],
    components: [
      {
        id: "group-1",
        type: "analysisGroup",
        title: "订单分析",
        props: {
          description: "",
          columns: 12,
          gap: 12,
          showSurface: true,
          queryFilters: [
            { kind: "fieldText", fieldKey: "orderNo", value: "" },
            { kind: "fieldText", fieldKey: "currency", value: "" },
          ],
        },
      },
      {
        id: "table-1",
        parentId: "group-1",
        type: "table",
        title: "订单明细",
        props: { pageSize: 20, striped: false },
        binding: { datasetId: "orders", slots: { columns: [{ fieldKey: "orderNo" }, { fieldKey: "currency" }] } },
      },
    ],
    datasets: [{ datasetId: "orders", schemaVersion: "orders-v1", parameters: {} }],
  });

  render(<AppProviders><DashboardViewer dashboard={grouped} currentDatasets={new Map([[orders.id, orders]])} /></AppProviders>);

  expect(screen.getByLabelText("复合分析查询条件")).toBeInTheDocument();
  expect(screen.getByText("订单明细")).toBeInTheDocument();
  expect(screen.getByText("订单编号")).toBeInTheDocument();
  expect(screen.getByText("货币标识")).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "复合分析查询值1" })).toHaveValue("");
  expect(screen.getByRole("textbox", { name: "复合分析查询值2" })).toHaveValue("");
});

it("removes component card borders in preview mode", () => {
  render(<DashboardViewer dashboard={dashboard()} mode="preview" />);

  expect((screen.getByText("月收入").closest(".ant-card") as HTMLElement).style.borderWidth).toBe("0px");
});

it("uses a neutral page background in preview mode", () => {
  render(<DashboardViewer dashboard={dashboard()} mode="preview" />);

  expect(screen.getByRole("main")).toHaveStyle({ background: "#fafafa" });
});

it("can hide revision metadata for a minimal preview header", () => {
  render(<DashboardViewer dashboard={dashboard()} showRevision={false} />);

  expect(screen.queryByText("修订版本 2")).not.toBeInTheDocument();
});

it("positions preview cards with the saved editor grid coordinates", () => {
  const positioned = dashboard({
    layout: [
      { i: "table-1", x: 0, y: 0, w: 9, h: 6 },
      { i: "kpi-1", x: 9, y: 0, w: 3, h: 3 },
      { i: "bar-1", x: 3, y: 6, w: 6, h: 5 },
    ],
    components: [
      { id: "table-1", type: "table", title: "交叉表", props: { pageSize: 20, striped: false } },
      { id: "kpi-1", type: "kpi", title: "指标看板", props: { aggregation: "first", prefix: "", suffix: "", decimals: 0 } },
      { id: "bar-1", type: "bar", title: "柱图", props: { color: "#1677ff", showLegend: true } },
    ],
  });

  render(<DashboardViewer dashboard={positioned} mode="preview" />);

  expect(screen.getByText("交叉表").closest(".ant-card")).toHaveStyle({ gridColumn: "1 / span 9", gridRow: "1 / span 6" });
  expect(screen.getByText("指标看板").closest(".ant-card")).toHaveStyle({ gridColumn: "10 / span 3", gridRow: "1 / span 3" });
  expect(screen.getByText("柱图").closest(".ant-card")).toHaveStyle({ gridColumn: "4 / span 6", gridRow: "7 / span 5" });
});

it("keeps preview content inside its saved grid area", () => {
  const compact = dashboard({
    layout: [{ i: "bar-1", x: 0, y: 0, w: 3, h: 2 }],
  });

  render(<DashboardViewer dashboard={compact} mode="preview" />);

  const card = screen.getByText("月收入").closest(".ant-card");
  expect(card).toHaveStyle({ height: "100%", minHeight: "0", overflow: "hidden" });
  expect(card?.querySelector(".ant-card-body")).toHaveStyle({ minHeight: "0", overflow: "hidden" });
});

it("shows an empty read-only state", () => {
  render(<DashboardViewer dashboard={dashboard({ layout: [], components: [] })} />);

  expect(screen.getByText("该看板还没有组件")).toBeInTheDocument();
});

it("isolates unsupported component render failures", () => {
  const broken = dashboard({
    layout: [
      { i: "bad", x: 0, y: 0, w: 6, h: 5 },
      { i: "bar-1", x: 6, y: 0, w: 6, h: 5 },
    ],
    components: [
      { id: "bad", type: "bar", title: "坏图表", props: { throwInViewer: true } },
      { id: "bar-1", type: "bar", title: "月收入", props: { color: "#1677ff", showLegend: true } },
    ],
  });

  render(<DashboardViewer dashboard={broken} mode="preview" />);

  expect(screen.getByText("坏图表渲染失败")).toBeInTheDocument();
  expect(screen.getByText("月收入")).toBeInTheDocument();
});

it("shows dataset schema drift near affected components", () => {
  const currentDataset = Dataset.parse({
    id: "sales",
    name: "销售数据",
    schemaVersion: "v2",
    fields: [{ key: "month", label: "月份", type: "string", nullable: false }],
    parameters: [],
  });
  const bound = dashboard({
    components: [{
      id: "bar-1",
      type: "bar",
      title: "月收入",
      props: { color: "#1677ff", showLegend: true },
      binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" } } },
    }],
    datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
  });

  render(<DashboardViewer dashboard={bound} mode="preview" currentDatasets={new Map([["sales", currentDataset]])} />);

  expect(screen.getByText("数据绑定需要检查")).toBeInTheDocument();
  expect(screen.getByText("数据集 sales 已从 v1 更新到 v2")).toBeInTheDocument();
});

it("queries saved dataset parameters and renders a real KPI value", async () => {
  const bound = dashboard({
    layout: [{ i: "kpi-1", x: 0, y: 0, w: 3, h: 3 }],
    components: [{
      id: "kpi-1",
      type: "kpi",
      title: "总收入",
      props: { aggregation: "first", prefix: "¥", suffix: "", decimals: 0 },
      binding: { datasetId: "sales", slots: { measure: { fieldKey: "revenue" } } },
    }],
    datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: { year: 2026, fromDate: "2026-01-01" } }],
  });

  render(<AppProviders><DashboardViewer dashboard={bound} mode="preview" /></AppProviders>);

  expect(await screen.findByLabelText("总收入指标值")).toHaveTextContent("120000 ¥");
  expect(screen.queryByText("组件类型：kpi")).not.toBeInTheDocument();
});

it("keeps retail paging available inside a published chart", async () => {
  const fields = [
    { key: "billNo", label: "单据编号", type: "string", nullable: false },
    { key: "orderAmt", label: "订单总额", type: "number", nullable: false },
  ];
  const requests: unknown[] = [];
  server.use(
    http.get("http://localhost/datasets/retail-delivery-orders/schema", () => HttpResponse.json({
      id: "retail-delivery-orders",
      name: "零售发货单（业务表）",
      fields: [],
      parameters: [
        { key: "current", label: "当前页", type: "number", required: false, runtime: true, defaultValue: 1 },
        { key: "size", label: "每页条数", type: "number", required: false, runtime: true, defaultValue: 20 },
      ],
      schemaVersion: "retail-delivery-orders-v1",
    })),
    http.post("http://localhost/datasets/retail-delivery-orders/query", async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json({ columns: fields, rows: [{ billNo: "OM001", orderAmt: 100 }], total: 1, sampledAt: "2026-07-24T00:00:00.000Z" });
    }),
  );
  const retail = dashboard({
    components: [{
      id: "bar-1", type: "kpi", title: "零售订单金额", props: { aggregation: "first", prefix: "", suffix: "", decimals: 0 },
      binding: { datasetId: "retail-delivery-orders", slots: { measure: { fieldKey: "orderAmt" } } },
    }],
    datasets: [{ datasetId: "retail-delivery-orders", schemaVersion: "retail-delivery-orders-v1", parameters: {} }],
  });

  render(<AppProviders><DashboardViewer dashboard={retail} /></AppProviders>);

  const current = await screen.findByRole("spinbutton", { name: "当前页" });
  const size = screen.getByRole("spinbutton", { name: "每页条数" });
  await userEvent.clear(current);
  await userEvent.type(current, "3");
  await userEvent.clear(size);
  await userEvent.type(size, "5");
  await userEvent.click(screen.getByRole("button", { name: "查询" }));

  await waitFor(() => expect(requests).toContainEqual({ parameters: { current: 3, size: 5 } }));
});
