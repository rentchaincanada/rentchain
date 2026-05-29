import { describe, expect, it } from "vitest";
import { buildAdminStorageStateFixture } from "../fixtures/admin-storage-state";
import { expectErrorSafe, expectNoSensitiveMarkers } from "../utils/assertion-helpers";
import { getSmokeAuthHeaders } from "../utils/auth-helpers";
import { createSmokeApiClient } from "../utils/smoke-api-client";

describe("authenticated smoke projection boundaries", () => {
  const fixture = buildAdminStorageStateFixture();
  const client = createSmokeApiClient(fixture);

  it("denies unauthenticated and cross-role access without sensitive details", () => {
    const missing = client.request({ method: "GET", path: "/api/admin/properties" });
    const landlordAdmin = client.request({
      method: "GET",
      path: "/api/admin/properties",
      headers: getSmokeAuthHeaders("landlord"),
    });
    const tenantLandlord = client.request({
      method: "GET",
      path: "/api/landlord/properties",
      headers: getSmokeAuthHeaders("tenant"),
    });

    expect(missing.status).toBe(401);
    expect(landlordAdmin.status).toBe(403);
    expect(tenantLandlord.status).toBe(403);
    expectErrorSafe(missing.body);
    expectErrorSafe(landlordAdmin.body);
    expectErrorSafe(tenantLandlord.body);
  });

  it("limits landlord properties to owned records", () => {
    const list = client.request({
      method: "GET",
      path: "/api/landlord/properties",
      headers: getSmokeAuthHeaders("landlord"),
    });
    const directOtherProperty = client.request({
      method: "GET",
      path: "/api/landlord/properties/smoke-property-b",
      headers: getSmokeAuthHeaders("landlord"),
    });

    expect(list.status).toBe(200);
    expect(list.body.items).toEqual([
      expect.objectContaining({
        displayLabel: "Smoke Property A",
        unitCount: 1,
      }),
    ]);
    expect(JSON.stringify(list.body)).not.toContain("Smoke Property B");
    expectNoSensitiveMarkers(list.body);

    expect(directOtherProperty.status).toBe(403);
    expectErrorSafe(directOtherProperty.body);
  });

  it("limits tenant lease reads to the authenticated tenant", () => {
    const ownLease = client.request({
      method: "GET",
      path: "/api/tenant/lease",
      headers: getSmokeAuthHeaders("tenant"),
    });
    const otherLease = client.request({
      method: "GET",
      path: "/api/tenant/leases/smoke-lease-b",
      headers: getSmokeAuthHeaders("tenant"),
    });

    expect(ownLease.status).toBe(200);
    expect(ownLease.body.lease).toEqual(
      expect.objectContaining({
        status: "active",
        propertyLabel: "Smoke Property A",
        unitLabel: "Suite 101",
      })
    );
    expect(JSON.stringify(ownLease.body)).not.toContain("Smoke Property B");
    expectNoSensitiveMarkers(ownLease.body);

    expect(otherLease.status).toBe(403);
    expectErrorSafe(otherLease.body);
  });
});
