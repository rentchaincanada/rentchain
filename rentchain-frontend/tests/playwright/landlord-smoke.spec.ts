import { test } from "@playwright/test";
import {
  roleSmokeViewports,
  runRoleRouteSmoke,
  storageStateForRole,
  type RoleSmokeRoute,
} from "./role-smoke-helpers";

const landlordRoutes: RoleSmokeRoute[] = [
  { label: "landlord dashboard", path: "/dashboard", shellText: [/dashboard/i, /portfolio/i] },
  { label: "landlord decision inbox", path: "/decision-inbox", shellText: [/decision/i, /inbox/i] },
  { label: "landlord operations", path: "/operations", shellText: [/operations/i, /command/i] },
  { label: "landlord leases", path: "/leases", shellText: [/leases/i, /active/i] },
  { label: "landlord messages", path: "/messages", shellText: [/messages/i, /inbox/i] },
];

test.describe("landlord role smoke", () => {
  const storageState = storageStateForRole("landlord");
  if (storageState) {
    test.use({ storageState });
  }

  for (const viewport of roleSmokeViewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport: viewport.size });

      for (const route of landlordRoutes) {
        test(`${route.label} renders safely`, async ({ page }, testInfo) => {
          await runRoleRouteSmoke(page, testInfo, route, viewport.name);
        });
      }
    });
  }
});
