import { defineConfig } from "@playwright/test";

const outputDir = process.env.QA_ARTIFACT_DIR || "test-results/playwright";
const baseURL = process.env.BASE_URL || process.env.VITE_API_BASE_URL || "http://localhost:5173";

export default defineConfig({
  timeout: 60_000,
  outputDir,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["list"],
    ["json", { outputFile: process.env.QA_JSON_REPORT_FILE || "test-results/playwright/results.json" }],
    ["html", { outputFolder: process.env.QA_HTML_REPORT_DIR || "playwright-report", open: "never" }],
    ["./rentchain-frontend/tests/playwright/qa-artifact-reporter.ts"],
  ],
  use: {
    baseURL,
    headless: process.env.PLAYWRIGHT_HEADED === "1" ? false : true,
    screenshot: "only-on-failure",
    trace: process.env.QA_TRACE === "on" ? "on" : "retain-on-failure",
    video: process.env.QA_VIDEO === "on" ? "on" : "retain-on-failure",
  },
  projects: [
    {
      name: "frontend-chromium",
      testDir: "rentchain-frontend/tests/playwright",
      use: { browserName: "chromium" },
    },
    {
      name: "frontend-firefox",
      testDir: "rentchain-frontend/tests/playwright",
      use: { browserName: "firefox" },
    },
    {
      name: "frontend-webkit",
      testDir: "rentchain-frontend/tests/playwright",
      use: { browserName: "webkit" },
    },
    {
      name: "api-chromium",
      testDir: "rentchain-api/tests/playwright",
      use: { browserName: "chromium" },
    },
    {
      name: "api-firefox",
      testDir: "rentchain-api/tests/playwright",
      use: { browserName: "firefox" },
    },
    {
      name: "api-webkit",
      testDir: "rentchain-api/tests/playwright",
      use: { browserName: "webkit" },
    },
  ],
});
