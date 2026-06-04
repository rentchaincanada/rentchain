import { describe, expect, it } from "vitest";

import { evidenceRecordFixtures, evidenceRecordFixtureList } from "./fixtures/evidence-record-fixtures";
import {
  EVIDENCE_RETENTION_POLICY_RULES,
  EVIDENCE_RETENTION_POLICY_VERSION,
} from "../services/evidence-retention-policy-registry";
import { EvidenceRecordService } from "../services/evidence-record-service";
import {
  type EvidenceRecord,
  type RetentionEvaluationContext,
} from "../types/evidence-record-types";

const evaluatedBy = {
  actorRole: "admin" as const,
  actorRef: "actor:retention-review",
  purpose: "retention policy evaluation",
  rawIdsIncluded: false as const,
};

function context(overrides: Partial<RetentionEvaluationContext> = {}): RetentionEvaluationContext {
  return {
    currentTimestamp: "2030-06-04T00:00:00.000Z",
    legalHoldStatus: "none",
    policyVersion: EVIDENCE_RETENTION_POLICY_VERSION,
    evaluationReason: "scheduled retention policy review",
    evaluatedBy,
    ...overrides,
  };
}

function withCreatedAt(record: EvidenceRecord, createdAt: string): EvidenceRecord {
  return {
    ...record,
    createdAt,
    provenanceMetadata: {
      ...record.provenanceMetadata,
      createdAt,
    },
  };
}

function serializedProjection(value: unknown): string {
  return JSON.stringify(value);
}

describe("evidence retention policy registry", () => {
  it("maps each evidence class to a versioned immutable retention rule", () => {
    const service = new EvidenceRecordService();

    for (const record of evidenceRecordFixtureList) {
      const rule = service.getRetentionSchedule(record.evidenceClass, record.landlordId, EVIDENCE_RETENTION_POLICY_VERSION);

      expect(rule).toMatchObject({
        evidenceClass: record.evidenceClass,
        policyVersion: EVIDENCE_RETENTION_POLICY_VERSION,
        auditEventCapture: "required",
        immutable: true,
        appliesRetroactively: false,
      });
      expect(EVIDENCE_RETENTION_POLICY_RULES[record.evidenceClass]).toEqual(rule);
    }
  });

  it("fails closed for unknown policy versions", () => {
    const service = new EvidenceRecordService();

    expect(() =>
      service.getRetentionSchedule(
        "ApplicationEvidence",
        "landlord-fixture-internal",
        "unknown_policy" as typeof EVIDENCE_RETENTION_POLICY_VERSION
      )
    ).toThrow("evidence_retention_policy_version_unknown");
  });
});

describe("EvidenceRecordService retention evaluation", () => {
  it("calculates class-based archival eligibility dates", () => {
    const service = new EvidenceRecordService();
    const cases = [
      { record: evidenceRecordFixtures.applicationEvidence, expected: "2029-06-04T00:00:00.000Z" },
      { record: evidenceRecordFixtures.screeningEvidence, expected: "2028-06-04T00:00:00.000Z" },
      { record: evidenceRecordFixtures.decisionEvidence, expected: "2028-06-04T00:00:00.000Z" },
      { record: evidenceRecordFixtures.paymentEvidence, expected: "2033-06-04T00:00:00.000Z" },
      { record: evidenceRecordFixtures.maintenanceEvidence, expected: "2028-06-04T00:00:00.000Z" },
      { record: evidenceRecordFixtures.auditEvidence, expected: null },
    ];

    for (const item of cases) {
      const record = withCreatedAt(item.record, "2026-06-04T00:00:00.000Z");
      const result = service.evaluateRetentionPolicy(record, context());

      expect(result.policyRule.evidenceClass).toBe(record.evidenceClass);
      expect(result.eligibleForArchivalAt).toBe(item.expected);
      expect(result.eligibleForDeletionAt).toBeNull();
      expect(result.rawIdsIncluded).toBe(false);
    }
  });

  it("honors legal hold status by blocking archival and deletion eligibility", () => {
    const service = new EvidenceRecordService();
    const record = withCreatedAt(evidenceRecordFixtures.applicationEvidence, "2026-06-04T00:00:00.000Z");
    const result = service.evaluateRetentionPolicy(record, context({ legalHoldStatus: "active" }));

    expect(result.legalHoldStatus).toBe("active");
    expect(result.eligibleForArchivalAt).toBe("2029-06-04T00:00:00.000Z");
    expect(result.archivalEligible).toBe(false);
    expect(result.deletionEligible).toBe(false);
  });

  it("applies landlord override input without exposing landlord identifiers in evaluation output", () => {
    const service = new EvidenceRecordService();
    const record = withCreatedAt(evidenceRecordFixtures.applicationEvidence, "2026-06-04T00:00:00.000Z");
    const result = service.evaluateRetentionPolicy(
      record,
      context({
        currentTimestamp: "2027-06-04T00:00:00.000Z",
        landlordOverride: {
          archiveAfterPeriod: 6,
          archiveAfterUnit: "months",
          retentionPeriod: 6,
          retentionUnit: "months",
          reason: "documented landlord retention schedule",
        },
      })
    );

    expect(result.eligibleForArchivalAt).toBe("2026-12-04T00:00:00.000Z");
    expect(result.archivalEligible).toBe(true);
    expect(serializedProjection(result)).not.toMatch(/landlord-fixture-internal|tenant-id|lease-id|unit-id/i);
  });

  it("fails closed on ambiguous legal hold status and unsafe reasons", () => {
    const service = new EvidenceRecordService();
    const record = evidenceRecordFixtures.applicationEvidence;

    expect(() => service.evaluateRetentionPolicy(record, context({ legalHoldStatus: null }))).toThrow(
      "evidence_retention_legal_hold_ambiguous"
    );
    expect(() => service.evaluateRetentionPolicy(record, context({ evaluationReason: "contains secret token" }))).toThrow(
      "evidence_retention_evaluation_reason_invalid"
    );
  });
});

