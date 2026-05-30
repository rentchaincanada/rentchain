import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { reportSmokeFindings } from "./smoke-findings";
import {
  installRoleSmokeHarness,
  requireStorageStateDetailsForRole,
  roleAuthContext,
  type RoleSmokeRole,
} from "./role-smoke-helpers";

type MatrixRole = RoleSmokeRole;

type MatrixRoute = {
  label: string;
  path: string;
  role: MatrixRole;
  shellText?: RegExp[];
};

const matrixViewports = [
  { name: "iphone", size: { width: 390, height: 844 } },
  { name: "android", size: { width: 412, height: 915 } },
  { name: "narrow", size: { width: 360, height: 780 } },
];

const matrixRoutes: MatrixRoute[] = [
  { role: "tenant", label: "tenant workspace", path: "/tenant", shellText: [/tenant/i, /rentchain tenant/i] },
  { role: "tenant", label: "tenant lease", path: "/tenant/lease", shellText: [/lease/i, /tenant/i] },
  { role: "tenant", label: "tenant ledger", path: "/tenant/ledger", shellText: [/ledger/i, /tenant/i] },
  { role: "tenant", label: "tenant documents", path: "/tenant/documents", shellText: [/tenant portal/i, /tenant experience/i] },
  { role: "tenant", label: "tenant messages", path: "/tenant/messages", shellText: [/messages/i, /tenant/i] },
  { role: "tenant", label: "tenant profile", path: "/tenant/profile", shellText: [/profile/i, /tenant/i] },
  { role: "tenant", label: "tenant maintenance", path: "/tenant/maintenance", shellText: [/maintenance/i, /tenant/i] },

  { role: "landlord", label: "landlord dashboard", path: "/dashboard", shellText: [/dashboard/i, /portfolio/i] },
  { role: "landlord", label: "landlord properties", path: "/properties", shellText: [/properties/i, /portfolio/i] },
  { role: "landlord", label: "landlord applications", path: "/applications", shellText: [/applications/i, /screening/i] },
  { role: "landlord", label: "landlord decision inbox", path: "/decision-inbox", shellText: [/decision/i, /inbox/i] },
  { role: "landlord", label: "landlord operations", path: "/operations", shellText: [/operations/i, /command/i] },
  { role: "landlord", label: "landlord leases", path: "/leases", shellText: [/leases/i, /active/i] },
  { role: "landlord", label: "landlord payments", path: "/payments", shellText: [/payments/i, /rent/i] },
  { role: "landlord", label: "landlord work orders", path: "/work-orders", shellText: [/work orders/i, /maintenance/i] },
  { role: "landlord", label: "landlord messages", path: "/messages", shellText: [/messages/i, /inbox/i] },

  { role: "admin", label: "admin dashboard", path: "/admin", shellText: [/admin/i, /workspace/i] },
  { role: "admin", label: "admin properties", path: "/admin/properties", shellText: [/properties/i, /workspace/i] },
  { role: "admin", label: "admin tenants", path: "/admin/tenants", shellText: [/tenants/i, /workspace/i] },
  { role: "admin", label: "admin leases", path: "/admin/leases", shellText: [/leases/i, /workspace/i] },
  { role: "admin", label: "admin review workspaces", path: "/admin/review-workspaces", shellText: [/review workspaces/i, /workspace/i] },
  { role: "admin", label: "admin support escalations", path: "/admin/support/escalations", shellText: [/support/i, /escalation/i] },
  { role: "admin", label: "admin security incidents", path: "/admin/security/incidents", shellText: [/security/i, /incident/i] },
  { role: "admin", label: "support operations", path: "/support-operations", shellText: [/support/i, /operations/i] },
];

function selectedRole() {
  const role = String(process.env.QA_ROLE || "mobile").trim().toLowerCase();
  if (role === "landlord" || role === "tenant" || role === "admin") return role;
  return "mobile";
}

function routeSlug(route: MatrixRoute) {
  return `${route.role}-${route.label}`.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

async function visibleShellText(page: Page, route: MatrixRoute) {
  if (!route.shellText?.length) return false;
  const matches = await Promise.all(
    route.shellText.map(async (pattern) => {
      try {
        await expect(page.getByText(pattern).first()).toBeVisible({ timeout: 1_500 });
        return true;
      } catch {
        return false;
      }
    }),
  );
  return matches.some(Boolean);
}

async function collectMobileLayoutMetrics(page: Page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    const horizontalOverflow = Math.max(0, document.documentElement.scrollWidth - viewportWidth);
    const visibleElements = Array.from(document.body.querySelectorAll<HTMLElement>("*")).filter((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0 &&
        element.getAttribute("aria-hidden") !== "true"
      );
    });

    const describe = (element: HTMLElement) => {
      const rect = element.getBoundingClientRect();
      const labelSource = element.getAttribute("aria-label") || element.getAttribute("title") || element.dataset.testid;
      const label = labelSource ? labelSource.replace(/\s+/g, " ").trim().slice(0, 60) : element.tagName.toLowerCase();
      return {
        tag: element.tagName.toLowerCase(),
        label,
        width: Math.round(rect.width),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      };
    };

    const hasHorizontalScrollContainer = (element: HTMLElement) => {
      let current: HTMLElement | null = element.parentElement;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        if (current.scrollWidth > current.clientWidth + 2 && ["auto", "scroll"].includes(style.overflowX)) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    };

    const oversizedElements = visibleElements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return (
          rect.width > viewportWidth + 2 &&
          style.position !== "fixed" &&
          !["HTML", "BODY", "SVG", "CANVAS"].includes(element.tagName)
        );
      })
      .slice(0, 8)
      .map(describe);

    const fixedOverflowElements = visibleElements
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return style.position === "fixed" && (rect.left < -2 || rect.right > viewportWidth + 2 || rect.bottom > viewportHeight + 2);
      })
      .slice(0, 8)
      .map(describe);

    const clippedInteractiveElements = visibleElements
      .filter((element) => element.matches("button, a, input, select, textarea, [role='button'], [tabindex]:not([tabindex='-1'])"))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return !hasHorizontalScrollContainer(element) && (rect.left < -2 || rect.right > viewportWidth + 2);
      })
      .slice(0, 8)
      .map(describe);

    return {
      viewportWidth,
      viewportHeight,
      horizontalOverflow,
      oversizedElements,
      fixedOverflowElements,
      clippedInteractiveElements,
    };
  });
}

