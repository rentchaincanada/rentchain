import { test, expect } from "@playwright/test";
import { installLegacySmokeHarness } from "./legacy-smoke-setup";

test("AI drawer loads summary", async ({ page }, testInfo) => {
  // Use legacy smoke setup to unlock dev preview gate for this test
  await installLegacySmokeHarness(page, { devPreviewUnlock: true });

  testInfo.annotations.push({
    type: "smoke-mode",
    description: "legacy smoke test with dev preview unlock",
  });

  await page.goto("/dashboard");
  await expect(page.getByText(/AI Portfolio Intelligence/i)).toBeVisible();
  await page.getByText(/AI Portfolio Intelligence/i).click();
  await expect(page.getByRole("button", { name: /Portfolio Health/i })).toBeVisible();
  await expect(page.getByText(/Health:/i)).toBeVisible();
});
