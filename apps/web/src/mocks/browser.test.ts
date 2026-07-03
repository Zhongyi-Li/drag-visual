import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MOCK_SERVICE_WORKER_URL } from "./worker-config.js";

describe("browser mock worker asset", () => {
  it("checks in the generated worker at the configured Vite public URL", async () => {
    expect(MOCK_SERVICE_WORKER_URL).toBe("/mockServiceWorker.js");
    const workerPath = fileURLToPath(new URL("../../public/mockServiceWorker.js", import.meta.url));
    await expect(access(workerPath)).resolves.toBeUndefined();
    await expect(readFile(workerPath, "utf8")).resolves.toContain("Mock Service Worker");
  });
});
