import { expect, test, type Page } from "@playwright/test";
import { installLegacySmokeHarness } from "./legacy-smoke-setup";

test.use({ serviceWorkers: "block" });

async function installNoticesHarness(page: Page, options: { rejectRecipientPreview?: boolean } = {}) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const fiveXX: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => { if (response.status() >= 500) fiveXX.push(`${response.status()} ${response.url()}`); });
  await page.route("**/src/api/baseUrl.ts", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace("import.meta?.env?.VITE_API_BASE_URL", '"http://127.0.0.1:5173"')
      .replace("import.meta?.env?.VITE_DEPLOY_ENV", '"development"')
      .replace("import.meta?.env?.DEV", "true");
    await route.fulfill({ response, body });
  });
  await installLegacySmokeHarness(page, { devPreviewUnlock: true });
  await page.route("**/api/account/limits", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, plan: "pro", limits: {}, usage: {} }) }));
  await page.route("**/api/landlord/messages/conversations", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ conversations: [] }) }));
  await page.route(/\/api\/properties(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ properties: [{ id: "property-synthetic", name: "Harbour Synthetic Property", addressLine1: "1 QA Street", totalUnits: 2, createdAt: "2026-08-09", units: [] }, { id: "property-queen", name: "Queen Synthetic Court", addressLine1: "2 QA Street", totalUnits: 1, createdAt: "2026-08-09", units: [] }] }) }));

  let notices: Array<Record<string, unknown>> = [];
  await page.route("**/api/landlord/notices**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.endsWith("/recipients")) {
      if (options.rejectRecipientPreview) {
        await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({
          ok: false, code: "notice_recipient_not_eligible", error: "Notice recipients unavailable",
        }) }); return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        properties: [{ id: "property-queen", label: "Queen Synthetic Court" }, { id: "property-synthetic", label: "Harbour Synthetic Property" }],
        propertyBreakdown: [{ id: "property-queen", label: "Queen Synthetic Court", recipientCount: 1 }, { id: "property-synthetic", label: "Harbour Synthetic Property", recipientCount: 3 }],
        recipients: [
          { tenantId: "tenant-a", tenantDisplayName: "Synthetic Current Tenant A", unitIds: ["unit-a", "unit-c"], unitLabels: ["1A", "3C"], propertyIds: ["property-synthetic", "property-queen"], propertyLabels: ["Harbour Synthetic Property", "Queen Synthetic Court"], units: [{ id: "unit-a", label: "1A", propertyId: "property-synthetic", propertyLabel: "Harbour Synthetic Property" }, { id: "unit-c", label: "3C", propertyId: "property-queen", propertyLabel: "Queen Synthetic Court" }], deliveryAvailability: "available" },
          { tenantId: "tenant-b", tenantDisplayName: "Synthetic Current Tenant B", unitIds: ["unit-b"], unitLabels: ["2B"], propertyIds: ["property-synthetic"], propertyLabels: ["Harbour Synthetic Property"], units: [{ id: "unit-b", label: "2B", propertyId: "property-synthetic", propertyLabel: "Harbour Synthetic Property" }], deliveryAvailability: "available" },
          { tenantId: "tenant-c", tenantDisplayName: "Synthetic Missing Email", unitIds: ["unit-b"], unitLabels: ["2B"], propertyIds: ["property-synthetic"], propertyLabels: ["Harbour Synthetic Property"], units: [{ id: "unit-b", label: "2B", propertyId: "property-synthetic", propertyLabel: "Harbour Synthetic Property" }], deliveryAvailability: "missing_email" },
        ], counts: { total: 3, available: 2, skipped: 1 }, maxRecipients: 100,
      }) }); return;
    }
    if (url.pathname === "/api/landlord/notices" && request.method() === "POST") {
      notices = [{ id: "notice-synthetic", propertyIds: ["property-queen", "property-synthetic"], properties: [{ id: "property-queen", label: "Queen Synthetic Court" }, { id: "property-synthetic", label: "Harbour Synthetic Property" }], propertyCount: 2, subject: "Water shutdown", body: "Water will be unavailable at noon.", status: "completed", recipientCount: 1, sentCount: 1, failedCount: 0, skippedCount: 0, createdAtMs: Date.now() }];
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true, created: true, notice: notices[0] }) }); return;
    }
    if (url.pathname === "/api/landlord/notices") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, notices }) }); return;
    }
    if (url.pathname.endsWith("/notice-synthetic")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, notice: notices[0], deliveries: [{ id: "delivery-a", tenantId: "tenant-a", tenantDisplayName: "Synthetic Current Tenant A", unitIds: ["unit-a", "unit-c"], unitLabels: ["1A", "3C"], propertyIds: ["property-synthetic", "property-queen"], propertyLabels: ["Harbour Synthetic Property", "Queen Synthetic Court"], units: [{ id: "unit-a", label: "1A", propertyId: "property-synthetic", propertyLabel: "Harbour Synthetic Property" }, { id: "unit-c", label: "3C", propertyId: "property-queen", propertyLabel: "Queen Synthetic Court" }], channel: "email", status: "sent" }] }) }); return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false }) });
  });
  return { consoleErrors, pageErrors, fiveXX };
}

