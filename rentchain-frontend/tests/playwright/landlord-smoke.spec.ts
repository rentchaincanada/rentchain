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

const authDetails = requireStorageStateDetailsForRole("landlord");
let authContext: RoleAuthContext;

test.describe("landlord authenticated smoke coverage", () => {
  test.use({ storageState: authDetails.storageState });

  test.beforeAll(() => {
    authContext = roleAuthContext("landlord", authDetails);
  });

  test.beforeEach(async ({ page }) => {
    await installRoleSmokeHarness(page, authContext);
  });

  test.describe("dashboard access and verification", () => {
    test("loads the landlord dashboard with authenticated storage state", async ({ page }, testInfo) => {
      await navigateToRoleDashboard(page, "landlord");
      await expect(page.locator("body")).toContainText(/dashboard|portfolio/i);
      await takeScreenshot(page, testInfo, "landlord-dashboard");
    });

    test("hydrates landlord role from the current-user endpoint", async ({ page }) => {
      await navigateToRoleDashboard(page, "landlord");
      const currentUser = await assertRoleCanAccess(page, "/api/me", "landlord");
      expect(currentUser).toMatchObject({
        user: {
          role: "landlord",
          actorRole: "landlord",
          landlordId: "smoke-landlord-a",
        },
      });
    });

    test("uses landlord-scoped authenticated storage context", async () => {
      expect(authContext.role).toBe("landlord");
      expect(authContext.landlordId).toBe("smoke-landlord-a");
      expect(authContext.fixtureVersion).toBe("authenticated-smoke-v1");
    });
  });

  test.describe("property and unit visibility", () => {
    test("loads the landlord properties surface", async ({ page }) => {
      await navigateToRoleDashboard(page, "landlord");
      await assertRoleCanAccess(page, "/properties", "landlord");
      await expect(page.locator("body")).toContainText(/properties|portfolio/i);
    });

    test("sees only owned properties", async ({ page }) => {
      await navigateToRoleDashboard(page, "landlord");
      const response = await assertRoleCanAccess(page, "/api/landlord/properties", "landlord");
      const text = JSON.stringify(response);
      expect(text).toContain("Smoke Property A");
      expect(text).not.toContain("Smoke Property B");
    });

    test("can view units within an owned property", async ({ page }) => {
      await navigateToRoleDashboard(page, "landlord");
      const response = await assertRoleCanAccess(page, "/api/landlord/properties/smoke-property-a", "landlord");
      expect(response).toMatchObject({
        property: {
          name: "Smoke Property A",
          unitCount: 1,
        },
      });
      expect(JSON.stringify(response)).toContain("Suite 101");
    });

    test("cannot view another landlord property", async ({ page }) => {
      await navigateToRoleDashboard(page, "landlord");
      await assertRoleCannotAccess(page, "/api/landlord/properties/smoke-property-b", "landlord");
    });
  });

  test.describe("tenant visibility and lease isolation", () => {
    test("can see tenants assigned to owned units", async ({ page }) => {
      await navigateToRoleDashboard(page, "landlord");
      const response = await assertRoleCanAccess(page, "/api/landlord/tenants", "landlord");
      const text = JSON.stringify(response);
      expect(text).toContain("Tenant Smoke A");
      expect(text).not.toContain("Tenant Smoke B");
    });

    test("loads the landlord tenant management surface", async ({ page }) => {
      await navigateToRoleDashboard(page, "landlord");
      await assertRoleCanAccess(page, "/tenants", "landlord");
      await expect(page.locator("body")).toContainText(/tenant/i);
    });

    test("does not receive tenant-only lease data", async ({ page }) => {
      await navigateToRoleDashboard(page, "landlord");
      await assertRoleCannotAccess(page, "/api/tenant/lease", "landlord");
    });
  });

  test.describe("maintenance handling and role boundaries", () => {
    test("can view maintenance requests for owned units", async ({ page }) => {
      await navigateToRoleDashboard(page, "landlord");
      const response = await assertRoleCanAccess(page, "/api/landlord/maintenance-requests", "landlord");
      const text = JSON.stringify(response);
      expect(text).toContain("Smoke Property A");
      expect(text).not.toContain("Smoke Property B");
    });

    test("loads the landlord work orders surface without mutating records", async ({ page }) => {
      await navigateToRoleDashboard(page, "landlord");
      await assertRoleCanAccess(page, "/work-orders", "landlord");
      await expect(page.locator("body")).toContainText(/work orders|maintenance/i);
    });

    test("cannot access admin routes or admin-only APIs", async ({ page }) => {
      await navigateToRoleDashboard(page, "landlord");
      await assertRoleCannotAccess(page, "/api/admin/properties", "landlord");
      await assertRoleCannotAccess(page, "/admin", "landlord");
    });

    test("cannot access isolated tenant surfaces", async ({ page }) => {
      await navigateToRoleDashboard(page, "landlord");
      await assertRoleCannotAccess(page, "/api/tenant/maintenance-requests", "landlord");
    });
  });
});
