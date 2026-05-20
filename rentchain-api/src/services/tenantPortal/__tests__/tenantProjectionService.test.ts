import { describe, expect, it } from "vitest";

import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../../__tests__/helpers/projectionSafetyAssertions";
import { projectTenantLease } from "../tenantProjectionService";

describe("tenantProjectionService", () => {
  it("adds deterministic tenant-safe projection contract metadata to current lease projections", () => {
    const projected = projectTenantLease("lease-1", {
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      status: "active",
      startDate: "2026-06-01",
      endDate: "2027-05-31",
      monthlyRent: 1640,
      dueDay: 1,
      documentUrl: "https://example.test/tenant-safe-lease.pdf",
      tenantSignedAt: "2026-05-01T12:00:00.000Z",
    });

    expect(projected.projectionVersion).toBe("tenant_safe_projection_v1");
    expect(projected.sensitivityClass).toBe("sensitive");
    expect(projected.projectionProfile).toEqual(
      expect.objectContaining({
        projectionName: "tenant_safe_workspace_projection",
        projectionVersion: "tenant_safe_projection_v1",
        audience: "tenant_workspace",
        scopeType: "tenant_current_lease",
        sensitivityClass: "sensitive",
        authorityBasis: "authenticated_tenant_scope",
        relationshipBasis: "Projection must be derived from the authenticated tenant's current lease relationship.",
        internalReferencePolicy:
          "Internal IDs are scoped references for navigation/traceability, not primary display labels.",
      }),
    );
    expect(projected.projectionProfile.allowedFieldGroups).toEqual(
      expect.arrayContaining([
        "tenant_visible_lease_summary",
        "tenant_visible_document_status",
        "tenant_signature_status",
        "payment_readiness_summary",
        "scoped_source_references",
      ]),
    );
    expect(projected.projectionProfile.excludedFieldGroups).toEqual(
      expect.arrayContaining([
        "landlord_only_notes",
        "other_tenant_records",
        "raw_provider_payloads",
        "raw_screening_reports",
        "raw_csv_values",
        "payment_account_details",
        "debug_payloads",
        "private_message_bodies",
      ]),
    );
    expect(projected.sourceCollections).toEqual(["leases", "properties", "tenants", "units"]);
    expect(projected.sourceRefs).toEqual([
      { sourceCollection: "leases", sourceId: "lease-1" },
      { sourceCollection: "properties", sourceId: "prop-1" },
      { sourceCollection: "tenants", sourceId: "tenant-1" },
      { sourceCollection: "units", sourceId: "unit-1" },
    ]);
    expect(projected.redactionSummary).toEqual(
      expect.objectContaining({
        redactionPolicy:
          "Exclude landlord-only notes, raw/provider/payment/debug/private-message fields, and unrelated tenant data.",
        redactionCount: projected.projectionProfile.excludedFieldGroups.length,
      }),
    );
  });

  it("keeps tenant lease projections whitelist-based when source records contain restricted fields", () => {
    const projected = projectTenantLease("lease-sensitive", {
      tenantId: "tenant-1",
      tenantIds: ["tenant-1", "other-tenant-1"],
      propertyId: "prop-1",
      unitId: "unit-1",
      status: "active",
      startDate: "2026-06-01",
      endDate: "2027-05-31",
      monthlyRent: 1640,
      dueDay: 1,
      documentUrl: "https://example.test/tenant-safe-lease.pdf",
      landlordOnlyNotes: "private landlord note",
      internalNotes: "internal landlord note",
      rawPayload: { providerPayload: "raw provider report" },
      rawCsv: "raw tenant CSV data",
      bankAccountNumber: "111122223333",
      routingNumber: "000111222",
      routeSource: "tenantPortalRoutes.ts",
      stack: "private stack trace",
      debugPayload: "debug details",
      messageBody: "unrestricted private message body",
      otherTenantRecords: [{ tenantId: "other-tenant-1", email: "other@example.test" }],
      screening: { rawReport: "raw screening report" },
    });

    expect(projected.leaseId).toBe("lease-sensitive");
    expect(projected.status).toBe("active");
    expect(projected.documentUrl).toBe("https://example.test/tenant-safe-lease.pdf");
    expect(projected.sourceRefs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceCollection: "leases", sourceId: "lease-sensitive" }),
        expect.objectContaining({ sourceCollection: "tenants", sourceId: "tenant-1" }),
      ]),
    );
    expectNoRestrictedProjectionFields(projected);
    expectPayloadDoesNotContainValues(projected, [
      "private landlord note",
      "internal landlord note",
      "raw provider report",
      "raw tenant CSV data",
      "111122223333",
      "000111222",
      "tenantPortalRoutes.ts",
      "private stack trace",
      "debug details",
      "unrestricted private message body",
      "other-tenant-1",
      "other@example.test",
      "raw screening report",
    ]);
  });
});
