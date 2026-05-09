import type { CanonicalEventV1 } from "../events/eventTypes";
import { redactIdentifier } from "../governance/platformGovernance";
import type { SupportInstitutionAccessDiagnosticSummary } from "../../services/tenantPortal/tenantInstitutionAccessService";

type OperatorAuditTimelineSource =
  | "tenant_institution_access"
  | "recipient_review"
  | "recipient_session"
  | "tenant_trust_export"
  | "institutional_trust_export"
  | "operator_interaction";

type OperatorAuditTimelineCategory =
  | "access_grant"
  | "recipient_review"
  | "recipient_session"
  | "trust_export_lifecycle"
  | "institutional_export_lifecycle"
  | "operator_access"
  | "policy_denial";

export type OperatorAuditTimelineEvent = {
  schemaVersion: "operator_audit_timeline_event.v1";
  eventId: string;
  source: OperatorAuditTimelineSource;
  category: OperatorAuditTimelineCategory;
  eventType: string;
  occurredAt: string;
  actorType: "tenant" | "recipient" | "system" | "operator";
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
  events: OperatorAuditTimelineEvent[];
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

function asString(value: unknown, max = 240) {
  const next = String(value ?? "").trim().slice(0, max);
  return next || null;
}

function timestamp(value: unknown) {
  const raw = asString(value, 120);
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stableId(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => asString(part, 160) || "unknown")
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "_");
}

function visibility(): OperatorAuditTimelineEvent["visibility"] {
  return {
    supportVisible: true,
    tenantVisible: false,
    recipientVisible: false,
    portableVisible: false,
    trustPayloadIncluded: false,
    providerPayloadIncluded: false,
    rawIdentityPayloadIncluded: false,
    rawPropertyPayloadIncluded: false,
    supportMetadataIncluded: false,
    downloadEnabled: false,
    publicAccessEnabled: false,
  };
}

function classifyAccessEvent(eventType: string, reason: string | null): OperatorAuditTimelineCategory {
  if (eventType.includes("session")) return "recipient_session";
  if (eventType.includes("recipient_trust_review")) return reason === "policy_gated_summary_unavailable" ? "policy_denial" : "recipient_review";
  return "access_grant";
}

function lifecycleCategory(reason: string | null): OperatorAuditTimelineCategory {
  return reason === "policy_gate_blocked" ? "policy_denial" : "trust_export_lifecycle";
}

function eventFromAccessTimeline(params: {
  grantId: string | null;
  audience: string | null;
  purpose: string | null;
  event: SupportInstitutionAccessDiagnosticSummary["timeline"][number];
}): OperatorAuditTimelineEvent | null {
  const occurredAt = asString(params.event?.occurredAt, 120);
  const eventType = asString(params.event?.eventType, 160);
  if (!occurredAt || !eventType || params.event?.metadataOnly !== true) return null;
  const reason = asString(params.event?.reason, 160);
  return {
    schemaVersion: "operator_audit_timeline_event.v1",
    eventId: stableId(["access", params.grantId, eventType, occurredAt, reason]),
    source: eventType.includes("session") ? "recipient_session" : eventType.includes("recipient_trust_review") ? "recipient_review" : "tenant_institution_access",
    category: classifyAccessEvent(eventType, reason),
    eventType,
    occurredAt,
    actorType: params.event.actorType === "tenant" || params.event.actorType === "system" || params.event.actorType === "recipient" ? params.event.actorType : "system",
    status: asString(params.event?.status, 120),
    outcome: asString(params.event?.outcome, 120),
    reason,
    lifecycleState: asString(params.event?.status, 120),
    audience: params.audience,
    purpose: params.purpose,
    resource: {
      type: "tenant_institution_access_grant",
      id: params.grantId,
      redactedId: redactIdentifier(params.grantId),
    },
    metadataOnly: true,
    visibility: visibility(),
  };
}

function eventFromTrustExport(params: {
  grantId: string | null;
  audience: string | null;
  purpose: string | null;
  exportRecord: any;
  lifecycleEvent: any;
}): OperatorAuditTimelineEvent | null {
  const occurredAt = asString(params.lifecycleEvent?.occurredAt, 120);
  const eventType = asString(params.lifecycleEvent?.eventType, 160);
  if (!occurredAt || !eventType || params.lifecycleEvent?.metadataOnly !== true) return null;
  const exportId = asString(params.exportRecord?.exportId || params.exportRecord?.id, 240);
  const reason = asString(params.lifecycleEvent?.reason, 160);
  return {
    schemaVersion: "operator_audit_timeline_event.v1",
    eventId: stableId(["tenant-trust-export", exportId, eventType, occurredAt, reason]),
    source: "tenant_trust_export",
    category: lifecycleCategory(reason),
    eventType,
    occurredAt,
    actorType: params.lifecycleEvent?.actorType === "tenant" ? "tenant" : "system",
    status: asString(params.exportRecord?.lifecycleControl?.state || params.exportRecord?.lifecycle, 120),
    outcome: asString(params.exportRecord?.lifecycleControl?.active === true ? "active" : "inactive", 80),
    reason,
    lifecycleState: asString(params.exportRecord?.lifecycleControl?.state || params.exportRecord?.lifecycle, 120),
    audience: params.audience,
    purpose: params.purpose,
    resource: {
      type: "tenant_trust_export",
      id: exportId,
      redactedId: redactIdentifier(exportId),
    },
    metadataOnly: true,
    visibility: visibility(),
  };
}

