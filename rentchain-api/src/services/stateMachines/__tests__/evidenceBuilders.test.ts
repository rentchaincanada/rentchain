import { describe, expect, it } from "vitest";
import {
  buildDecisionEvidence,
  buildLeaseEvidence,
  buildMaintenanceEvidence,
  buildPaymentEvidence,
  buildScreeningEvidence,
} from "../evidenceBuilders";

describe("workflow evidence builders", () => {
  it("builds screening evidence without raw identifiers", () => {
    const refs = buildScreeningEvidence({
      application: { id: "application-raw-id" },
      order: { id: "order-raw-id" },
      result: { id: "result-raw-id" },
    });
    expect(refs.map((ref) => ref.referenceType)).toEqual(["application", "order", "result"]);
    expect(JSON.stringify(refs)).not.toContain("application-raw-id");
  });

  it("builds lease evidence with notice context", () => {
    const refs = buildLeaseEvidence({ lease: { id: "lease-raw-id", latestNoticeId: "notice-raw-id" } });
    expect(refs.map((ref) => ref.referenceType)).toEqual(["lease", "notice"]);
    expect(refs.every((ref) => ref.metadataOnly && !ref.rawIdsIncluded)).toBe(true);
  });

  it("builds maintenance evidence for work order, cost, and completion evidence", () => {
    const refs = buildMaintenanceEvidence({
      workOrder: { id: "work-order-raw-id" },
      context: {
        actorRole: "landlord",
        authorized: true,
        workOrderId: "work-order-raw-id",
        costTotalCents: 12000,
        evidenceCount: 2,
      },
    });
    expect(refs.map((ref) => ref.referenceType)).toEqual(["work_order", "cost", "attachment"]);
  });

  it("builds payment evidence with provider status as metadata-only reference", () => {
    const refs = buildPaymentEvidence({
      payment: { id: "payment-raw-id" },
      context: {
        actorRole: "landlord",
        authorized: true,
        paymentId: "payment-raw-id",
        paymentIntentId: "intent-raw-id",
        providerStatus: "confirmed",
      },
    });
    expect(refs.map((ref) => ref.referenceType)).toEqual(["payment", "provider_status"]);
    expect(JSON.stringify(refs)).not.toContain("intent-raw-id");
  });

  it("builds decision evidence for source and action records", () => {
    const refs = buildDecisionEvidence({
      context: {
        actorRole: "landlord",
        authorized: true,
        decisionId: "decision-raw-id",
        actionRecordExists: true,
        sourceValid: true,
      },
    });
    expect(refs.map((ref) => ref.referenceType)).toEqual(["decision", "action", "source"]);
    expect(JSON.stringify(refs)).not.toContain("decision-raw-id");
  });
});
