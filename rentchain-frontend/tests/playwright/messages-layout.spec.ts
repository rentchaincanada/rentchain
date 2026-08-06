import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { installLegacySmokeHarness } from "./legacy-smoke-setup";

const messagesCss = readFileSync(
  new URL("../../src/pages/MessagesPage.css", import.meta.url),
  "utf8"
);
const masterDetailCss = readFileSync(
  new URL("../../src/components/layout/ResponsiveMasterDetail.css", import.meta.url),
  "utf8"
);
const evidenceDir = process.env.PR1435_POLISH_EVIDENCE_DIR;

function conversationCards() {
  return Array.from({ length: 24 }, (_, index) => `
    <button class="rc-messages-list-item" type="button" data-conversation="${index}">
      <span class="rc-messages-list-item-body">
        <span class="rc-messages-avatar">QT</span>
        <span class="rc-messages-list-item-content">
          <span class="rc-messages-list-item-row">
            <span class="rc-messages-list-item-title">QA Tenant With An Intentionally Long Governed Display Label ${index + 1}</span>
            <span class="rc-messages-unread-dot"></span>
          </span>
          <span class="rc-messages-list-item-meta">Harbour Property With A Long Name / Unit ${index + 1}</span>
        </span>
      </span>
    </button>
  `).join("");
}

function messageBubbles() {
  return Array.from({ length: 30 }, (_, index) => `
    <div class="rc-messages-bubble" style="align-self:${index % 2 ? "flex-end" : "flex-start"}">
      <span class="rc-messages-bubble-meta">${index % 2 ? "landlord" : "tenant"}</span>
      <span class="rc-messages-bubble-text">Bounded synthetic QA message ${index + 1}</span>
    </div>
  `).join("");
}

async function installFixture(page: Page, mobile: boolean) {
  const master = `
    <div class="rc-messages-list" data-testid="messages-conversation-scroll">
      ${conversationCards()}
    </div>`;
  const detail = `
    <section class="rc-messages-thread" data-testid="messages-detail-panel">
      <header class="rc-messages-thread-header"><span class="rc-messages-thread-title">QA Tenant With An Intentionally Long Governed Display Label • Linked property</span></header>
      <div class="rc-messages-thread-body" data-testid="messages-detail-scroll">${messageBubbles()}</div>
      <div class="rc-messages-composer" data-testid="messages-composer">
        <textarea class="rc-messages-composer-input" aria-label="Write a message"></textarea>
        <button class="rc-messages-composer-send">Send</button>
      </div>
    </section>`;
  const layout = mobile
    ? `<div class="rc-master-detail rc-master-detail--mobile"><div class="rc-master-detail-mobile-stack"><div class="rc-master-detail-detail rc-master-detail-detail--mobile">${detail}</div></div></div>`
    : `<div class="rc-master-detail rc-master-detail--desktop"><div class="rc-master-detail-master"><div class="rc-master-detail-master-title">Conversations</div>${master}</div><div class="rc-master-detail-detail">${detail}</div></div>`;

  await page.setContent(`<!doctype html><style>
    * { box-sizing: content-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow-x: hidden; }
    body { background: #f7f1e7; font-family: system-ui, sans-serif; }
    :root { --rc-landlord-sticky-shell-height: 120px; --rc-landlord-sticky-shell-gap: 20px; }
    ${masterDetailCss}
    ${messagesCss}
  </style><main class="rc-messages-page"><h1>Messages</h1><div class="rc-messages-grid" data-testid="messages-layout">${layout}</div></main>`);
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "narrow-desktop", width: 1024, height: 768 },
]) {
  test(`${viewport.name} keeps bounded independent message panels`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installFixture(page, false);

    const list = page.getByTestId("messages-conversation-scroll");
    const detail = page.getByTestId("messages-detail-scroll");
    const panel = page.getByTestId("messages-detail-panel");

    for (const locator of [list, detail, panel]) {
      const geometry = await locator.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth + 1)
    );

    const initialDetailTop = await detail.evaluate((element) => element.scrollTop);
    await list.evaluate((element) => { element.scrollTop = 240; });
    expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await detail.evaluate((element) => element.scrollTop)).toBe(initialDetailTop);

    const listTop = await list.evaluate((element) => element.scrollTop);
    await detail.evaluate((element) => { element.scrollTop = 260; });
    expect(await detail.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    expect(await list.evaluate((element) => element.scrollTop)).toBe(listTop);
    await expect(page.getByTestId("messages-composer")).toBeVisible();
    await page.getByLabel("Write a message").fill("Synthetic layout check");
    await expect(page.getByLabel("Write a message")).toHaveValue("Synthetic layout check");

    if (evidenceDir) {
      mkdirSync(evidenceDir, { recursive: true });
      await page.screenshot({ path: join(evidenceDir, `${viewport.name}-messages-layout.png`), fullPage: true });
    }
  });
}

