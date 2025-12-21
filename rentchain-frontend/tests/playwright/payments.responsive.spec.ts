import { test, expect } from "@playwright/test";

test.describe("Payments page responsive", () => {
  const viewports = [
    { name: "desktop", size: { width: 1280, height: 800 } },
    { name: "tablet", size: { width: 834, height: 1112 } },
    { name: "mobile", size: { width: 390, height: 844 } },
  ];

  for (const { name, size } of viewports) {
    test(`renders payments on ${name}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("http://localhost:5173/payments");
      await expect(page.getByRole("heading", { name: /payments/i })).toBeVisible();
      await expect(page.getByRole("table")).toBeVisible();
      await page.screenshot({
        path: `screenshots/payments-${name}.png`,
        fullPage: true,
      });
    });
  }
});
