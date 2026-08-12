import {
  Dataset,
  DatasetFieldOptions,
  DatasetQueryResult,
  DatasetSummary,
  type DatasetFilter,
  type DatasetField,
  type DatasetQueryRequest,
  type QueryParameter,
} from "@drag-visual/contracts";
import { Inject, Injectable } from "@nestjs/common";

import {
  DATASET_REPOSITORY,
  type DatasetRepository,
} from "./dataset.repository.js";
import {
  DatasetInvalidResponseError,
  DatasetNotFoundError,
  DatasetQueryInvalidError,
} from "./dataset.errors.js";
import {
  RETAIL_ORDER_DATASET_ID,
  STORAGE_TURNOVER_DATASET_ID,
  validateRetailOrderResultLimit,
  validateStorageTurnoverResultLimit,
} from "./retail-order-dataset.repository.js";

export {
  DatasetInvalidResponseError,
  DatasetNotFoundError,
  DatasetQueryInvalidError,
} from "./dataset.errors.js";

const DATASET_BODY_LIMIT = 5 * 1024 * 1024;

const calendarDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const calendarDay = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value) && calendarDate(value);

const valueMatchesType = (
  value: unknown,
  type: DatasetField["type"],
): boolean => {
  if (type === "date") return typeof value === "string" && calendarDate(value);
  return typeof value === type;
};

@Injectable()
export class DatasetService {
  constructor(
    @Inject(DATASET_REPOSITORY)
    private readonly repository: DatasetRepository,
  ) {}

  async list(ownerId?: string) {
    return DatasetSummary.array().parse(await this.repository.list(ownerId));
  }

  async getSchema(id: string, ownerId?: string) {
    const dataset = await this.repository.getSchema(id, ownerId);
    if (!dataset) throw new DatasetNotFoundError(id);
    return Dataset.parse(dataset);
  }

  async query(id: string, request: DatasetQueryRequest, ownerId?: string) {
    const dataset = await this.getSchema(id, ownerId);
    this.validateParameters(dataset.parameters, request.parameters);
    const filters = this.combinedFilters(request);
    this.validateFilters(dataset.fields, filters);
    this.validateAggregation(dataset.fields, request.aggregation);
    if ((id === RETAIL_ORDER_DATASET_ID && !validateRetailOrderResultLimit(request.parameters))
      || (id === STORAGE_TURNOVER_DATASET_ID && !validateStorageTurnoverResultLimit(request.parameters))) {
      throw new DatasetQueryInvalidError();
    }
    const { globalFilters: _globalFilters, componentFilters: _componentFilters, ...repositoryRequest } = request;
    const result = await this.repository.query(id, { ...repositoryRequest, ...(filters === undefined ? {} : { filters }) }, ownerId);
    if (!result) throw new DatasetNotFoundError(id);
    return this.validateResult(result);
  }

  private combinedFilters(request: DatasetQueryRequest): DatasetFilter[] | undefined {
    if (request.filters !== undefined) return [...request.filters];
    const filters = [...(request.globalFilters ?? []), ...(request.componentFilters ?? [])];
    return filters.length === 0 ? undefined : filters;
  }

  async getFieldOptions(id: string, fieldKey: string, search: string | undefined, limit: number, ownerId?: string) {
    const dataset = await this.getSchema(id, ownerId);
    const field = dataset.fields.find((candidate) => candidate.key === fieldKey);
    if (field === undefined || field.type === "number" || field.type === "date") throw new DatasetQueryInvalidError();
    const result = await this.repository.getFieldOptions?.(id, fieldKey, search, limit, ownerId);
    if (!result) throw new DatasetNotFoundError(id);
    return DatasetFieldOptions.parse(result);
  }

  private validateParameters(
    parameters: readonly QueryParameter[],
    values: Record<string, unknown>,
  ): void {
    const known = new Map(
      parameters.map((parameter) => [parameter.key, parameter]),
    );
    for (const [key, value] of Object.entries(values)) {
      const parameter = known.get(key);
      if (
        !parameter ||
        value === null ||
        !valueMatchesType(value, parameter.type)
      ) {
        throw new DatasetQueryInvalidError();
      }
    }
    for (const parameter of parameters) {
      if (
        parameter.required &&
        (!Object.hasOwn(values, parameter.key) || values[parameter.key] === null)
      ) {
        throw new DatasetQueryInvalidError();
      }
    }
  }

  private validateAggregation(
    fields: readonly DatasetField[],
    aggregation: DatasetQueryRequest["aggregation"],
  ): void {
    if (aggregation === undefined) return;
    const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
    for (const fieldKey of aggregation.groupBy) {
      if (!fieldsByKey.has(fieldKey)) throw new DatasetQueryInvalidError();
    }
    for (const measure of aggregation.measures) {
      if (fieldsByKey.get(measure.fieldKey)?.type !== "number") throw new DatasetQueryInvalidError();
    }
  }

  private validateFilters(
    fields: readonly DatasetField[],
    filters: readonly DatasetFilter[] | undefined,
  ): void {
    if (filters === undefined) return;
    const fieldsByKey = new Map(fields.map((field) => [field.key, field]));
    for (const filter of filters) {
      const field = fieldsByKey.get(filter.fieldKey);
      if (filter.kind === "dateRange" && field?.type === "date" && calendarDay(filter.start) && calendarDay(filter.end) && filter.start <= filter.end) continue;
      if (filter.kind === "fieldValue" && (field?.type === "string" || field?.type === "boolean")) continue;
      if (filter.kind === "fieldText" && field?.type === "string") continue;
      if (filter.kind === "numberComparison" && field?.type === "number") continue;
      throw new DatasetQueryInvalidError();
    }
  }

  private validateResult(result: unknown) {
    const parsed = DatasetQueryResult.safeParse(result);
    if (!parsed.success) throw new DatasetInvalidResponseError();
    const normalized = parsed.data;
    if (
      new TextEncoder().encode(JSON.stringify(normalized)).byteLength >
      DATASET_BODY_LIMIT
    ) {
      throw new DatasetInvalidResponseError();
    }
    for (const row of normalized.rows) {
      for (const column of normalized.columns) {
        const cell = row[column.key];
        if (cell === null) {
          if (!column.nullable) throw new DatasetInvalidResponseError();
          continue;
        }
        if (!valueMatchesType(cell, column.type)) {
          throw new DatasetInvalidResponseError();
        }
      }
    }
    return normalized;
  }
}
