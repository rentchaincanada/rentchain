import { expect, test, type Page } from "@playwright/test";
import { installLegacySmokeHarness } from "./legacy-smoke-setup";

test.use({ serviceWorkers: "block" });

const viewports = [
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 414, height: 896 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1024, height: 768 },
  { width: 1180, height: 900 },
  { width: 1280, height: 900 },
  { width: 1366, height: 900 },
  { width: 1440, height: 900 },
];

async function installPropertiesHarness(page: Page) {
  await installLegacySmokeHarness(page, { devPreviewUnlock: true });

  await page.route("**/api/properties**", async (route) => {
    const url = new URL(route.request().url());
    const units = [
      {
        id: "unit-101",
        propertyId: "property-mobile",
        unitNumber: "101",
        beds: 2,
        baths: 1,
        sqft: 850,
        marketRent: 1850,
        status: "occupied",
        occupantName: "Synthetic Mobile Tenant",
        leaseEndDate: "2027-05-31",
      },
    ];

    if (url.pathname === "/api/properties/property-mobile/units") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ units }) });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "property-mobile",
            name: "Harbour Mobile House",
            addressLine1: "101 Waterfront Drive",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 1A1",
            totalUnits: 1,
            unitCount: 1,
            occupiedCount: 1,
            occupancyRate: 1,
            portfolioStatus: "active",
            createdAt: "2026-01-01T00:00:00.000Z",
            units,
          },
        ],
      }),
    });
  });
}

for (const viewport of viewports) {
  test(`keeps Properties cards readable without overflow at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on("requestfailed", (request) =>
      runtimeErrors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || "unknown"}`)
    );
    await page.setViewportSize(viewport);
    await installPropertiesHarness(page);
    const response = await page.goto("/properties", { waitUntil: "domcontentloaded" });

    const propertiesPage = page.locator(".rc-properties-page");
    await expect(
      propertiesPage,
      `status=${response?.status() || 0}; url=${page.url()}; runtime=${runtimeErrors.join(" | ") || "none"}`
    ).toBeVisible();
    const unitCard = page.locator(".rc-unit-card").first();
    if (viewport.width <= 430) {
      await expect(unitCard.getByText("Unit #")).toBeVisible();
      await expect(unitCard.getByText("101", { exact: true })).toBeVisible();
      await expect(unitCard.getByText("Status", { exact: true })).toBeVisible();
    } else {
      await expect(page.locator(".rc-units-table")).toBeVisible();
      await expect(page.locator(".rc-units-table").getByText("101", { exact: true })).toBeVisible();
    }

    const geometry = await page.evaluate(() => {
      const root = document.documentElement;
      const pageElement = document.querySelector<HTMLElement>(".rc-properties-page");
      const card = document.querySelector<HTMLElement>(".rc-unit-card");
      const row = document.querySelector<HTMLElement>(".rc-unit-card-row");
      const lastAction = document.querySelector<HTMLElement>(".rc-unit-actions button:last-of-type");
      const pageRect = pageElement?.getBoundingClientRect();
      const cardRect = card?.getBoundingClientRect();
      const rowStyle = row ? getComputedStyle(row) : null;
      return {
        viewportWidth: innerWidth,
        documentScrollWidth: root.scrollWidth,
        pageLeft: pageRect?.left ?? -1,
        pageRight: pageRect?.right ?? -1,
        pageWidth: pageRect?.width ?? 0,
        cardLeft: cardRect?.left ?? -1,
        cardRight: cardRect?.right ?? -1,
        cardWidth: cardRect?.width ?? 0,
        rowDisplay: rowStyle?.display ?? "",
        rowColumns: rowStyle?.gridTemplateColumns ?? "",
        lastActionBottom: lastAction?.getBoundingClientRect().bottom ?? 0,
        documentHeight: root.scrollHeight,
      };
    });

    test.info().annotations.push({ type: "geometry", description: JSON.stringify(geometry) });
    expect(geometry.documentScrollWidth).toBeLessThanOrEqual(viewport.width + 1);
    expect(geometry.pageLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.pageRight).toBeLessThanOrEqual(viewport.width + 1);
    expect(geometry.cardLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.cardRight).toBeLessThanOrEqual(viewport.width + 1);

    if (viewport.width <= 430) {
      expect(geometry.pageWidth).toBeGreaterThanOrEqual(viewport.width - 34);
      expect(geometry.cardWidth).toBeGreaterThanOrEqual(viewport.width - 80);
      expect(geometry.rowDisplay).toBe("grid");
      expect(geometry.rowColumns).not.toBe("none");
      await expect(unitCard.getByRole("button", { name: "Edit" })).toBeVisible();
      await expect(unitCard.getByRole("button", { name: /Send application for unit 101/i })).toBeVisible();
    }

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(geometry.lastActionBottom).toBeLessThanOrEqual(geometry.documentHeight + 1);
  });
}
