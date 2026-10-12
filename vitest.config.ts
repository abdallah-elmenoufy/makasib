import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // lib modules guard themselves with `import "server-only"`; tests run in node
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
});
