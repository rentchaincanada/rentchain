import { defineConfig } from "@playwright/test";

/**
 * RentChain Frontend Playwright Configuration
 *
 * This configuration supports two distinct test modes that can coexist:
 *
 * 1. **Authenticated Role Smoke Tests** (admin-smoke.spec.ts, landlord-smoke.spec.ts, tenant-smoke.spec.ts)
 *    - Uses storage state fixtures from environment variables (QA_ADMIN_STORAGE_STATE, etc.)
 *    - Tests role-based access control and authenticated workflows
 *    - Requires `npm run storage-state:export` in rentchain-api before running
 *    - Uses installRoleSmokeHarness() from role-smoke-helpers.ts
 *
 * 2. **Legacy Smoke Tests** (ai-drawer.spec.ts, payments.responsive.spec.ts)
 *    - Uses dev preview unlock to bypass DevAuthGate in development mode
 *    - Tests frontend-only features without role context or authentication
 *    - Does not require storage state environment variables
 *    - Uses installLegacySmokeHarness() from legacy-smoke-setup.ts
 *
 * Both modes are idempotent and safe for unattended test runs. The storage state
 * environment variables are optional - legacy tests run without them, while authenticated
 * role tests require them and will throw descriptive errors if missing.
 */

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
    ["json", { outputFile: process.env.QA_JSON_REPORT_FILE || "test-results/qa-results.json" }],
    ["html", { outputFolder: process.env.QA_HTML_REPORT_DIR || "playwright-report" }],
    ["./tests/playwright/qa-artifact-reporter.ts"],
  ],
});
