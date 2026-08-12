import { expect, test, type Page } from "@playwright/test";
import { installLegacySmokeHarness } from "./legacy-smoke-setup";

test.use({ serviceWorkers: "block" });

const viewports = [
  { width: 360, height: 800 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 414, height: 896 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 1180, height: 900 },
  { width: 1366, height: 900 },
  { width: 1440, height: 900 },
];

const occupiedUnit = {
  id: "unit-modal-101",
  propertyId: "property-modal",
  unitNumber: "101",
  beds: 2,
  baths: 1,
  marketRent: 1850,
  status: "occupied",
  occupantName: "Synthetic Modal Tenant",
  leaseEndDate: "2027-05-31",
  notes: "Synthetic content used to exercise a long mobile Edit Unit form.",
};

async function installPropertiesHarness(page: Page) {
  await installLegacySmokeHarness(page, { devPreviewUnlock: true });

  await page.route("**/api/units/unit-modal-101", async (route) => {
    if (route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ unit: { ...occupiedUnit, ...payload } }),
      });
      return;
    }
    await route.fallback();
  });

  await page.route("**/api/properties**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/properties/property-modal/units") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ units: [occupiedUnit] }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: "property-modal",
            name: "Harbour Modal House",
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
            units: [occupiedUnit],
          },
        ],
      }),
    });
  });
}

async function openEditUnit(page: Page) {
  const unitEditButton = page
    .locator(".rc-unit-card button, .rc-units-table button")
    .filter({ hasText: /^Edit$/ })
    .first();
  await unitEditButton.waitFor({ state: "attached" });
  if (await unitEditButton.isVisible()) {
    await unitEditButton.click();
  } else {
    // At exactly 768px the existing properties stylesheet hides the table's
    // actions column. Dispatch the component action so this modal-only matrix
    // can still verify the dialog at that required tablet boundary.
    await unitEditButton.dispatchEvent("click");
  }
  await expect(page.getByRole("dialog", { name: "Edit unit" })).toBeVisible();
}

for (const viewport of viewports) {
  test(`keeps Edit Unit actions reachable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on("requestfailed", (request) =>
      runtimeErrors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText || "unknown"}`)
    );

    await page.setViewportSize(viewport);
    await installPropertiesHarness(page);
    await page.goto("/properties", { waitUntil: "domcontentloaded" });
    await openEditUnit(page);

    const body = page.locator(".rc-unit-edit-body");
    const backgroundScroll = await page.evaluate(() => window.scrollY);

    for (let cycle = 0; cycle < 10; cycle += 1) {
      await body.evaluate((element, index) => {
        element.scrollTop = index % 3 === 1 ? element.scrollHeight / 2 : element.scrollHeight;
      }, cycle);
    }

    const geometry = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>(".rc-unit-edit-panel")!;
      const bodyElement = document.querySelector<HTMLElement>(".rc-unit-edit-body")!;
      const actionsElement = document.querySelector<HTMLElement>(".rc-unit-edit-actions")!;
      const nav = document.querySelector<HTMLElement>(".rc-landlord-mobile-tabbar");
      const panelRect = panel.getBoundingClientRect();
      const actionsRect = actionsElement.getBoundingClientRect();
      return {
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        documentWidth: document.documentElement.scrollWidth,
        panelTop: panelRect.top,
        panelBottom: panelRect.bottom,
        panelWidth: panelRect.width,
        actionsTop: actionsRect.top,
        actionsBottom: actionsRect.bottom,
        bodyClientHeight: bodyElement.clientHeight,
        bodyScrollHeight: bodyElement.scrollHeight,
        bodyOverflowY: getComputedStyle(bodyElement).overflowY,
        bodyOverscroll: getComputedStyle(bodyElement).overscrollBehavior,
        bodyLocked: document.body.style.overflow,
        panelZ: Number(getComputedStyle(panel.parentElement!).zIndex),
        navZ: nav ? Number(getComputedStyle(nav).zIndex) : 0,
      };
    });
    test.info().annotations.push({ type: "geometry", description: JSON.stringify(geometry) });

    expect(geometry.documentWidth).toBeLessThanOrEqual(viewport.width + 1);
    expect(geometry.panelTop).toBeGreaterThanOrEqual(0);
    expect(geometry.panelBottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(geometry.panelWidth).toBeLessThanOrEqual(viewport.width + 1);
    expect(geometry.actionsTop).toBeGreaterThanOrEqual(0);
    expect(geometry.actionsBottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(geometry.bodyScrollHeight).toBeGreaterThanOrEqual(geometry.bodyClientHeight);
    if (viewport.height <= 844) {
      expect(geometry.bodyScrollHeight).toBeGreaterThan(geometry.bodyClientHeight);
    }
    expect(geometry.bodyOverflowY).toBe("auto");
    expect(geometry.bodyOverscroll).toBe("contain");
    expect(geometry.bodyLocked).toBe("hidden");
    expect(geometry.panelZ).toBeGreaterThan(geometry.navZ);
    expect(await page.evaluate(() => window.scrollY)).toBe(backgroundScroll);

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog", { name: "Edit unit" })).toBeHidden();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe("");

    await openEditUnit(page);
    await body.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(page.getByRole("button", { name: "Save", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Edit unit" })).toBeHidden();
    expect(runtimeErrors).toEqual([]);
  });
}

test("keeps actions usable after a representative mobile keyboard viewport reduction", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installPropertiesHarness(page);
  await page.goto("/properties", { waitUntil: "domcontentloaded" });
  await openEditUnit(page);

  await page.getByLabel("Current tenant name").focus();
  await page.setViewportSize({ width: 390, height: 520 });
  await page.locator(".rc-unit-edit-body").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect(page.getByRole("button", { name: "Cancel" })).toBeInViewport();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeInViewport();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "Edit unit" })).toBeHidden();
});
