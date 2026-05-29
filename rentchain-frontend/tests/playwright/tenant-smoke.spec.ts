import { expect, test } from "@playwright/test";
import {
  assertRoleCanAccess,
  assertRoleCannotAccess,
  installRoleSmokeHarness,
  navigateToRoleDashboard,
  requireStorageStateDetailsForRole,
  roleAuthContext,
  takeScreenshot,
  type RoleAuthContext,
} from "./role-smoke-helpers";

const authDetails = requireStorageStateDetailsForRole("tenant");
let authContext: RoleAuthContext;

test.describe("tenant authenticated smoke coverage", () => {
  test.use({ storageState: authDetails.storageState });

  test.beforeAll(() => {
    authContext = roleAuthContext("tenant", authDetails);
  });

  test.beforeEach(async ({ page }) => {
    await installRoleSmokeHarness(page, authContext);
  });

  test.describe("dashboard access and verification", () => {
    test("loads the tenant dashboard with authenticated storage state", async ({ page }, testInfo) => {
      await navigateToRoleDashboard(page, "tenant");
      await expect(page.locator("body")).toContainText(/tenant dashboard|tenant/i);
      await takeScreenshot(page, testInfo, "tenant-dashboard");
    });

    test("hydrates tenant role from the current-user endpoint", async ({ page }) => {
      await navigateToRoleDashboard(page, "tenant");
      const currentUser = await assertRoleCanAccess(page, "/api/me", "tenant");
      expect(currentUser).toMatchObject({
        user: {
          role: "tenant",
          actorRole: "tenant",
          tenantId: "smoke-tenant-a",
        },
      });
    });

    test("uses tenant-scoped authenticated storage context", async () => {
      expect(authContext.role).toBe("tenant");
      expect(authContext.tenantId).toBe("smoke-tenant-a");
      expect(authContext.fixtureVersion).toBe("authenticated-smoke-v1");
    });
  });

  test.describe("lease visibility and isolation", () => {
    test("loads the tenant lease surface", async ({ page }) => {
      await navigateToRoleDashboard(page, "tenant");
      await assertRoleCanAccess(page, "/tenant/lease", "tenant");
      await expect(page.locator("body")).toContainText(/lease|tenant/i);
    });

    test("can view only the authenticated tenant lease", async ({ page }) => {
      await navigateToRoleDashboard(page, "tenant");
      const response = await assertRoleCanAccess(page, "/api/tenant/lease", "tenant");
      const text = JSON.stringify(response);
      expect(text).toContain("Smoke Property A");
      expect(text).toContain("Suite 101");
      expect(text).not.toContain("Smoke Property B");
      expect(text).not.toContain("Suite 202");
    });

    test("cannot view another tenant lease", async ({ page }) => {
      await navigateToRoleDashboard(page, "tenant");
      await assertRoleCannotAccess(page, "/api/tenant/leases/smoke-lease-b", "tenant");
    });

    test("sees only property data tied to the authenticated lease", async ({ page }) => {
      await navigateToRoleDashboard(page, "tenant");
      const response = await assertRoleCanAccess(page, "/api/tenant/workspace", "tenant");
      const text = JSON.stringify(response);
      expect(text).toContain("Smoke Property A");
      expect(text).not.toContain("Smoke Property B");
    });
  });

  test.describe("maintenance filing and tracking", () => {
    test("loads the tenant maintenance list", async ({ page }) => {
      await navigateToRoleDashboard(page, "tenant");
      await assertRoleCanAccess(page, "/tenant/maintenance", "tenant");
      await expect(page.locator("body")).toContainText(/maintenance|tenant portal/i);
    });

    test("can open the maintenance creation path without submitting", async ({ page }) => {
      await navigateToRoleDashboard(page, "tenant");
      await assertRoleCanAccess(page, "/tenant/maintenance/new", "tenant");
      await expect(page.locator("body")).toContainText(/maintenance|request|tenant portal/i);
    });

    test("can view only maintenance requests filed by the authenticated tenant", async ({ page }) => {
      await navigateToRoleDashboard(page, "tenant");
      const response = await assertRoleCanAccess(page, "/api/tenant/maintenance-requests", "tenant");
      const text = JSON.stringify(response);
      expect(text).toContain("Smoke Property A");
      expect(text).not.toContain("Smoke Property B");
    });

    test("cannot view another tenant maintenance request", async ({ page }) => {
      await navigateToRoleDashboard(page, "tenant");
      await assertRoleCannotAccess(page, "/api/tenant/maintenance-requests/smoke-maintenance-b", "tenant");
    });
  });

  test.describe("communications and role boundaries", () => {
    test("loads tenant communications relevant to the lease", async ({ page }) => {
      await navigateToRoleDashboard(page, "tenant");
      await assertRoleCanAccess(page, "/tenant/messages", "tenant");
      await expect(page.locator("body")).toContainText(/messages|communications|tenant/i);
    });

    test("cannot access landlord property management", async ({ page }) => {
      await navigateToRoleDashboard(page, "tenant");
      await assertRoleCannotAccess(page, "/api/landlord/properties", "tenant");
      await assertRoleCannotAccess(page, "/api/properties", "tenant");
    });

    test("cannot access admin surfaces", async ({ page }) => {
      await navigateToRoleDashboard(page, "tenant");
      await assertRoleCannotAccess(page, "/api/admin/properties", "tenant");
      await assertRoleCannotAccess(page, "/admin", "tenant");
    });
  });
});
