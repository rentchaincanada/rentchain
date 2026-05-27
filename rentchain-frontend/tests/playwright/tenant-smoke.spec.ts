import { test } from "@playwright/test";
import {
  roleSmokeViewports,
  runRoleRouteSmoke,
  storageStateDetailsForRole,
  type RoleSmokeRoute,
} from "./role-smoke-helpers";

const tenantRoutes: RoleSmokeRoute[] = [
  { label: "tenant workspace", path: "/tenant", shellText: [/tenant/i, /rentchain tenant/i] },
  { label: "tenant lease", path: "/tenant/lease", shellText: [/lease/i, /tenant/i] },
  { label: "tenant ledger", path: "/tenant/ledger", shellText: [/ledger/i, /tenant/i] },
  { label: "tenant documents", path: "/tenant/documents", shellText: [/documents/i, /schedule/i] },
  { label: "tenant messages", path: "/tenant/messages", shellText: [/messages/i, /tenant/i] },
  { label: "tenant profile", path: "/tenant/profile", shellText: [/profile/i, /tenant/i] },
  { label: "tenant maintenance", path: "/tenant/maintenance", shellText: [/maintenance/i, /tenant/i] },
];

test.describe("tenant role smoke", () => {
  const authDetails = storageStateDetailsForRole("tenant");
  if (authDetails.storageState) {
    test.use({ storageState: authDetails.storageState });
  }

  for (const viewport of roleSmokeViewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport: viewport.size });

      for (const route of tenantRoutes) {
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
