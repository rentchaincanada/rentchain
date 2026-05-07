import { describe, expect, it } from "vitest";
import { deriveObservabilityIncidentReadinessProfile } from "../deriveObservabilityIncidentReadinessProfile";

const completeInput = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  observabilityEvents: [{ id: "obs-1", eventType: "workflow_completed", workflow: "payment", severity: "info", status: "resolved" }],
  statusIncidents: [{ id: "incident-1", status: "resolved", severity: "minor" }],
  recoveryReadiness: [{ recoveryReadinessId: "recovery-1", status: "ready_for_review" }],
  escalationReadiness: [{ escalationReadinessId: "escalation-1", status: "ready_for_review" }],
  postIncidentReviews: [{ postIncidentReviewId: "post-incident-1", status: "ready_for_review" }],
  slaEvaluations: [{ slaId: "sla-1", status: "verified", stage: "fresh" }],
  adminAlerts: [{ alertId: "alert-1", severity: "low", status: "verified" }],
  releaseGovernanceProfiles: [{ releaseGovernanceId: "release-1", status: "ready_for_review" }],
  publicExposureHardeningProfiles: [{ publicExposureHardeningId: "public-exposure-1", status: "ready_for_review" }],
  evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
  operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
  auditEvents: [{ eventId: "event-1", eventType: "public_exposure_hardening_profile_derived" }],
};

describe("deriveObservabilityIncidentReadinessProfile", () => {
  it("derives deterministic ready-for-review readiness with fixed non-execution flags", () => {
    const profile = deriveObservabilityIncidentReadinessProfile(completeInput);

    expect(profile).toEqual(
      expect.objectContaining({
        status: "ready_for_review",
        manualReviewRequired: true,
        externalMonitoringIntegrationEnabled: false,
        autonomousRemediationEnabled: false,
        alertSendingEnabled: false,
        productionMutationEnabled: false,
        sensitiveTelemetryExposed: false,
      })
    );
    expect(profile.summary.totalReferences).toBe(13);
    expect(profile.summary.verifiedReferences).toBe(13);
    expect(profile.observabilityIncidentRestrictions).toEqual([]);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("observability_incident_readiness_profile_derived");
  });

  it("blocks readiness for open critical observability, incident, or alert restrictions", () => {
    const profile = deriveObservabilityIncidentReadinessProfile({
      ...completeInput,
      observabilityEvents: [{ id: "obs-1", eventType: "action_failed", workflow: "payment", severity: "critical", status: "open" }],
      statusIncidents: [{ id: "incident-1", status: "investigating", severity: "critical" }],
      adminAlerts: [{ alertId: "alert-1", severity: "critical", status: "open" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.observabilityIncidentRestrictions.map((restriction) => restriction.status)).toContain("blocked");
    expect(profile.blockedReasons).toEqual(
      expect.arrayContaining([
        "Open critical observability event requires incident readiness review.",
        "Active major or critical incident blocks readiness.",
        "Unresolved outage lineage blocks incident readiness.",
        "Critical admin alert requires manual incident readiness review.",
      ])
    );
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("observability_incident_blocked");
  });

  it("requires review when critical readiness lineage is missing", () => {
    const profile = deriveObservabilityIncidentReadinessProfile({
      ...completeInput,
      observabilityEvents: [],
      slaEvaluations: [],
      auditEvents: [],
    });

    expect(profile.status).toBe("review_required");
    expect(profile.summary.unavailableReferences).toBe(3);
    expect(profile.observabilityIncidentRestrictions.map((restriction) => restriction.restrictionType)).toEqual(
      expect.arrayContaining(["observability", "sla", "audit"])
    );
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("observability_incident_review_required");
  });

  it("keeps partial readiness for overdue SLA or high alert visibility without executing remediation", () => {
    const profile = deriveObservabilityIncidentReadinessProfile({
      ...completeInput,
      slaEvaluations: [{ slaId: "sla-1", stage: "overdue" }],
      adminAlerts: [{ alertId: "alert-1", severity: "high" }],
    });

    expect(profile.status).toBe("partially_ready");
    expect(profile.manualReviewRequired).toBe(true);
    expect(profile.autonomousRemediationEnabled).toBe(false);
    expect(profile.alertSendingEnabled).toBe(false);
    expect(profile.productionMutationEnabled).toBe(false);
  });

  it("returns unknown when no source context is available", () => {
    const profile = deriveObservabilityIncidentReadinessProfile({});

    expect(profile.status).toBe("unknown");
    expect(profile.summary.unavailableReferences).toBeGreaterThan(0);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("observability_incident_redaction_applied");
  });
});
