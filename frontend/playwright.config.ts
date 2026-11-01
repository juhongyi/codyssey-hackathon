import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: process.env.E2E_TEST_DIR || "../e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "pnpm start -H 0.0.0.0",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: false,
  },
});
