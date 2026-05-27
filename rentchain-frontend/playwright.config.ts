import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/playwright",
  outputDir: process.env.QA_ARTIFACT_DIR || "test-results",
  timeout: 60_000,
  use: {
    headless: true,
    baseURL: process.env.BASE_URL || "http://localhost:5173",
    screenshot: "only-on-failure",
    trace: process.env.QA_TRACE === "on" ? "on" : "retain-on-failure",
    video: process.env.QA_VIDEO === "on" ? "on" : "retain-on-failure",
  },
  reporter: [
    ["list"],
    ["html", { outputFolder: process.env.QA_HTML_REPORT_DIR || "playwright-report" }],
  ],
});
