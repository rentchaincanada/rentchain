import {
  DeriveInstitutionReviewSessionInput,
  InstitutionReviewAudience,
  InstitutionReviewEventType,
  InstitutionReviewLifecycleState,
  InstitutionReviewPurpose,
  InstitutionReviewRecipientRole,
  InstitutionReviewSessionEvent,
  InstitutionReviewSessionSummary,
} from "./institutionReviewSessionTypes";

function asString(value: unknown, max = 240): string | null {
  const next = String(value ?? "").trim().slice(0, max);
  return next || null;
}

function timestamp(value: unknown): number {
  const raw = asString(value, 120);
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nowIso(value: unknown): string {
  const raw = asString(value, 120);
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function stableId(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => asString(part, 160) || "unknown")
    .join(":")
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, "_");
}

function normalizeAudience(value: unknown): InstitutionReviewAudience {
  const raw = asString(value, 80);
  if (
    raw === "insurer" ||
    raw === "lender" ||
    raw === "institutional_landlord" ||
    raw === "subsidy_program" ||
    raw === "government_review" ||
    raw === "advocate_caseworker" ||
    raw === "auditor"
  ) {
    return raw;
  }
  return "insurer";
}

function normalizePurpose(value: unknown, audience: InstitutionReviewAudience): InstitutionReviewPurpose {
  const raw = asString(value, 120);
  if (
    raw === "insurance_review" ||
    raw === "lender_review" ||
    raw === "institutional_landlord_review" ||
    raw === "subsidy_program_review" ||
    raw === "government_housing_review" ||
    raw === "advocate_assisted_review" ||
    raw === "auditor_review"
  ) {
    return raw;
  }
  if (audience === "lender") return "lender_review";
  if (audience === "institutional_landlord") return "institutional_landlord_review";
  if (audience === "subsidy_program") return "subsidy_program_review";
  if (audience === "government_review") return "government_housing_review";
  if (audience === "advocate_caseworker") return "advocate_assisted_review";
  if (audience === "auditor") return "auditor_review";
  return "insurance_review";
}

function roleForAudience(audience: InstitutionReviewAudience): InstitutionReviewRecipientRole {
  if (audience === "lender") return "lender_reviewer";
  if (audience === "institutional_landlord") return "institutional_landlord_reviewer";
  if (audience === "subsidy_program") return "subsidy_program_reviewer";
  if (audience === "government_review") return "government_housing_reviewer";
  if (audience === "advocate_caseworker") return "advocate_caseworker";
  if (audience === "auditor") return "auditor";
  return "insurance_reviewer";
}

function redactEmail(value: unknown) {
  const email = asString(value, 320)?.toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "not available";
  const [local, domain] = email.split("@");
  const visible = local.length <= 2 ? local.slice(0, 1) : `${local.slice(0, 2)}***`;
  return `${visible}@${domain}`;
}

function lifecycleFromGrant(params: {
  grant: any;
  recipientReviewSession: any | null;
  generatedAt: string;
}): InstitutionReviewLifecycleState {
  const grant = params.grant || {};
  const session = params.recipientReviewSession || null;
  const packageState = asString(grant.package?.lifecycleControl?.state, 80);
  const grantLifecycle = asString(grant.lifecycle, 80);
  const expiresAt = timestamp(grant.expiresAt);
  const now = timestamp(params.generatedAt);

  if (grantLifecycle === "archived" || packageState === "archived") return "archived";
  if (grantLifecycle === "superseded" || packageState === "superseded") return "superseded";
  if (grantLifecycle === "revoked" || grant.revokedAt || grant.consent?.revokedAt) return "revoked";
  if (grantLifecycle === "expired" || (expiresAt && expiresAt <= now)) return "expired";
  if (grantLifecycle === "reverification_required" || packageState === "reverification_required") {
    return "reverification_required";
  }
  if (grantLifecycle === "blocked" || packageState === "blocked" || packageState === "invalidated") return "blocked";
  if (session && asString(session.lifecycle, 80) !== "active") return "session_closed";
  if (session && asString(session.lifecycle, 80) === "active") return "active";
  return grantLifecycle === "active" ? "pending" : "blocked";
}

function eventVisibility(): InstitutionReviewSessionEvent["visibility"] {
  return {
    auditSafe: true,
    supportSafe: true,
    trustPayloadIncluded: false,
    providerPayloadIncluded: false,
    internalSupportMetadataIncluded: false,
    publicAccessEnabled: false,
    downloadEnabled: false,
  };
}

function eventFor(params: {
  eventType: InstitutionReviewEventType;
  occurredAt: string;
  actorType: InstitutionReviewSessionEvent["actorType"];
  lifecycleState: InstitutionReviewLifecycleState;
  reason: string;
}): InstitutionReviewSessionEvent {
  return {
    schemaVersion: "institution_review_session_event.v1",
    eventType: params.eventType,
    occurredAt: params.occurredAt,
    actorType: params.actorType,
    lifecycleState: params.lifecycleState,
    reason: params.reason,
    metadataOnly: true,
    visibility: eventVisibility(),
  };
}

