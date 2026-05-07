import { describe, expect, it } from "vitest";
import { deriveReleaseGovernanceProfile } from "../deriveReleaseGovernanceProfile";

describe("deriveReleaseGovernanceProfile", () => {
  it("derives deterministic release governance with disabled execution flags", () => {
    const profile = deriveReleaseGovernanceProfile({
      releaseVersion: "v1.0.0",
      generatedAt: "2026-01-01T00:00:00.000Z",
      releaseArtifacts: [{ artifactId: "release-notes", status: "verified", path: "docs/releases/v1.0.0.md", secretToken: "raw-secret" }],
      deploymentChecks: [{ checkId: "ci-backend", status: "success" }],
      rollbackArtifacts: [{ artifactId: "rollback-plan", status: "verified" }],
      qaRecords: [{ qaId: "qa-1", status: "passed" }],
      operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "stable" }],
      evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
      operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
      auditEvents: [{ eventId: "event-1", eventType: "release_governance_profile_derived" }],
    });

    expect(profile).toEqual(
      expect.objectContaining({
        releaseGovernanceId: "release_governance:v1.0.0",
        releaseVersion: "v1.0.0",
        status: "ready_for_review",
        manualApprovalRequired: true,
        autonomousDeploymentEnabled: false,
        autonomousRollbackEnabled: false,
        publicLaunchEnabled: false,
      })
    );
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("release_governance_profile_derived");
    expect(JSON.stringify(profile)).not.toContain("secretToken");
    expect(JSON.stringify(profile)).not.toContain("raw-secret");
  });

  it("surfaces blocked restrictions without enabling deployment or rollback", () => {
    const profile = deriveReleaseGovernanceProfile({
      releaseVersion: "v1.0.0",
      releaseArtifacts: [{ artifactId: "release-notes", status: "verified" }],
      deploymentChecks: [{ checkId: "ci-backend", status: "failure" }],
      rollbackArtifacts: [{ artifactId: "rollback-plan", status: "verified" }],
      qaRecords: [{ qaId: "qa-1", status: "failed" }],
      operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "blocked" }],
      evidencePacks: [{ evidencePackId: "evidence-1", status: "blocked" }],
      operatorReviewSessions: [{ reviewSessionId: "review-1", status: "blocked" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.releaseRestrictions.length).toBeGreaterThan(0);
    expect(profile.autonomousDeploymentEnabled).toBe(false);
    expect(profile.autonomousRollbackEnabled).toBe(false);
    expect(profile.publicLaunchEnabled).toBe(false);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("release_governance_blocked");
  });

  it("returns unknown when release governance source context is unavailable", () => {
    const profile = deriveReleaseGovernanceProfile({ releaseVersion: "v1.0.0" });

    expect(profile.status).toBe("unknown");
    expect(profile.manualApprovalRequired).toBe(true);
    expect(profile.autonomousDeploymentEnabled).toBe(false);
    expect(profile.autonomousRollbackEnabled).toBe(false);
    expect(profile.publicLaunchEnabled).toBe(false);
  });
});
