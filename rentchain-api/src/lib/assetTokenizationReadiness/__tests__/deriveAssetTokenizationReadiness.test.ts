import { describe, expect, it } from "vitest";
import { deriveAssetTokenizationReadiness } from "../deriveAssetTokenizationReadiness";

describe("deriveAssetTokenizationReadiness", () => {
  it("derives deterministic readiness with required disabled execution flags", () => {
    const readiness = deriveAssetTokenizationReadiness({
      landlordId: "landlord-1",
      propertyId: "property-1",
      properties: [{ id: "property-1" }],
      leases: [{ id: "lease-1", propertyId: "property-1", startDate: "2026-01-01" }],
      obligationRows: [{ rowId: "row-1", leaseId: "lease-1", obligationStatus: "paid" }],
      evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
      operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
      settlementReadiness: {
        settlementReadinessId: "settlement-1",
        status: "ready_for_review",
        reviewReferences: [],
        evidenceReferences: [],
      } as any,
      regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "ready_for_review" } as any],
    });

    expect(readiness.assetReadinessId).toBe("asset_tokenization_readiness:landlord-1:property:property-1");
    expect(readiness.manualReviewRequired).toBe(true);
    expect(readiness.tokenIssuanceEnabled).toBe(false);
    expect(readiness.blockchainIntegrationEnabled).toBe(false);
    expect(readiness.publicMarketplaceEnabled).toBe(false);
    expect(readiness.status).toBe("partially_ready");
    expect(readiness.canonicalEvents.map((event) => event.eventType)).toContain("asset_tokenization_readiness_derived");
    expect(readiness.canonicalEvents.map((event) => event.eventType)).toContain("asset_tokenization_redaction_applied");
  });

  it("blocks when settlement or regulatory lineage is missing", () => {
    const readiness = deriveAssetTokenizationReadiness({
      landlordId: "landlord-1",
      properties: [{ id: "property-1" }],
      leases: [{ id: "lease-1", propertyId: "property-1" }],
      obligationRows: [{ rowId: "row-1", leaseId: "lease-1", obligationStatus: "paid" }],
    });

    expect(readiness.status).toBe("blocked");
    expect(readiness.blockedReasons).toContain("Settlement readiness lineage is missing.");
    expect(readiness.blockedReasons).toContain("Regulatory profile lineage is missing.");
    expect(readiness.canonicalEvents.map((event) => event.eventType)).toContain("asset_tokenization_blocked");
    expect(readiness.canonicalEvents.map((event) => event.eventType)).toContain("asset_tokenization_restriction_detected");
  });

  it("returns unknown when source context is unavailable", () => {
    const readiness = deriveAssetTokenizationReadiness({ landlordId: "landlord-1" });

    expect(readiness.status).toBe("unknown");
    expect(readiness.summary.unavailableReferences).toBeGreaterThan(0);
  });

  it("keeps sensitive token, blockchain, investor, and financial payloads out of the read model", () => {
    const readiness = deriveAssetTokenizationReadiness({
      landlordId: "landlord-1",
      properties: [{ id: "property-1", walletAddress: "0xabc", bankAccountNumber: "123" }],
      settlementReadiness: { settlementReadinessId: "settlement-1", status: "blocked", reviewReferences: [], evidenceReferences: [] } as any,
      regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "blocked" } as any],
    });
    const serialized = JSON.stringify(readiness);

    expect(serialized).not.toContain("0xabc");
    expect(serialized).not.toContain("123");
    expect(readiness.redactions.join(" ")).toContain("Blockchain addresses");
    expect(readiness.redactions.join(" ")).toContain("Investor data");
  });
});
