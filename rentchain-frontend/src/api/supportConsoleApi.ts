import { apiFetch } from "./apiFetch";
import type { SlaEvaluationV1 } from "./adminSlaApi";
import type { TimelineItem } from "./timelineApi";

export type SupportConsoleResourceResponse = {
  resource: {
    type: string;
    id: string;
    title?: string | null;
    subtitle?: string | null;
    status?: string | null;
    parentType?: string | null;
    parentId?: string | null;
  };
  timeline: TimelineItem[];
  insight?: Record<string, unknown> | null;
  policyDecisions: Array<{
    id: string;
    timestamp: string;
    action?: string | null;
    outcome?: string | null;
    reasonCodes?: string[];
    summary?: string | null;
  }>;
  automation: Array<{
    id: string;
    timestamp: string;
    action?: string | null;
    executed: boolean;
    skipped: boolean;
    reason?: string | null;
    summary?: string | null;
  }>;
  reconciliation?: Record<string, unknown> | null;
  sla?: SlaEvaluationV1 | null;
  assignment?: AssignmentRecordV1 | null;
  resolution?: ResolutionRecordV1 | null;
  institutionAccessDiagnostic?: SupportInstitutionAccessDiagnosticSummary | null;
  operatorAuditTimeline?: OperatorAuditTimelineSummary | null;
  watch?: {
    version: "v1";
    id: string;
    target: {
      type: "portfolio" | "application" | "maintenance" | "lease";
      id: string;
      portfolioId?: string | null;
    };
    createdAt: string;
    updatedAt: string;
    createdBy?: string | null;
    notes?: string | null;
    tags?: string[];
    isActive: boolean;
  } | null;
  debug: {
    canonicalEventCount: number;
    domainsPresent: string[];
    identifiers?: Record<string, string | null | undefined>;
  };
};

export type OperatorAuditTimelineSummary = {
  schemaVersion: "operator_audit_timeline.v1";
  metadataOnly: true;
  supportSafe: true;
  eventCount: number;
  lifecycleTransitionCount: number;
  revocationCount: number;
  expirationCount: number;
  supersessionCount: number;
  policyDeniedCount: number;
  sessionEventCount: number;
  operatorInteractionCount: number;
  firstEventAt: string | null;
  lastEventAt: string | null;
  events: Array<{
    schemaVersion: "operator_audit_timeline_event.v1";
    eventId: string;
    source: string;
    category: string;
    eventType: string;
    occurredAt: string;
    actorType: string;
    status: string | null;
    outcome: string | null;
    reason: string | null;
    lifecycleState: string | null;
    audience: string | null;
    purpose: string | null;
    resource: {
      type: string;
      id: string | null;
      redactedId: string | null;
    };
    operator?: {
      redactedOperatorId: string | null;
      role: string | null;
    };
    metadataOnly: true;
    visibility: {
      supportVisible: true;
      tenantVisible: false;
      recipientVisible: false;
      portableVisible: false;
      trustPayloadIncluded: false;
      providerPayloadIncluded: false;
      rawIdentityPayloadIncluded: false;
      rawPropertyPayloadIncluded: false;
      supportMetadataIncluded: false;
      downloadEnabled: false;
      publicAccessEnabled: false;
    };
  }>;
  payloadSafety: {
    trustPayloadIncluded: false;
    portableAttestationContentsIncluded: false;
    rawProviderPayloadIncluded: false;
    rawIdentityPayloadIncluded: false;
    rawPropertyPayloadIncluded: false;
    supportMetadataIncluded: false;
    downloadableArtifactIncluded: false;
    publicAccessEnabled: false;
  };
};

