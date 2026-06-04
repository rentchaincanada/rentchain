import { describe, expect, it } from "vitest";

import {
  createExportPackageEntity,
  createExportProfileEntity,
  createExportRequestEntity,
  generateExportPackageId,
  generateExportProfileId,
  generateExportRequestId,
  validateExportPackage,
  validateExportProfile,
  validateExportRequest,
} from "../services/export-service";
import type { ExportAuthorizationContext } from "../types/export-authorization-types";
import type { ExportProfile } from "../types/export-profile-types";
import type { ExportRequest } from "../types/export-request-types";

const landlordRef = "landlord:aaaaaaaaaaaaaaaaaaaa";
const actorRef = "actor:bbbbbbbbbbbbbbbbbbbb";
const unitRef = "unit:cccccccccccccccccccc";
const timestamp = "2026-06-04T12:00:00.000Z";

function context(overrides: Partial<ExportAuthorizationContext> = {}): ExportAuthorizationContext {
  return {
    requestingActorId: actorRef,
    requestingActorRole: "LandlordAdmin",
    requestingActorScope: landlordRef,
    requestingPurpose: "InsuranceClaim",
    timestamp,
    rawIdsIncluded: false,
    ...overrides,
  };
}

function profile(): ExportProfile {
  return createExportProfileEntity(
    {
      landlordId: landlordRef,
      recipientType: "InsuranceAdjuster",
      recipientName: "Acme Insurance Adjusters LLC",
      recipientReference: "acme-insurance-adjusters",
      purpose: "InsuranceClaim",
      description: "Insurance claim review for property flooding.",
      approvedEvidenceClasses: ["ApplicationEvidence", "PaymentEvidence", "MaintenanceEvidence"],
      excludedUnitIds: [unitRef],
      dataMinimizationLevel: "Redacted",
      createdReason: "Insurance claim package review.",
    },
    context()
  );
}

function request(profileEntity = profile()): ExportRequest {
  return createExportRequestEntity(
    {
      profile: profileEntity,
      requestedAt: "2026-06-04T12:05:00.000Z",
      requestedBy: actorRef,
      requestReason: "Claim settlement review.",
      scopeParameters: {
        dateRangeStart: "2026-01-01T00:00:00.000Z",
        dateRangeEnd: "2026-06-01T00:00:00.000Z",
        evidenceClassFilters: ["PaymentEvidence", "MaintenanceEvidence"],
        unitScopeOverride: [unitRef],
      },
      redactionPolicyOverride: {
        dataMinimizationLevel: "RedactedSensitive",
        reason: "Tighten export for external adjuster.",
      },
    },
    context()
  );
}

describe("export framework entity types and service helpers", () => {
  it("generates deterministic export identifiers without raw input values", () => {
    const profileId = generateExportProfileId(landlordRef, "recipient:raw-reference", "InsuranceClaim");
    const repeatedProfileId = generateExportProfileId(landlordRef, "recipient:raw-reference", "InsuranceClaim");
    const requestId = generateExportRequestId(profileId, timestamp, landlordRef);
    const repeatedRequestId = generateExportRequestId(profileId, timestamp, landlordRef);
    const packageId = generateExportPackageId(requestId, timestamp);

    expect(profileId).toBe(repeatedProfileId);
    expect(requestId).toBe(repeatedRequestId);
    expect(profileId).toMatch(/^exp_profile_v1_/);
    expect(requestId).toMatch(/^exp_req_v1_/);
    expect(packageId).toMatch(/^exp_pkg_v1_/);
    expect(`${profileId} ${requestId} ${packageId}`).not.toContain("raw-reference");
    expect(`${profileId} ${requestId} ${packageId}`).not.toContain(landlordRef);
  });

  it("creates and validates export profile, request, and package entities", () => {
    const exportProfile = profile();
    const exportRequest = request(exportProfile);
    const exportPackage = createExportPackageEntity({
      request: exportRequest,
      recipientType: exportProfile.recipientType,
      purpose: exportProfile.purpose,
      assembledAt: "2026-06-04T12:10:00.000Z",
      assembledBy: "service:dddddddddddddddddddd",
      evidenceClasses: ["PaymentEvidence", "MaintenanceEvidence"],
      unitsScopeApplied: [unitRef],
      redactionPolicyApplied: "RedactedSensitive",
      includedEvidenceCount: 2,
    });

    expect(validateExportProfile(exportProfile)).toEqual({ ok: true, errors: [] });
    expect(validateExportRequest(exportRequest, exportProfile)).toEqual({ ok: true, errors: [] });
    expect(validateExportPackage(exportPackage)).toEqual({ ok: true, errors: [] });
    expect(exportPackage.packageMetadata.checksumAlgorithm).toBe("sha256");
  });

  it("fails validation for invalid profile purpose mapping and unsafe profile content", () => {
    const exportProfile = profile();
    const invalid: ExportProfile = {
      ...exportProfile,
      recipientType: "Regulator",
      description: "contains secret token",
    };
    const result = validateExportProfile(invalid);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("purpose_not_allowed_for_recipient");
    expect(result.errors).toContain("description_invalid");
  });

  it("fails validation for invalid request scope and loose redaction override", () => {
    const exportProfile = profile();
    const exportRequest: ExportRequest = {
      ...request(exportProfile),
      scopeParameters: {
        dateRangeStart: "2026-06-01T00:00:00.000Z",
        dateRangeEnd: "2026-01-01T00:00:00.000Z",
        evidenceClassFilters: ["ScreeningEvidence"],
      },
      redactionPolicyOverride: {
        dataMinimizationLevel: "Full",
        reason: "loosen policy",
      },
    };
    const result = validateExportRequest(exportRequest, exportProfile);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("scope_date_range_invalid");
    expect(result.errors).toContain("redaction_override_cannot_loosen_profile");
  });

  it("keeps validation pure and deterministic", () => {
    const exportProfile = profile();
    const before = JSON.stringify(exportProfile);

    expect(validateExportProfile(exportProfile)).toEqual(validateExportProfile(exportProfile));
    expect(JSON.stringify(exportProfile)).toBe(before);
  });
});
