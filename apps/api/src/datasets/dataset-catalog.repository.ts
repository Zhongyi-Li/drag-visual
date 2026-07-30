import type {
  Dataset,
  DatasetQueryRequest,
  DatasetQueryResult,
  DatasetSummary,
} from "@drag-visual/contracts";
import { Inject, Injectable } from "@nestjs/common";

import type { DatasetRepository } from "./dataset.repository.js";
import { RetailOrderDatasetRepository } from "./retail-order-dataset.repository.js";

@Injectable()
export class DatasetCatalogRepository implements DatasetRepository {
  constructor(
    @Inject(RetailOrderDatasetRepository)
    private readonly retailOrders: RetailOrderDatasetRepository,
  ) {}

  async list(): Promise<readonly DatasetSummary[]> {
    return this.retailOrders.list();
  }

  async getSchema(id: string): Promise<Dataset | null> {
    return this.retailOrders.getSchema(id);
  }

  async query(id: string, request: DatasetQueryRequest): Promise<DatasetQueryResult | null> {
    return this.retailOrders.query(id, request);
  }
}
