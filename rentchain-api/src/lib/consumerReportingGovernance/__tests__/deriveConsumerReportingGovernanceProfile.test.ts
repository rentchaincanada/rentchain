import { describe, expect, it } from "vitest";
import { deriveConsumerReportingGovernanceProfile } from "../deriveConsumerReportingGovernanceProfile";

const completeInput = {
  generatedAt: "2026-05-07T00:00:00.000Z",
  consentGovernance: [{ consentGovernanceId: "consent-1", status: "ready_for_review" }],
  disputeGovernance: [{ disputeGovernanceId: "dispute-1", status: "ready_for_review" }],
  adverseActionReadiness: [{ adverseActionReadinessId: "adverse-1", status: "ready_for_review" }],
  credentialingReadiness: [{ platformCredentialingId: "credentialing-1", status: "ready_for_review" }],
  operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "stable" }],
  rentalHistoryLineage: [{ rentalHistoryLedgerId: "ledger-1", status: "verified" }],
  evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
  operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
  auditEvents: [{ eventId: "audit-1", eventType: "consumer_reporting_governance_profile_derived" }],
};

describe("deriveConsumerReportingGovernanceProfile", () => {
  it("derives a deterministic ready-for-review profile with execution flags pinned off", () => {
    const profile = deriveConsumerReportingGovernanceProfile(completeInput);
    const repeat = deriveConsumerReportingGovernanceProfile(completeInput);

    expect(profile).toEqual(repeat);
    expect(profile.status).toBe("ready_for_review");
    expect(profile).toEqual(
      expect.objectContaining({
        manualApprovalRequired: true,
        consumerReportingExecutionEnabled: false,
        autonomousReportingEnabled: false,
        publicReportingExposureEnabled: false,
      })
    );
    expect(profile.summary).toEqual(
      expect.objectContaining({
        totalReferences: 9,
        verifiedReferences: 9,
        restrictions: 0,
      })
    );
  });

  it("blocks unresolved consent and dispute restrictions", () => {
    const profile = deriveConsumerReportingGovernanceProfile({
      ...completeInput,
      consentGovernance: [{ consentGovernanceId: "consent-1", status: "blocked" }],
      disputeGovernance: [{ disputeGovernanceId: "dispute-1", status: "blocked" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.reportingRestrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ restrictionType: "consent", status: "blocked" }),
        expect.objectContaining({ restrictionType: "dispute", status: "blocked" }),
      ])
    );
  });

  it("requires review when critical consent, dispute, audit, evidence, or review lineage is missing", () => {
    const profile = deriveConsumerReportingGovernanceProfile({
      ...completeInput,
      consentGovernance: [],
      disputeGovernance: [],
      evidencePacks: [],
      operatorReviewSessions: [],
      auditEvents: [],
    });

    expect(profile.status).toBe("review_required");
    expect(profile.reportingRestrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ restrictionType: "consent", status: "review_required" }),
        expect.objectContaining({ restrictionType: "dispute", status: "review_required" }),
        expect.objectContaining({ restrictionType: "evidence", status: "review_required" }),
        expect.objectContaining({ restrictionType: "review", status: "review_required" }),
        expect.objectContaining({ restrictionType: "audit", status: "review_required" }),
      ])
    );
  });

  it("marks unresolved operational risk as partially ready without autonomous reporting", () => {
    const profile = deriveConsumerReportingGovernanceProfile({
      ...completeInput,
      operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "elevated" }],
    });

    expect(profile.status).toBe("partially_ready");
    expect(profile.reportingRestrictions).toEqual(
      expect.arrayContaining([expect.objectContaining({ restrictionType: "credentialing", status: "blocked" })])
    );
    expect(profile.autonomousReportingEnabled).toBe(false);
  });

  it("returns unknown when there is insufficient source context", () => {
    const profile = deriveConsumerReportingGovernanceProfile({});

    expect(profile.status).toBe("unknown");
    expect(profile.summary.unavailableReferences).toBeGreaterThan(0);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["consumer_reporting_governance_profile_derived", "consumer_reporting_redaction_applied"])
    );
  });

  it("generates canonical events for restriction, review-required, blocked, and redaction paths", () => {
    const blocked = deriveConsumerReportingGovernanceProfile({
      ...completeInput,
      consentGovernance: [{ consentGovernanceId: "consent-1", status: "blocked" }],
    });

    expect(blocked.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "consumer_reporting_governance_profile_derived",
        "consumer_reporting_redaction_applied",
        "consumer_reporting_restriction_detected",
        "consumer_reporting_blocked",
      ])
    );
  });
});