describe("EvidenceRecordService lifecycle transitions", () => {
  it("creates append-only lifecycle events and returns a new record copy", () => {
    const service = new EvidenceRecordService();
    const original = withCreatedAt(evidenceRecordFixtures.applicationEvidence, "2026-06-04T00:00:00.000Z");
    const evaluation = service.evaluateRetentionPolicy(original, context({ currentTimestamp: "2030-06-04T00:00:00.000Z" }));
    const event = service.createLifecycleTransitionEvent({
      evidenceRecord: original,
      newStatus: "archived",
      transitionReason: "retention archive eligibility confirmed",
      evaluation,
    });
    const updated = service.appendLifecycleTransitionEvent(original, event, evaluation);

    expect(event).toMatchObject({
      evidenceId: original.evidenceId,
      priorStatus: "active",
      newStatus: "archived",
      rawIdsIncluded: false,
      payloadIncluded: false,
    });
    expect(original.status).toBe("active");
    expect(original.retentionMetadata.lifecycleEvents).toHaveLength(0);
    expect(updated.status).toBe("archived");
    expect(updated.retentionMetadata.lifecycleEvents).toEqual([event]);
    expect(updated.retentionMetadata.appliedRetentionPolicyRule?.policyId).toBe("retention_application_evidence_v1");
  });

  it("rejects invalid lifecycle transitions", () => {
    const service = new EvidenceRecordService();
    const archivedRecord: EvidenceRecord = {
      ...evidenceRecordFixtures.applicationEvidence,
      status: "archived",
    };
    const evaluation = service.evaluateRetentionPolicy(archivedRecord, context());

    expect(() =>
      service.createLifecycleTransitionEvent({
        evidenceRecord: archivedRecord,
        newStatus: "active",
        transitionReason: "restore active status",
        evaluation,
      })
    ).toThrow("evidence_lifecycle_transition_invalid");
  });

  it("evaluates archival and deletion eligibility from retention metadata", () => {
    const service = new EvidenceRecordService();
    const record: EvidenceRecord = {
      ...evidenceRecordFixtures.applicationEvidence,
      retentionMetadata: {
        ...evidenceRecordFixtures.applicationEvidence.retentionMetadata,
        eligibleForArchivalAt: "2029-06-04T00:00:00.000Z",
        eligibleForDeletionAt: "2031-06-04T00:00:00.000Z",
      },
    };

    expect(service.isEligibleForArchival(record, new Date("2029-06-03T23:59:59.999Z"))).toBe(false);
    expect(service.isEligibleForArchival(record, new Date("2029-06-04T00:00:00.000Z"))).toBe(true);
    expect(service.isEligibleForDeletion(record, new Date("2031-06-04T00:00:00.000Z"))).toBe(true);
    expect(
      service.isEligibleForDeletion(
        {
          ...record,
          retentionMetadata: {
            ...record.retentionMetadata,
            legalHoldStatus: "active",
          },
        },
        new Date("2031-06-04T00:00:00.000Z")
      )
    ).toBe(false);
  });
});

describe("EvidenceRecordService retention projections", () => {
  it("applies audience-specific allowlists without exposing raw identifiers", () => {
    const service = new EvidenceRecordService();
    const original = withCreatedAt(evidenceRecordFixtures.applicationEvidence, "2026-06-04T00:00:00.000Z");
    const evaluation = service.evaluateRetentionPolicy(original, context({ currentTimestamp: "2030-06-04T00:00:00.000Z" }));
    const event = service.createLifecycleTransitionEvent({
      evidenceRecord: original,
      newStatus: "archived",
      transitionReason: "retention archive eligibility confirmed",
      evaluation,
    });
    const updated = service.appendLifecycleTransitionEvent(original, event, evaluation);

    const tenant = service.getRetentionMetadataProjection(updated, "tenant");
    const landlord = service.getRetentionMetadataProjection(updated, "landlord");
    const admin = service.getRetentionMetadataProjection(updated, "admin");
    const audit = service.getRetentionMetadataProjection(updated, "audit");

    expect(tenant).toEqual({ audience: "tenant", status: "archived", rawIdsIncluded: false });
    expect(serializedProjection(tenant)).not.toContain("retention_application_evidence_v1");
    expect(serializedProjection(landlord)).toContain("eligibleForArchivalAt");
    expect(serializedProjection(landlord)).not.toContain("legalHoldStatus");
    expect(serializedProjection(admin)).toContain("legalHoldStatus");
    expect(serializedProjection(audit)).toContain("auditTrailReference");

    for (const projection of [tenant, landlord, admin, audit]) {
      expect(serializedProjection(projection)).not.toMatch(/landlord-fixture-internal|rental-application-internal-fixture|tenant-id|lease-id|unit-id/i);
      expect(serializedProjection(projection)).not.toMatch(/secret|token|credential|gs:\/\/|storage\.googleapis\.com/i);
    }
  });
});
