export class DatasetNotFoundError extends Error {
  constructor(id: string) {
    super(`Dataset not found: ${id}`);
    this.name = "DatasetNotFoundError";
  }
}

export class DatasetNameConflictError extends Error {
  constructor(name: string) {
    super(`Dataset name already exists: ${name}`);
    this.name = "DatasetNameConflictError";
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

export class DatasetUpstreamError extends Error {
  constructor() {
    super("Dataset upstream request failed");
    this.name = "DatasetUpstreamError";
  }
}

export class DatasetTimeoutError extends Error {
  constructor() {
    super("Dataset request timed out");
    this.name = "DatasetTimeoutError";
  }
}
