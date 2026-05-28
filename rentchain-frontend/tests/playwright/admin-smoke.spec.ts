import { test } from "@playwright/test";
import {
  roleSmokeViewports,
  runRoleRouteSmoke,
  storageStateDetailsForRole,
  type RoleSmokeRoute,
} from "./role-smoke-helpers";

const adminRoutes: RoleSmokeRoute[] = [
  { label: "admin dashboard", path: "/admin", shellText: [/admin/i, /workspace/i] },
  { label: "admin properties", path: "/admin/properties", shellText: [/properties/i, /workspace/i] },
  { label: "admin tenants", path: "/admin/tenants", shellText: [/tenants/i, /workspace/i] },
  { label: "admin leases", path: "/admin/leases", shellText: [/leases/i, /workspace/i] },
  {
    label: "admin review workspaces",
    path: "/admin/review-workspaces",
    shellText: [/review workspaces/i, /workspace/i],
    expectedApiResponse: {
      urlPattern: /\/api\/admin\/review-workspaces(?:\?|$)/,
      header: "x-route-source",
      value: "governedReviewWorkspaceRoutes.ts",
    },
  },
  { label: "admin support escalations", path: "/admin/support/escalations", shellText: [/support/i, /escalation/i] },
  { label: "admin security incidents", path: "/admin/security/incidents", shellText: [/security/i, /incident/i] },
  { label: "support operations", path: "/support-operations", shellText: [/support/i, /operations/i] },
];

test.describe("admin role smoke", () => {
  const authDetails = storageStateDetailsForRole("admin");
  if (authDetails.storageState) {
    test.use({ storageState: authDetails.storageState });
  }

  for (const viewport of roleSmokeViewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport: viewport.size });

      for (const route of adminRoutes) {
        test(`${route.label} renders safely`, async ({ page }, testInfo) => {
          await runRoleRouteSmoke(page, testInfo, route, viewport.name, {
            authDetails,
            requireShellText: authDetails.mode === "authenticated",
          });
        });
      }
    });
  }
});
