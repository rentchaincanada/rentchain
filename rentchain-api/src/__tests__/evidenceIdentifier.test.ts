import { describe, expect, it } from "vitest";

import { evidenceRecordFixtureList } from "./fixtures/evidence-record-fixtures";
import { EVIDENCE_CLASSES } from "../types/evidence-record-types";
import {
  generateEvidenceId,
  parseEvidenceId,
  validateEvidenceId,
} from "../utils/evidence-identifier";

describe("evidence identifier utilities", () => {
  it("generates deterministic opaque evidence identifiers", () => {
    const metadata = {
      evidenceClass: "PaymentEvidence",
      landlordRef: "landlord:safe-ref",
      projection: "metadata_only",
      schemaVersion: "evidence_record_v1",
    };
    const first = generateEvidenceId("PaymentEvidence", "raw-firestore-doc-id-123456789", metadata);
    const second = generateEvidenceId("PaymentEvidence", "raw-firestore-doc-id-123456789", {
      schemaVersion: "evidence_record_v1",
      projection: "metadata_only",
      landlordRef: "landlord:safe-ref",
      evidenceClass: "PaymentEvidence",
    });

    expect(first).toBe(second);
    expect(validateEvidenceId(first)).toBe(true);
    expect(first).not.toContain("raw-firestore-doc-id");
    expect(first).not.toContain("landlord:safe-ref");
  });

  it("parses evidence type and governance hashes without exposing source identifiers", () => {
    const evidenceId = generateEvidenceId("ScreeningEvidence", "screening-order-secret-id", {
      evidenceClass: "ScreeningEvidence",
      projection: "metadata_only",
    });
    const parsed = parseEvidenceId(evidenceId);

    expect(parsed).toMatchObject({
      valid: true,
      version: "v1",
      evidenceType: "screening-evidence",
    });
    expect(parsed.sourceHash).toMatch(/^[a-f0-9]{20}$/);
    expect(parsed.governanceHash).toMatch(/^[a-f0-9]{20}$/);
    expect(JSON.stringify(parsed)).not.toContain("screening-order-secret-id");
  });

  it("rejects malformed evidence identifiers", () => {
    expect(validateEvidenceId("screening-order-secret-id")).toBe(false);
    expect(validateEvidenceId("evr_v1_type_short_hash")).toBe(false);
    expect(parseEvidenceId("screening-order-secret-id").valid).toBe(false);
  });

  it("supports every evidence class without exposing raw source values", () => {
    for (const evidenceClass of EVIDENCE_CLASSES) {
      const evidenceId = generateEvidenceId(evidenceClass, `${evidenceClass}:raw-source-id`, {
        evidenceClass,
        projection: "metadata_only",
        schemaVersion: "evidence_record_v1",
      });
      const parsed = parseEvidenceId(evidenceId);

      expect(validateEvidenceId(evidenceId)).toBe(true);
      expect(parsed.valid).toBe(true);
      expect(evidenceId).not.toContain("raw-source-id");
      expect(evidenceId).not.toContain(evidenceClass);
    }
  });
});

describe("evidence record fixtures", () => {
  it("cover all required evidence classes with append-safe metadata", () => {
    expect(evidenceRecordFixtureList.map((record) => record.evidenceClass)).toEqual([
      "ApplicationEvidence",
      "ScreeningEvidence",
      "DecisionEvidence",
      "PaymentEvidence",
      "MaintenanceEvidence",
      "AuditEvidence",
    ]);
    expect(evidenceRecordFixtureList.every((record) => record.immutable)).toBe(true);
    expect(evidenceRecordFixtureList.every((record) => record.appendOnly)).toBe(true);
    expect(evidenceRecordFixtureList.every((record) => record.metadataOnly)).toBe(true);
    expect(evidenceRecordFixtureList.every((record) => record.rawIdsIncluded === false)).toBe(true);
    expect(evidenceRecordFixtureList.every((record) => validateEvidenceId(record.evidenceId))).toBe(true);
  });

  it("keeps restricted payload markers out of evidence records", () => {
    const serialized = JSON.stringify(evidenceRecordFixtureList);

    expect(serialized).not.toMatch(/bearer-secret|secret-token|gs:\/\/|storage\.googleapis\.com/i);
    expect(serialized).not.toMatch(/raw-provider-payload|bank-account-number|card-number-value|message-body-value/i);
    expect(evidenceRecordFixtureList.every((record) => record.sensitivityMetadata.rawIdsIncluded === false)).toBe(true);
    expect(evidenceRecordFixtureList.every((record) => record.sensitivityMetadata.payloadIncluded === false)).toBe(true);
  });
});
