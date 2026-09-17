import type {
  Dataset,
  DatasetFieldOptions,
  DatasetQueryRequest,
  DatasetQueryResult,
  DatasetSummary,
} from "@drag-visual/contracts";
import { Inject, Injectable } from "@nestjs/common";

import type { DatasetRepository } from "./dataset.repository.js";
import {
  OrderProfitReportDatasetRepository,
  RetailOrderDatasetRepository,
  SgStorageDatasetRepository,
  StorageTurnoverDatasetRepository,
} from "./retail-order-dataset.repository.js";
import { UploadedDatasetRepository } from "./uploaded-dataset.repository.js";

@Injectable()
export class DatasetCatalogRepository implements DatasetRepository {
  constructor(
    @Inject(RetailOrderDatasetRepository)
    private readonly retailOrders: RetailOrderDatasetRepository,
    @Inject(StorageTurnoverDatasetRepository)
    private readonly storageTurnover: StorageTurnoverDatasetRepository,
    @Inject(OrderProfitReportDatasetRepository)
    private readonly orderProfitReport: OrderProfitReportDatasetRepository,
    @Inject(SgStorageDatasetRepository)
    private readonly sgStorage: SgStorageDatasetRepository,
    @Inject(UploadedDatasetRepository)
    private readonly uploadedDatasets: UploadedDatasetRepository,
  ) {}

  async list(ownerId?: string): Promise<readonly DatasetSummary[]> {
    const [retail, storageTurnover, orderProfitReport, sgStorage, uploaded] = await Promise.all([
      this.retailOrders.list(),
      this.storageTurnover.list(),
      this.orderProfitReport.list(),
      this.sgStorage.list(),
      this.uploadedDatasets.list(ownerId),
    ]);
    return [...retail, ...storageTurnover, ...orderProfitReport, ...sgStorage, ...uploaded];
  }

  async getSchema(id: string, ownerId?: string): Promise<Dataset | null> {
    const catalog = await this.retailOrders.getSchema(id);
    return catalog
      ?? await this.storageTurnover.getSchema(id)
      ?? await this.orderProfitReport.getSchema(id)
      ?? await this.sgStorage.getSchema(id)
      ?? this.uploadedDatasets.getSchema(id, ownerId);
  }

  async query(
    id: string,
    request: DatasetQueryRequest,
    ownerId?: string,
  ): Promise<DatasetQueryResult | null> {
    const catalog = await this.retailOrders.query(id, request);
    return catalog
      ?? await this.storageTurnover.query(id, request)
      ?? await this.orderProfitReport.query(id, request)
      ?? await this.sgStorage.query(id, request)
      ?? this.uploadedDatasets.query(id, request, ownerId);
  }

  async getFieldOptions(id: string, fieldKey: string, search: string | undefined, limit: number, ownerId?: string): Promise<DatasetFieldOptions | null> {
    const catalog = await this.retailOrders.getFieldOptions(id, fieldKey, search, limit);
    return catalog
      ?? await this.storageTurnover.getFieldOptions(id, fieldKey, search, limit)
      ?? await this.orderProfitReport.getFieldOptions(id, fieldKey, search, limit)
      ?? await this.sgStorage.getFieldOptions(id, fieldKey, search, limit)
      ?? this.uploadedDatasets.getFieldOptions(id, fieldKey, search, limit, ownerId);
  }
}
