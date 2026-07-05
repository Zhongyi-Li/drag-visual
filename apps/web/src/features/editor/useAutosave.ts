import { useEffect, useRef, useState } from "react";
import type { Dashboard } from "@drag-visual/contracts";

export function useAutosave(input: {
  readonly dashboard: Dashboard;
  readonly dirty: boolean;
  readonly save: (dashboard: Dashboard) => Promise<unknown>;
  readonly delayMs?: number;
}): void {
  const saving = useRef(false);
  const [retryTick, scheduleRetry] = useState(0);

  useEffect(() => {
    if (!input.dirty || saving.current) return undefined;
    const timer = window.setTimeout(() => {
      saving.current = true;
      void input.save(input.dashboard)
        .catch(() => {
          if (input.dirty) scheduleRetry((value) => value + 1);
        })
        .finally(() => {
          saving.current = false;
        });
    }, input.delayMs ?? 2_000);

    return () => window.clearTimeout(timer);
  }, [input.dashboard, input.dirty, input.delayMs, input.save, retryTick]);
}
