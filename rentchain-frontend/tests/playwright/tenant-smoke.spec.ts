import { test } from "@playwright/test";
import {
  roleSmokeViewports,
  runRoleRouteSmoke,
  storageStateForRole,
  type RoleSmokeRoute,
} from "./role-smoke-helpers";

const tenantRoutes: RoleSmokeRoute[] = [
  { label: "tenant workspace", path: "/tenant", shellText: [/tenant/i, /rentchain tenant/i] },
  { label: "tenant lease", path: "/tenant/lease", shellText: [/lease/i, /tenant/i] },
  { label: "tenant documents", path: "/tenant/documents", shellText: [/documents/i, /schedule/i] },
  { label: "tenant messages", path: "/tenant/messages", shellText: [/messages/i, /tenant/i] },
  { label: "tenant profile", path: "/tenant/profile", shellText: [/profile/i, /tenant/i] },
];

test.describe("tenant role smoke", () => {
  const storageState = storageStateForRole("tenant");
  if (storageState) {
    test.use({ storageState });
  }

  for (const viewport of roleSmokeViewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport: viewport.size });

      for (const route of tenantRoutes) {
        test(`${route.label} renders safely`, async ({ page }, testInfo) => {
          await runRoleRouteSmoke(page, testInfo, route, viewport.name);
        });
      }
    });
  }
});
