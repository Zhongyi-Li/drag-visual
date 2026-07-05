// @vitest-environment jsdom

import { DashboardSchema, type Dashboard } from "@drag-visual/contracts";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useAutosave } from "./useAutosave.js";

const dashboard = (overrides: Partial<Dashboard> = {}): Dashboard => DashboardSchema.parse({
  schemaVersion: 1,
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "经营看板",
  theme: { primaryColor: "#1677ff", backgroundColor: "#f5f7fa" },
  layout: [],
  components: [],
  datasets: [],
  revision: 1,
  updatedAt: "2026-07-03T08:00:00.000Z",
  ...overrides,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("saves once after two seconds of inactivity", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  renderHook(() => useAutosave({ dashboard: dashboard(), dirty: true, save, delayMs: 2_000 }));

  await act(async () => { await vi.advanceTimersByTimeAsync(1_999); });
  expect(save).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });

  expect(save).toHaveBeenCalledOnce();
  expect(save).toHaveBeenCalledWith(dashboard());
});

it("does not autosave while a previous save is pending", async () => {
  let resolve!: () => void;
  const save = vi.fn(() => new Promise<void>((done) => { resolve = done; }));
  const { rerender } = renderHook(
    ({ value }) => useAutosave({ dashboard: value, dirty: true, save, delayMs: 2_000 }),
    { initialProps: { value: dashboard() } },
  );

  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
  rerender({ value: dashboard({ name: "修改后" }) });
  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });

  expect(save).toHaveBeenCalledOnce();
  await act(async () => { resolve(); });
});

it("does not schedule when the editor is clean", async () => {
  const save = vi.fn().mockResolvedValue(undefined);
  renderHook(() => useAutosave({ dashboard: dashboard(), dirty: false, save, delayMs: 2_000 }));

  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });

  expect(save).not.toHaveBeenCalled();
});

it("retries after a failed autosave while the editor remains dirty", async () => {
  const save = vi.fn()
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValueOnce(undefined);
  renderHook(() => useAutosave({ dashboard: dashboard(), dirty: true, save, delayMs: 2_000 }));

  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
  expect(save).toHaveBeenCalledOnce();
  await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });

  expect(save).toHaveBeenCalledTimes(2);
});
