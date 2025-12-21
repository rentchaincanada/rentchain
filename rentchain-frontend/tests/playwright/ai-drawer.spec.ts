import { test, expect } from "@playwright/test";

test("AI drawer loads summary", async ({ page }) => {
  await page.goto("http://localhost:5173/dashboard");
  await expect(page.getByText(/AI Portfolio Intelligence/i)).toBeVisible();
  await page.getByText(/AI Portfolio Intelligence/i).click();
  await expect(page.getByRole("button", { name: /Portfolio Health/i })).toBeVisible();
  await expect(page.getByText(/Health:/i)).toBeVisible();
});
