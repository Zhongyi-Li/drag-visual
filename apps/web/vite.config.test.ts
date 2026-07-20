import { describe, expect, it } from "vitest";

import config from "./vite.config.js";

const resolveConfig = async (command: "serve" | "build") => {
  if (typeof config !== "function") return config;
  return await config({ command, mode: "development", isSsrBuild: false, isPreview: false });
};

describe("vite config", () => {
  it("defines process.env.NODE_ENV for browser-only dependencies", async () => {
    await expect(resolveConfig("serve")).resolves.toMatchObject({
      define: {
        "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
      },
    });
  });

  it("aliases workspace packages to source files during dev server runs", async () => {
    const serveConfig = await resolveConfig("serve");

    expect(serveConfig.resolve?.alias).toEqual(expect.arrayContaining([
      expect.objectContaining({
        find: "@drag-visual/component-registry",
        replacement: expect.stringContaining("/packages/component-registry/src/index.ts"),
      }),
      expect.objectContaining({
        find: "@drag-visual/chart-renderer",
        replacement: expect.stringContaining("/packages/chart-renderer/src/index.ts"),
      }),
      expect.objectContaining({
        find: "@drag-visual/contracts",
        replacement: expect.stringContaining("/packages/contracts/src/index.ts"),
      }),
      expect.objectContaining({
        find: "@drag-visual/data-engine",
        replacement: expect.stringContaining("/packages/data-engine/src/index.ts"),
      }),
      expect.objectContaining({
        find: "@drag-visual/editor-core",
        replacement: expect.stringContaining("/packages/editor-core/src/index.ts"),
      }),
    ]));
    expect(serveConfig.optimizeDeps?.exclude).toEqual(expect.arrayContaining([
      "@drag-visual/component-registry",
      "@drag-visual/chart-renderer",
      "@drag-visual/contracts",
      "@drag-visual/data-engine",
      "@drag-visual/editor-core",
    ]));
    expect(serveConfig.server?.proxy).toMatchObject({
      "/dashboards": "http://127.0.0.1:3000",
      "/published-dashboards": "http://127.0.0.1:3000",
      "/datasets": "http://127.0.0.1:3000",
    });
  });

  it("keeps production build resolution on package exports", async () => {
    const buildConfig = await resolveConfig("build");

    expect(buildConfig.resolve?.alias).toBeUndefined();
    expect(buildConfig.optimizeDeps?.exclude).toBeUndefined();
  });
});
