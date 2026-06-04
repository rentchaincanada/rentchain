import { describe, expect, it } from "vitest";

import {
  createExportPackageEntity,
  createExportProfileEntity,
  createExportRequestEntity,
} from "../services/export-service";
import {
  projectExportPackageForAdmin,
  projectExportPackageForLandlord,
  projectExportProfileForAdmin,
  projectExportProfileForLandlord,
  projectExportRequestForAdmin,
  projectExportRequestForLandlord,
} from "../types/export-projections";
import type { ExportAuthorizationContext } from "../types/export-authorization-types";

const landlordRef = "landlord:aaaaaaaaaaaaaaaaaaaa";
const actorRef = "actor:bbbbbbbbbbbbbbbbbbbb";
const unitRef = "unit:cccccccccccccccccccc";

function context(): ExportAuthorizationContext {
  return {
    requestingActorId: actorRef,
    requestingActorRole: "LandlordAdmin",
    requestingActorScope: landlordRef,
    requestingPurpose: "InsuranceClaim",
    timestamp: "2026-06-04T12:00:00.000Z",
    rawIdsIncluded: false,
  };
}

function entities() {
  const profile = createExportProfileEntity(
    {
      landlordId: landlordRef,
      recipientType: "InsuranceAdjuster",
      recipientName: "Acme Insurance Adjusters LLC",
      recipientReference: "acme-insurance-adjusters",
      purpose: "InsuranceClaim",
      description: "Insurance claim review.",
      approvedEvidenceClasses: ["PaymentEvidence", "MaintenanceEvidence"],
      excludedUnitIds: [unitRef],
      dataMinimizationLevel: "Redacted",
      createdReason: "Insurance claim package review.",
    },
    context()
  );
  const request = createExportRequestEntity(
    {
      profile,
      requestedAt: "2026-06-04T12:05:00.000Z",
      requestedBy: actorRef,
      requestReason: "Claim settlement review.",
      scopeParameters: {
        dateRangeStart: "2026-01-01T00:00:00.000Z",
        dateRangeEnd: "2026-06-01T00:00:00.000Z",
        evidenceClassFilters: ["PaymentEvidence"],
        unitScopeOverride: [unitRef],
      },
    },
    context()
  );
  const pkg = createExportPackageEntity({
    request,
    recipientType: profile.recipientType,
    purpose: profile.purpose,
    assembledAt: "2026-06-04T12:10:00.000Z",
    assembledBy: "service:dddddddddddddddddddd",
    evidenceClasses: ["PaymentEvidence"],
    unitsScopeApplied: [unitRef],
    redactionPolicyApplied: "Redacted",
    includedEvidenceCount: 1,
  });
  return { profile, request, pkg };
}

function serialized(value: unknown): string {
  return JSON.stringify(value);
}

describe("export projection rules", () => {
  it("projects landlord-safe and admin-safe profile views", () => {
    const { profile } = entities();
    const landlord = projectExportProfileForLandlord(profile, landlordRef);
    const admin = projectExportProfileForAdmin(profile);

    expect(landlord).not.toHaveProperty("createdBy");
    expect(landlord).not.toHaveProperty("auditTrailReference");
    expect(admin).toHaveProperty("auditTrailReference");
    expect(serialized(landlord)).not.toMatch(/raw-|secret|token|credential|provider payload/i);
  });

  it("projects landlord-safe and admin-safe request views", () => {
    const { request } = entities();
    const landlord = projectExportRequestForLandlord(request, landlordRef);
    const admin = projectExportRequestForAdmin(request);

    expect(landlord.authorizationStatus).not.toHaveProperty("authorizedBy");
    expect(landlord).not.toHaveProperty("auditTrailReference");
    expect(admin).toHaveProperty("auditTrailReference");
    expect(serialized(landlord)).not.toMatch(/secret|token|credential|provider payload/i);
  });

  it("projects landlord-safe package views without checksum values or internal audit references", () => {
    const { pkg } = entities();
    const landlord = projectExportPackageForLandlord(pkg, landlordRef);
    const admin = projectExportPackageForAdmin(pkg);

    expect(landlord.packageMetadata).not.toHaveProperty("checksumValue");
    expect(landlord).not.toHaveProperty("auditTrailReference");
    expect(admin).toHaveProperty("auditTrailReference");
    expect(serialized(landlord)).not.toMatch(/secret|token|credential|provider payload/i);
  });

  it("rejects cross-landlord projection attempts", () => {
    const { profile, request, pkg } = entities();

    expect(() => projectExportProfileForLandlord(profile, "landlord:ffffffffffffffffffff")).toThrow("export_projection_landlord_scope_mismatch");
    expect(() => projectExportRequestForLandlord(request, "landlord:ffffffffffffffffffff")).toThrow("export_projection_landlord_scope_mismatch");
    expect(() => projectExportPackageForLandlord(pkg, "landlord:ffffffffffffffffffff")).toThrow("export_projection_landlord_scope_mismatch");
  });

  it("keeps projections deterministic", () => {
    const { profile } = entities();

    expect(projectExportProfileForLandlord(profile, landlordRef)).toEqual(projectExportProfileForLandlord(profile, landlordRef));
  });
});
