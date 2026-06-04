import { describe, expect, it } from "vitest";

import {
  buildEvidencePackage,
  materializeEvidenceRecords,
  type EvidenceRecordFirestoreLike,
  type ExportAssemblyContext,
} from "../evidence-package-builder-service";
import {
  createExportProfileEntity,
  createExportRequestEntity,
  validateExportPackage,
} from "../../services/export-service";
import type { ExportAuthorizationContext } from "../../types/export-authorization-types";
import type { ExportProfile } from "../../types/export-profile-types";
import type { ExportRequest } from "../../types/export-request-types";
import type { EvidenceRecord } from "../../types/evidence-record-types";
import { EVIDENCE_RECORD_COLLECTION } from "../../types/evidence-record-types";
import { evidenceRecordFixtures } from "../../__tests__/fixtures/evidence-record-fixtures";

const landlordRef = "landlord:aaaaaaaaaaaaaaaaaaaa";
const otherLandlordRef = "landlord:eeeeeeeeeeeeeeeeeeee";
const actorRef = "actor:bbbbbbbbbbbbbbbbbbbb";
const unitRef = "unit:cccccccccccccccccccc";
const timestamp = "2026-06-04T15:00:00.000Z";

type Filter = {
  field: string;
  op: string;
  value: unknown;
};

class QueryLike {
  private readonly filters: Filter[];
  private readonly max: number | null;

  constructor(private readonly data: EvidenceRecord[], filters: Filter[] = [], max: number | null = null) {
    this.filters = filters;
    this.max = max;
  }

  where(field: string, op: string, value: unknown) {
    return new QueryLike(this.data, [...this.filters, { field, op, value }], this.max);
  }

  orderBy() {
    return this;
  }

  limit(limit: number) {
    return new QueryLike(this.data, this.filters, limit);
  }

  async get() {
    const filtered = this.data
      .filter((record) =>
        this.filters.every((filter) => {
          const value = record[filter.field as keyof EvidenceRecord];
          if (filter.op === "==") return value === filter.value;
          if (filter.op === ">=") return String(value) >= String(filter.value);
          if (filter.op === "<=") return String(value) <= String(filter.value);
          return true;
        })
      )
      .slice(0, this.max || undefined);
    return {
      docs: filtered.map((record) => ({
        data: () => record,
      })),
    };
  }
}

function firestore(records: EvidenceRecord[]): EvidenceRecordFirestoreLike {
  return {
    collection(name: string) {
      if (name !== EVIDENCE_RECORD_COLLECTION) throw new Error("unexpected_collection");
      return new QueryLike(records) as unknown as ReturnType<EvidenceRecordFirestoreLike["collection"]>;
    },
  };
}

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

function assemblyContext(records: EvidenceRecord[], overrides: Partial<ExportAssemblyContext> = {}): ExportAssemblyContext {
  return {
    timestamp: "2026-06-04T15:15:00.000Z",
    actorId: actorRef,
    actorRole: "LandlordAdmin",
    landlordId: landlordRef,
    purpose: "InsuranceClaim",
    firestore: firestore(records),
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
      approvedEvidenceClasses: ["PaymentEvidence", "MaintenanceEvidence"],
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
      requestedAt: "2026-06-04T15:05:00.000Z",
      requestedBy: actorRef,
      requestReason: "Claim settlement review.",
      scopeParameters: {
        dateRangeStart: "2026-01-01T00:00:00.000Z",
        dateRangeEnd: "2026-06-30T00:00:00.000Z",
        evidenceClassFilters: ["PaymentEvidence", "MaintenanceEvidence"],
      },
      redactionPolicyOverride: {
        dataMinimizationLevel: "RedactedSensitive",
        reason: "Tighten projection for external recipient.",
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
    ...overrides,
  };
}

function records(): EvidenceRecord[] {
  return [
    record(evidenceRecordFixtures.paymentEvidence),
    record(evidenceRecordFixtures.maintenanceEvidence),
    record(evidenceRecordFixtures.screeningEvidence),
    record(evidenceRecordFixtures.paymentEvidence, {
      evidenceId: "evidence:other-landlord-fixture",
      landlordId: otherLandlordRef,
    }),
  ];
}

describe("evidence package builder integration", () => {
  it("builds an export package through profile, request, materialization, and validation", async () => {
    const exportProfile = profile();
    const exportRequest = request(exportProfile);
    const pkg = await buildEvidencePackage(exportRequest, exportProfile, assemblyContext(records()));

    expect(pkg.packageMetadata.includedEvidenceCount).toBe(2);
    expect(pkg.evidenceManifest.evidenceClasses).toEqual(["MaintenanceEvidence", "PaymentEvidence"]);
    expect(pkg.evidenceManifest.redactionPolicyApplied).toBe("RedactedSensitive");
    expect(pkg.packageMetadata.checksumValue).toMatch(/^[a-f0-9]{64}$/);
    expect(validateExportPackage(pkg)).toEqual({ ok: true, errors: [] });
    expect(JSON.stringify(pkg)).not.toContain(otherLandlordRef);
  });

  it("keeps package IDs and checksums deterministic for identical inputs", async () => {
    const exportProfile = profile();
    const exportRequest = request(exportProfile);
    const context = assemblyContext(records());
    const first = await buildEvidencePackage(exportRequest, exportProfile, context);
    const second = await buildEvidencePackage(exportRequest, exportProfile, context);

    expect(second.exportPackageId).toBe(first.exportPackageId);
    expect(second.packageMetadata.checksumValue).toBe(first.packageMetadata.checksumValue);
  });

  it("materializes landlord-scoped evidence records only", async () => {
    const exportProfile = profile();
    const exportRequest = request(exportProfile);
    const materialized = await materializeEvidenceRecords(landlordRef, exportRequest, exportProfile, firestore(records()));

    expect(materialized).toHaveLength(2);
    expect(materialized.every((record) => record.landlordId === landlordRef)).toBe(true);
    expect(materialized.map((record) => record.evidenceClass).sort()).toEqual(["MaintenanceEvidence", "PaymentEvidence"]);
  });

  it("rejects unauthorized actors and cross-landlord requests", async () => {
    const exportProfile = profile();
    const exportRequest = request(exportProfile);

    await expect(buildEvidencePackage(exportRequest, exportProfile, assemblyContext(records(), { actorRole: "AdminSupport", landlordId: null as unknown as string })))
      .rejects.toThrow("requesting_actor_scope_required");
    await expect(buildEvidencePackage({ ...exportRequest, landlordId: otherLandlordRef }, exportProfile, assemblyContext(records())))
      .rejects.toThrow("landlord_id_mismatch");
  });

  it("rejects request scope that widens beyond the export profile", async () => {
    const exportProfile = profile();
    const exportRequest = request(exportProfile, {
      scopeParameters: {
        evidenceClassFilters: ["ScreeningEvidence"],
      },
    });

    await expect(buildEvidencePackage(exportRequest, exportProfile, assemblyContext(records())))
      .rejects.toThrow("requested_evidence_class_not_approved");
  });
});
