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

function visibleCommunicationsMenuTrigger(page: Page) {
  return page
    .locator(".rc-landlord-topnav:visible, .rc-landlord-mobile-topbar:visible")
    .getByRole("button", { name: "Communications" });
}

for (const route of communicationsRoutes) {
  for (const width of desktopViewports) {
    test(`keeps ${route.title} Communications state visible without Workspace scrolling at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await installWorkspaceHarness(page);
      await page.goto(route.path);

      const workspaceNav = page.getByRole("navigation", { name: "Workspace navigation" });
      await expect(workspaceNav.getByRole("group", { name: "Communications" })).toHaveCount(0);
      await expect(workspaceNav.getByText("COMMUNICATIONS")).toHaveCount(0);
      const trigger = visibleCommunicationsMenuTrigger(page);
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

test("keeps Communications children out of the mobile Workspace drawer and tab bar", async ({ page }) => {
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
  await expect(tabbar.getByRole("button", { name: "Communications" })).toBeVisible();
  await expect(tabbar.getByRole("button", { name: "Unified Inbox" })).toHaveCount(0);
  await expect(tabbar.getByRole("button", { name: "Messages" })).toHaveCount(0);
  await expect(tabbar.getByRole("button", { name: "Notices" })).toHaveCount(0);
});

test("uses the bottom Communications control as a dismissible child drawer without implicit navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installWorkspaceHarness(page);
  await page.goto("/messages");

  const tabbar = page.getByRole("navigation", { name: "Bottom navigation" });
  const trigger = tabbar.getByRole("button", { name: "Communications" });
  await trigger.click();
  await expect(page).toHaveURL(/\/messages$/);
  const drawer = page.getByRole("dialog", { name: "Communications navigation" });
  await expect(drawer.getByRole("button")).toHaveCount(4);
  await expect(drawer.getByRole("button", { name: "Unified Inbox" })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Messages" })).toHaveAttribute("aria-current", "page");
  await expect(drawer.getByRole("button", { name: "Notices" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeAttached();
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(/\/messages$/);

  await trigger.click();
  await page.locator(".rc-landlord-backdrop").click({ position: { x: 4, y: 4 } });
  await expect(drawer).not.toBeAttached();
  await expect(page).toHaveURL(/\/messages$/);
});

test("reopens the bottom Communications drawer across child navigation", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await installWorkspaceHarness(page);
  await page.goto("/messages");

  const trigger = page.getByRole("navigation", { name: "Bottom navigation" }).getByRole("button", { name: "Communications" });
  await trigger.click();
  await page.getByRole("dialog", { name: "Communications navigation" }).getByRole("button", { name: "Notices" }).click();
  await expect(page).toHaveURL(/\/notices$/);
  await expect(trigger).toHaveAttribute("aria-current", "page");

  await trigger.click();
  await expect(page).toHaveURL(/\/notices$/);
  const drawer = page.getByRole("dialog", { name: "Communications navigation" });
  await expect(drawer.getByRole("button", { name: "Notices" })).toHaveAttribute("aria-current", "page");
  await drawer.getByRole("button", { name: "Unified Inbox" }).click();
  await expect(page).toHaveURL(/\/landlord\/unified-inbox$/);
  await expect(drawer).not.toBeAttached();
});

for (const destination of communicationsRoutes) {
  test(`navigates to ${destination.title} from the mobile Communications menu`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installWorkspaceHarness(page);
    await page.goto("/messages");

    await visibleCommunicationsMenuTrigger(page).click();
    const target = page.getByRole("menu", { name: "Communications destinations" }).getByRole("menuitem", { name: destination.title });
    await target.click();

    await expect(page).toHaveURL(new RegExp(`${destination.path.replaceAll("/", "\\/")}$`));
    await expect(page.locator(".rc-landlord-mobile-role")).toHaveText(destination.title);
    await visibleCommunicationsMenuTrigger(page).click();
    await expect(page.getByRole("menuitem", { name: destination.title })).toHaveAttribute("aria-current", "page");
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 414, height: 896 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
]) {
  test(`keeps Communications primary in bottom nav without Workspace duplication at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installWorkspaceHarness(page);
    await page.goto("/notices");

    await page.getByRole("button", { name: "Open workspace pages" }).first().click();
    const drawer = page.getByRole("dialog", { name: "Navigation menu" });
    await expect(drawer.getByRole("group", { name: "Communications" })).toHaveCount(0);
    await drawer.getByRole("button", { name: "Close menu" }).click();
    const tabbar = page.getByRole("navigation", { name: "Bottom navigation" });
    await expect(tabbar.getByRole("button")).toHaveCount(5);
    await expect(tabbar.getByText("Dashboard")).toBeVisible();
    await expect(tabbar.getByText("Properties")).toBeVisible();
    await expect(tabbar.getByText("Applicants")).toBeVisible();
    await expect(tabbar.getByText("Communications")).toBeVisible();
    await expect(tabbar.getByText("More")).toBeVisible();
    await expect(tabbar.getByText("Operations")).toHaveCount(0);
    await expect(tabbar.getByRole("button", { name: "Communications" })).toHaveAttribute("aria-current", "page");
    await tabbar.getByRole("button", { name: "Communications" }).click();
    const communicationsDrawer = page.getByRole("dialog", { name: "Communications navigation" });
    await expect(communicationsDrawer.getByRole("button", { name: "Unified Inbox" })).toBeVisible();
    await expect(communicationsDrawer.getByRole("button", { name: "Messages" })).toBeVisible();
    await expect(communicationsDrawer.getByRole("button", { name: "Notices" })).toHaveAttribute("aria-current", "page");
    await expect(page).toHaveURL(/\/notices$/);
    await communicationsDrawer.getByRole("button", { name: "Close menu" }).click();
    await visibleCommunicationsMenuTrigger(page).click();
    const communications = page.getByRole("menu", { name: "Communications destinations" });
    await expect(communications.getByRole("menuitem")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth + 1),
    );

    await tabbar.getByRole("button", { name: "Open workspace pages" }).click();
    await expect(
      page.getByRole("dialog", { name: "Navigation menu" }).getByRole("button", { name: "Operations" })
    ).toBeVisible();
  });
}

test("redirects the legacy landlord inbox into the canonical Communications shell", async ({ page }) => {
  await page.setViewportSize({ width: 1309, height: 900 });
  await installWorkspaceHarness(page);
  await page.goto("/landlord/inbox?status=unread#updates");

  await expect(page).toHaveURL(/\/landlord\/unified-inbox\?status=unread#updates$/);
  const workspaceNav = page.getByRole("navigation", { name: "Workspace navigation" });
  await expect(workspaceNav.getByRole("group", { name: "Communications" })).toHaveCount(0);
  await visibleCommunicationsMenuTrigger(page).click();
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
      await expect(
        page.getByRole("navigation", { name: "Bottom navigation" }).getByRole("button", { name: "Communications" })
      ).toHaveAttribute("aria-current", "page");
      await visibleCommunicationsMenuTrigger(page).click();
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