function eventFromInstitutionalPackage(params: {
  grantId: string | null;
  audience: string | null;
  purpose: string | null;
  packageRecord: any;
}): OperatorAuditTimelineEvent | null {
  const control = params.packageRecord?.lifecycleControl;
  const occurredAt = asString(control?.evaluatedAt || params.packageRecord?.generatedAt, 120);
  if (!occurredAt || control?.metadataOnly !== true) return null;
  const packageId = asString(params.packageRecord?.exportId, 240);
  return {
    schemaVersion: "operator_audit_timeline_event.v1",
    eventId: stableId(["institutional-trust-export", params.grantId, packageId, control?.state, occurredAt]),
    source: "institutional_trust_export",
    category: control?.active === true ? "institutional_export_lifecycle" : "policy_denial",
    eventType: "institutional_trust_export_lifecycle_evaluated",
    occurredAt,
    actorType: "system",
    status: asString(params.packageRecord?.status, 120),
    outcome: control?.active === true ? "active" : "blocked",
    reason: Array.isArray(control?.reasons) && control.reasons.length ? asString(control.reasons[0], 160) : null,
    lifecycleState: asString(control?.state, 120),
    audience: params.audience,
    purpose: params.purpose,
    resource: {
      type: "institutional_trust_export_package",
      id: packageId,
      redactedId: redactIdentifier(packageId),
    },
    metadataOnly: true,
    visibility: visibility(),
  };
}

function eventFromCanonicalOperatorEvent(params: {
  grantId: string | null;
  event: CanonicalEventV1;
}): OperatorAuditTimelineEvent | null {
  const action = asString(params.event.action, 160);
  if (!action || !action.includes("institution_access")) return null;
  const occurredAt = asString(params.event.occurredAt || params.event.recordedAt, 120);
  if (!occurredAt) return null;
  return {
    schemaVersion: "operator_audit_timeline_event.v1",
    eventId: stableId(["operator", params.event.id, occurredAt]),
    source: "operator_interaction",
    category: "operator_access",
    eventType: asString(params.event.type, 180) || `system.${action}`,
    occurredAt,
    actorType: "operator",
    status: asString(params.event.status, 120),
    outcome: asString(params.event.status || "completed", 120),
    reason: asString(params.event.metadata?.retentionCategory || "support_diagnostics", 160),
    lifecycleState: null,
    audience: null,
    purpose: null,
    resource: {
      type: asString(params.event.resource?.type, 120) || "tenant_institution_access_grant",
      id: params.grantId,
      redactedId: redactIdentifier(params.grantId),
    },
    operator: {
      redactedOperatorId: redactIdentifier(params.event.actor?.id),
      role: asString(params.event.actor?.role, 80),
    },
    metadataOnly: true,
    visibility: visibility(),
  };
}

function sortEvents(events: OperatorAuditTimelineEvent[]) {
  return [...events].sort((left, right) => {
    const delta = timestamp(right.occurredAt) - timestamp(left.occurredAt);
    if (delta !== 0) return delta;
    return right.eventId.localeCompare(left.eventId);
  });
}

export function buildOperatorAuditTimeline(input: {
  grantId: string;
  grant: any;
  diagnostic: SupportInstitutionAccessDiagnosticSummary | null;
  canonicalEvents?: CanonicalEventV1[];
  tenantTrustExports?: any[];
}): OperatorAuditTimelineSummary {
  const grantId = asString(input.grantId, 240);
  const audience = asString(input.diagnostic?.audience || input.grant?.audience, 120);
  const purpose = asString(input.diagnostic?.purpose || input.grant?.purpose, 120);
  const events: OperatorAuditTimelineEvent[] = [];

  for (const event of input.diagnostic?.timeline || []) {
    const next = eventFromAccessTimeline({ grantId, audience, purpose, event });
    if (next) events.push(next);
  }

  const packageEvent = eventFromInstitutionalPackage({
    grantId,
    audience,
    purpose,
    packageRecord: input.grant?.package,
  });
  if (packageEvent) events.push(packageEvent);

  for (const exportRecord of input.tenantTrustExports || []) {
    for (const lifecycleEvent of Array.isArray(exportRecord?.lifecycleEvents) ? exportRecord.lifecycleEvents : []) {
      const next = eventFromTrustExport({ grantId, audience, purpose, exportRecord, lifecycleEvent });
      if (next) events.push(next);
    }
  }

  for (const event of input.canonicalEvents || []) {
    const next = eventFromCanonicalOperatorEvent({ grantId, event });
    if (next) events.push(next);
  }

  const sorted = sortEvents(events).slice(0, 100);
  return {
    schemaVersion: "operator_audit_timeline.v1",
    metadataOnly: true,
    supportSafe: true,
    eventCount: sorted.length,
    lifecycleTransitionCount: sorted.filter((event) => event.category.includes("lifecycle")).length,
    revocationCount: sorted.filter((event) => event.reason?.includes("revoked") || event.eventType.includes("revoked")).length,
    expirationCount: sorted.filter((event) => event.reason?.includes("expired") || event.eventType.includes("expired")).length,
    supersessionCount: sorted.filter((event) => event.reason?.includes("superseded") || event.eventType.includes("superseded")).length,
    policyDeniedCount: sorted.filter((event) => event.category === "policy_denial" || event.reason?.includes("policy")).length,
    sessionEventCount: sorted.filter((event) => event.category === "recipient_session").length,
    operatorInteractionCount: sorted.filter((event) => event.category === "operator_access").length,
    firstEventAt: sorted.length ? sorted[sorted.length - 1].occurredAt : null,
    lastEventAt: sorted[0]?.occurredAt || null,
    events: sorted,
    payloadSafety: {
      trustPayloadIncluded: false,
      portableAttestationContentsIncluded: false,
      rawProviderPayloadIncluded: false,
      rawIdentityPayloadIncluded: false,
      rawPropertyPayloadIncluded: false,
      supportMetadataIncluded: false,
      downloadableArtifactIncluded: false,
      publicAccessEnabled: false,
    },
  };
}
