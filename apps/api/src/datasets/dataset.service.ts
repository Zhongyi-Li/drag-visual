import {
  Dataset,
  DatasetQueryResult,
  DatasetSummary,
  type DatasetField,
  type DatasetQueryRequest,
  type QueryParameter,
} from "@drag-visual/contracts";
import { Inject, Injectable } from "@nestjs/common";

import {
  DATASET_REPOSITORY,
  type DatasetRepository,
} from "./dataset.repository.js";

export class DatasetNotFoundError extends Error {
  constructor(id: string) {
    super(`Dataset not found: ${id}`);
    this.name = "DatasetNotFoundError";
  }
}

export class DatasetQueryInvalidError extends Error {
  constructor() {
    super("Dataset query is invalid");
    this.name = "DatasetQueryInvalidError";
  }
}

export class DatasetInvalidResponseError extends Error {
  constructor() {
    super("Dataset response is invalid");
    this.name = "DatasetInvalidResponseError";
  }
}

const DATASET_BODY_LIMIT = 5 * 1024 * 1024;

const calendarDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
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

  async list() {
    return DatasetSummary.array().parse(await this.repository.list());
  }

  async getSchema(id: string) {
    const dataset = await this.repository.getSchema(id);
    if (!dataset) throw new DatasetNotFoundError(id);
    return Dataset.parse(dataset);
  }

  async query(id: string, request: DatasetQueryRequest) {
    const dataset = await this.getSchema(id);
    this.validateParameters(dataset.parameters, request.parameters);
    const result = await this.repository.query(id, request);
    if (!result) throw new DatasetNotFoundError(id);
    return this.validateResult(result);
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
