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
  { width: 1440, height: 900 },
];

const tenantToken = `tenant.${Buffer.from(JSON.stringify({ sub: "tenant-image-qa", role: "tenant", exp: 4102444800 })).toString("base64url")}.qa`;

async function installTenantHarness(page: Page, uploadFails = false, applicationRequests: Array<{ url: string; method: string }> = []) {
  await page.addInitScript(({ token }) => {
    localStorage.setItem("rentchain_tenant_token", token);
    sessionStorage.setItem("rentchain_tenant_token", token);
    localStorage.setItem("dev_auth_unlocked", "1");
  }, { token: tenantToken });
  await page.route(/\/api\/tenant\//, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    applicationRequests.push({ url: request.url(), method: request.method() });
    if (path.endsWith("/api/tenant/workspace")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { context: { authority: "active_tenant", tenantId: "tenant-image-qa", propertyId: "property-qa", leaseId: "lease-qa" }, tenant: { id: "tenant-image-qa", status: "active" }, landlord: { name: "Synthetic Landlord" }, property: { id: "property-qa", name: "QA Property" }, unit: { id: "unit-qa", label: "Unit 1" }, lease: { id: "lease-qa", status: "active" }, application: null, maintenance: [] } }) });
      return;
    }
    if (request.method() === "POST" && /\/attachments$/.test(path)) {
      await route.fulfill({
        status: uploadFails ? 500 : 201,
        contentType: "application/json",
        body: JSON.stringify(uploadFails
          ? { ok: false, error: "UPLOAD_FAILED" }
          : { ok: true, data: { attachmentId: "image-qa", filename: "leak.jpg", contentType: "image/jpeg", byteSize: 32, width: 8, height: 8, createdAt: 100 } }),
      });
      return;
    }
    if (request.method() === "POST" && path.endsWith("/api/tenant/maintenance-requests")) {
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true, data: { requestId: "maintenance:69ffa10a77d4", status: "submitted" } }) });
      return;
    }
    if (request.method() === "GET" && path.endsWith("/attachments/image-qa/access")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", expiresInSeconds: 600 } }) });
      return;
    }
    if (request.method() === "GET" && path.endsWith("/attachments")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [{ attachmentId: "image-qa", filename: "faucet-leak.jpg", contentType: "image/jpeg", byteSize: 1227, width: 640, height: 480, createdAt: 100 }] }) });
      return;
    }
    if (request.method() === "GET" && /\/api\/tenant\/maintenance-requests\/maintenance(?::|%3A)69ffa10a77d4$/.test(path)) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { requestId: "maintenance:69ffa10a77d4", title: "Synthetic faucet leak", description: "Water is visibly leaking from the faucet.", status: "submitted", priority: "normal", category: "plumbing", notifications: { tenant: { requiresAccessConfirmation: false, requiresSignoff: false, requiresReworkAwareness: false } }, createdAt: 100, updatedAt: 200 } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [] }) });
  });
}

