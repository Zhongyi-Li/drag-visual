import { defineConfig } from "vite";

export default defineConfig({
  define: {
    // react-draggable still references process.env.NODE_ENV in its browser bundle.
    // Vite does not polyfill process, so define the exact property it reads.
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV ?? "development"),
  },
});
