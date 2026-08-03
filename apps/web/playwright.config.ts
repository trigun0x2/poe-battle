import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    // Set PLAYWRIGHT_CHROMIUM_PATH to reuse a system chromium instead of
    // downloading one (e.g. CI images with a preinstalled browser).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: [
    {
      command: 'npm run start --workspace @exile/server',
      port: 8787,
      reuseExistingServer: true,
      cwd: '../..',
    },
    {
      command: 'npm run dev --workspace @exile/web',
      port: 5173,
      reuseExistingServer: true,
      cwd: '../..',
    },
  ],
});
