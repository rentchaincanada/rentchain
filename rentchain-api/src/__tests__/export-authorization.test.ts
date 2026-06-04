import { describe, expect, it } from "vitest";

import {
  createExportProfileEntity,
  createExportRequestEntity,
} from "../services/export-service";
import {
  validateExportAuthorizationContext,
  validateExportProfileAuthorization,
  validateExportRequestAuthorization,
  validateRedactionPolicyOverride,
  type ExportAuthorizationContext,
} from "../types/export-authorization-types";

const landlordRef = "landlord:aaaaaaaaaaaaaaaaaaaa";
const otherLandlordRef = "landlord:bbbbbbbbbbbbbbbbbbbb";
const actorRef = "actor:cccccccccccccccccccc";
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

function profile() {
  return createExportProfileEntity(
    {
      landlordId: landlordRef,
      recipientType: "InsuranceAdjuster",
      recipientName: "Acme Insurance Adjusters LLC",
      recipientReference: "acme-insurance-adjusters",
      purpose: "InsuranceClaim",
      description: "Insurance claim review.",
      approvedEvidenceClasses: ["PaymentEvidence", "MaintenanceEvidence"],
      dataMinimizationLevel: "Redacted",
      createdReason: "Insurance claim package review.",
    },
    context()
  );
}

describe("export authorization validation", () => {
  it("validates authorization context", () => {
    expect(validateExportAuthorizationContext(context())).toEqual({ ok: true, errors: [] });
    expect(
      validateExportAuthorizationContext(context({
        requestingActorId: "raw-actor-id",
        requestingActorScope: "",
        timestamp: "not-a-date",
      })).errors
    ).toEqual([
      "requesting_actor_id_must_be_safe_reference",
      "requesting_actor_scope_required",
      "timestamp_must_be_utc_iso",
    ]);
  });

  it("approves valid profile and request authorization", () => {
    const exportProfile = profile();
    const exportRequest = createExportRequestEntity(
      {
        profile: exportProfile,
        requestedAt: "2026-06-04T12:05:00.000Z",
        requestedBy: actorRef,
        requestReason: "Claim review.",
        scopeParameters: {
          evidenceClassFilters: ["PaymentEvidence"],
        },
      },
      context()
    );

    expect(validateExportProfileAuthorization(exportProfile, context()).decision).toBe("Approved");
    expect(validateExportRequestAuthorization(exportRequest, exportProfile, context()).decision).toBe("Approved");
  });

  it("denies invalid recipient-purpose mapping and cross-landlord scope", () => {
    const exportProfile = {
      ...profile(),
      recipientType: "Regulator" as const,
    };

    expect(validateExportProfileAuthorization(exportProfile, context()).decision).toBe("DeniedInvalidPurpose");
    expect(validateExportProfileAuthorization(profile(), context({ requestingActorScope: otherLandlordRef })).decision).toBe("DeniedOutOfScope");
  });

  it("denies request evidence classes outside profile scope", () => {
    const exportProfile = profile();
    const exportRequest = createExportRequestEntity(
      {
        profile: exportProfile,
        requestedAt: "2026-06-04T12:05:00.000Z",
        requestedBy: actorRef,
        requestReason: "Claim review.",
        scopeParameters: {
          evidenceClassFilters: ["ScreeningEvidence"],
        },
      },
      context()
    );

    expect(validateExportRequestAuthorization(exportRequest, exportProfile, context())).toMatchObject({
      isApproved: false,
      decision: "DeniedOutOfScope",
      denialReason: "requested_evidence_class_not_approved",
    });
  });

  it("requires redaction overrides to tighten profile policy", () => {
    const exportProfile = profile();

    expect(validateRedactionPolicyOverride({ dataMinimizationLevel: "RedactedSensitive", reason: "tighten" }, exportProfile).ok).toBe(true);
    expect(validateRedactionPolicyOverride({ dataMinimizationLevel: "Full", reason: "loosen" }, exportProfile)).toEqual({
      ok: false,
      errors: ["redaction_override_cannot_loosen_profile"],
    });
  });
});
