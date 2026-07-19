import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { completeReceivablesSchemaReadinessFixture } from "../__fixtures__/receivablesSchemaReadinessFixtures";
import { classifyReceivablesSchemaReadiness } from "../receivablesSchemaReadinessClassifier";
import type { ClassifyReceivablesSchemaReadinessInput } from "../receivablesSchemaReadinessTypes";

const clone = <T>(value: T): T => structuredClone(value);
const classify = (change?: (input: ClassifyReceivablesSchemaReadinessInput) => void) => {
  const input = clone(completeReceivablesSchemaReadinessFixture);
  change?.(input);
  return classifyReceivablesSchemaReadiness(input);
};

describe("classifyReceivablesSchemaReadiness", () => {
  it("returns ready for complete injected evidence", () => {
    expect(classify()).toEqual({
      ok: true,
      readinessStatus: "ready",
      phase: "phase_0r",
      classifierVersion: "receivables_schema_readiness_classifier_v1",
      reasonCodes: [],
      warnings: [],
      checkedAt: "2026-07-19T12:00:00.000Z",
      requiredNextSteps: [],
    });
  });

  it("fails closed when schema evidence is missing", () => {
    const result = classify((input) => { delete input.schema; });
    expect(result).toMatchObject({ ok: false, readinessStatus: "not_ready" });
    expect(result.reasonCodes).toContain("READINESS_EVIDENCE_MISSING");
  });

  it("fails closed when canonical ownership fields are missing", () => {
    const result = classify((input) => { input.schema!.canonicalOwnershipFieldsPresent = false; });
    expect(result.reasonCodes).toContain("READINESS_SCHEMA_OWNERSHIP_FIELDS_MISSING");
  });

  it("fails closed when index evidence is missing", () => {
    const result = classify((input) => { delete input.indexes; });
    expect(result.reasonCodes).toContain("READINESS_EVIDENCE_MISSING");
  });

  it("returns partial for incomplete index coverage", () => {
    const result = classify((input) => {
      input.indexes!.state = "partial";
      input.indexes!.readyIndexCount = 4;
    });
    expect(result.readinessStatus).toBe("partial");
    expect(result.reasonCodes).toContain("READINESS_INDEX_COVERAGE_INCOMPLETE");
  });

  it("blocks a write-capable identity", () => {
    const result = classify((input) => { input.iam!.writeAccessDenied = false; });
    expect(result).toMatchObject({ ok: false, readinessStatus: "blocked" });
    expect(result.reasonCodes).toContain("READINESS_IAM_WRITE_CAPABLE");
  });

  it("fails closed without completeness proof", () => {
    const result = classify((input) => { input.completeness!.exhaustionProven = false; });
    expect(result.reasonCodes).toContain("READINESS_COMPLETENESS_EXHAUSTION_UNPROVEN");
  });

  it("returns ambiguous when capped-query evidence is ambiguous", () => {
    const result = classify((input) => {
      input.pagination!.state = "ambiguous";
      input.pagination!.ambiguousCapHandling = true;
    });
    expect(result.readinessStatus).toBe("ambiguous");
    expect(result.reasonCodes).toContain("READINESS_PAGINATION_CAP_AMBIGUOUS");
  });

  it("fails closed without unsafe-field exclusion", () => {
    const result = classify((input) => { input.unsafeFieldExclusion!.restrictedFieldsExcluded = false; });
    expect(result.reasonCodes).toContain("READINESS_UNSAFE_FIELD_EXCLUSION_UNPROVEN");
  });

  it("fails closed without rollback and verification evidence", () => {
    const result = classify((input) => {
      input.rollback!.phaseSpecificRollbackDefined = false;
      input.verification!.postChangeVerificationDefined = false;
    });
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "READINESS_ROLLBACK_PLAN_MISSING",
      "READINESS_VERIFICATION_POST_CHANGE_MISSING",
    ]));
  });

  it("fails closed for conflicting evidence", () => {
    const result = classify((input) => { input.schema!.conflictsDetected = true; });
    expect(result.readinessStatus).toBe("ambiguous");
    expect(result.reasonCodes).toContain("READINESS_EVIDENCE_CONFLICT");
  });

  it("blocks unsafe evidence", () => {
    const result = classify((input) => { input.unsafeFieldExclusion!.state = "unsafe"; });
    expect(result.readinessStatus).toBe("blocked");
    expect(result.reasonCodes).toContain("READINESS_EVIDENCE_UNSAFE");
  });

  it("returns sorted deterministic reason codes and next steps", () => {
    const first = classify((input) => {
      input.schema!.canonicalOwnershipFieldsPresent = false;
      input.iam!.dedicatedIdentityPresent = false;
    });
    const second = classify((input) => {
      input.schema!.canonicalOwnershipFieldsPresent = false;
      input.iam!.dedicatedIdentityPresent = false;
    });
    expect(first).toEqual(second);
    expect(first.reasonCodes).toEqual([...first.reasonCodes].sort());
    expect(first.requiredNextSteps).toEqual([...first.requiredNextSteps].sort());
  });

  it("does not mutate injected evidence", () => {
    const input = clone(completeReceivablesSchemaReadinessFixture);
    const before = clone(input);
    classifyReceivablesSchemaReadiness(input);
    expect(input).toEqual(before);
  });

  it("keeps the output non-financial and scope-free", () => {
    const serialized = JSON.stringify(classify()).toLowerCase();
    for (const forbidden of [
      "balance", "amount", "charge", "payment", "allocation", "rent roll", "aging",
      "tenant", "landlord", "leaseid", "propertyid", "firestore", "storage", "bank", "provider",
    ]) expect(serialized).not.toContain(forbidden);
  });

  it("has no Firestore, IAM, infrastructure, route, job, scheduler, provider, or runtime dependency", () => {
    const source = readFileSync(new URL("../receivablesSchemaReadinessClassifier.ts", import.meta.url), "utf8").toLowerCase();
    for (const forbidden of [
      "firebase", "@google-cloud", "firestore", "terraform", "google_project_iam", "express",
      "router", "cron", "scheduler", "pubsub", "rotessa", "stripe", "process.env", "../firebase",
    ]) expect(source).not.toContain(forbidden);
  });
});
