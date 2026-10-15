// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppProviders } from "../../app/AppProviders.js";
import { datasetFixtures } from "../../mocks/fixtures.js";
import { server } from "../../mocks/server.js";
import { DatasetDetail } from "./DatasetDetail.js";

describe("DatasetDetail field selection", () => {
  it("supports select all and clear all, and blocks the next step when no field is selected", async () => {
    const dataset = { ...datasetFixtures[0]!, id: "uploaded-1" };
    server.use(
      http.get("*/datasets/uploaded-1/schema", () => HttpResponse.json(dataset)),
      http.get("*/datasets/uploaded-1/draft", () => HttpResponse.json({
        dataset,
        calculatedFields: [],
        combine: { kind: "join", sourceDatasetId: "inventory", joinType: "left", leftField: "month", rightField: "sku", selectedFields: [] },
        filters: [],
        selectedFields: null,
        version: 1,
        publishedVersion: 0,
        publishedAt: null,
      })),
    );

    render(
      <MemoryRouter initialEntries={["/data/datasets/uploaded-1"]}>
        <AppProviders>
          <Routes><Route path="/data/datasets/:datasetId" element={<DatasetDetail />} /></Routes>
        </AppProviders>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "下一步：派生字段" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "下一步：派生字段" }));
    fireEvent.click(screen.getByRole("button", { name: "下一步：字段选择" }));

    expect(screen.getByText("已选 4 / 4 个字段")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全选" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "取消全选" }));
    expect(screen.getByText("已选 0 / 4 个字段")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一步：结果筛选" })).toBeDisabled();
    expect(within(screen.getByRole("navigation", { name: "加工步骤导航" })).getAllByRole("button")[3]).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "月份" }));
    expect(screen.getByText("已选 1 / 4 个字段")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一步：结果筛选" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "全选" }));
    expect(screen.getByText("已选 4 / 4 个字段")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox").every((checkbox) => (checkbox as HTMLInputElement).checked)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "下一步：结果筛选" }));
    expect(screen.getByRole("heading", { name: "结果筛选" })).toBeInTheDocument();
  });

  it.each([
    { caseName: "未选择第二数据集", startWithJoin: false },
    { caseName: "未设置匹配字段", startWithJoin: true },
  ])("blocks advancing or skipping the incomplete join when $caseName", async ({ startWithJoin }) => {
    const dataset = { ...datasetFixtures[0]!, id: "uploaded-1" };
    server.use(
      http.get("*/datasets/uploaded-1/schema", () => HttpResponse.json(dataset)),
      http.get("*/datasets/uploaded-1/draft", () => HttpResponse.json({
        dataset,
        calculatedFields: [],
        combine: startWithJoin ? { kind: "join", sourceDatasetId: "inventory", joinType: "left", leftField: "month", rightField: "sku", selectedFields: ["sku"] } : null,
        filters: [],
        selectedFields: null,
        version: 1,
        publishedVersion: 0,
        publishedAt: null,
      })),
    );

    render(
      <MemoryRouter initialEntries={["/data/datasets/uploaded-1"]}>
        <AppProviders>
          <Routes><Route path="/data/datasets/:datasetId" element={<DatasetDetail />} /></Routes>
        </AppProviders>
      </MemoryRouter>,
    );

    if (startWithJoin) {
      fireEvent.click(await screen.findByRole("button", { name: /添加匹配条件/ }));
    } else {
      await waitFor(() => expect(screen.getByRole("button", { name: "下一步：派生字段" })).toBeDisabled());
      expect(within(screen.getByRole("navigation", { name: "加工步骤导航" })).getAllByRole("button")[1]).toBeDisabled();
      fireEvent.click(await screen.findByRole("button", { name: /添加下一步整合/ }));
    }
    await waitFor(() => expect(screen.getByRole("button", { name: "下一步：派生字段" })).toBeDisabled());
    expect(screen.queryByText("整合配置尚未完成")).not.toBeInTheDocument();
    const navButtons = within(screen.getByRole("navigation", { name: "加工步骤导航" })).getAllByRole("button");
    expect(navButtons.slice(1).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    fireEvent.click(navButtons[1]!);
    expect(screen.getByRole("heading", { name: "数据关联" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: startWithJoin ? "删除匹配条件 2" : "删除整合步骤 1" }));
    if (startWithJoin) {
      expect(screen.getByRole("button", { name: "下一步：派生字段" })).toBeEnabled();
    } else {
      expect(screen.getByRole("button", { name: "下一步：派生字段" })).toBeDisabled();
    }
  });
});
