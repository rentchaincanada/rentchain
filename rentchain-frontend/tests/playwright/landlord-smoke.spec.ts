import { test } from "@playwright/test";
import {
  roleSmokeViewports,
  runRoleRouteSmoke,
  storageStateDetailsForRole,
  type RoleSmokeRoute,
} from "./role-smoke-helpers";

const landlordRoutes: RoleSmokeRoute[] = [
  { label: "landlord dashboard", path: "/dashboard", shellText: [/dashboard/i, /portfolio/i] },
  { label: "landlord properties", path: "/properties", shellText: [/properties/i, /portfolio/i] },
  { label: "landlord applications", path: "/applications", shellText: [/applications/i, /screening/i] },
  { label: "landlord decision inbox", path: "/decision-inbox", shellText: [/decision/i, /inbox/i] },
  { label: "landlord operations", path: "/operations", shellText: [/operations/i, /command/i] },
  { label: "landlord leases", path: "/leases", shellText: [/leases/i, /active/i] },
  { label: "landlord payments", path: "/payments", shellText: [/payments/i, /rent/i] },
  { label: "landlord work orders", path: "/work-orders", shellText: [/work orders/i, /maintenance/i] },
  { label: "landlord messages", path: "/messages", shellText: [/messages/i, /inbox/i] },
];

test.describe("landlord role smoke", () => {
  const authDetails = storageStateDetailsForRole("landlord");
  if (authDetails.storageState) {
    test.use({ storageState: authDetails.storageState });
  }

  for (const viewport of roleSmokeViewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport: viewport.size });

      for (const route of landlordRoutes) {
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