async function installMobileLayoutMatrixOverrides(page: Page) {
  await page.route("**/api/applications**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/applications") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/viewings**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/viewings") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/admin/review-workspaces**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/admin/review-workspaces") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          workspaces: [],
          summary: {
            total: 0,
            byType: {},
            byStatus: {},
            byAssignment: {},
            appendOnly: true,
            metadataOnly: true,
            emptyState: "No governed review workspaces available.",
          },
          schema: {
            metadataOnly: true,
            visibilityClass: "admin_support_internal",
            tenantVisible: false,
            landlordVisible: false,
            appendOnly: true,
            persistence: "read_only_if_present",
            mutationControlsEnabled: false,
            rawPayloadAccessEnabled: false,
            createRouteEnabled: false,
            updateRouteEnabled: false,
            deleteRouteEnabled: false,
          },
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/admin/support/escalations**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/admin/support/escalations") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          escalations: [],
          summary: {
            total: 0,
            highOrCritical: 0,
            awaitingApproval: 0,
            notes: 0,
            metadataOnly: true,
            emptyState: "No support escalations available.",
          },
          schema: {
            metadataOnly: true,
            visibilityClass: "admin_support_internal",
            tenantVisible: false,
            landlordVisible: false,
            persistence: "read_only_if_present",
            mutationControlsEnabled: false,
          },
        }),
      });
      return;
    }

    await route.fallback();
  });

  await page.route("**/api/admin/security/incidents**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/admin/security/incidents") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          incidents: [],
          summary: {
            total: 0,
            open: 0,
            reviewing: 0,
            highOrCritical: 0,
            metadataOnly: true,
          },
        }),
      });
      return;
    }

    await route.fallback();
  });
}

async function runMobileLayoutMatrix(page: Page, testInfo: TestInfo, route: MatrixRoute, viewportName: string) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const authDetails = requireStorageStateDetailsForRole(route.role);
  const authContext = roleAuthContext(route.role, authDetails);

  testInfo.annotations.push({
    type: "smoke-mode",
    description: "mobile layout matrix smoke",
  });
  testInfo.annotations.push({
    type: "matrix-role",
    description: route.role,
  });
  testInfo.annotations.push({
    type: "auth-mode",
    description: `authenticated ${route.role} via ${authDetails.source || "storage state"}`,
  });

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await installRoleSmokeHarness(page, authContext);
  await installMobileLayoutMatrixOverrides(page);

  const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
  if (response) {
    expect(response.status(), `${route.label} response status`).toBeLessThan(500);
  }

  await expect(page.locator("body"), `${route.label} body`).toBeVisible();
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);

  const shellVisible = await visibleShellText(page, route);
  testInfo.annotations.push({
    type: "matrix-shell",
    description: shellVisible ? "matched role-appropriate shell text" : "shell text not visible; route may be unauthenticated or access-gated",
  });
  expect(shellVisible, `${route.label} authenticated shell text; storage state may be expired, wrong role, or route regressed`).toBe(true);

  const metrics = await collectMobileLayoutMetrics(page);
  await testInfo.attach("mobile-layout-metrics", {
    contentType: "application/json",
    body: Buffer.from(JSON.stringify({ route: route.label, viewport: viewportName, ...metrics }, null, 2)),
  });

  expect(metrics.horizontalOverflow, `${route.label} horizontal overflow`).toBeLessThanOrEqual(2);
  expect(metrics.oversizedElements, `${route.label} elements exceeding viewport width`).toEqual([]);
  expect(metrics.fixedOverflowElements, `${route.label} fixed/sticky navigation overflow`).toEqual([]);
  expect(metrics.clippedInteractiveElements, `${route.label} clipped interactive controls`).toEqual([]);

  await page.screenshot({
    path: testInfo.outputPath(`${viewportName}-${routeSlug(route)}.png`),
    fullPage: true,
  });

  await reportSmokeFindings(testInfo, route.label, consoleErrors, pageErrors, {
    role: route.role,
    routeOrFeature: route.path,
  });
}

const role = selectedRole();
const routes = role === "mobile" ? matrixRoutes : matrixRoutes.filter((route) => route.role === role);

for (const viewport of matrixViewports) {
  test.describe(`mobile layout matrix: ${viewport.name}`, () => {
    test.use({ viewport: viewport.size });

    for (const route of routes) {
      test(`${route.role}: ${route.label} has contained mobile layout`, async ({ page }, testInfo) => {
        await runMobileLayoutMatrix(page, testInfo, route, viewport.name);
      });
    }
  });
}
