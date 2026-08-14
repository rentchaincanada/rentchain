import { describe, expect, it } from "vitest";
import {
  PR1525_ATTACHMENTS_BRANCH,
  resolvePr1525TenantMaintenanceUrl,
} from "./pr1525TenantMaintenanceRouting";

describe("PR #1525 real tenant maintenance routing", () => {
  const production = "https://rentchain-landlord-api-cyaabkl54a-uc.a.run.app";

  it.each([
    ["/tenant/maintenance-requests", "/api/pr1525-attachments/tenant/api/tenant/maintenance-requests"],
    ["/tenant/maintenance-requests/maintenance%3A69ffa10a77d4", "/api/pr1525-attachments/tenant/api/tenant/maintenance-requests/maintenance%3A69ffa10a77d4"],
    ["/tenant/maintenance-requests/maintenance%3A69ffa10a77d4/attachments", "/api/pr1525-attachments/tenant/api/tenant/maintenance-requests/maintenance%3A69ffa10a77d4/attachments"],
  ])("uses the same-origin proxy for %s", (path, expected) => {
    expect(resolvePr1525TenantMaintenanceUrl(path, production, PR1525_ATTACHMENTS_BRANCH)).toBe(expected);
  });

  it("preserves normal Production routing outside the PR branch", () => {
    expect(resolvePr1525TenantMaintenanceUrl("/tenant/maintenance-requests", production, "main"))
      .toBe(`${production}/api/tenant/maintenance-requests`);
  });

  it("does not reroute unrelated tenant APIs", () => {
    expect(resolvePr1525TenantMaintenanceUrl("/tenant/workspace", production, PR1525_ATTACHMENTS_BRANCH))
      .toBe(`${production}/api/tenant/workspace`);
  });
});
