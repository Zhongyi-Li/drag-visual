import type { Pool, RowDataPacket } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import { DatasetUpstreamError } from "./dataset.errors.js";
import {
  RETAIL_ORDER_DATASET_ID,
  RetailOrderDatasetRepository,
  STORAGE_TURNOVER_DATASET_ID,
  StorageTurnoverDatasetRepository,
  validateRetailOrderResultLimit,
} from "./retail-order-dataset.repository.js";
import { DatasetService } from "./dataset.service.js";

const mysqlColumns = [
  { sourceKey: "order_no", label: "订单编号", dataType: "varchar", nullable: "NO" },
  { sourceKey: "bill_no", label: "单据编号", dataType: "varchar", nullable: "YES" },
  { sourceKey: "buyer_actual_pay", label: "买家实付金额", dataType: "decimal", nullable: "YES" },
  { sourceKey: "order_time", label: "订单时间", dataType: "datetime", nullable: "YES" },
] as RowDataPacket[];
const mysqlTableComment = [{ tableComment: "零售发货单（业务表）" }] as RowDataPacket[];
const storageTurnoverColumns = [
  { sourceKey: "id", label: "主键ID", dataType: "bigint", nullable: "NO" },
  { sourceKey: "turnover_days", label: "周转天数", dataType: "int", nullable: "YES" },
] as RowDataPacket[];

const mysqlPool = (execute: ReturnType<typeof vi.fn>): Pool => ({ execute } as unknown as Pool);

