import { expect, test, type Page } from "@playwright/test";
import { installLegacySmokeHarness } from "./legacy-smoke-setup";

test.use({ serviceWorkers: "block" });

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
];

const canonicalState = {
  leaseTermState: "past",
  occupancyState: "review_needed",
  tenantRelationshipState: "occupancy_unresolved",
  supportingLeaseId: null,
  reasons: ["PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY", "OCCUPIED_WITHOUT_CURRENT_LEASE"],
};

async function installOccupancyHarness(page: Page) {
  await installLegacySmokeHarness(page, { devPreviewUnlock: true });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const fulfill = (body: unknown) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });

    if (url.pathname === "/api/tenants") {
      await fulfill({ tenants: [{
        id: "viewport-tenant",
        fullName: "Viewport Tenant",
        email: "viewport@example.test",
        propertyId: "viewport-property",
        propertyName: "Viewport House",
        unitId: "viewport-unit",
        unitLabel: "1A",
        status: "active",
        canonicalState,
        tenancies: [],
      }] });
      return;
    }
    if (url.pathname === "/api/tenants/viewport-tenant/tenancies") {
      await fulfill({ tenancies: [] });
      return;
    }
    if (url.pathname === "/api/occupancy-resolutions/context") {
      await fulfill({ ok: true, context: {
        propertyId: "viewport-property",
        unitId: "viewport-unit",
        tenantId: "viewport-tenant",
        propertyLabel: "Viewport House",
        unitLabel: "1A",
        canonicalState,
        expectedStateToken: "viewport-token",
        eligibleResolutionTypes: ["record_operational_move_out", "clear_stale_occupancy_record"],
        existingLeaseCandidates: [],
        activeLeaseRequiresEndWorkflow: false,
      } });
      return;
    }
    await route.fallback();
  });
}

async function openDrawer(page: Page) {
  const runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
  });
  await page.goto("/tenants?tenantId=viewport-tenant", { waitUntil: "domcontentloaded" });
  const trigger = page.getByRole("button", { name: "Resolve occupancy" }).first();
  await expect(trigger).toBeVisible({ timeout: 10_000 }).catch(async (error) => {
    throw new Error(`${error.message}\nPAGE_STATE=${JSON.stringify({
      url: page.url(),
      title: await page.title(),
      body: await page.locator("body").innerText(),
      runtimeErrors,
    })}`);
  });
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Resolve Occupancy" })).toBeVisible();
  return trigger;
}

for (const viewport of viewports) {
  test(`fits and remains operable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installOccupancyHarness(page);
    await openDrawer(page);

    const dialog = page.getByRole("dialog", { name: "Resolve Occupancy" });
    await expect(page.getByRole("heading", { name: "Resolve Occupancy" })).toBeVisible();
    await expect(page.getByText(/without making a legal tenancy determination/i)).toBeVisible();
    await expect(page.getByLabel("Record operational move-out")).toBeVisible();
    await expect(page.getByLabel("Correct stale occupancy records")).toBeVisible();
    await expect(page.getByRole("button", { name: "Close Resolve Occupancy" })).toBeVisible();

    await page.getByLabel("Record operational move-out").check();
    await expect(page.getByLabel("Operational move-out effective date")).toBeVisible();
    await dialog.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(page.getByRole("button", { name: "Review later" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Confirm operational reconciliation" })).toBeInViewport();

    const geometry = await page.evaluate(() => {
      const dialogElement = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')!;
      const rect = dialogElement.getBoundingClientRect();
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        overflowX: getComputedStyle(dialogElement).overflowX,
        overflowY: getComputedStyle(dialogElement).overflowY,
        scrollHeight: dialogElement.scrollHeight,
        clientHeight: dialogElement.clientHeight,
      };
    });

    expect(geometry.documentWidth).toBeLessThanOrEqual(viewport.width + 1);
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(viewport.width + 1);
    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.bottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(geometry.overflowX).toBe("hidden");
    expect(geometry.overflowY).toBe("auto");
    expect(geometry.scrollHeight).toBeGreaterThanOrEqual(geometry.clientHeight);
  });
}

test("traps keyboard focus and returns it to the opener", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await installOccupancyHarness(page);
  const trigger = await openDrawer(page);
  const dialog = page.getByRole("dialog", { name: "Resolve Occupancy" });

  await expect(page.getByRole("button", { name: "Close Resolve Occupancy" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Record operational move-out")).toBeFocused();
  for (let index = 0; index < 8; index += 1) await page.keyboard.press("Tab");
  await expect.poll(async () => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect.poll(async () => dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("Close dismisses through native click, Enter, and Space activation without mutation", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await installOccupancyHarness(page);
  const mutationRequests: string[] = [];
  page.on("request", (request) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      mutationRequests.push(`${request.method()} ${request.url()}`);
    }
  });

  for (const activation of ["click", "Enter", "Space"] as const) {
    const trigger = await openDrawer(page);
    const dialog = page.getByRole("dialog", { name: "Resolve Occupancy" });
    const closeButton = page.getByRole("button", { name: "Close Resolve Occupancy" });
    await expect(closeButton).toBeFocused();

    if (activation === "click") await closeButton.click();
    else await page.keyboard.press(activation);

    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }

  expect(mutationRequests).toEqual([]);
});
