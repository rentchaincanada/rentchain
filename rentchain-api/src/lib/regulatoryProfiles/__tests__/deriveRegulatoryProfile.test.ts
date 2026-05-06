import { describe, expect, it } from "vitest";
import { deriveRegulatoryProfile } from "../deriveRegulatoryProfile";

describe("deriveRegulatoryProfile", () => {
  it("derives deterministic regulatory readiness with required safety flags", () => {
    const profile = deriveRegulatoryProfile({
      landlordId: "landlord-1",
      province: "NS",
      municipality: "Halifax",
      properties: [{ id: "property-1", province: "NS", municipality: "Halifax" }],
      registryStatuses: [{ propertyId: "property-1", status: "verified" }],
      consentRecords: [{ id: "consent-1", tenantId: "tenant-1" }],
      evidencePacks: [{ evidencePackId: "evidence-1" }],
      operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
      settlementReadiness: { status: "ready_for_review", settlementReadinessId: "settlement-1", reviewReferences: [], evidenceReferences: [], blockedReasons: [] } as any,
      auditComplianceReadiness: { status: "ready_for_review", readinessId: "audit-1", checks: [] } as any,
    });

    expect(profile).toEqual(
      expect.objectContaining({
        manualReviewRequired: true,
        legalCertificationEnabled: false,
        externalRegulatorSubmissionEnabled: false,
      })
    );
    expect(profile.jurisdiction).toEqual({ country: "CA", province: "NS", municipality: "Halifax" });
    expect(profile.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["regulatory_profile_derived", "regulatory_redaction_applied"])
    );
  });

  it("blocks when consent lineage is missing", () => {
    const profile = deriveRegulatoryProfile({
      landlordId: "landlord-1",
      properties: [{ id: "property-1" }],
      registryStatuses: [{ propertyId: "property-1", status: "verified" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.blockedReasons.join(" ")).toMatch(/Consent/i);
  });

  it("returns unknown when source context is unavailable", () => {
    const profile = deriveRegulatoryProfile({ landlordId: "landlord-1" });

    expect(profile.status).toBe("unknown");
  });

  it("excludes legal, screening, tenant, and payment payloads", () => {
    const profile = deriveRegulatoryProfile({
      landlordId: "landlord-1",
      properties: [{ id: "property-1", legalOpinion: "sensitive-legal" }],
      screeningOrders: [{ id: "screening-1", rawBureauPayload: "sensitive-bureau" }],
      consentRecords: [{ id: "consent-1" }],
    });

    const serialized = JSON.stringify(profile);
    expect(serialized).not.toContain("sensitive-legal");
    expect(serialized).not.toContain("sensitive-bureau");
    expect(profile.redactions).toEqual(expect.arrayContaining(["Legal opinions and legal advice are excluded."]));
  });
});
