import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:3200", trace: "retain-on-failure", screenshot: "only-on-failure" },
  webServer: {
    command: '"C:\\tmp\\node-v22.13.0-win-x64\\node.exe" "C:\\tmp\\node-v22.13.0-win-x64\\node_modules\\npm\\bin\\npm-cli.js" run start -- --hostname 127.0.0.1 --port 3200',
    url: "http://127.0.0.1:3200/api/health/live",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