export type SupportInstitutionAccessDiagnosticSummary = {
  schemaVersion: "support_institution_access_diagnostics.v1";
  grantId: string;
  lifecycle: string;
  audience: string;
  purpose: string;
  recipient: {
    redactedEmail: string;
    organizationName: string | null;
    authenticationRequirement: string;
  };
  tenant: {
    redactedTenantId: string | null;
  };
  consent: {
    granted: boolean;
    consentVersion: string;
    grantedAt: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
  };
  access: {
    recipientAuthenticationRequired: true;
    sessionBound: true;
    publicAccessEnabled: false;
    publicProfileEnabled: false;
    externalSubmissionEnabled: false;
    downloadEnabled: false;
  };
  package: {
    status: string;
    blockedReasonCount: number;
    exportSummaryCount: number;
  };
  institutionReviewSession?: {
    schemaVersion: "institution_review_session.v1";
    sessionId: string;
    accessGrantId: string;
    recipientReviewSessionId: string | null;
    audience: string;
    purpose: string;
    recipientRole: string;
    lifecycle: string;
    tenantMediated: true;
    consentScoped: true;
    policyGated: true;
    metadataOnly: true;
    viewOnly: true;
    publicAccessEnabled: false;
    publicProfileEnabled: false;
    externalSubmissionEnabled: false;
    providerIntegrationEnabled: false;
    automatedDecisioningEnabled: false;
    downloadEnabled: false;
  };
  audit: {
    totalEvents: number;
    openedReviewCount: number;
    blockedReviewCount: number;
    revokedAccessCount: number;
    expiredAccessCount: number;
    sessionStartedCount: number;
    sessionExpiredCount: number;
    lastActivityAt: string | null;
    lastOpenedAt: string | null;
    lastBlockedAt: string | null;
    lastOutcome: string | null;
    lastReason: string | null;
    reasonCategories: string[];
  };
  securityTelemetry?: {
    schemaVersion: "support_safe_security_session_telemetry.v1";
    internalOnly: true;
    metadataOnly: true;
    eventCount: number;
    blockedAttemptCount: number;
    wrongRecipientAttemptCount: number;
    revokedAttemptCount: number;
    expiredAttemptCount: number;
    replayBlockedCount: number;
    staleSessionCount: number;
    uniqueIpHashCount: number;
    userAgentFamilies: string[];
    lastSignal: string | null;
    lastRecordedAt: string | null;
    signals: string[];
    retention: {
      classification: string;
      nonPortable: true;
      nonExportable: true;
    };
    redaction: {
      ipAddressMode: string;
      userAgentMode: string;
      rawIpVisible: false;
      rawUserAgentVisible: false;
      preciseGeolocationIncluded: false;
      deviceFingerprintingIncluded: false;
      behavioralProfileIncluded: false;
      riskScoreIncluded: false;
    };
    visibility: {
      supportSafe: true;
      operatorVisible: true;
      tenantVisible: false;
      recipientVisible: false;
      portableVisible: false;
      publicVisible: false;
      trustPayloadIncluded: false;
      providerPayloadIncluded: false;
      rawIdentityPayloadIncluded: false;
      rawPropertyPayloadIncluded: false;
    };
  };
  pilotOperation?: {
    schemaVersion: "pilot_institution_review_operation.v1";
    status: string;
    statusLabel: string;
    escalation: {
      required: boolean;
      reasons: string[];
      primaryReason: string;
    };
    coordination: {
      reviewNeedsFollowUp: boolean;
      nextOperationalAction: string;
      supportOnly: true;
      freeformNotesEnabled: false;
    };
    continuity: {
      grantLifecycle: string;
      inviteStatus: string;
      deliveryStatus: string;
      sessionState: string;
      trustExportLifecycle: string | null;
      revocationVisible: boolean;
      expirationVisible: boolean;
      supersessionVisible: boolean;
      policyDeniedVisible: boolean;
    };
    reporting: {
      openedReviewCount: number;
      blockedReviewCount: number;
      sessionStartedCount: number;
      deliveryAttemptCount: number;
      lastActivityAt: string | null;
    };
    visibility: {
      tenantVisible: true;
      supportSafe: true;
      operatorVisible: true;
      recipientVisible: false;
      portableVisible: false;
      metadataOnly: true;
      trustPayloadIncluded: false;
      providerPayloadIncluded: false;
      supportMetadataIncluded: false;
      publicAccessEnabled: false;
      downloadEnabled: false;
    };
  };
  observability?: {
    schemaVersion: "institution_review_observability.v1";
    operationalHealth: string;
    lifecycleMetrics: {
      pendingReviewCount: number;
      activeReviewCount: number;
      awaitingAuthenticationCount: number;
      openedReviewCount: number;
      blockedReviewCount: number;
      expiredReviewCount: number;
      revokedReviewCount: number;
      supersededReviewCount: number;
      completedReviewCount: number;
    };
    sessionHealth: {
      sessionStartedCount: number;
      sessionExpiredCount: number;
      staleSessionDetected: boolean;
      replayBlockedCount: number;
      reauthenticationRequiredCount: number;
      invalidatedSessionCount: number;
      continuityState: string;
    };
    bottlenecks: {
      awaitingAuthentication: boolean;
      reviewNeverOpened: boolean;
      deliveryNotSent: boolean;
      unresolvedBlockedReview: boolean;
      lifecycleBlocked: boolean;
      policyDenied: boolean;
      staleReview: boolean;
    };
    escalation: {
      followUpRequired: boolean;
      primaryReason: string;
      reasons: string[];
      nextOperationalAction: string;
    };
    conversion: {
      deliveryAttemptCount: number;
      deliverySent: boolean;
      reviewOpened: boolean;
      authenticatedReviewObserved: boolean;
      completionEvidence: string;
    };
    auditAlignment: {
      sourceEventCount: number;
      pilotEventCount: number;
      lastActivityAt: string | null;
      lastObservedReason: string | null;
      metadataOnly: true;
    };
    visibility: {
      supportSafe: true;
      operatorVisible: true;
      tenantVisible: false;
      recipientVisible: false;
      portableVisible: false;
      metadataOnly: true;
      trustPayloadIncluded: false;
      providerPayloadIncluded: false;
      rawIdentityPayloadIncluded: false;
      rawPropertyPayloadIncluded: false;
      supportMetadataIncluded: false;
      publicAccessEnabled: false;
      downloadEnabled: false;
    };
  };
  payloadSafety: {
    metadataOnly: true;
    supportSafe: true;
    trustPayloadIncluded: false;
    portableAttestationContentsIncluded: false;
    rawProviderPayloadIncluded: false;
    rawIdentityPayloadIncluded: false;
    rawPropertyPayloadIncluded: false;
    supportMetadataIncluded: false;
    unsafePortablePayloadDetected: boolean;
  };
  timeline: Array<{
    eventType: string;
    occurredAt: string;
    actorType: string;
    outcome: string;
    status: string;
    reason: string;
    metadataOnly: true;
  }>;
};

