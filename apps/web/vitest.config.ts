import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify("http://localhost"),
  },
  test: {
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
  },
});
