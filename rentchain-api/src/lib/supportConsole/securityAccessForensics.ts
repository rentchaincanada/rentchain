import type { SupportInstitutionAccessDiagnosticSummary } from "../../services/tenantPortal/tenantInstitutionAccessService";
import { redactIdentifier } from "../governance/platformGovernance";
import type { OperatorAuditTimelineEvent, OperatorAuditTimelineSummary } from "./operatorAuditTimeline";

type ForensicIncidentType =
  | "repeated_blocked_attempts_observed"
  | "wrong_recipient_attempts_observed"
  | "revoked_access_attempt_observed"
  | "expired_access_attempt_observed"
  | "replay_attempt_observed"
  | "stale_session_attempt_observed"
  | "operator_diagnostic_access_observed";

type ForensicChainType =
  | "recipient_access_chain"
  | "operator_diagnostic_chain"
  | "lifecycle_context_chain";

export type SecurityAccessForensicEvent = {
  schemaVersion: "security_access_forensic_event.v1";
  eventId: string;
  source: "recipient_access_timeline" | "operator_audit_timeline";
  category:
    | "blocked_access"
    | "wrong_recipient"
    | "revoked_access"
    | "expired_access"
    | "replay_blocked"
    | "stale_session"
    | "operator_access"
    | "lifecycle_context";
  eventType: string;
  occurredAt: string;
  actorType: string;
  outcome: string | null;
  reason: string | null;
  lifecycleState: string | null;
  resource: {
    type: string;
    redactedId: string | null;
  };
  requestContext?: {
    ipHashPresent: boolean;
    ipHashValueVisible: false;
    rawIpVisible: false;
    userAgentFamily: string | null;
    rawUserAgentVisible: false;
  };
  metadataOnly: true;
  visibility: SecurityAccessForensicVisibility;
};

export type SecurityAccessForensicIncidentSummary = {
  type: ForensicIncidentType;
  label: string;
  count: number;
  observed: boolean;
  followUpSuggested: boolean;
  lastObservedAt: string | null;
};

export type SecurityAccessForensicChain = {
  type: ForensicChainType;
  label: string;
  eventCount: number;
  lastEventAt: string | null;
  events: SecurityAccessForensicEvent[];
};

export type SecurityAccessForensicVisibility = {
  supportVisible: true;
  operatorVisible: true;
  tenantVisible: false;
  recipientVisible: false;
  institutionVisible: false;
  portableVisible: false;
  publicVisible: false;
  exportable: false;
  downloadable: false;
  trustPayloadIncluded: false;
  providerPayloadIncluded: false;
  rawIdentityPayloadIncluded: false;
  rawPropertyPayloadIncluded: false;
  rawIpIncluded: false;
  fullUserAgentIncluded: false;
  behavioralProfileIncluded: false;
  riskScoreIncluded: false;
};

export type SecurityAccessForensicSummary = {
  schemaVersion: "security_access_forensics.v1";
  internalOnly: true;
  supportSafe: true;
  metadataOnly: true;
  grantId: string;
  incidentCount: number;
  chainEventCount: number;
  incidents: SecurityAccessForensicIncidentSummary[];
  chains: SecurityAccessForensicChain[];
  requestOriginSummary: {
    uniqueIpHashCount: number;
    ipHashValuesVisible: false;
    rawIpVisible: false;
    userAgentFamilies: string[];
    rawUserAgentVisible: false;
  };
  operatorCorrelation: {
    operatorDiagnosticAccessCount: number;
    lastOperatorAccessAt: string | null;
  };
  retention: {
    classification: "security_session_internal";
    nonPortable: true;
    nonExportable: true;
    retentionJobImplemented: false;
    futureEnforcementMission: "feat/security-telemetry-retention-enforcement-v1";
  };
  prohibitedFields: {
    rawTrustPayloads: false;
    rawProviderPayloads: false;
    rawIdentityDocuments: false;
    rawPropertyPayloads: false;
    rawIpAddresses: false;
    fullUserAgents: false;
    preciseGeolocation: false;
    behavioralProfiles: false;
    riskScores: false;
  };
  visibility: SecurityAccessForensicVisibility;
};

