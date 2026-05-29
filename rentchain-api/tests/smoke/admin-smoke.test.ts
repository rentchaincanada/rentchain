import { describe, expect, it } from "vitest";
import { buildAdminStorageStateFixture } from "../fixtures/admin-storage-state";
import { expectNoSensitiveMarkers, expectReadonlyAuditTrail } from "../utils/assertion-helpers";
import { getSmokeAuthHeaders } from "../utils/auth-helpers";
import { createSmokeApiClient } from "../utils/smoke-api-client";

describe("authenticated admin smoke", () => {
  const fixture = buildAdminStorageStateFixture();
  const client = createSmokeApiClient(fixture);
  const adminHeaders = getSmokeAuthHeaders("admin");

  it("validates admin session claims without exposing credentials", () => {
    const res = client.request({
      method: "GET",
      path: "/api/auth/me",
      headers: adminHeaders,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        user: expect.objectContaining({
          role: "admin",
          permissions: expect.arrayContaining(["system.admin"]),
        }),
      })
    );
    expectNoSensitiveMarkers(res.body);
  });

  it("fetches admin property and tenant projections", () => {
    const properties = client.request({
      method: "GET",
      path: "/api/admin/properties",
      headers: adminHeaders,
    });
    const tenants = client.request({
      method: "GET",
      path: "/api/admin/tenants",
      headers: adminHeaders,
    });

    expect(properties.status).toBe(200);
    expect(properties.body.items).toHaveLength(2);
    expect(properties.body.items[0]).toEqual(
      expect.objectContaining({
        displayLabel: expect.any(String),
        unitCount: expect.any(Number),
      })
    );

    expect(tenants.status).toBe(200);
    expect(tenants.body.items).toHaveLength(2);
    expect(tenants.body.items[0]).toEqual(
      expect.objectContaining({
        fullName: expect.any(String),
        email: expect.any(String),
        leaseStatus: "active",
      })
    );
    expectNoSensitiveMarkers({ properties: properties.body, tenants: tenants.body });
  });

  it("validates maintenance audit trail reads and append-safe review response", () => {
    const list = client.request({
      method: "GET",
      path: "/api/maintenanceRequests",
      headers: adminHeaders,
    });
    const review = client.request({
      method: "POST",
      path: "/api/maintenanceRequests/smoke-maintenance-a/review",
      headers: adminHeaders,
      body: { decision: "reviewed" },
    });
    const audit = client.request({
      method: "GET",
      path: "/api/audit/events",
      headers: adminHeaders,
    });

    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(2);
    expectReadonlyAuditTrail(list.body);

    expect(review.status).toBe(200);
    expect(review.body.auditTrail).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "admin_reviewed",
          actorRole: "admin",
          occurredAt: expect.any(String),
        }),
      ])
    );

    expect(audit.status).toBe(200);
    expectReadonlyAuditTrail(audit.body);
    expectNoSensitiveMarkers({ list: list.body, review: review.body, audit: audit.body });
  });
});
