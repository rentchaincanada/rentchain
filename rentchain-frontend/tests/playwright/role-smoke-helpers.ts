import { expect, type Page, type TestInfo } from "@playwright/test";
import { reportSmokeFindings } from "./smoke-findings";

export type RoleSmokeRole = "admin" | "tenant" | "landlord";

export type RoleSmokeRoute = {
  label: string;
  path: string;
  shellText?: RegExp[];
};

export const roleSmokeViewports = [
  { name: "desktop", size: { width: 1280, height: 800 } },
  { name: "mobile", size: { width: 390, height: 844 } },
];

export function storageStateForRole(role: RoleSmokeRole) {
  const roleKey = `QA_${role.toUpperCase()}_STORAGE_STATE`;
  return process.env[roleKey] || process.env.QA_STORAGE_STATE || undefined;
}

export async function runRoleRouteSmoke(
  page: Page,
  testInfo: TestInfo,
  route: RoleSmokeRoute,
  viewportName: string,
) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
  if (response) {
    expect(response.status(), `${route.label} response status`).toBeLessThan(500);
  }

  await expect(page.locator("body"), `${route.label} body`).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return Math.max(0, doc.scrollWidth - doc.clientWidth);
  });
  expect(overflow, `${route.label} horizontal overflow`).toBeLessThanOrEqual(2);

  if (route.shellText?.length) {
    const foundShellText = await Promise.all(
      route.shellText.map(async (pattern) => {
        try {
          await expect(page.getByText(pattern).first()).toBeVisible({ timeout: 1_500 });
          return true;
        } catch {
          return false;
        }
      }),
    );
    testInfo.annotations.push({
      type: "role-shell",
      description: foundShellText.some(Boolean)
        ? "matched role-appropriate shell text"
        : "role shell text not visible; route may be unauthenticated or access-gated",
    });
  }

  await page.screenshot({
    path: testInfo.outputPath(`${viewportName}-${route.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`),
    fullPage: true,
  });

  await reportSmokeFindings(testInfo, route.label, consoleErrors, pageErrors);
}
