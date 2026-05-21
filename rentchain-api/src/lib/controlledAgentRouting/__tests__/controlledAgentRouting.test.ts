import { describe, expect, it } from "vitest";
import {
  buildControlledRoutingReadinessRef,
  classifyActionRisk,
  classifyAgentReadiness,
  CONTROLLED_AGENT_ROUTING_READINESS_VERSION,
  determineHumanApprovalRequirement,
  normalizeControlledRoutingContext,
} from "../controlledAgentRouting";

describe("controlled agent routing readiness", () => {
  it("classifies action risk and human approval requirements deterministically", () => {
    expect(classifyActionRisk("payment ledger adjustment")).toBe("financial");
    expect(classifyActionRisk("legal notice draft")).toBe("legal_notice");
    expect(classifyActionRisk("institutional export review")).toBe("evidence_export");
    expect(classifyActionRisk("consent renewal")).toBe("consent_sensitive");
    expect(classifyActionRisk("webhookSecret rotation")).toBe("credential_security");
    expect(classifyActionRisk("admin support escalation")).toBe("admin_support");
    expect(classifyActionRisk("route suggestion")).toBe("operational_metadata");
    expect(classifyActionRisk("summary")).toBe("informational");

    expect(determineHumanApprovalRequirement("informational")).toBe("none_for_metadata_only");
    expect(determineHumanApprovalRequirement("operational_metadata")).toBe("review_required");
    expect(determineHumanApprovalRequirement("tenant_visible")).toBe("explicit_approval_required");
    expect(determineHumanApprovalRequirement("financial")).toBe("explicit_approval_required");
    expect(determineHumanApprovalRequirement("credential_security")).toBe("admin_approval_required");
    expect(determineHumanApprovalRequirement("prohibited_autonomous")).toBe("prohibited");
  });

  it("keeps metadata-only summaries non-executable", () => {
    const context = normalizeControlledRoutingContext({
      landlordId: "landlord-1",
      requestedAction: "summarize operational context",
      actionRiskClass: "informational",
      metadataOnly: true,
    });

    expect(context).toMatchObject({
      controlledRoutingVersion: CONTROLLED_AGENT_ROUTING_READINESS_VERSION,
      readinessClass: "summarize_only",
      humanApprovalRequirement: "none_for_metadata_only",
      manualHandoffOnly: true,
      noExecution: true,
      autonomousExecutionEnabled: false,
      externalAiProviderEnabled: false,
    });
  });

  it("allows operational routing suggestions only as manual metadata with scoped refs", () => {
    const context = normalizeControlledRoutingContext({
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      requestedAction: "suggest_route",
      actionRiskClass: "operational_metadata",
      sourceRefs: [
        { sourceCollection: "decisionActions", sourceId: "decision-1", landlordId: "landlord-1", tenantId: "tenant-1" },
        { sourceCollection: "decisionActions", sourceId: "other-tenant", landlordId: "landlord-1", tenantId: "tenant-2" },
        { sourceCollection: "decisionActions", sourceId: "other-landlord", landlordId: "landlord-2", tenantId: "tenant-1" },
      ],
    });

    expect(context.readinessClass).toBe("suggest_route");
    expect(context.humanApprovalRequirement).toBe("review_required");
    expect(context.autoRouteEnabled).toBe(false);
    expect(context.sourceRefs).toHaveLength(1);
    expect(JSON.stringify(context)).not.toContain("other-tenant");
    expect(JSON.stringify(context)).not.toContain("other-landlord");
  });

  it("requires human approval for financial, legal, evidence/export, and consent-sensitive drafts", () => {
    for (const actionRiskClass of ["financial", "legal_notice", "evidence_export", "consent_sensitive"] as const) {
      const context = normalizeControlledRoutingContext({
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        requestedAction: `${actionRiskClass}_draft`,
        actionRiskClass,
        explicitHumanApprovalAvailable: true,
        sourceRefs: [{ sourceCollection: "operatorReviewSessions", sourceId: actionRiskClass, landlordId: "landlord-1", tenantId: "tenant-1" }],
      });

      expect(context.readinessClass).toBe("prepare_draft");
      expect(context.humanApprovalRequirement).toBe("explicit_approval_required");
      expect(context.autonomousExecutionEnabled).toBe(false);
      expect(context.autoApprovalEnabled).toBe(false);
      expect(context.financialMutationEnabled).toBe(false);
    }
  });

  it("blocks autonomous execution requests and admin/security-sensitive internals", () => {
    expect(
      classifyAgentReadiness({
        actionRiskClass: "operational_metadata",
        metadataOnly: true,
        requestedAutonomousExecution: true,
      }),
    ).toBe("blocked");

    const credentialContext = normalizeControlledRoutingContext({
      landlordId: "landlord-1",
      requestedAction: "rotate token",
      actionRiskClass: "credential_security",
      sourceRefs: [
        {
          sourceCollection: "securityIncidents",
          sourceId: "incident-1",
          landlordId: "landlord-1",
          rawProviderPayload: { token: "secret-token" },
          debugPayload: "stack trace",
        },
      ],
    });

    expect(credentialContext.readinessClass).toBe("requires_human_approval");
    expect(credentialContext.humanApprovalRequirement).toBe("admin_approval_required");
    expect(credentialContext.blockedReasons).toContain("credential_security_requires_admin_review");
    expect(credentialContext.tenantVisibleAgentInternals).toBe(false);
    expect(JSON.stringify(credentialContext)).not.toContain("secret-token");
    expect(JSON.stringify(credentialContext)).not.toContain("stack trace");
  });

  it("builds readiness source refs as internal references only", () => {
    expect(
      buildControlledRoutingReadinessRef({
        sourceCollection: "operatorReviewSessions",
        sourceId: "review-1",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
      }),
    ).toEqual({
      sourceCollection: "operatorReviewSessions",
      sourceId: "review-1",
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      internalReference: true,
      tenantVisible: false,
    });
  });
});
