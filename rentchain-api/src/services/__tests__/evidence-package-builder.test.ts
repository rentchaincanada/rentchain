import { describe, expect, it } from "vitest";

import {
  assembleEvidencePackage,
  filterEvidenceByRetentionStatus,
  filterEvidenceByScope,
  generatePackageChecksum,
  projectEvidenceForExport,
  validatePackageManifest,
  type ExportAssemblyContext,
} from "../evidence-package-builder-service";
import {
  createExportProfileEntity,
  createExportRequestEntity,
} from "../../services/export-service";
import type { ExportAuthorizationContext } from "../../types/export-authorization-types";
import type { ExportProfile } from "../../types/export-profile-types";
import type { ExportRequest } from "../../types/export-request-types";
import type { EvidenceRecord } from "../../types/evidence-record-types";
import { evidenceRecordFixtures } from "../../__tests__/fixtures/evidence-record-fixtures";

const landlordRef = "landlord:aaaaaaaaaaaaaaaaaaaa";
const actorRef = "actor:bbbbbbbbbbbbbbbbbbbb";
const unitRef = "unit:cccccccccccccccccccc";
const otherUnitRef = "unit:dddddddddddddddddddd";
const timestamp = "2026-06-04T14:00:00.000Z";

function authorizationContext(overrides: Partial<ExportAuthorizationContext> = {}): ExportAuthorizationContext {
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

function assemblyContext(overrides: Partial<ExportAssemblyContext> = {}): ExportAssemblyContext {
  return {
    timestamp: "2026-06-04T14:15:00.000Z",
    actorId: actorRef,
    actorRole: "LandlordAdmin",
    landlordId: landlordRef,
    purpose: "InsuranceClaim",
    rawIdsIncluded: false,
    ...overrides,
  };
}

function profile(overrides: Partial<ExportProfile> = {}): ExportProfile {
  const created = createExportProfileEntity(
    {
      landlordId: landlordRef,
      recipientType: "InsuranceAdjuster",
      recipientName: "Acme Insurance Adjusters LLC",
      recipientReference: "acme-insurance-adjusters",
      purpose: "InsuranceClaim",
      description: "Insurance claim review.",
      approvedEvidenceClasses: ["ApplicationEvidence", "PaymentEvidence", "MaintenanceEvidence"],
      excludedUnitIds: [otherUnitRef],
      dataMinimizationLevel: "Redacted",
      createdReason: "Insurance claim package review.",
    },
    authorizationContext()
  );
  return { ...created, ...overrides };
}

function request(exportProfile = profile(), overrides: Partial<ExportRequest> = {}): ExportRequest {
  const created = createExportRequestEntity(
    {
      profile: exportProfile,
      requestedAt: "2026-06-04T14:05:00.000Z",
      requestedBy: actorRef,
      requestReason: "Claim settlement review.",
      scopeParameters: {
        dateRangeStart: "2026-01-01T00:00:00.000Z",
        dateRangeEnd: "2026-06-30T00:00:00.000Z",
        evidenceClassFilters: ["PaymentEvidence", "MaintenanceEvidence"],
        unitScopeOverride: [unitRef],
      },
      redactionPolicyOverride: {
        dataMinimizationLevel: "RedactedSensitive",
        reason: "Tighten projection for external review.",
      },
    },
    authorizationContext()
  );
  return { ...created, ...overrides };
}

function record(base: EvidenceRecord, overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    ...base,
    landlordId: landlordRef,
    safeReference: {
      ...base.safeReference,
      safeReferenceKey: unitRef,
    },
    provenanceMetadata: {
      ...base.provenanceMetadata,
      source: {
        ...base.provenanceMetadata.source,
        sourceReferenceKey: unitRef,
      },
    },
    ...overrides,
  };
}

function records(): EvidenceRecord[] {
  return [
    record(evidenceRecordFixtures.paymentEvidence),
    record(evidenceRecordFixtures.maintenanceEvidence),
    record(evidenceRecordFixtures.applicationEvidence),
    record(evidenceRecordFixtures.screeningEvidence),
    record(evidenceRecordFixtures.paymentEvidence, {
      evidenceId: "evidence:superseded-safe-fixture",
      status: "superseded",
      createdAt: "2026-03-01T00:00:00.000Z",
    }),
    record(evidenceRecordFixtures.maintenanceEvidence, {
      evidenceId: "evidence:old-safe-fixture",
      createdAt: "2025-01-01T00:00:00.000Z",
    }),
  ];
}

