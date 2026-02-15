import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  outputDir: "../tmp/ui-audit/artifacts",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    video: "on"
  },
  webServer: {
    command: "pnpm build && pnpm preview",
    port: 4173,
    timeout: 180_000,
    reuseExistingServer: false
  },
  projects: [
    {
      name: "chromium"
    }
  ]
});
