import { test, expect } from "@playwright/test";
import { installLegacySmokeHarness } from "./legacy-smoke-setup";

test.describe("Payments page responsive", () => {
  const viewports = [
    { name: "desktop", size: { width: 1280, height: 800 } },
    { name: "tablet", size: { width: 834, height: 1112 } },
    { name: "mobile", size: { width: 390, height: 844 } },
  ];

  for (const { name, size } of viewports) {
    test(`renders payments on ${name}`, async ({ page }, testInfo) => {
      // Use legacy smoke setup to unlock dev preview gate for this test
      await installLegacySmokeHarness(page, { devPreviewUnlock: true });

      testInfo.annotations.push({
        type: "smoke-mode",
        description: "legacy responsive smoke test with dev preview unlock",
      });

      await page.setViewportSize(size);
      await page.goto("/payments");
      await expect(page.getByRole("heading", { name: /payments/i })).toBeVisible();
      await expect(page.getByRole("table")).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`payments-${name}.png`),
        fullPage: true,
      });
    });
  }
});
