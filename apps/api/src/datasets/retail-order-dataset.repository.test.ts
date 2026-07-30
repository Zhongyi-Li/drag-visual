import type { Pool, RowDataPacket } from "mysql2/promise";
import { describe, expect, it, vi } from "vitest";

import { DatasetUpstreamError } from "./dataset.errors.js";
import {
  RETAIL_ORDER_DATASET_ID,
  RetailOrderDatasetRepository,
  validateRetailOrderResultLimit,
} from "./retail-order-dataset.repository.js";
import { DatasetService } from "./dataset.service.js";

const mysqlColumns = [
  { sourceKey: "order_no", label: "订单编号", dataType: "varchar", nullable: "NO" },
  { sourceKey: "bill_no", label: "单据编号", dataType: "varchar", nullable: "YES" },
  { sourceKey: "buyer_actual_pay", label: "买家实付金额", dataType: "decimal", nullable: "YES" },
  { sourceKey: "order_time", label: "订单时间", dataType: "datetime", nullable: "YES" },
] as RowDataPacket[];

const mysqlPool = (execute: ReturnType<typeof vi.fn>): Pool => ({ execute } as unknown as Pool);

describe("RetailOrderDatasetRepository", () => {
  it("maps MySQL retail order rows to the existing dataset contract", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([mysqlColumns, []])
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

    expect(execute).toHaveBeenLastCalledWith(
      expect.stringContaining("ORDER BY `order_time` DESC LIMIT 50"),
    );
    expect(result).toMatchObject({
      total: 63235,
      datasetName: "零售发货单",
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
      .mockRejectedValueOnce(new Error("database unavailable"));
    const repository = new RetailOrderDatasetRepository(mysqlPool(execute));

    await expect(repository.query(RETAIL_ORDER_DATASET_ID, { parameters: {} })).rejects.toBeInstanceOf(DatasetUpstreamError);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("aggregates each numeric measure by the requested business dimension", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce([mysqlColumns, []])
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
      2,
      expect.stringContaining("SELECT COUNT(*) AS total FROM (SELECT 1 FROM `os`.`os_order_combined` GROUP BY `bill_no`) AS grouped_rows"),
    );
    expect(execute).toHaveBeenLastCalledWith(
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

  it("enforces a positive bounded result limit", () => {
    expect(validateRetailOrderResultLimit({})).toBe(true);
    expect(validateRetailOrderResultLimit({ limit: 5_000 })).toBe(true);
    expect(validateRetailOrderResultLimit({ limit: 0 })).toBe(false);
    expect(validateRetailOrderResultLimit({ limit: 5_001 })).toBe(false);
    expect(validateRetailOrderResultLimit({ limit: 1.5 })).toBe(false);
  });
});
