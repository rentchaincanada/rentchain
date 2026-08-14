import { expect, test, type Page } from "@playwright/test";

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

const attachments = [
  { attachmentId: "11111111-1111-4111-8111-111111111111", filename: "synthetic.jpg", contentType: "image/jpeg", byteSize: 1200, width: 640, height: 480 },
  { attachmentId: "22222222-2222-4222-8222-222222222222", filename: "synthetic.png", contentType: "image/png", byteSize: 1500, width: 640, height: 480 },
  { attachmentId: "33333333-3333-4333-8333-333333333333", filename: "synthetic.webp", contentType: "image/webp", byteSize: 700, width: 640, height: 480 },
];

const onePixelGif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64");

async function installThumbnailHarness(page: Page, role: "tenant" | "landlord", imageRequests: string[]) {
  await page.route("**/api/pr1525-bootstrap/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        scope: "pr1525-maintenance-attachments",
        deploymentSha: "b".repeat(40),
        requestId: "qa-pr1525-target-request",
        session: { role, principalId: `qa-pr1525-${role}`, apiActor: role },
      }),
    });
  });
  await page.route("**/api/pr1525-attachments/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/access")) {
      const attachment = attachments.find((item) => path.includes(item.attachmentId));
      await route.fulfill({
        status: attachment ? 200 : 404,
        contentType: "application/json",
        body: JSON.stringify(attachment
          ? { ok: true, data: { url: `https://storage.googleapis.com/private-preview/${attachment.attachmentId}?Expires=600&Signature=short-lived`, expiresInSeconds: 600 } }
          : { ok: false, error: "NOT_FOUND" }),
      });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: attachments }) });
  });
  await page.route("https://storage.googleapis.com/private-preview/**", async (route) => {
    imageRequests.push(new URL(route.request().url()).hostname);
    await route.fulfill({ status: 200, contentType: "image/gif", body: onePixelGif });
  });
}

for (const role of ["tenant", "landlord"] as const) {
  for (const viewport of viewports) {
    test(`${role} renders private attachment thumbnails at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      const imageRequests: string[] = [];
      await page.setViewportSize(viewport);
      await installThumbnailHarness(page, role, imageRequests);
      await page.goto(`/__qa/pr1525/${role}`, { waitUntil: "domcontentloaded" });

      for (const attachment of attachments) {
        const image = page.getByRole("img", { name: `Maintenance attachment preview: ${attachment.filename}` });
        await expect(image).toBeVisible();
        await expect(image).toHaveJSProperty("complete", true);
      }
      await expect(page.getByRole("button", { name: "Open photo" })).toHaveCount(3);
      await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(role === "tenant" ? 3 : 0);
      expect(imageRequests).toHaveLength(3);
      expect(new Set(imageRequests)).toEqual(new Set(["storage.googleapis.com"]));
      const geometry = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      expect(geometry.document).toBeLessThanOrEqual(geometry.viewport + 1);
      await expect(page.locator("body")).not.toContainText("maintenance/images/");
    });
  }
}

test("thumbnail access failure preserves metadata and controls without repeated requests", async ({ page }) => {
  let accessRequests = 0;
  await page.route("**/api/pr1525-bootstrap/tenant", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      ok: true,
      scope: "pr1525-maintenance-attachments",
      deploymentSha: "b".repeat(40),
      requestId: "qa-pr1525-target-request",
      session: { role: "tenant", principalId: "qa-pr1525-tenant", apiActor: "tenant" },
    }) });
  });
  await page.route("**/api/pr1525-attachments/**", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/access")) {
      accessRequests += 1;
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, error: "NOT_FOUND" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, data: [attachments[0]] }) });
  });
  await page.goto("/__qa/pr1525/tenant", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Preview unavailable")).toBeVisible();
  await expect(page.getByText("synthetic.jpg")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open photo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
  await page.waitForTimeout(250);
  expect(accessRequests).toBe(1);
});
