import { defineConfig, devices } from "@playwright/test";

// E2E checks against a running app (default http://localhost:3000).
//   npm run dev            (in another terminal)
//   npm run test:e2e
// Uses the installed Google Chrome (no browser download). Set
// PLAYWRIGHT_CHANNEL="" to use Playwright's bundled Chromium instead.
const channel = process.env.PLAYWRIGHT_CHANNEL ?? "chrome";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    ...(channel ? { channel } : {}),
  },
  projects: [
    { name: "mobile-375", use: { ...devices["iPhone 12"], viewport: { width: 375, height: 812 }, defaultBrowserType: "chromium" } },
    { name: "desktop", use: { viewport: { width: 1366, height: 900 } } },
  ],
});
