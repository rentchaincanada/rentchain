import { expect, test, type Page } from "@playwright/test";
import { installLegacySmokeHarness } from "./legacy-smoke-setup";

test.use({ serviceWorkers: "block" });

const desktopViewports = [1440, 1366, 1309, 1280, 1180, 1024];

async function installWorkspaceHarness(page: Page) {
  await page.route("**/src/api/baseUrl.ts", async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace("import.meta?.env?.VITE_API_BASE_URL", '"http://127.0.0.1:5173"')
      .replace("import.meta?.env?.VITE_DEPLOY_ENV", '"development"')
      .replace("import.meta?.env?.DEV", "true");
    await route.fulfill({ response, body });
  });
  await installLegacySmokeHarness(page, { devPreviewUnlock: true });
  await page.route("**/api/capabilities", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, plan: "free", features: { messaging: false } }),
    });
  });
}

const communicationsRoutes = [
  { path: "/landlord/unified-inbox", title: "Unified Inbox" },
  { path: "/messages", title: "Messages" },
  { path: "/notices", title: "Notices" },
];

for (const route of communicationsRoutes) {
  for (const width of desktopViewports) {
    test(`keeps ${route.title} Communications state visible without Workspace scrolling at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await installWorkspaceHarness(page);
      await page.goto(route.path);

      const workspaceNav = page.getByRole("navigation", { name: "Workspace navigation" });
      await expect(workspaceNav.getByRole("group", { name: "Communications" })).toHaveCount(0);
      await expect(workspaceNav.getByText("COMMUNICATIONS")).toHaveCount(0);
      const trigger = page.getByRole("button", { name: "Communications" });
      await trigger.click();
      const communications = page.getByRole("menu", { name: "Communications destinations" });
      await expect(communications.getByRole("menuitem")).toHaveCount(3);
      await expect(communications.getByRole("menuitem", { name: "Unified Inbox" })).toBeVisible();
      await expect(communications.getByRole("menuitem", { name: "Messages" })).toBeVisible();
      await expect(communications.getByRole("menuitem", { name: "Notices" })).toBeVisible();
      await expect(communications.getByRole("menuitem", { name: route.title })).toHaveAttribute("aria-current", "page");
      await expect(page.locator(".rc-landlord-workspace-context strong")).toHaveText(route.title);

      const geometry = await workspaceNav.evaluate((nav) => {
        const navRect = nav.getBoundingClientRect();
        return {
          clientWidth: nav.clientWidth,
          scrollWidth: nav.scrollWidth,
          navLeft: navRect.left,
          navRight: navRect.right,
          viewportWidth: window.innerWidth,
        };
      });

      test.info().annotations.push({ type: "geometry", description: JSON.stringify(geometry) });
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
      const menuGeometry = await communications.evaluate((menu) => {
        const rect = menu.getBoundingClientRect();
        const first = menu.querySelector<HTMLElement>('[role="menuitem"]');
        const firstRect = first?.getBoundingClientRect();
        const topElement = firstRect ? document.elementFromPoint(firstRect.left + firstRect.width / 2, firstRect.top + firstRect.height / 2) : null;
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
          firstItemReceivesPointer: Boolean(topElement?.closest('[role="menuitem"]') === first),
          portalParent: menu.parentElement?.tagName,
        };
      });
      const triggerBottom = await trigger.evaluate((element) => element.getBoundingClientRect().bottom);
      expect(menuGeometry.left).toBeGreaterThanOrEqual(0);
      expect(menuGeometry.right).toBeLessThanOrEqual(menuGeometry.viewportWidth);
      expect(menuGeometry.top).toBeGreaterThanOrEqual(0);
      expect(menuGeometry.bottom).toBeLessThanOrEqual(menuGeometry.viewportHeight);
      expect(menuGeometry.top).toBeGreaterThanOrEqual(triggerBottom + 7);
      expect(menuGeometry.firstItemReceivesPointer).toBe(true);
      expect(menuGeometry.portalParent).toBe("BODY");
    });
  }
}

test("keeps communication destinations out of the mobile Workspace drawer and tab bar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installWorkspaceHarness(page);
  await page.goto("/messages");

  await page.getByRole("button", { name: "Open workspace pages" }).first().click();
  const drawer = page.getByRole("dialog", { name: "Navigation menu" });
  await expect(drawer.getByRole("button", { name: "Close menu" })).toBeVisible();
  await expect(drawer.getByRole("group", { name: "Communications" })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "Unified Inbox" })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "Messages" })).toHaveCount(0);
  await expect(drawer.getByRole("button", { name: "Notices" })).toHaveCount(0);
  const tabbar = page.getByRole("navigation", { name: "Bottom navigation" });
  await expect(tabbar.getByRole("button", { name: "Unified Inbox" })).toHaveCount(0);
  await expect(tabbar.getByRole("button", { name: "Messages" })).toHaveCount(0);
  await expect(tabbar.getByRole("button", { name: "Notices" })).toHaveCount(0);
});

for (const destination of communicationsRoutes) {
  test(`navigates to ${destination.title} from the mobile Communications menu`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installWorkspaceHarness(page);
    await page.goto("/messages");

    await page.getByRole("button", { name: "Communications" }).click();
    const target = page.getByRole("menu", { name: "Communications destinations" }).getByRole("menuitem", { name: destination.title });
    await target.click();

    await expect(page).toHaveURL(new RegExp(`${destination.path.replaceAll("/", "\\/")}$`));
    await expect(page.locator(".rc-landlord-mobile-role")).toHaveText(destination.title);
    await page.getByRole("button", { name: "Communications" }).click();
    await expect(page.getByRole("menuitem", { name: destination.title })).toHaveAttribute("aria-current", "page");
  });
}

for (const viewport of [
  { width: 375, height: 812 },
  { width: 360, height: 800 },
  { width: 430, height: 932 },
]) {
  test(`keeps Communications exclusive to the header at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installWorkspaceHarness(page);
    await page.goto("/notices");

    await page.getByRole("button", { name: "Open workspace pages" }).first().click();
    const drawer = page.getByRole("dialog", { name: "Navigation menu" });
    await expect(drawer.getByRole("group", { name: "Communications" })).toHaveCount(0);
    await drawer.getByRole("button", { name: "Close menu" }).click();
    await page.getByRole("button", { name: "Communications" }).click();
    const communications = page.getByRole("menu", { name: "Communications destinations" });
    await expect(communications.getByRole("menuitem")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth + 1),
    );
  });
}

