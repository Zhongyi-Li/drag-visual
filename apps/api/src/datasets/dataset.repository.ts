import type {
  Dataset,
  DatasetCalculatedField,
  DatasetDraftUpdateRequest,
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

export const DATASET_REPOSITORY = Symbol("DATASET_REPOSITORY");

export interface DatasetRepository {
  /**
   * `ownerId` scopes user-uploaded datasets. Catalog datasets remain visible
   * to every authenticated user, but an omitted owner must never expose a
   * user's uploaded data.
   */
  list(ownerId?: string): Promise<readonly DatasetSummary[]>;
  getSchema(id: string, ownerId?: string): Promise<Dataset | null>;
  query(
    id: string,
    request: DatasetQueryRequest,
    ownerId?: string,
  ): Promise<DatasetQueryResult | null>;
  getFieldOptions?(
    id: string,
    fieldKey: string,
    search: string | undefined,
    limit: number,
    ownerId?: string,
  ): Promise<DatasetFieldOptions | null>;
  getDraft?(id: string, ownerId?: string): Promise<DatasetDraft | null>;
  updateDraft?(id: string, ownerId: string, request: DatasetDraftUpdateRequest): Promise<DatasetDraft | null>;
  publishDraft?(id: string, ownerId: string, request: DatasetProcessingPublishRequest): Promise<DatasetProcessingPublishResult | null>;
  previewDraft?(id: string, ownerId: string, request: DatasetDraftPreviewRequest): Promise<DatasetQueryResult | null>;
  listProcessingTasks?(ownerId: string): Promise<readonly DatasetProcessingTask[]>;
  listProcessingRecords?(ownerId: string): Promise<readonly DatasetProcessingRecord[]>;
}