test("handles fail-closed recipient preview rejection without sending", async ({ page }) => {
  const errors = await installNoticesHarness(page, { rejectRecipientPreview: true });
  await page.goto("/notices");
  await page.getByRole("button", { name: "New Notice" }).click();
  await page.getByLabel("Harbour Synthetic Property").check();
  await page.getByRole("button", { name: "Resolve current recipients" }).click();
  await expect(page.getByRole("alert")).toHaveText("Eligible recipients could not be resolved.");
  await expect(page.getByRole("button", { name: "Preview Notice" })).toHaveCount(0);
  expect(errors.consoleErrors).toEqual([expect.stringContaining("403 (Forbidden)")]);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.fiveXX).toEqual([]);
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "desktop-1366", width: 1366, height: 900 },
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "desktop-1180", width: 1180, height: 900 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} completes the synthetic private Notices flow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = await installNoticesHarness(page);
    await page.goto("/notices");
    await expect(page.getByRole("heading", { name: "Notices" })).toBeVisible();
    await page.getByRole("button", { name: "New Notice" }).click();
    await page.getByLabel("Harbour Synthetic Property").check();
    await page.getByLabel("Queen Synthetic Court").check();
    await expect(page.getByText(/2 selected/)).toBeVisible();
    await page.getByRole("button", { name: "Resolve current recipients" }).click();
    await expect(page.getByText(/Synthetic Current Tenant A/)).toBeVisible();
    await expect(page.getByText(/Former Tenant/)).toHaveCount(0);
    await expect(page.getByText(/2 properties · 3 eligible occupants · 2 deliverable · 1 skipped/)).toBeVisible();
    await page.getByRole("checkbox", { name: "Harbour Synthetic Property — 1A", exact: true }).check();
    await expect(page.getByText(/Preview recipients \(1\)/)).toBeVisible();
    await page.getByLabel("Subject").fill("Water shutdown");
    await page.getByLabel("Message").fill("Water will be unavailable at noon.");
    await page.getByRole("button", { name: "Preview Notice" }).click();
    const confirmation = page.getByRole("dialog", { name: "Confirm notice" });
    await expect(confirmation.getByText(/2 selected properties/)).toBeVisible();
    await expect(confirmation.getByText(/separate private delivery/)).toBeVisible();
    await confirmation.getByRole("button", { name: "Send Notice" }).click();
    await expect(page.getByText("Water shutdown")).toBeVisible();
    await page.getByText("Water shutdown").click();
    await expect(page.getByRole("list", { name: "Selected properties" })).toContainText("Queen Synthetic Court");
    await expect(page.getByText(/Synthetic Current Tenant A.*sent/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth + 1));
    expect(errors.consoleErrors).toEqual([]);
    expect(errors.pageErrors).toEqual([]);
    expect(errors.fiveXX).toEqual([]);
  });
}
