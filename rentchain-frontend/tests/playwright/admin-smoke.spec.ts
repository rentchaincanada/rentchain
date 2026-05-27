import { test } from "@playwright/test";
import {
  roleSmokeViewports,
  runRoleRouteSmoke,
  storageStateForRole,
  type RoleSmokeRoute,
} from "./role-smoke-helpers";

const adminRoutes: RoleSmokeRoute[] = [
  { label: "admin dashboard", path: "/admin", shellText: [/admin/i, /workspace/i] },
  { label: "admin properties", path: "/admin/properties", shellText: [/properties/i, /workspace/i] },
  { label: "admin review workspaces", path: "/admin/review-workspaces", shellText: [/review workspaces/i, /workspace/i] },
  { label: "admin support escalations", path: "/admin/support/escalations", shellText: [/support/i, /escalation/i] },
  { label: "admin security incidents", path: "/admin/security/incidents", shellText: [/security/i, /incident/i] },
];

test.describe("admin role smoke", () => {
  const storageState = storageStateForRole("admin");
  if (storageState) {
    test.use({ storageState });
  }

  for (const viewport of roleSmokeViewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport: viewport.size });

      for (const route of adminRoutes) {
        test(`${route.label} renders safely`, async ({ page }, testInfo) => {
          await runRoleRouteSmoke(page, testInfo, route, viewport.name);
        });
      }
    });
  }
});