for (const viewport of viewports) {
  test(`keeps tenant image selection responsive at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installTenantHarness(page);
    await page.goto("/tenant/maintenance/new", { waitUntil: "domcontentloaded" });

    const input = page.locator('input[type="file"]');
    await expect(page.getByText("Add photos", { exact: true })).toBeVisible();
    await input.setInputFiles([
      { name: "leak.jpg", mimeType: "image/jpeg", buffer: Buffer.from("synthetic-image-a") },
      { name: "pipe.webp", mimeType: "image/webp", buffer: Buffer.from("synthetic-image-b") },
    ]);
    await expect(page.getByText("leak.jpg", { exact: true })).toBeVisible();
    await expect(page.getByText("pipe.webp", { exact: true })).toBeVisible();
    const preview = page.getByRole("img", { name: "Selected maintenance photo preview: leak.jpg" });
    await expect(preview).toBeVisible();
    await expect(preview).toHaveCSS("object-fit", "contain");
    const ratio = await preview.evaluate((image) => {
      const frame = image.parentElement!.getBoundingClientRect();
      return frame.width / frame.height;
    });
    expect(ratio).toBeCloseTo(4 / 3, 1);
    await page.getByRole("button", { name: "Remove pipe.webp" }).click();
    await expect(page.getByText("pipe.webp", { exact: true })).toHaveCount(0);

    const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
  });

  test(`shows persisted maintenance evidence without cropping at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installTenantHarness(page);
    await page.goto("/tenant/maintenance/maintenance:69ffa10a77d4", { waitUntil: "domcontentloaded" });

    const image = page.getByRole("img", { name: "Maintenance photo: faucet-leak.jpg" });
    await expect(image).toBeVisible();
    await expect(image).toHaveCSS("object-fit", "contain");
    const geometry = await image.evaluate((element) => {
      const frame = element.parentElement!.getBoundingClientRect();
      return {
        ratio: frame.width / frame.height,
        imageWidth: element.getBoundingClientRect().width,
        imageHeight: element.getBoundingClientRect().height,
        viewport: innerWidth,
        document: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.ratio).toBeCloseTo(4 / 3, 1);
    expect(geometry.imageWidth).toBeGreaterThan(0);
    expect(geometry.imageHeight).toBeGreaterThan(0);
    expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
    await expect(page.getByRole("button", { name: "Open faucet-leak.jpg" })).toBeEnabled();
    await expect(page.getByText("faucet-leak.jpg", { exact: true })).toBeVisible();
  });
}

test("preserves a created request when a synthetic image upload fails", async ({ page }) => {
  await installTenantHarness(page, true);
  await page.goto("/tenant/maintenance/new", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="file"]').setInputFiles({ name: "leak.jpg", mimeType: "image/jpeg", buffer: Buffer.from("synthetic-image") });
  await page.getByPlaceholder("Leaking kitchen faucet").fill("Synthetic leak");
  await page.getByPlaceholder(/Describe the issue/).fill("Synthetic QA description");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page.getByText(/request was saved, but one or more photos could not be uploaded/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry photo uploads" })).toBeVisible();
});

test("submits the real tenant form through the same-origin API using the created request reference", async ({ page }) => {
  const applicationRequests: Array<{ url: string; method: string }> = [];
  await installTenantHarness(page, false, applicationRequests);
  await page.goto("/tenant/maintenance/new", { waitUntil: "domcontentloaded" });
  await page.locator('input[type="file"]').setInputFiles([
    { name: "leak.jpg", mimeType: "image/jpeg", buffer: Buffer.from("synthetic-jpeg") },
    { name: "pipe.png", mimeType: "image/png", buffer: Buffer.from("synthetic-png") },
  ]);
  await page.getByPlaceholder("Leaking kitchen faucet").fill("Synthetic governed upload");
  await page.getByPlaceholder(/Describe the issue/).fill("Synthetic real tenant form verification");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect.poll(() => applicationRequests.filter((request) => request.method === "POST" && request.url.endsWith("/attachments")).length).toBe(2);
  const uploadUrls = applicationRequests
    .filter((request) => request.method === "POST" && request.url.endsWith("/attachments"))
    .map((request) => request.url);
  expect(uploadUrls).toHaveLength(2);
  for (const requestUrl of uploadUrls) {
    const url = new URL(requestUrl);
    expect(url.origin).toBe(new URL(page.url()).origin);
    expect(url.hostname).not.toContain("run.app");
    expect(url.pathname).toContain("/api/tenant/maintenance-requests/maintenance%3A69ffa10a77d4/attachments");
  }
  await expect(page).toHaveURL(/\/tenant\/maintenance\/maintenance(?::|%3A)69ffa10a77d4$/);
});

test("shows an authorized landlord thumbnail without exposing an object path", async ({ page }) => {
  await installLegacySmokeHarness(page, { devPreviewUnlock: true });
  await page.route("**/api/contractor/invites", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, invites: [] }) });
  });
  await page.route("**/api/landlord/maintenance**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/attachments/image-qa/access")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: { url: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", expiresInSeconds: 600 } }) });
      return;
    }
    if (path.endsWith("/attachments")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [{ attachmentId: "image-qa", filename: "tenant-leak.jpg", contentType: "image/jpeg", byteSize: 32, width: 8, height: 8, createdAt: 100 }] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [{ id: "maint-image-qa", tenantId: "tenant-qa", landlordId: "smoke-landlord", propertyId: "property-qa", unitId: "unit-qa", tenantName: "Synthetic Tenant", propertyLabel: "QA Property", unitLabel: "Unit 1", title: "Synthetic leak", description: "Synthetic only", category: "PLUMBING", priority: "normal", status: "submitted", assignedContractorName: null, serviceWindowStartAt: null, serviceWindowEndAt: null, accessRequired: null, createdAt: 100, updatedAt: 100 }] }) });
  });
  await page.goto("/maintenance/maint-image-qa", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Open tenant photo tenant-leak.jpg" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("maintenance/images/");
});
