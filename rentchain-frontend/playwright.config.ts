import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/playwright",
  timeout: 60_000,
  use: {
    headless: true,
    baseURL: process.env.BASE_URL || "http://localhost:5173",
  },
  reporter: [["list"], ["html", { outputFolder: "playwright-report" }]],
});
