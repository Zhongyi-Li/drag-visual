import { describe, expect, it, vi } from "vitest";

import { bootstrapApplication } from "./bootstrap.js";

const createDeferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
};

describe("bootstrapApplication", () => {
  it.each([undefined, "false"])("does not load mocks for %s and renders", async (useMocks) => {
    const loadMockWorker = vi.fn();
    const render = vi.fn();

    await bootstrapApplication({ useMocks, loadMockWorker, render });

    expect(loadMockWorker).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledOnce();
  });

  it("awaits mock worker startup before rendering", async () => {
    const workerStarted = createDeferred<void>();
    const startMockWorker = vi.fn(() => workerStarted.promise);
    const loadMockWorker = vi.fn(async () => ({ startMockWorker }));
    const render = vi.fn();

    const booting = bootstrapApplication({ useMocks: "true", loadMockWorker, render });
    await vi.waitFor(() => expect(startMockWorker).toHaveBeenCalledOnce());
    expect(render).not.toHaveBeenCalled();

    workerStarted.resolve();
    await booting;

    expect(render).toHaveBeenCalledOnce();
  });

  it("surfaces worker startup rejection and does not render", async () => {
    const failure = new Error("worker failed");
    const loadMockWorker = vi.fn(async () => ({
      startMockWorker: () => Promise.reject(failure),
    }));
    const render = vi.fn();

    await expect(bootstrapApplication({
      useMocks: "true",
      loadMockWorker,
      render,
    })).rejects.toBe(failure);
    expect(render).not.toHaveBeenCalled();
  });
});
