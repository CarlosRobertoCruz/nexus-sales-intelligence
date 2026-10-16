import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/auth",
  timeout: 20000,
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 900 },
    headless: true,
    channel: process.platform === "win32" ? "msedge" : undefined,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    env: { VITE_DATA_MODE: "server" },
    reuseExistingServer: false,
    timeout: 30000,
  },
});
