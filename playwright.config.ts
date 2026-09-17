import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 150_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "line",
  webServer: {
    command: "pnpm dev:frontend",
    url: "http://localhost:3000",
    env: { ...process.env, NEXT_PUBLIC_MAP_EDITOR_WRITE_ENABLED: "true" },
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      args: ["--use-angle=swiftshader"],
    },
  },
});