export type ResolutionStatus = "open" | "acknowledged" | "in_progress" | "resolved" | "dismissed";

export type AssignmentRecordV1 = {
  version: "v1";
  id: string;
  resource: {
    type: string;
    id: string;
  };
  currentOwner: {
    ownerId?: string | null;
    ownerLabel?: string | null;
  };
  createdAt: string;
  updatedAt: string;
  history: Array<{
    id: string;
    timestamp: string;
    action: "set" | "changed" | "cleared";
    fromOwnerId?: string | null;
    fromOwnerLabel?: string | null;
    toOwnerId?: string | null;
    toOwnerLabel?: string | null;
    authorId?: string | null;
    authorRole?: string | null;
    note?: string | null;
  }>;
  metadata?: Record<string, unknown>;
};

export type ResolutionRecordV1 = {
  version: "v1";
  id: string;
  resource: {
    type: string;
    id: string;
  };
  triage: {
    category?: string | null;
    severity?: string | null;
    reasonCode?: string | null;
  };
  status: ResolutionStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  dismissedAt?: string | null;
  notes: Array<{
    id: string;
    createdAt: string;
    authorId?: string | null;
    authorRole?: string | null;
    message: string;
  }>;
  history: Array<{
    id: string;
    timestamp: string;
    fromStatus?: ResolutionStatus | null;
    toStatus: ResolutionStatus;
    authorId?: string | null;
    authorRole?: string | null;
    reason?: string | null;
  }>;
  metadata?: Record<string, unknown>;
};

export async function fetchSupportConsoleResource(
  resourceType: string,
  resourceId: string
): Promise<SupportConsoleResourceResponse> {
  const search = new URLSearchParams();
  search.set("resourceType", resourceType);
  search.set("resourceId", resourceId);
  return await apiFetch<SupportConsoleResourceResponse>(
    `/admin/support-console/resource?${search.toString()}`
  );
}
