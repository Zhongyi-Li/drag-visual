import { describe, expect, it } from "vitest";

import config from "./vite.config.js";

describe("vite config", () => {
  it("defines process.env.NODE_ENV for browser-only dependencies", () => {
    expect(config).toMatchObject({
      define: {
        "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
      },
    });
  });
});