describe("RetailOrderDatasetRepository", () => {
  it("maps MySQL retail order rows to the existing dataset contract", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([mysqlColumns, []])
      .mockResolvedValueOnce([mysqlTableComment, []])
      .mockResolvedValueOnce([[{ total: 63235 }], []])
      .mockResolvedValueOnce([[
        {
          order_no: "3075545918444315",
          bill_no: "OM26061500000283",
          buyer_actual_pay: 164.46,
          order_time: "2026-06-15 00:50:09",
        },
      ], []]);
    const repository = new RetailOrderDatasetRepository(mysqlPool(execute));

    const result = await new DatasetService(repository).query(RETAIL_ORDER_DATASET_ID, {
      parameters: { limit: 50 },
    });

    expect(execute).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("ORDER BY `order_time` DESC LIMIT 50"),
    );
    expect(result).toMatchObject({
      total: 63235,
      datasetName: "零售发货单（业务表）",
      columns: expect.arrayContaining([
        { key: "buyerActualPay", label: "买家实付金额", type: "number", nullable: true },
        { key: "orderTime", label: "订单时间", type: "date", nullable: true },
      ]),
      rows: [{
        orderNo: "3075545918444315",
        billNo: "OM26061500000283",
        buyerActualPay: 164.46,
        orderTime: "2026-06-15 00:50:09",
      }],
    });
  });

  it("uses a safe default result limit and maps database failures", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([mysqlColumns, []])
      .mockResolvedValueOnce([mysqlTableComment, []])
      .mockRejectedValueOnce(new Error("database unavailable"));
    const repository = new RetailOrderDatasetRepository(mysqlPool(execute));

    await expect(repository.query(RETAIL_ORDER_DATASET_ID, { parameters: {} })).rejects.toBeInstanceOf(DatasetUpstreamError);
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("aggregates each numeric measure by the requested business dimension", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([mysqlColumns, []])
      .mockResolvedValueOnce([mysqlTableComment, []])
      .mockResolvedValueOnce([[{ total: 2 }], []])
      .mockResolvedValueOnce([[
        { bill_no: "OM001", buyer_actual_pay: 320.25 },
        { bill_no: "OM002", buyer_actual_pay: 164.46 },
      ], []]);
    const repository = new RetailOrderDatasetRepository(mysqlPool(execute));

    const result = await new DatasetService(repository).query(RETAIL_ORDER_DATASET_ID, {
      parameters: { limit: 20 },
      aggregation: {
        groupBy: ["billNo"],
        measures: [{ fieldKey: "buyerActualPay", aggregation: "sum" }],
      },
    });

    expect(execute).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("SELECT COUNT(*) AS total FROM (SELECT 1 FROM `os`.`os_order_combined` GROUP BY `bill_no`) AS grouped_rows"),
    );
    expect(execute).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("SUM(`buyer_actual_pay`) AS `buyer_actual_pay` FROM `os`.`os_order_combined` GROUP BY `bill_no` ORDER BY `bill_no` ASC LIMIT 20"),
    );
    expect(result).toMatchObject({
      total: 2,
      columns: [
        { key: "billNo", type: "string" },
        { key: "buyerActualPay", type: "number", nullable: true },
      ],
      rows: [
        { billNo: "OM001", buyerActualPay: 320.25 },
        { billNo: "OM002", buyerActualPay: 164.46 },
      ],
    });
  });

  it("filters raw rows before counting or aggregating by the selected date field", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([mysqlColumns, []])
      .mockResolvedValueOnce([mysqlTableComment, []])
      .mockResolvedValueOnce([[{ total: 1 }], []])
      .mockResolvedValueOnce([[] , []]);
    const repository = new RetailOrderDatasetRepository(mysqlPool(execute));

    await new DatasetService(repository).query(RETAIL_ORDER_DATASET_ID, {
      parameters: { limit: 20 },
      filters: [{ kind: "dateRange", fieldKey: "orderTime", start: "2026-07-01", end: "2026-07-31", timezone: "Asia/Shanghai" }],
      aggregation: {
        groupBy: ["billNo"],
        measures: [{ fieldKey: "buyerActualPay", aggregation: "sum" }],
      },
    });

    expect(execute).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("FROM `os`.`os_order_combined` WHERE `order_time` >= ? AND `order_time` < ? GROUP BY `bill_no`"),
      ["2026-07-01", "2026-08-01"],
    );
    expect(execute).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("FROM `os`.`os_order_combined` WHERE `order_time` >= ? AND `order_time` < ? GROUP BY `bill_no`"),
      ["2026-07-01", "2026-08-01"],
    );
  });

  it("enforces a positive bounded result limit", () => {
    expect(validateRetailOrderResultLimit({})).toBe(true);
    expect(validateRetailOrderResultLimit({ limit: 5_000 })).toBe(true);
    expect(validateRetailOrderResultLimit({ limit: 0 })).toBe(false);
    expect(validateRetailOrderResultLimit({ limit: 5_001 })).toBe(false);
    expect(validateRetailOrderResultLimit({ limit: 1.5 })).toBe(false);
  });

  it("uses the table comment as the dataset name", async () => {
    const execute = vi.fn().mockResolvedValueOnce([[{ tableComment: "零售订单汇总" }], []]);
    const repository = new RetailOrderDatasetRepository(mysqlPool(execute));

    await expect(repository.list()).resolves.toEqual([{
      id: RETAIL_ORDER_DATASET_ID,
      name: "零售订单汇总",
      schemaVersion: "retail-delivery-orders-v2",
    }]);
    expect(execute).toHaveBeenCalledWith(
      expect.stringContaining("FROM INFORMATION_SCHEMA.TABLES"),
      ["os", "os_order_combined"],
    );
  });

  it("retries schema discovery after a transient upstream failure", async () => {
    const execute = vi.fn()
      .mockRejectedValueOnce(new Error("database temporarily unavailable"))
      .mockResolvedValueOnce([mysqlColumns, []])
      .mockResolvedValueOnce([mysqlTableComment, []]);
    const repository = new RetailOrderDatasetRepository(mysqlPool(execute));

    await expect(repository.getSchema(RETAIL_ORDER_DATASET_ID)).rejects.toBeInstanceOf(DatasetUpstreamError);
    const schema = await repository.getSchema(RETAIL_ORDER_DATASET_ID);
    expect(schema).toMatchObject({ id: RETAIL_ORDER_DATASET_ID, name: "零售发货单（业务表）" });
    expect(schema?.fields).toContainEqual(expect.objectContaining({ key: "orderNo" }));
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it("retries dataset-name discovery after a transient upstream failure", async () => {
    const execute = vi.fn()
      .mockRejectedValueOnce(new Error("database temporarily unavailable"))
      .mockResolvedValueOnce([mysqlTableComment, []]);
    const repository = new RetailOrderDatasetRepository(mysqlPool(execute));

    await expect(repository.list()).rejects.toBeInstanceOf(DatasetUpstreamError);
    await expect(repository.list()).resolves.toEqual([{
      id: RETAIL_ORDER_DATASET_ID,
      name: "零售发货单（业务表）",
      schemaVersion: "retail-delivery-orders-v2",
    }]);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("exposes storage turnover as an independent dataset ordered by its primary key", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([storageTurnoverColumns, []])
      .mockResolvedValueOnce([[{ tableComment: "库存周转天数清洗表" }], []])
      .mockResolvedValueOnce([[{ total: 1 }], []])
      .mockResolvedValueOnce([[
        { id: 9, turnover_days: 17 },
      ], []]);
    const repository = new StorageTurnoverDatasetRepository(mysqlPool(execute));

    const result = await new DatasetService(repository).query(STORAGE_TURNOVER_DATASET_ID, { parameters: { limit: 10 } });

    expect(execute).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining("FROM `os`.`os_storage_turnover` ORDER BY `id` DESC LIMIT 10"),
    );
    expect(result).toMatchObject({ datasetName: "库存周转天数清洗表", rows: [{ id: 9, turnoverDays: 17 }] });
    expect(result.columns).toContainEqual(expect.objectContaining({ key: "turnoverDays", type: "number" }));
  });
});