function eventTypeForLifecycle(lifecycle: InstitutionReviewLifecycleState): InstitutionReviewEventType | null {
  if (lifecycle === "active") return "institution_review_session_opened";
  if (lifecycle === "session_closed") return "institution_review_session_closed";
  if (lifecycle === "expired") return "institution_review_session_expired";
  if (lifecycle === "revoked") return "institution_review_session_revoked";
  if (lifecycle === "blocked" || lifecycle === "superseded" || lifecycle === "archived") return "institution_review_session_blocked";
  if (lifecycle === "reverification_required") return "institution_review_session_reverification_required";
  return null;
}

function deriveEvents(params: {
  grant: any;
  session: any | null;
  generatedAt: string;
  lifecycle: InstitutionReviewLifecycleState;
}): InstitutionReviewSessionEvent[] {
  const createdAt = nowIso(params.grant?.createdAt || params.grant?.generatedAt || params.generatedAt);
  const events: InstitutionReviewSessionEvent[] = [
    eventFor({
      eventType: "institution_review_session_created",
      occurredAt: createdAt,
      actorType: "tenant",
      lifecycleState: "pending",
      reason: "tenant_mediated_access_grant_created",
    }),
  ];
  const lifecycleEvent = eventTypeForLifecycle(params.lifecycle);
  if (lifecycleEvent) {
    events.push(
      eventFor({
        eventType: lifecycleEvent,
        occurredAt: nowIso(params.session?.lastValidatedAt || params.grant?.updatedAt || params.generatedAt),
        actorType: params.lifecycle === "active" || params.lifecycle === "session_closed" ? "recipient" : "system",
        lifecycleState: params.lifecycle,
        reason: params.lifecycle,
      })
    );
  }
  return events.sort((left, right) => timestamp(right.occurredAt) - timestamp(left.occurredAt));
}

export function deriveInstitutionReviewSession(
  input: DeriveInstitutionReviewSessionInput
): InstitutionReviewSessionSummary {
  const grant = input.accessGrant || {};
  const generatedAt = nowIso(input.generatedAt || grant.updatedAt || grant.generatedAt);
  const audience = normalizeAudience(grant.audience);
  const purpose = normalizePurpose(grant.purpose, audience);
  const recipientRole = roleForAudience(audience);
  const recipientReviewSession = input.recipientReviewSession || null;
  const lifecycle = lifecycleFromGrant({ grant, recipientReviewSession, generatedAt });
  const grantId = asString(grant.grantId, 240) || "unknown";
  const recipientReviewSessionId = asString(recipientReviewSession?.sessionId, 240);
  const trustExport = grant.package || {};
  const lifecycleControl = trustExport.lifecycleControl || {};

  return {
    schemaVersion: "institution_review_session.v1",
    sessionId: stableId(["institution_review_session", grantId, recipientReviewSessionId || "pending"]),
    accessGrantId: grantId,
    recipientReviewSessionId,
    audience,
    purpose,
    recipientRole,
    lifecycle,
    tenantMediated: true,
    consentScoped: true,
    policyGated: true,
    metadataOnly: true,
    viewOnly: true,
    publicAccessEnabled: false,
    publicProfileEnabled: false,
    externalSubmissionEnabled: false,
    providerIntegrationEnabled: false,
    automatedDecisioningEnabled: false,
    downloadEnabled: false,
    accessGrant: {
      grantId,
      lifecycle: asString(grant.lifecycle, 80),
      expiresAt: asString(grant.expiresAt, 120),
      revokedAt: asString(grant.revokedAt || grant.consent?.revokedAt, 120),
    },
    trustExport: {
      exportId: asString(trustExport.exportId, 240),
      lifecycleState: asString(lifecycleControl.state || trustExport.lifecycle, 120),
      status: asString(trustExport.status, 120),
      active: lifecycleControl.active === true,
      shareable: lifecycleControl.shareable === true,
    },
    recipient: {
      role: recipientRole,
      redactedEmail: redactEmail(grant.recipient?.email),
      organizationName: asString(grant.recipient?.organizationName, 160),
      authenticationRequirement: "recipient_email_session_required",
    },
    lifecycleLinkage: {
      grantLifecycleLinked: true,
      trustExportLifecycleLinked: true,
      recipientSessionLinked: Boolean(recipientReviewSessionId),
      revocationPropagates: true,
      expirationPropagates: true,
      reverificationPropagates: true,
    },
    payloadSafety: {
      metadataOnly: true,
      trustPayloadIncluded: false,
      portableAttestationContentsIncluded: false,
      rawProviderPayloadIncluded: false,
      rawIdentityPayloadIncluded: false,
      rawPropertyPayloadIncluded: false,
      supportMetadataIncluded: false,
    },
    events: deriveEvents({ grant, session: recipientReviewSession, generatedAt, lifecycle }),
  };
}
