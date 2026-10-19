import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: ["node_modules", ".open-next", ".wrangler", ".next"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      // server-only throws outside the react-server condition; tests run plain Node
      "server-only": path.resolve(__dirname, "./tests/support/empty.ts"),
    },
  },
});
