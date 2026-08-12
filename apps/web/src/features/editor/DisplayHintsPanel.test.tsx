// @vitest-environment jsdom

import { DashboardSchema } from "@drag-visual/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { DisplayHintsPanel } from "./DisplayHintsPanel.js";
import { createEditorStore } from "./store/editorStore.js";

const createStore = () => createEditorStore(DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "销售分析",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [{ i: "bar-1", x: 0, y: 0, w: 6, h: 5 }],
  components: [{
    id: "bar-1", type: "bar", title: "库存分析", props: { color: "#1677ff", showLegend: true },
    binding: { datasetId: "inventory", slots: { dimension: { fieldKey: "product" }, measure: [{ fieldKey: "stockQty" }] } },
  }],
  datasets: [{ datasetId: "inventory", schemaVersion: "v1", parameters: {} }],
  revision: 1,
  updatedAt: "2026-08-06T08:00:00.000Z",
}));

it("configures an annotation from its text input and visual position selector", async () => {
  const store = createStore();
  const component = store.getState().history.present.components[0]!;
  render(<AppProviders><DisplayHintsPanel component={component} store={store} /></AppProviders>);

  expect(screen.getAllByRole("textbox", { name: /说明文本/ })).toHaveLength(4);
  await userEvent.type(screen.getByRole("textbox", { name: "左上说明文本" }), "最高 1,660 件");
  await userEvent.tab();
  await userEvent.click(screen.getByRole("button", { name: "选择左上说明的位置" }));
  await userEvent.click(screen.getByRole("button", { name: "移动到右下" }));

  expect(store.getState().history.present.components[0]?.displayAnnotations).toMatchObject({
    annotations: [{ position: "bottomRight", text: "最高 1,660 件" }], unitText: "",
  });
});

it("releases a position when its annotation is cleared", async () => {
  const store = createStore();
  store.getState().dispatch({
    type: "component.display-annotations.update", componentId: "bar-1",
    nextDisplayAnnotations: { annotations: [{ position: "topLeft", text: "数量 / 天数" }], unitText: "" },
  });
  const component = store.getState().history.present.components[0]!;
  render(<AppProviders><DisplayHintsPanel component={component} store={store} /></AppProviders>);

  expect(screen.getAllByRole("textbox", { name: /说明文本/ })).toHaveLength(4);
  const input = screen.getByRole("textbox", { name: "左上说明文本" });
  await userEvent.clear(input);
  await userEvent.tab();

  await waitFor(() => expect(store.getState().history.present.components[0]?.displayAnnotations).toMatchObject({ annotations: [], unitText: "" }));
});
