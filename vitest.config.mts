import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: { provider: "v8", reporter: ["text", "html"] },
  },
  resolve: { alias: { "@": path.resolve(root, "src"), "server-only": path.resolve(root, "tests/server-only.ts") } },
});
