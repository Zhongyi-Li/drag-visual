// @vitest-environment jsdom
import { DashboardSchema } from "@drag-visual/contracts";
import { act, render, screen } from "@testing-library/react";
import { theme } from "antd";
import { expect, it, vi } from "vitest";
import { AppProviders } from "../../app/AppProviders.js";
import { ComponentFrame } from "../editor/ComponentFrame.js";
import { createEditorStore } from "../editor/store/editorStore.js";
import { ViewerComponent } from "../viewer/ViewerComponent.js";
vi.mock("./ChartQueryFilterBar.js", () => ({
  ChartQueryFilterBar: () => { const { token } = theme.useToken(); return <span data-testid="query-theme">{token.colorPrimary}</span>; },
}));
const dashboard = DashboardSchema.parse({ schemaVersion: 1, id: "123e4567-e89b-42d3-a456-426614174000", name: "交互主题", theme: { primaryColor: "#a18bfa", backgroundColor: "#ffffff" }, layout: [{ i: "chart", x: 0, y: 0, w: 6, h: 5 }], components: [{ id: "chart", type: "table", title: "明细", props: { queryFilters: [{ kind: "fieldText", fieldKey: "month", operator: "contains", value: "" }] }, binding: { datasetId: "sales", slots: { columns: [{ fieldKey: "month" }] } } }], datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: { year: 2026, fromDate: "2026-01-01" } }], revision: 1, updatedAt: "2026-10-14T00:00:00.000Z" });
it("passes the live dashboard theme to controls outside the editor chart renderer", async () => {
  const store = createEditorStore(dashboard);
  render(<AppProviders><ComponentFrame component={dashboard.components[0]!} store={store} createComponentId={() => "next"} isInteracting={false} /></AppProviders>);
  expect(await screen.findByTestId("query-theme")).toHaveTextContent("#a18bfa");
  act(() => store.getState().dispatch({ type: "dashboard.theme.update", nextTheme: DashboardSchema.parse({ ...dashboard, theme: { ...dashboard.theme, primaryColor: "#36c99a" } }).theme }));
  expect(screen.getByTestId("query-theme")).toHaveTextContent("#36c99a");
});
it("passes the theme to viewer query controls outside the chart renderer", async () => {
  const view = (primaryColor: string) => <AppProviders><ViewerComponent component={dashboard.components[0]!} savedDataset={dashboard.datasets[0]!} theme={{ ...dashboard.theme, primaryColor }} /></AppProviders>;
  const { rerender } = render(view("#a18bfa"));
  expect(await screen.findByTestId("query-theme")).toHaveTextContent("#a18bfa");
  rerender(view("#36c99a"));
  expect(screen.getByTestId("query-theme")).toHaveTextContent("#36c99a");
});