test("redirects the legacy landlord inbox into the canonical Communications shell", async ({ page }) => {
  await page.setViewportSize({ width: 1309, height: 900 });
  await installWorkspaceHarness(page);
  await page.goto("/landlord/inbox?status=unread#updates");

  await expect(page).toHaveURL(/\/landlord\/unified-inbox\?status=unread#updates$/);
  const workspaceNav = page.getByRole("navigation", { name: "Workspace navigation" });
  await expect(workspaceNav.getByRole("group", { name: "Communications" })).toHaveCount(0);
  await page.getByRole("button", { name: "Communications" }).click();
  const communications = page.getByRole("menu", { name: "Communications destinations" });
  await expect(communications.getByRole("menuitem")).toHaveCount(3);
  await expect(communications.getByRole("menuitem", { name: "Unified Inbox" })).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".rc-landlord-workspace-context strong")).toHaveText("Unified Inbox");
});

for (const route of communicationsRoutes) {
  for (const viewport of [
    { name: "tablet", width: 820, height: 1180 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    test(`keeps ${route.title} in the header menu but out of the ${viewport.name} Workspace drawer`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await installWorkspaceHarness(page);
      await page.goto(route.path);

      await expect(page.locator(".rc-landlord-mobile-role")).toHaveText(route.title);
      await page.getByRole("button", { name: "Communications" }).click();
      const headerMenu = page.getByRole("menu", { name: "Communications destinations" });
      await expect(headerMenu.getByRole("menuitem", { name: "Unified Inbox" })).toBeVisible();
      await expect(headerMenu.getByRole("menuitem", { name: "Messages" })).toBeVisible();
      await expect(headerMenu.getByRole("menuitem", { name: "Notices" })).toBeVisible();
      await expect(headerMenu.getByRole("menuitem", { name: route.title })).toHaveAttribute("aria-current", "page");
      await page.keyboard.press("Escape");
      await expect(headerMenu).not.toBeAttached();
      await page.getByRole("button", { name: "Open workspace pages" }).first().click();
      const drawer = page.getByRole("dialog", { name: "Navigation menu" });
      await expect(drawer.getByRole("group", { name: "Communications" })).toHaveCount(0);
      await expect(drawer.getByRole("button", { name: "Unified Inbox" })).toHaveCount(0);
      await expect(drawer.getByRole("button", { name: "Messages" })).toHaveCount(0);
      await expect(drawer.getByRole("button", { name: "Notices" })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        await page.evaluate(() => document.documentElement.clientWidth + 1),
      );
    });
  }
}
