import type {
  Dataset,
  DatasetCalculatedField,
  DatasetDraft,
  DatasetDraftPreviewRequest,
  DatasetProcessingPublishRequest,
  DatasetProcessingPublishResult,
  DatasetProcessingRecord,
  DatasetProcessingTask,
  DatasetFieldOptions,
  DatasetQueryRequest,
  DatasetQueryResult,
  DatasetSummary,
} from "@drag-visual/contracts";
import { Inject, Injectable, Logger } from "@nestjs/common";

import type { DatasetRepository } from "./dataset.repository.js";
import {
  OrderProfitReportDatasetRepository,
  ORDER_PROFIT_REPORT_DATASET_ID,
  RetailOrderDatasetRepository,
  RETAIL_ORDER_DATASET_ID,
  SgStorageDatasetRepository,
  SG_STORAGE_DATASET_ID,
  StorageTurnoverDatasetRepository,
  STORAGE_TURNOVER_DATASET_ID,
} from "./retail-order-dataset.repository.js";
import { UploadedDatasetRepository } from "./uploaded-dataset.repository.js";

@Injectable()
export class DatasetCatalogRepository implements DatasetRepository {
  private readonly logger = new Logger(DatasetCatalogRepository.name);

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
    const sources: readonly { name: string; load: () => Promise<readonly DatasetSummary[]> }[] = [
      { name: "retail-orders", load: () => this.retailOrders.list() },
      { name: "storage-turnover", load: () => this.storageTurnover.list() },
      { name: "order-profit-report", load: () => this.orderProfitReport.list() },
      { name: "sg-storage", load: () => this.sgStorage.list() },
      { name: "uploaded", load: () => this.uploadedDatasets.list(ownerId) },
    ];
    const results = await Promise.allSettled(sources.map((source) => source.load()));
    return results.flatMap((result, index) => {
      if (result.status === "fulfilled") return result.value;
      this.logger.warn(`Dataset source ${sources[index]!.name} is unavailable; omitted from catalog list.`);
      return [];
    });
  }

  async getSchema(id: string, ownerId?: string): Promise<Dataset | null> {
    return (await this.catalogRepository(id)?.getSchema(id)) ?? this.uploadedDatasets.getSchema(id, ownerId);
  }

  async query(
    id: string,
    request: DatasetQueryRequest,
    ownerId?: string,
  ): Promise<DatasetQueryResult | null> {
    return (await this.catalogRepository(id)?.query(id, request)) ?? this.uploadedDatasets.query(id, request, ownerId);
  }

  async getFieldOptions(id: string, fieldKey: string, search: string | undefined, limit: number, ownerId?: string): Promise<DatasetFieldOptions | null> {
    return (await this.catalogRepository(id)?.getFieldOptions(id, fieldKey, search, limit))
      ?? this.uploadedDatasets.getFieldOptions(id, fieldKey, search, limit, ownerId);
  }

  private catalogRepository(id: string): RetailOrderDatasetRepository | null {
    if (id === RETAIL_ORDER_DATASET_ID) return this.retailOrders;
    if (id === STORAGE_TURNOVER_DATASET_ID) return this.storageTurnover;
    if (id === ORDER_PROFIT_REPORT_DATASET_ID) return this.orderProfitReport;
    if (id === SG_STORAGE_DATASET_ID) return this.sgStorage;
    return null;
  }

  async getDraft(id: string, ownerId?: string): Promise<DatasetDraft | null> {
    return this.uploadedDatasets.getDraft(id, ownerId);
  }

  async updateDraft(id: string, ownerId: string, request: import("@drag-visual/contracts").DatasetDraftUpdateRequest): Promise<DatasetDraft | null> {
    return this.uploadedDatasets.updateDraft(id, ownerId, request);
  }

  async publishDraft(id: string, ownerId: string, request: DatasetProcessingPublishRequest): Promise<DatasetProcessingPublishResult | null> {
    return this.uploadedDatasets.publishDraft(id, ownerId, request);
  }

  async previewDraft(id: string, ownerId: string, request: DatasetDraftPreviewRequest): Promise<DatasetQueryResult | null> {
    return this.uploadedDatasets.previewDraft(id, ownerId, request);
  }

  async listProcessingTasks(ownerId: string): Promise<readonly DatasetProcessingTask[]> {
    return this.uploadedDatasets.listProcessingTasks(ownerId);
  }

  async listProcessingRecords(ownerId: string): Promise<readonly DatasetProcessingRecord[]> {
    return this.uploadedDatasets.listProcessingRecords(ownerId);
  }
}
