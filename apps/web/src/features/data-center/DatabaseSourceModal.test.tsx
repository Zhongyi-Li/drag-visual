// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { ConfigProvider } from "antd";
import { DatabaseSourceModal } from "./DatabaseSourceModal.js";
import { createDatabaseDataset, listDatabaseTables } from "../datasets/datasetApi.js";

vi.mock("../datasets/datasetApi.js", () => ({ createDatabaseDataset: vi.fn(), listDatabaseTables: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

const fill = () => {
  fireEvent.change(screen.getByLabelText("数据库地址"), { target: { value: "localhost" } });
  fireEvent.change(screen.getByLabelText("数据库名称"), { target: { value: "sales" } });
  fireEvent.change(screen.getByLabelText("账号"), { target: { value: "reader" } });
  fireEvent.change(screen.getByLabelText("密码"), { target: { value: "secret" } });
};

it("connects, selects a table and creates a reusable source", async () => {
  vi.mocked(listDatabaseTables).mockResolvedValue({ tables: [{ schema: "sales", name: "orders" }] });
  const dataset = { id: "database-1", name: "orders", schemaVersion: "v1", fields: [], parameters: [] };
  vi.mocked(createDatabaseDataset).mockResolvedValue(dataset);
  const created = vi.fn(); const close = vi.fn();
  render(<ConfigProvider theme={{ token: { motion: false } }}><DatabaseSourceModal open onCreated={created} onClose={close} /></ConfigProvider>);
  fill();
  fireEvent.click(screen.getByRole("button", { name: "连接并获取表" }));
  await waitFor(() => expect(screen.getByText("连接成功，找到 1 张表")).toBeVisible());
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "选择数据表" }));
  fireEvent.click(await screen.findByText("sales.orders"));
  fireEvent.click(screen.getByRole("button", { name: "创建数据源" }));
  await waitFor(() => expect(created).toHaveBeenCalledWith(dataset));
  expect(vi.mocked(createDatabaseDataset).mock.calls[0]![0]).toEqual({
    connection: { type: "mysql", host: "localhost", port: 3306, database: "sales", username: "reader", password: "secret", ssl: false },
    table: { schema: "sales", name: "orders" }, name: "orders",
  });
  expect(close).toHaveBeenCalled();
  expect(window.localStorage.length).toBe(0);
});

it("invalidates the tested connection after editing credentials", async () => {
  vi.mocked(listDatabaseTables).mockResolvedValue({ tables: [{ schema: "sales", name: "orders" }] });
  render(<ConfigProvider theme={{ token: { motion: false } }}><DatabaseSourceModal open onCreated={vi.fn()} onClose={vi.fn()} /></ConfigProvider>);
  fill(); fireEvent.click(screen.getByRole("button", { name: "连接并获取表" }));
  await screen.findByText("连接成功，找到 1 张表");
  fireEvent.change(screen.getByLabelText("密码"), { target: { value: "changed" } });
  expect(screen.queryByText("连接成功，找到 1 张表")).toBeNull();
  expect(screen.getByRole("button", { name: "创建数据源" })).toBeDisabled();
});

it("shows connection errors and permits a retry", async () => {
  vi.mocked(listDatabaseTables).mockRejectedValueOnce(new Error("无法连接数据库"));
  render(<ConfigProvider theme={{ token: { motion: false } }}><DatabaseSourceModal open onCreated={vi.fn()} onClose={vi.fn()} /></ConfigProvider>);
  fill(); fireEvent.click(screen.getByRole("button", { name: "连接并获取表" }));
  await waitFor(() => expect(screen.getByText("无法连接数据库")).toBeVisible());
  expect(screen.getByRole("button", { name: "创建数据源" })).toBeDisabled();
  vi.mocked(listDatabaseTables).mockResolvedValueOnce({ tables: [] });
  fireEvent.click(screen.getByRole("button", { name: "连接并获取表" }));
  await waitFor(() => expect(screen.getByText("连接成功，当前账号下没有可选择的表")).toBeVisible());
});