test("real Messages page preserves deep links, Back, composer access, and bounded panel geometry", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const productionRequests: string[] = [];
  const failedResponses: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("rentchain-landlord-api-cyaabkl54a-uc.a.run.app")) {
      productionRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await installLegacySmokeHarness(page, { devPreviewUnlock: true });
  await page.route("**/api/account/limits", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, plan: "pro", limits: {}, usage: {} }),
    });
  });
  const conversations = Array.from({ length: 24 }, (_, index) => ({
    id: `conv-${index + 1}`,
    tenantId: `safe-tenant-ref-${index + 1}`,
    tenantDisplayName: `QA Tenant With An Intentionally Long Governed Display Label ${index + 1}`,
    propertyDisplayLabel: "Harbour Property With A Long Name",
    unitDisplayLabel: `Unit ${index + 1}`,
    hasUnread: index === 0,
    lastMessageAt: 1000 - index,
  }));
  await page.route("**/api/landlord/messages/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/landlord/messages/conversations") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ conversations }) });
      return;
    }
    const match = url.pathname.match(/^\/api\/landlord\/messages\/conversations\/(conv-\d+)(?:\/read)?$/);
    if (!match) {
      await route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false }) });
      return;
    }
    const conversation = conversations.find((item) => item.id === match[1]) ?? conversations[0];
    if (url.pathname.endsWith("/read")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    const messages = Array.from({ length: 30 }, (_, index) => ({
      id: `${conversation.id}-message-${index + 1}`,
      conversationId: conversation.id,
      senderRole: index % 2 ? "landlord" : "tenant",
      body: `Bounded synthetic message ${index + 1}`,
      createdAtMs: index + 1,
    }));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ conversation, messages }) });
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/messages?threadId=conv-1");
  await page.waitForTimeout(500);
  if (await page.getByRole("heading", { name: "Messages" }).count() === 0) {
    throw new Error(JSON.stringify({
      url: page.url(),
      consoleErrors,
      pageErrors,
      body: await page.locator("body").innerText(),
    }));
  }
  await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
  await expect(page.getByText(/QA Tenant With An Intentionally Long Governed Display Label 1/).first()).toBeVisible();

  const list = page.getByTestId("messages-conversation-scroll");
  const detail = page.getByTestId("messages-detail-scroll");
  for (const locator of [list, detail, page.getByTestId("messages-detail-panel")]) {
    const geometry = await locator.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth + 1)
  );

  const initialDetailTop = await detail.evaluate((element) => element.scrollTop);
  await list.evaluate((element) => { element.scrollTop = 300; });
  expect(await list.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await detail.evaluate((element) => element.scrollTop)).toBe(initialDetailTop);
  const listTop = await list.evaluate((element) => element.scrollTop);
  await detail.evaluate((element) => { element.scrollTop = 300; });
  expect(await detail.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await list.evaluate((element) => element.scrollTop)).toBe(listTop);

  await page.getByText(/QA Tenant With An Intentionally Long Governed Display Label 2/).first().click();
  await expect(page).toHaveURL(/threadId=conv-2/);
  await page.goBack();
  await expect(page).toHaveURL(/threadId=conv-1/);
  await page.getByPlaceholder("Write a message").fill("Synthetic interaction check");
  await expect(page.getByPlaceholder("Write a message")).toHaveValue("Synthetic interaction check");
  expect(failedResponses).toEqual([]);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(productionRequests).toEqual([]);

  if (evidenceDir) {
    mkdirSync(evidenceDir, { recursive: true });
    await page.screenshot({ path: join(evidenceDir, "real-messages-page.png"), fullPage: true });
  }
});

for (const viewport of [
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} keeps the mobile detail usable without horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installFixture(page, true);

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth + 1)
    );
    await expect(page.getByTestId("messages-detail-panel")).toBeVisible();
    await expect(page.getByTestId("messages-composer")).toBeVisible();
    await page.getByLabel("Write a message").fill("Responsive synthetic check");
    await expect(page.getByLabel("Write a message")).toHaveValue("Responsive synthetic check");

    if (evidenceDir) {
      mkdirSync(evidenceDir, { recursive: true });
      await page.screenshot({ path: join(evidenceDir, `${viewport.name}-messages-layout.png`), fullPage: true });
    }
  });
}
