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

async function expectConversationCardsContained(page: Page) {
  const geometry = await page.locator(".rc-messages-list-item").evaluateAll((cards) =>
    cards.map((card, index) => {
      const rect = card.getBoundingClientRect();
      const nextRect = cards[index + 1]?.getBoundingClientRect();
      const childRects = [
        card.querySelector(".rc-messages-list-item-body"),
        card.querySelector(".rc-messages-list-item-title"),
        card.querySelector(".rc-messages-list-item-meta"),
        card.querySelector(".rc-messages-avatar"),
        card.querySelector(".rc-messages-unread-dot"),
      ].filter((element): element is Element => Boolean(element)).map((element) => element.getBoundingClientRect());
      return {
        card: { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, height: rect.height },
        nextTop: nextRect?.top ?? null,
        childrenContained: childRects.every((child) =>
          child.top >= rect.top && child.right <= rect.right && child.bottom <= rect.bottom && child.left >= rect.left
        ),
      };
    })
  );

  expect(geometry.length).toBeGreaterThan(1);
  for (const [index, item] of geometry.entries()) {
    expect(item.card.height, `card ${index} must retain its content-driven height`).toBeGreaterThanOrEqual(66);
    expect(item.childrenContained, `card ${index} children must remain inside its border`).toBe(true);
    if (item.nextTop != null) {
      expect(item.nextTop - item.card.bottom, `card ${index} must not intersect the next card`).toBeGreaterThanOrEqual(9);
    }
  }
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide-desktop", width: 1536, height: 960 },
  { name: "narrow-desktop", width: 1024, height: 768 },
]) {
  test(`${viewport.name} keeps bounded independent message panels`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installFixture(page, false);

    const list = page.getByTestId("messages-conversation-scroll");
    const detail = page.getByTestId("messages-detail-scroll");
    const panel = page.getByTestId("messages-detail-panel");

    await expectConversationCardsContained(page);

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

  await page.route("**/src/api/baseUrl.ts", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace("import.meta?.env?.VITE_API_BASE_URL", '"http://127.0.0.1:5173"')
      .replace("import.meta?.env?.VITE_DEPLOY_ENV", '"development"')
      .replace("import.meta?.env?.DEV", "true");
    await route.fulfill({ response, body });
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
    if (url.pathname === "/api/landlord/messages/recipients") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          recipients: Array.from({ length: 6 }, (_, index) => ({
            leaseId: `lease-synthetic-${index + 1}`,
            tenantId: `tenant-synthetic-${index + 1}`,
            tenantDisplayName: index === 0
              ? "Synthetic Active Tenant With An Intentionally Long Wrapping Display Name"
              : `Synthetic Active Tenant ${index + 1}`,
            propertyId: `property-synthetic-${index + 1}`,
            propertyDisplayLabel: index === 0
              ? "Harbour Synthetic Property With An Intentionally Long Waterfront Name"
              : "Harbour Synthetic Property",
            unitId: `unit-synthetic-${index + 1}`,
            unitDisplayLabel: index === 0 ? "Unit 4B East Wing With Extended Label" : `Unit ${index + 1}`,
          })),
        }),
      });
      return;
    }
    if (url.pathname === "/api/landlord/messages/conversations") {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            conversationId: "conv-1",
            created: false,
            message: { id: "synthetic-first-message" },
          }),
        });
        return;
      }
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

  await page.getByRole("button", { name: "New Message" }).first().click();
  const compose = page.getByRole("dialog", { name: "New message" });
  await expect(compose).toBeVisible();
  const recipientRows = compose.locator(".rc-messages-recipient-list button");
  await expect(recipientRows).toHaveCount(6);
  const rowGeometry = await recipientRows.evaluateAll((rows) => rows.map((row, index) => {
    const rect = row.getBoundingClientRect();
    const name = row.querySelector<HTMLElement>(".rc-messages-recipient-name")?.getBoundingClientRect();
    const context = row.querySelector<HTMLElement>(".rc-messages-recipient-context")?.getBoundingClientRect();
    const next = rows[index + 1]?.getBoundingClientRect();
    return {
      rowTop: rect.top,
      rowBottom: rect.bottom,
      nameTop: name?.top,
      nameBottom: name?.bottom,
      contextTop: context?.top,
      contextBottom: context?.bottom,
      nextTop: next?.top,
    };
  }));
  for (const geometry of rowGeometry) {
    expect(geometry.nameTop).toBeGreaterThanOrEqual(geometry.rowTop);
    expect(geometry.nameBottom).toBeLessThanOrEqual(geometry.contextTop ?? Infinity);
    expect(geometry.contextBottom).toBeLessThanOrEqual(geometry.rowBottom);
    if (geometry.nextTop !== undefined) expect(geometry.rowBottom).toBeLessThan(geometry.nextTop);
  }
  await expect(compose.getByPlaceholder("Write your message")).toBeVisible();
  await expect(compose.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(compose.getByRole("button", { name: "Send Message" })).toBeVisible();
  await compose.getByPlaceholder("Search by tenant, property, or unit").fill("4B");
  await compose.getByRole("button", { name: /Synthetic Active Tenant With/ }).click();
  await expect(compose.getByText("Selected recipient")).toBeVisible();
  await expect(compose.getByPlaceholder("Search by tenant, property, or unit")).toHaveCount(0);
  await expect(compose.locator(".rc-messages-recipient-list button")).toHaveCount(0);
  await expect(compose.getByText(/Synthetic Active Tenant With/)).toBeVisible();
  await expect(compose.getByText(/Harbour Synthetic Property With An Intentionally Long Waterfront Name/)).toBeVisible();
  await compose.getByPlaceholder("Write your message").fill("Harmless unsent draft retained during recipient change");
  await compose.getByRole("button", { name: "Change" }).click();
  await expect(compose.getByPlaceholder("Search by tenant, property, or unit")).toBeFocused();
  await expect(compose.getByPlaceholder("Write your message")).toHaveValue("Harmless unsent draft retained during recipient change");
  await expect(compose.locator(".rc-messages-recipient-list button")).toHaveCount(6);
  await compose.getByRole("button", { name: /Synthetic Active Tenant 2/ }).click();
  await expect(compose.getByText("Selected recipient")).toBeVisible();
  await expect(compose.getByText("Synthetic Active Tenant 2")).toBeVisible();
  await compose.getByRole("button", { name: "Cancel" }).click();
  await expect(compose).not.toBeVisible();
  await expect(page).toHaveURL(/threadId=conv-1/);

  await expectConversationCardsContained(page);

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
