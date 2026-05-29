import { expect, test } from "@playwright/test";
import {
  assertRoleCanAccess,
  getSmokeFixture,
  installRoleSmokeHarness,
  navigateToRoleDashboard,
  requireStorageStateDetailsForRole,
  roleAuthContext,
  takeScreenshot,
  type RoleAuthContext,
} from "./role-smoke-helpers";

const authDetails = requireStorageStateDetailsForRole("admin");
let authContext: RoleAuthContext;

test.describe("admin authenticated smoke coverage", () => {
  test.use({ storageState: authDetails.storageState });

  test.beforeAll(() => {
    authContext = roleAuthContext("admin", authDetails);
  });

  test.beforeEach(async ({ page }) => {
    await installRoleSmokeHarness(page, authContext);
  });

  test.describe("dashboard access and role verification", () => {
    test("loads the admin dashboard with authenticated storage state", async ({ page }, testInfo) => {
      await navigateToRoleDashboard(page, "admin");
      await expect(page.getByRole("heading", { name: /admin dashboard/i })).toBeVisible();
      await takeScreenshot(page, testInfo, "admin-dashboard");
    });

    test("hydrates the admin identity from the current-user endpoint", async ({ page }) => {
      await navigateToRoleDashboard(page, "admin");
      const currentUser = await assertRoleCanAccess(page, "/api/me", "admin");
      expect(currentUser).toMatchObject({
        user: {
          role: "admin",
          actorRole: "admin",
          permissions: ["system.admin"],
        },
      });
    });

    test("uses the authenticated smoke fixture version", async () => {
      expect(authContext.fixtureVersion).toBe("authenticated-smoke-v1");
      expect(authContext.role).toBe("admin");
      expect(authContext.userId).toBe("smoke-admin");
    });
  });

  test.describe("property management and data visibility", () => {
    test("loads the admin properties surface", async ({ page }) => {
      await navigateToRoleDashboard(page, "admin");
      await assertRoleCanAccess(page, "/admin/properties", "admin");
      await expect(page.getByRole("heading", { name: /^properties$/i })).toBeVisible();
    });

    test("can view all properties across landlords", async ({ page }) => {
      await navigateToRoleDashboard(page, "admin");
      const response = await assertRoleCanAccess(page, "/api/admin/properties", "admin");
      const items = Array.isArray(response?.items) ? response.items : [];
      expect(items).toHaveLength(getSmokeFixture().properties.length);
      expect(JSON.stringify(items)).toContain("Smoke Property A");
      expect(JSON.stringify(items)).toContain("Smoke Property B");
    });

    test("can view property metadata needed for admin review", async ({ page }) => {
      await navigateToRoleDashboard(page, "admin");
      const response = await assertRoleCanAccess(page, "/api/admin/properties", "admin");
      const first = Array.isArray(response?.items) ? response.items[0] : null;
      expect(first).toMatchObject({
        displayLabel: "Smoke Property A",
        city: "Halifax",
        unitCount: 1,
        integrity: {
          hasIssues: false,
        },
      });
    });

    test("retains platform-wide visibility instead of landlord-scoped filtering", async ({ page }) => {
      await navigateToRoleDashboard(page, "admin");
      const response = await assertRoleCanAccess(page, "/api/admin/properties", "admin");
      const labels = Array.isArray(response?.items)
        ? response.items.map((item) => String((item as { displayLabel?: string }).displayLabel || ""))
        : [];
      expect(labels).toEqual(expect.arrayContaining(["Smoke Property A", "Smoke Property B"]));
    });
  });

  test.describe("user and role management", () => {
    test("can access the admin tenants surface", async ({ page }) => {
      await navigateToRoleDashboard(page, "admin");
      await assertRoleCanAccess(page, "/admin/tenants", "admin");
      await expect(page.getByRole("heading", { name: /^tenants$/i })).toBeVisible();
    });

    test("can view users across all primary roles through tenant and owner records", async ({ page }) => {
      await navigateToRoleDashboard(page, "admin");
      const response = await assertRoleCanAccess(page, "/api/admin/tenants", "admin");
      const text = JSON.stringify(response);
      expect(text).toContain("Tenant Smoke A");
      expect(text).toContain("Tenant Smoke B");
    });

    test("can open the lease administration surface without submitting changes", async ({ page }) => {
      await navigateToRoleDashboard(page, "admin");
      await assertRoleCanAccess(page, "/admin/leases", "admin");
      await expect(page.getByRole("heading", { name: /^leases$/i })).toBeVisible();
    });
  });

  test.describe("audit and system surfaces", () => {
    test("can access audit data", async ({ page }) => {
      await navigateToRoleDashboard(page, "admin");
      const response = await assertRoleCanAccess(page, "/api/admin/audit", "admin");
      expect(response).toMatchObject({
        summary: {
          recentAdminActions: 1,
        },
      });
      expect(JSON.stringify(response)).toContain("view_properties");
    });

    test("can open audit and support system surfaces", async ({ page }) => {
      await navigateToRoleDashboard(page, "admin");
      await assertRoleCanAccess(page, "/admin/audit", "admin");
      await expect(page.getByRole("heading", { name: /audit/i })).toBeVisible();
      await assertRoleCanAccess(page, "/support-operations", "admin");
      await expect(page.locator("body")).toContainText(/support|operations/i);
    });

    test("is not downgraded to landlord or tenant data boundaries", async ({ page }) => {
      await navigateToRoleDashboard(page, "admin");
      const propertyResponse = await assertRoleCanAccess(page, "/api/admin/properties", "admin");
      const tenantResponse = await assertRoleCanAccess(page, "/api/admin/tenants", "admin");
      expect(Array.isArray(propertyResponse?.items) ? propertyResponse.items : []).toHaveLength(2);
      expect(Array.isArray(tenantResponse?.items) ? tenantResponse.items : []).toHaveLength(2);
    });
  });
});