function asString(value: unknown, max = 240) {
  const next = String(value ?? "").trim().slice(0, max);
  return next || null;
}

function eventTimestamp(value: { occurredAt?: string | null }) {
  const parsed = Date.parse(asString(value.occurredAt, 120) || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function visibility(): SecurityAccessForensicVisibility {
  return {
    supportVisible: true,
    operatorVisible: true,
    tenantVisible: false,
    recipientVisible: false,
    institutionVisible: false,
    portableVisible: false,
    publicVisible: false,
    exportable: false,
    downloadable: false,
    trustPayloadIncluded: false,
    providerPayloadIncluded: false,
    rawIdentityPayloadIncluded: false,
    rawPropertyPayloadIncluded: false,
    rawIpIncluded: false,
    fullUserAgentIncluded: false,
    behavioralProfileIncluded: false,
    riskScoreIncluded: false,
  };
}

function lastTimestamp(events: Array<{ occurredAt?: string | null }>) {
  const sorted = [...events].filter((event) => asString(event.occurredAt, 120)).sort((a, b) => eventTimestamp(b) - eventTimestamp(a));
  return sorted[0]?.occurredAt || null;
}

function includesAny(value: string | null, needles: string[]) {
  const haystack = String(value || "").toLowerCase();
  return needles.some((needle) => haystack.includes(needle));
}

function classifyAccessEvent(event: SupportInstitutionAccessDiagnosticSummary["timeline"][number]): SecurityAccessForensicEvent["category"] | null {
  const reason = asString(event.reason, 160);
  const eventType = asString(event.eventType, 160);
  const outcome = asString(event.outcome, 120);
  const status = asString(event.status, 120);
  if (includesAny(reason, ["recipient_email_mismatch", "wrong_recipient"])) return "wrong_recipient";
  if (includesAny(reason, ["replay"]) || includesAny(eventType, ["replay"])) return "replay_blocked";
  if (includesAny(reason, ["stale"]) || includesAny(eventType, ["stale"])) return "stale_session";
  if (includesAny(reason, ["revoked"]) || includesAny(eventType, ["revoked"]) || includesAny(status, ["revoked"])) return "revoked_access";
  if (includesAny(reason, ["expired"]) || includesAny(eventType, ["expired"]) || includesAny(status, ["expired"])) return "expired_access";
  if (outcome === "blocked" || includesAny(eventType, ["blocked"])) return "blocked_access";
  return null;
}

function eventFromAccessTimeline(params: {
  grantId: string;
  event: SupportInstitutionAccessDiagnosticSummary["timeline"][number];
}): SecurityAccessForensicEvent | null {
  const category = classifyAccessEvent(params.event);
  const eventType = asString(params.event.eventType, 160);
  const occurredAt = asString(params.event.occurredAt, 120);
  if (!category || !eventType || !occurredAt || params.event.metadataOnly !== true) return null;
  return {
    schemaVersion: "security_access_forensic_event.v1",
    eventId: `recipient:${params.grantId}:${eventType}:${occurredAt}:${asString(params.event.reason, 160) || "none"}`,
    source: "recipient_access_timeline",
    category,
    eventType,
    occurredAt,
    actorType: asString(params.event.actorType, 80) || "system",
    outcome: asString(params.event.outcome, 120),
    reason: asString(params.event.reason, 160),
    lifecycleState: asString(params.event.status, 120),
    resource: {
      type: "tenant_institution_access_grant",
      redactedId: redactIdentifier(params.grantId),
    },
    metadataOnly: true,
    visibility: visibility(),
  };
}

function categoryFromOperatorEvent(event: OperatorAuditTimelineEvent): SecurityAccessForensicEvent["category"] {
  if (event.category === "operator_access") return "operator_access";
  if (includesAny(event.reason, ["revoked"]) || includesAny(event.eventType, ["revoked"])) return "revoked_access";
  if (includesAny(event.reason, ["expired"]) || includesAny(event.eventType, ["expired"])) return "expired_access";
  if (includesAny(event.reason, ["superseded", "policy"]) || event.category === "policy_denial") return "lifecycle_context";
  return "lifecycle_context";
}

function eventFromOperatorTimeline(event: OperatorAuditTimelineEvent): SecurityAccessForensicEvent | null {
  if (event.metadataOnly !== true) return null;
  const eventType = asString(event.eventType, 160);
  const occurredAt = asString(event.occurredAt, 120);
  if (!eventType || !occurredAt) return null;
  const category = categoryFromOperatorEvent(event);
  if (category !== "operator_access" && category !== "revoked_access" && category !== "expired_access" && category !== "lifecycle_context") {
    return null;
  }
  return {
    schemaVersion: "security_access_forensic_event.v1",
    eventId: `operator:${event.eventId}`,
    source: "operator_audit_timeline",
    category,
    eventType,
    occurredAt,
    actorType: event.actorType,
    outcome: event.outcome,
    reason: event.reason,
    lifecycleState: event.lifecycleState || event.status,
    resource: {
      type: event.resource.type,
      redactedId: event.resource.redactedId,
    },
    metadataOnly: true,
    visibility: visibility(),
  };
}

function incident(params: {
  type: ForensicIncidentType;
  label: string;
  count: number;
  events: Array<{ occurredAt?: string | null }>;
  followUpThreshold?: number;
}): SecurityAccessForensicIncidentSummary {
  const threshold = params.followUpThreshold ?? 1;
  return {
    type: params.type,
    label: params.label,
    count: params.count,
    observed: params.count > 0,
    followUpSuggested: params.count >= threshold,
    lastObservedAt: lastTimestamp(params.events),
  };
}

function chain(type: ForensicChainType, label: string, events: SecurityAccessForensicEvent[]): SecurityAccessForensicChain {
  const sorted = [...events].sort((a, b) => eventTimestamp(b) - eventTimestamp(a)).slice(0, 25);
  return {
    type,
    label,
    eventCount: sorted.length,
    lastEventAt: sorted[0]?.occurredAt || null,
    events: sorted,
  };
}

export function buildSecurityAccessForensics(input: {
  grantId: string;
  diagnostic: SupportInstitutionAccessDiagnosticSummary | null;
  operatorAuditTimeline: OperatorAuditTimelineSummary | null;
}): SecurityAccessForensicSummary | null {
  if (!input.diagnostic && !input.operatorAuditTimeline) return null;
  const grantId = asString(input.grantId, 240) || "unknown";
  const telemetry = input.diagnostic?.securityTelemetry;
  const accessEvents = (input.diagnostic?.timeline || [])
    .map((event) => eventFromAccessTimeline({ grantId, event }))
    .filter((event): event is SecurityAccessForensicEvent => Boolean(event));
  const operatorEvents = (input.operatorAuditTimeline?.events || [])
    .map(eventFromOperatorTimeline)
    .filter((event): event is SecurityAccessForensicEvent => Boolean(event));

  const blockedEvents = accessEvents.filter((event) => event.category === "blocked_access" || event.category === "wrong_recipient");
  const wrongRecipientEvents = accessEvents.filter((event) => event.category === "wrong_recipient");
  const revokedEvents = [...accessEvents, ...operatorEvents].filter((event) => event.category === "revoked_access");
  const expiredEvents = [...accessEvents, ...operatorEvents].filter((event) => event.category === "expired_access");
  const replayEvents = accessEvents.filter((event) => event.category === "replay_blocked");
  const staleEvents = accessEvents.filter((event) => event.category === "stale_session");
  const operatorDiagnosticEvents = operatorEvents.filter((event) => event.category === "operator_access");

  const blockedCount = Math.max(telemetry?.blockedAttemptCount || 0, input.diagnostic?.audit.blockedReviewCount || 0, blockedEvents.length);
  const wrongRecipientCount = Math.max(telemetry?.wrongRecipientAttemptCount || 0, wrongRecipientEvents.length);
  const revokedCount = Math.max(telemetry?.revokedAttemptCount || 0, revokedEvents.length);
  const expiredCount = Math.max(telemetry?.expiredAttemptCount || 0, expiredEvents.length);
  const replayCount = Math.max(telemetry?.replayBlockedCount || 0, replayEvents.length);
  const staleCount = Math.max(telemetry?.staleSessionCount || 0, staleEvents.length);
  const operatorDiagnosticCount = Math.max(input.operatorAuditTimeline?.operatorInteractionCount || 0, operatorDiagnosticEvents.length);

  const incidents = [
    incident({
      type: "repeated_blocked_attempts_observed",
      label: "Repeated blocked attempts observed",
      count: blockedCount >= 2 ? blockedCount : 0,
      events: blockedEvents,
      followUpThreshold: 2,
    }),
    incident({
      type: "wrong_recipient_attempts_observed",
      label: "Wrong recipient attempts observed",
      count: wrongRecipientCount,
      events: wrongRecipientEvents,
    }),
    incident({
      type: "revoked_access_attempt_observed",
      label: "Revoked access attempted",
      count: revokedCount,
      events: revokedEvents,
    }),
    incident({
      type: "expired_access_attempt_observed",
      label: "Expired access attempted",
      count: expiredCount,
      events: expiredEvents,
    }),
    incident({
      type: "replay_attempt_observed",
      label: "Replay or stale invite/session attempt observed",
      count: replayCount,
      events: replayEvents,
    }),
    incident({
      type: "stale_session_attempt_observed",
      label: "Stale session attempt observed",
      count: staleCount,
      events: staleEvents,
    }),
    incident({
      type: "operator_diagnostic_access_observed",
      label: "Operator diagnostic access observed",
      count: operatorDiagnosticCount,
      events: operatorDiagnosticEvents,
    }),
  ];

  const chains = [
    chain("recipient_access_chain", "Recipient access chain", accessEvents),
    chain("operator_diagnostic_chain", "Operator diagnostic access chain", operatorDiagnosticEvents),
    chain(
      "lifecycle_context_chain",
      "Lifecycle context chain",
      operatorEvents.filter((event) => event.category !== "operator_access")
    ),
  ];

  return {
    schemaVersion: "security_access_forensics.v1",
    internalOnly: true,
    supportSafe: true,
    metadataOnly: true,
    grantId,
    incidentCount: incidents.filter((item) => item.observed).length,
    chainEventCount: chains.reduce((total, item) => total + item.eventCount, 0),
    incidents,
    chains,
    requestOriginSummary: {
      uniqueIpHashCount: telemetry?.uniqueIpHashCount || 0,
      ipHashValuesVisible: false,
      rawIpVisible: false,
      userAgentFamilies: telemetry?.userAgentFamilies || [],
      rawUserAgentVisible: false,
    },
    operatorCorrelation: {
      operatorDiagnosticAccessCount: operatorDiagnosticCount,
      lastOperatorAccessAt: lastTimestamp(operatorDiagnosticEvents),
    },
    retention: {
      classification: "security_session_internal",
      nonPortable: true,
      nonExportable: true,
      retentionJobImplemented: false,
      futureEnforcementMission: "feat/security-telemetry-retention-enforcement-v1",
    },
    prohibitedFields: {
      rawTrustPayloads: false,
      rawProviderPayloads: false,
      rawIdentityDocuments: false,
      rawPropertyPayloads: false,
      rawIpAddresses: false,
      fullUserAgents: false,
      preciseGeolocation: false,
      behavioralProfiles: false,
      riskScores: false,
    },
    visibility: visibility(),
  };
}
