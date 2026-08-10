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
}

for (const width of desktopViewports) {
  test(`keeps Communications visible without Workspace scrolling at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await installWorkspaceHarness(page);
    await page.goto("/landlord/unified-inbox");

    const workspaceNav = page.getByRole("navigation", { name: "Workspace navigation" });
    const communications = workspaceNav.getByRole("group", { name: "Communications" });
    const activeInbox = communications.getByRole("link", { name: "Unified Inbox" });
    await expect(activeInbox).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".rc-landlord-workspace-context strong")).toHaveText("Unified Inbox");

    const geometry = await workspaceNav.evaluate((nav) => {
      const group = nav.querySelector<HTMLElement>(".rc-landlord-workspace-group");
      const active = nav.querySelector<HTMLElement>('[aria-current="page"]');
      const navRect = nav.getBoundingClientRect();
      const groupRect = group?.getBoundingClientRect();
      const activeRect = active?.getBoundingClientRect();
      return {
        clientWidth: nav.clientWidth,
        scrollWidth: nav.scrollWidth,
        navLeft: navRect.left,
        navRight: navRect.right,
        groupLeft: groupRect?.left,
        groupRight: groupRect?.right,
        activeLeft: activeRect?.left,
        activeRight: activeRect?.right,
        viewportWidth: window.innerWidth,
      };
    });

    test.info().annotations.push({ type: "geometry", description: JSON.stringify(geometry) });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
    expect(geometry.groupLeft).toBeGreaterThanOrEqual(geometry.navLeft);
    expect(geometry.groupRight).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.activeLeft).toBeGreaterThanOrEqual(geometry.navLeft);
    expect(geometry.activeRight).toBeLessThanOrEqual(geometry.viewportWidth);
  });
}

for (const route of [
  { path: "/messages", title: "Messages" },
  { path: "/notices", title: "Notices" },
]) {
  test(`preserves ${route.title} Communications state at 1309px`, async ({ page }) => {
    await page.setViewportSize({ width: 1309, height: 900 });
    await installWorkspaceHarness(page);
    await page.goto(route.path);

    const communications = page.getByRole("group", { name: "Communications" });
    await expect(communications.getByRole("link", { name: route.title })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".rc-landlord-workspace-context strong")).toHaveText(route.title);
  });
}

for (const viewport of [
  { name: "tablet", width: 820, height: 1180 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`keeps Communications usable in the ${viewport.name} drawer`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await installWorkspaceHarness(page);
    await page.goto("/notices");

    await page.getByRole("button", { name: "Open workspace pages" }).first().click();
    const drawer = page.getByRole("dialog", { name: "Navigation menu" });
    const communications = drawer.getByRole("group", { name: "Communications" });
    await expect(communications.getByRole("button", { name: "Unified Inbox" })).toBeVisible();
    await expect(communications.getByRole("button", { name: "Messages" })).toBeVisible();
    await expect(communications.getByRole("button", { name: "Notices" })).toHaveAttribute("aria-current", "page");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth + 1),
    );
  });
}
