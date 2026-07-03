import { describe, expect, it } from "vitest";

import { ApiError } from "../api/ApiError.js";
import { createAppQueryClient, shouldRetryRequest } from "./AppProviders.js";

describe("application retry policy", () => {
  it("does not retry 4xx API errors", () => {
    expect(shouldRetryRequest(0, new ApiError(400, "BAD_REQUEST", "bad"))).toBe(false);
  });

  it("retries a 5xx API error and network error once at most", () => {
    expect(shouldRetryRequest(0, new ApiError(500, "INTERNAL_ERROR", "failed"))).toBe(true);
    expect(shouldRetryRequest(1, new ApiError(500, "INTERNAL_ERROR", "failed"))).toBe(false);
    expect(shouldRetryRequest(0, new TypeError("network"))).toBe(true);
    expect(shouldRetryRequest(1, new TypeError("network"))).toBe(false);
  });

  it("creates isolated clients with the policy for queries and mutations", () => {
    const first = createAppQueryClient();
    const second = createAppQueryClient();

    expect(first).not.toBe(second);
    expect(first.getDefaultOptions().queries?.retry).toBe(shouldRetryRequest);
    expect(first.getDefaultOptions().mutations?.retry).toBe(shouldRetryRequest);
  });
});
