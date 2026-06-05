import { describe, expect, it } from "vitest";

import {
  computeEvidencePackageHash,
  computeEvidenceRecordHash,
  isSha256Hash,
  normalizeForHashing,
} from "./evidence-hash-service";
import { createExportPackageEntity, createExportProfileEntity, createExportRequestEntity } from "../services/export-service";
import type { ExportAuthorizationContext } from "../types/export-authorization-types";
import { evidenceRecordFixtures } from "../__tests__/fixtures/evidence-record-fixtures";

const landlordRef = "landlord:aaaaaaaaaaaaaaaaaaaa";
const actorRef = "actor:bbbbbbbbbbbbbbbbbbbb";
const timestamp = "2026-06-05T14:00:00.000Z";

function context(): ExportAuthorizationContext {
  return {
    requestingActorId: actorRef,
    requestingActorRole: "LandlordAdmin",
    requestingActorScope: landlordRef,
    requestingPurpose: "InsuranceClaim",
    timestamp,
    rawIdsIncluded: false,
  };
}

function exportPackage() {
  const auth = context();
  const profile = createExportProfileEntity(
    {
      landlordId: landlordRef,
      recipientType: "InsuranceAdjuster",
      recipientName: "Acme Insurance Adjusters LLC",
      recipientReference: "acme-insurance-adjusters",
      purpose: "InsuranceClaim",
      description: "Insurance claim review.",
      approvedEvidenceClasses: ["PaymentEvidence"],
      dataMinimizationLevel: "Redacted",
      createdReason: "Insurance claim package review.",
    },
    auth
  );
  const request = createExportRequestEntity(
    {
      profile,
      requestedAt: "2026-06-05T14:01:00.000Z",
      requestedBy: actorRef,
      requestReason: "Claim settlement review.",
      scopeParameters: { evidenceClassFilters: ["PaymentEvidence"] },
    },
    auth
  );
  return createExportPackageEntity({
    request,
    recipientType: profile.recipientType,
    purpose: profile.purpose,
    assembledAt: "2026-06-05T14:02:00.000Z",
    assembledBy: actorRef,
    evidenceClasses: ["PaymentEvidence"],
    redactionPolicyApplied: "Redacted",
    includedEvidenceCount: 1,
  });
}

describe("evidence hash service", () => {
  it("normalizes values with stable key ordering and null handling", () => {
    expect(normalizeForHashing({ b: 2, a: { d: undefined, c: 1 } })).toBe(
      normalizeForHashing({ a: { c: 1, d: null }, b: 2 })
    );
  });

  it("computes deterministic package hashes without mutating packages", () => {
    const pkg = exportPackage();
    const before = JSON.stringify(pkg);
    const first = computeEvidencePackageHash(pkg);
    const second = computeEvidencePackageHash({
      ...pkg,
      evidenceManifest: {
        ...pkg.evidenceManifest,
        evidenceClasses: [...pkg.evidenceManifest.evidenceClasses].reverse(),
      },
    });

    expect(first).toBe(second);
    expect(isSha256Hash(first)).toBe(true);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(pkg)).toBe(before);
  });

  it("computes deterministic evidence record hashes without mutating records", () => {
    const record = evidenceRecordFixtures.paymentEvidence;
    const before = JSON.stringify(record);
    const first = computeEvidenceRecordHash(record);
    const second = computeEvidenceRecordHash({ ...record, createdAt: "2030-01-01T00:00:00.000Z" });

    expect(first).toBe(second);
    expect(isSha256Hash(first)).toBe(true);
    expect(JSON.stringify(record)).toBe(before);
  });

  it("rejects invalid package and evidence inputs", () => {
    expect(() => computeEvidencePackageHash({ ...exportPackage(), rawIdsIncluded: true as false })).toThrow(
      "export_package_hash_flags_invalid"
    );
    expect(() =>
      computeEvidenceRecordHash({ ...evidenceRecordFixtures.paymentEvidence, metadataOnly: false as true })
    ).toThrow("evidence_record_hash_flags_invalid");
  });
});