describe("evidence package builder unit helpers", () => {
  it("assembles metadata-only packages with manifest counts and checksum", () => {
    const exportProfile = profile();
    const exportRequest = request(exportProfile);
    const pkg = assembleEvidencePackage(exportRequest, exportProfile, records(), assemblyContext());

    expect(pkg.packageMetadata.includedEvidenceCount).toBe(2);
    expect(pkg.packageMetadata.checksumAlgorithm).toBe("sha256");
    expect(pkg.packageMetadata.checksumValue).toMatch(/^[a-f0-9]{64}$/);
    expect(pkg.evidenceManifest.evidenceClasses).toEqual(["MaintenanceEvidence", "PaymentEvidence"]);
    expect(pkg.evidenceManifest.redactionPolicyApplied).toBe("RedactedSensitive");
    expect(pkg.evidenceManifest.excludedEvidence?.map((item) => item.reason)).toEqual([
      "evidence_class_not_requested",
      "evidence_class_not_approved",
      "evidence_status_not_allowed",
      "evidence_before_requested_date_range",
    ]);
    expect(pkg.rawIdsIncluded).toBe(false);
    expect(pkg.payloadIncluded).toBe(false);
  });

  it("filters records by profile evidence class, request class, date range, and unit scope", () => {
    const exportProfile = profile();
    const exportRequest = request(exportProfile);
    const scoped = filterEvidenceByScope(records(), exportRequest.scopeParameters, exportProfile);

    expect(scoped.map((item) => item.evidenceClass)).toEqual([
      "PaymentEvidence",
      "MaintenanceEvidence",
      "PaymentEvidence",
    ]);
    expect(filterEvidenceByRetentionStatus(scoped, ["active"]).map((item) => item.evidenceClass)).toEqual([
      "PaymentEvidence",
      "MaintenanceEvidence",
    ]);
  });

  it("excludes archived, superseded, and redacted records by default", () => {
    const mixed = [
      record(evidenceRecordFixtures.paymentEvidence),
      record(evidenceRecordFixtures.paymentEvidence, { evidenceId: "evidence:archived", status: "archived" }),
      record(evidenceRecordFixtures.paymentEvidence, { evidenceId: "evidence:redacted", status: "redacted" }),
      record(evidenceRecordFixtures.paymentEvidence, { evidenceId: "evidence:superseded", status: "superseded" }),
    ];

    expect(filterEvidenceByRetentionStatus(mixed, ["active"]).map((item) => item.status)).toEqual(["active"]);
  });

  it("projects evidence using safe allowlists for each redaction level", () => {
    const payment = record(evidenceRecordFixtures.paymentEvidence);
    const full = projectEvidenceForExport(payment, "Full");
    const redacted = projectEvidenceForExport(payment, "Redacted");
    const sensitive = projectEvidenceForExport(payment, "RedactedSensitive");

    expect(full.allowedFieldGroups).toContain("ledgerStatus");
    expect(redacted.allowedFieldGroups).toEqual(["currency", "ledgerStatus", "paidAt"]);
    expect(sensitive.allowedFieldGroups).toEqual(["status", "timestamp", "safeReference", "redactionCategories"]);
    expect(sensitive.redactedFieldGroups).toContain("amount");
    expect(JSON.stringify(sensitive)).not.toContain(payment.resourceId);
    expect(JSON.stringify(sensitive)).not.toMatch(/gs:\/\/|storage\.googleapis\.com|secret|token|credential/i);
    expect(sensitive.rawIdsIncluded).toBe(false);
    expect(sensitive.payloadIncluded).toBe(false);
  });

  it("generates deterministic checksums and changes when manifest data changes", () => {
    const included = records().slice(0, 2);
    const checksum = generatePackageChecksum(included, { manifest: "a" });

    expect(generatePackageChecksum([...included].reverse(), { manifest: "a" })).toBe(checksum);
    expect(generatePackageChecksum(included, { manifest: "b" })).not.toBe(checksum);
  });

  it("validates package manifests against collected records", () => {
    const exportProfile = profile();
    const exportRequest = request(exportProfile);
    const included = filterEvidenceByRetentionStatus(filterEvidenceByScope(records(), exportRequest.scopeParameters, exportProfile), ["active"]);
    const pkg = assembleEvidencePackage(exportRequest, exportProfile, records(), assemblyContext());

    expect(validatePackageManifest(pkg, included)).toEqual({ ok: true, errors: [] });
    expect(validatePackageManifest({ ...pkg, packageMetadata: { ...pkg.packageMetadata, includedEvidenceCount: 99 } }, included).errors)
      .toContain("package_manifest_included_count_mismatch");
  });

  it("assembles a valid empty package when no evidence matches scope", () => {
    const exportProfile = profile();
    const exportRequest = request(exportProfile);
    const pkg = assembleEvidencePackage(exportRequest, exportProfile, [], assemblyContext());

    expect(pkg.packageMetadata.includedEvidenceCount).toBe(0);
    expect(pkg.evidenceManifest.evidenceClasses).toEqual(exportProfile.approvedEvidenceClasses);
    expect(validatePackageManifest(pkg, [])).toEqual({ ok: true, errors: [] });
  });

  it("rejects cross-landlord assembly and out-of-profile evidence class requests", () => {
    const exportProfile = profile();
    const exportRequest = request(exportProfile);

    expect(() => assembleEvidencePackage(exportRequest, exportProfile, records(), assemblyContext({ landlordId: "landlord:ffffffffffffffffffff" })))
      .toThrow("landlord_scope_mismatch");
    expect(() =>
      assembleEvidencePackage(
        { ...exportRequest, scopeParameters: { evidenceClassFilters: ["ScreeningEvidence"] } },
        exportProfile,
        records(),
        assemblyContext()
      )
    ).toThrow("requested_evidence_class_not_approved");
  });

  it("rejects redaction policy loosening and invalid actor contexts", () => {
    const exportProfile = profile();
    const exportRequest = request(exportProfile, {
      redactionPolicyOverride: {
        dataMinimizationLevel: "Full",
        reason: "loosen",
      },
    });

    expect(() => assembleEvidencePackage(exportRequest, exportProfile, records(), assemblyContext()))
      .toThrow("redaction_override_cannot_loosen_profile");
    expect(() => assembleEvidencePackage(request(exportProfile), exportProfile, records(), assemblyContext({ actorRole: "AdminSupport", landlordId: "" })))
      .toThrow("requesting_actor_scope_required");
  });
});
