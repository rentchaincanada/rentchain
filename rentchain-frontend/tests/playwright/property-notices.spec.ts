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
  await page.route(/\/api\/properties(?:\?|$)/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ properties: [{ id: "property-synthetic", name: "Harbour Synthetic Property", addressLine1: "1 QA Street", totalUnits: 2, createdAt: "2026-08-09", units: [] }] }) }));

  let notices: any[] = [];
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
        property: { id: "property-synthetic", label: "Harbour Synthetic Property" },
        recipients: [
          { tenantId: "tenant-a", tenantDisplayName: "Synthetic Current Tenant A", unitIds: ["unit-a"], unitLabels: ["1A"], deliveryAvailability: "available" },
          { tenantId: "tenant-b", tenantDisplayName: "Synthetic Current Tenant B", unitIds: ["unit-b"], unitLabels: ["2B"], deliveryAvailability: "available" },
          { tenantId: "tenant-c", tenantDisplayName: "Synthetic Missing Email", unitIds: ["unit-b"], unitLabels: ["2B"], deliveryAvailability: "missing_email" },
        ], counts: { total: 3, available: 2, skipped: 1 }, maxRecipients: 100,
      }) }); return;
    }
    if (url.pathname === "/api/landlord/notices" && request.method() === "POST") {
      notices = [{ id: "notice-synthetic", propertyId: "property-synthetic", propertyLabel: "Harbour Synthetic Property", subject: "Water shutdown", body: "Water will be unavailable at noon.", status: "completed", recipientCount: 1, sentCount: 1, failedCount: 0, skippedCount: 0, createdAtMs: Date.now() }];
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true, created: true, notice: notices[0] }) }); return;
    }
    if (url.pathname === "/api/landlord/notices") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, notices }) }); return;
    }
    if (url.pathname.endsWith("/notice-synthetic")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, notice: notices[0], deliveries: [{ id: "delivery-a", tenantId: "tenant-a", tenantDisplayName: "Synthetic Current Tenant A", unitIds: ["unit-a"], unitLabels: ["1A"], channel: "email", status: "sent" }] }) }); return;
    }
    await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false }) });
  });
  return { consoleErrors, pageErrors, fiveXX };
}

test("handles fail-closed recipient preview rejection without sending", async ({ page }) => {
  const errors = await installNoticesHarness(page, { rejectRecipientPreview: true });
  await page.goto("/notices");
  await page.getByRole("button", { name: "New Notice" }).click();
  await page.getByLabel("Property").selectOption("property-synthetic");
  await page.getByRole("button", { name: "Resolve current recipients" }).click();
  await expect(page.getByRole("alert")).toHaveText("Eligible recipients could not be resolved.");
  await expect(page.getByRole("button", { name: "Preview Notice" })).toHaveCount(0);
  expect(errors.consoleErrors).toEqual([expect.stringContaining("403 (Forbidden)")]);
  expect(errors.pageErrors).toEqual([]);
  expect(errors.fiveXX).toEqual([]);
});

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} completes the synthetic private Notices flow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = await installNoticesHarness(page);
    await page.goto("/notices");
    await expect(page.getByRole("heading", { name: "Notices" })).toBeVisible();
    await page.getByRole("button", { name: "New Notice" }).click();
    await page.getByLabel("Property").selectOption("property-synthetic");
    await page.getByRole("button", { name: "Resolve current recipients" }).click();
    await expect(page.getByText(/Synthetic Current Tenant A/)).toBeVisible();
    await expect(page.getByText(/Former Tenant/)).toHaveCount(0);
    await page.getByRole("checkbox", { name: "1A", exact: true }).check();
    await expect(page.getByText(/Preview recipients \(1\)/)).toBeVisible();
    await page.getByLabel("Subject").fill("Water shutdown");
    await page.getByLabel("Message").fill("Water will be unavailable at noon.");
    await page.getByRole("button", { name: "Preview Notice" }).click();
    const confirmation = page.getByRole("dialog", { name: "Confirm notice" });
    await expect(confirmation.getByText(/separate private delivery/)).toBeVisible();
    await confirmation.getByRole("button", { name: "Send Notice" }).click();
    await expect(page.getByText("Water shutdown")).toBeVisible();
    await page.getByText("Water shutdown").click();
    await expect(page.getByText(/Synthetic Current Tenant A.*sent/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth + 1));
    expect(errors.consoleErrors).toEqual([]);
    expect(errors.pageErrors).toEqual([]);
    expect(errors.fiveXX).toEqual([]);
  });
}
