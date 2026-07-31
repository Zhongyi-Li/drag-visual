// @vitest-environment jsdom

import { DashboardSchema } from "@drag-visual/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { FIELD_DRAG_TYPE } from "./fieldDrag.js";
import { DateFilterConfigurationPanel } from "./DateFilterConfigurationPanel.js";
import { createEditorStore } from "./store/editorStore.js";

const fields = [
  { key: "orderTime", label: "订单时间", type: "date", nullable: false },
  { key: "paymentTime", label: "支付时间", type: "date", nullable: false },
] as const;

vi.mock("../datasets/LocalDatasetProvider.js", () => ({
  LocalDatasetProvider: ({ children }: { readonly children: React.ReactNode }) => children,
  useLocalDatasets: () => ({
    getDataset: (datasetId: string) => datasetId === "sales" ? {
      id: "sales", name: "销售数据", schemaVersion: "v1", fields, parameters: [],
    } : undefined,
  }),
}));

const dashboard = DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
  components: [{
    id: "bar-1", type: "bar", title: "销售额", props: { color: "#1677ff", showLegend: true },
    binding: {
      datasetId: "sales", slots: {},
      dateFilter: { fieldKey: "orderTime", defaultPreset: "all", allowCustom: true, timezone: "Asia/Shanghai" },
    },
  }],
  datasets: [{ datasetId: "sales", schemaVersion: "v1", parameters: {} }],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
});

describe("DateFilterConfigurationPanel", () => {
  it("accepts a date field dropped from the data panel", async () => {
    const store = createEditorStore(dashboard);
    const component = store.getState().history.present.components[0]!;
    render(<AppProviders><DateFilterConfigurationPanel store={store} component={component} /></AppProviders>);

    const dropZone = await screen.findByLabelText("筛选字段拖放区域");
    const dataTransfer = {
      types: [FIELD_DRAG_TYPE],
      getData: vi.fn(() => "paymentTime"),
    };
    fireEvent.dragEnter(dropZone, { dataTransfer });
    fireEvent.drop(dropZone, { dataTransfer });

    await waitFor(() => expect(store.getState().history.present.components[0]!.binding?.dateFilter?.fieldKey).toBe("paymentTime"));
  });
});
