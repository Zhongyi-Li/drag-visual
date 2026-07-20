import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));
const workspaceSourcePackages = [
  ["@drag-visual/component-registry", "../../packages/component-registry/src/index.ts"],
  ["@drag-visual/contracts", "../../packages/contracts/src/index.ts"],
  ["@drag-visual/chart-renderer", "../../packages/chart-renderer/src/index.ts"],
  ["@drag-visual/data-engine", "../../packages/data-engine/src/index.ts"],
  ["@drag-visual/editor-core", "../../packages/editor-core/src/index.ts"],
] as const;

export default defineConfig(({ command }) => {
  const useWorkspaceSources = command === "serve";
  const workspacePackageNames = workspaceSourcePackages.map(([find]) => find);

  return {
    define: {
      // react-draggable still references process.env.NODE_ENV in its browser bundle.
      // Vite does not polyfill process, so define the exact property it reads.
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
    },
    ...(useWorkspaceSources
      ? {
          optimizeDeps: { exclude: workspacePackageNames },
          resolve: {
            alias: workspaceSourcePackages.map(([find, path]) => ({
              find,
              replacement: fileURLToPath(new URL(path, import.meta.url)),
            })),
          },
          server: {
            fs: {
              allow: [workspaceRoot],
            },
            proxy: {
              "/dashboards": "http://127.0.0.1:3000",
              "/published-dashboards": "http://127.0.0.1:3000",
              "/datasets": "http://127.0.0.1:3000",
              "/api/auth": "http://127.0.0.1:3000",
            },
          },
        }
      : {}),
  };
});
