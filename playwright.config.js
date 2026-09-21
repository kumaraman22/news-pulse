import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  fullyParallel: false,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    headless: true,
    trace: "retain-on-failure",
    launchOptions: {
      ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH && {
        executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
      }),
    },
  },
  webServer: {
    command: "npm run dev -w frontend",
    url: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
