import { expect, test } from "@playwright/test";
import { reportSmokeFindings } from "./smoke-findings";

type SmokeRoute = {
  label: string;
  path: string;
  roles: Array<"mobile" | "landlord" | "tenant" | "admin">;
};

const viewports = [
  { name: "iphone", size: { width: 390, height: 844 } },
  { name: "android", size: { width: 412, height: 915 } },
];

const routes: SmokeRoute[] = [
  { label: "landlord dashboard", path: "/dashboard", roles: ["mobile", "landlord"] },
  { label: "landlord decision inbox", path: "/decision-inbox", roles: ["mobile", "landlord"] },
  { label: "landlord operations", path: "/operations", roles: ["mobile", "landlord"] },
  { label: "tenant workspace", path: "/tenant", roles: ["mobile", "tenant"] },
  { label: "tenant documents", path: "/tenant/documents", roles: ["mobile", "tenant"] },
  { label: "admin dashboard", path: "/admin", roles: ["mobile", "admin"] },
  { label: "admin review workspaces", path: "/admin/review-workspaces", roles: ["mobile", "admin"] },
];

function selectedRole() {
  const role = String(process.env.QA_ROLE || "mobile").trim().toLowerCase();
  if (role === "landlord" || role === "tenant" || role === "admin") return role;
  return "mobile";
}

for (const viewport of viewports) {
  test.describe(`mobile preview smoke: ${viewport.name}`, () => {
    test.use({ viewport: viewport.size });

    for (const route of routes.filter((candidate) => candidate.roles.includes(selectedRole()))) {
      test(`${route.label} renders without mobile overflow`, async ({ page }, testInfo) => {
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

        await expect(page.locator("body")).toBeVisible();
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return Math.max(0, doc.scrollWidth - doc.clientWidth);
        });
        expect(overflow, `${route.label} horizontal overflow`).toBeLessThanOrEqual(2);

        await page.screenshot({
          path: testInfo.outputPath(`${viewport.name}-${route.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`),
          fullPage: true,
        });

        await reportSmokeFindings(testInfo, route.label, consoleErrors, pageErrors);
      });
    }
  });
}
