import type {
  Dataset,
  DatasetQueryRequest,
  DatasetQueryResult,
  DatasetSummary,
} from "@drag-visual/contracts";

export const DATASET_REPOSITORY = Symbol("DATASET_REPOSITORY");

export interface DatasetRepository {
  list(): Promise<readonly DatasetSummary[]>;
  getSchema(id: string): Promise<Dataset | null>;
  query(
    id: string,
    request: DatasetQueryRequest,
  ): Promise<DatasetQueryResult | null>;
}
