import type {
  CanonicalReviewTimeline,
  DeriveCanonicalReviewTimelineInput,
  ReviewTimelineActor,
  ReviewTimelineEntry,
  ReviewTimelineEntryStatus,
  ReviewTimelineEntryType,
  ReviewTimelineScope,
  ReviewTimelineSource,
} from "./reviewTimelineTypes";

const KNOWN_ENTRY_TYPES: ReviewTimelineEntryType[] = [
  "canonical_event",
  "decision",
  "workflow_transition",
  "operator_review",
  "evidence_reference",
  "export_preview",
  "readiness_check",
  "delinquency_review",
  "maintenance_review",
  "redaction_note",
  "recovery_action",
];
const KNOWN_STATUSES: ReviewTimelineEntryStatus[] = ["info", "review_required", "blocked", "completed", "redacted"];
const KNOWN_SOURCES: ReviewTimelineSource[] = [
  "canonical_events",
  "decision_inbox",
  "workflow_routing",
  "operator_reviews",
  "evidence_packs",
  "institution_exports",
  "audit_compliance",
  "operator_recovery",
  "unknown",
];

function asString(value: unknown, max = 1000): string {
  return String(value ?? "").trim().slice(0, max);
}

function cleanId(value: unknown): string {
  return asString(value, 800)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toIso(value: unknown, fallback: string): string {
  const raw = asString(value, 120);
  const parsed = raw ? new Date(raw) : new Date(fallback);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function generatedAt(input: DeriveCanonicalReviewTimelineInput): string {
  return toIso(input.generatedAt, new Date().toISOString());
}

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function canonicalEventLabel(event: Record<string, any>): string {
  const raw = asString(event.type || event.action, 160);
  if (raw === "renewal_notice_draft_saved" || raw === "lease.renewal_notice_draft_saved") {
    return "Renewal notice draft saved";
  }
  if (raw === "renewal_notice_send_confirmed" || raw === "lease.renewal_notice_send_confirmed") {
    return "Renewal tenant communication send confirmed";
  }
  if (raw === "renewal_notice_email_send_attempted" || raw === "lease.renewal_notice_email_send_attempted") {
    return "Renewal tenant communication send attempted";
  }
  if (raw === "renewal_notice_email_sent" || raw === "lease.renewal_notice_email_sent") {
    return "Renewal tenant communication email sent";
  }
  if (raw === "renewal_notice_email_failed" || raw === "lease.renewal_notice_email_failed") {
    return "Renewal tenant communication email failed";
  }
  if (raw === "renewal_notice_delivery_status_updated" || raw === "lease.renewal_notice_delivery_status_updated") {
    return "Renewal tenant communication delivery status updated";
  }
  return raw || "Canonical event";
}

function isRenewalNoticeCommunicationEvent(event: Record<string, any>): boolean {
  const raw = asString(event.type || event.action, 160);
  return (
    raw === "renewal_notice_send_confirmed" ||
    raw === "lease.renewal_notice_send_confirmed" ||
    raw === "renewal_notice_email_send_attempted" ||
    raw === "lease.renewal_notice_email_send_attempted" ||
    raw === "renewal_notice_email_sent" ||
    raw === "lease.renewal_notice_email_sent" ||
    raw === "renewal_notice_email_failed" ||
    raw === "lease.renewal_notice_email_failed" ||
    raw === "renewal_notice_delivery_status_updated" ||
    raw === "lease.renewal_notice_delivery_status_updated"
  );
}

function formatTimelineTimestamp(value: unknown): string {
  const iso = toIso(value, "");
  if (!iso) return "time unavailable";
  return iso.replace("T", " ").slice(0, 16) + " UTC";
}

function renewalNoticeCommunicationStatusText(event: Record<string, any>): string {
  const raw = asString(event.type || event.action, 160);
  if (raw === "renewal_notice_email_sent" || raw === "lease.renewal_notice_email_sent") return "email sent";
  if (raw === "renewal_notice_email_failed" || raw === "lease.renewal_notice_email_failed") return "email failed";
  if (raw === "renewal_notice_delivery_status_updated" || raw === "lease.renewal_notice_delivery_status_updated") {
    return "delivery status updated";
  }
  if (raw === "renewal_notice_email_send_attempted" || raw === "lease.renewal_notice_email_send_attempted") return "send attempted";
  if (raw === "renewal_notice_send_confirmed" || raw === "lease.renewal_notice_send_confirmed") return "send confirmed internally";
  return "communication recorded";
}

function renewalNoticeCommunicationRecordFor(
  event: Record<string, any>,
  records: Record<string, any>[] | null | undefined
): Record<string, any> | null {
  const metadata = { ...(event.payload || {}), ...(event.metadata || {}) };
  const communicationId = asString(metadata.communicationId || event.communicationId, 240);
  if (!communicationId) return null;
  return (records || []).find((record) => asString(record.communicationId || record.id, 240) === communicationId) || null;
}

function renewalNoticeCommunicationDeliveryLabel(value: unknown): string {
  const raw = asString(value, 120);
  if (!raw || raw === "delivery_status_unknown" || raw === "not_tracked") return "Not tracked yet";
  if (raw === "accepted_for_sending") return "Accepted for sending";
  if (raw === "queued") return "Queued by email provider";
  if (raw === "sent") return "Sent by email provider";
  if (raw === "delivered") return "Delivered by email provider";
  if (raw === "bounced") return "Bounce detected by email provider";
  if (raw === "failed") return "Failed by email provider";
  if (raw === "deferred") return "Temporary delivery issue detected by email provider";
  if (raw === "rejected") return "Rejected by email provider";
  if (raw === "complained") return "Complaint reported by email provider";
  if (raw === "opened") return "Open event recorded by provider";
  if (raw === "clicked") return "Click event recorded by provider";
  if (raw === "unknown") return "Unknown";
  return raw.replace(/_/g, " ");
}

function renewalNoticeCommunicationTimelineDescriptionForInput(
  event: Record<string, any>,
  input: DeriveCanonicalReviewTimelineInput
): string | null {
  if (!isRenewalNoticeCommunicationEvent(event)) return null;
  const metadata = { ...(event.payload || {}), ...(event.metadata || {}) };
  const record = renewalNoticeCommunicationRecordFor(event, input.renewalNoticeCommunications);
  const communicationId = asString(metadata.communicationId || event.communicationId || record?.communicationId || record?.id, 240);
  const deliveryStatus = renewalNoticeCommunicationDeliveryLabel(
    metadata.deliveryStatus || event.deliveryStatus || record?.deliveryStatus
  );
  const occurredAt = formatTimelineTimestamp(event.occurredAt || event.recordedAt || event.createdAt || record?.sentAt || record?.attemptedAt);
  const status = renewalNoticeCommunicationStatusText(event);
  const parts = [
    `Renewal tenant communication ${status} at ${occurredAt}.`,
    communicationId ? `Communication ID: ${communicationId}.` : "",
    `Status: ${status}.`,
  ];
  const recipientEmail = asString(record?.recipientEmail, 320);
  const snapshotId = asString(metadata.snapshotId || record?.snapshotId, 240);
  const approvalDecisionItemId = asString(metadata.approvalDecisionItemId || record?.approvalDecisionItemId, 240);
  if (recipientEmail) parts.push(`Recipient email: ${recipientEmail}.`);
  parts.push(`Delivery confirmation: ${deliveryStatus}.`);
  if (snapshotId) parts.push(`Draft snapshot ID: ${snapshotId}.`);
  if (approvalDecisionItemId) parts.push(`Approval decision ID: ${approvalDecisionItemId}.`);
  if (record?.confirmation) parts.push("Confirmation/audit status: send confirmations captured.");
  parts.push("Not served; legal service not established.");
  parts.push("Legal compliance not determined by this workflow.");
  return parts.filter(Boolean).join(" ");
}

function normalizeActor(raw: any): ReviewTimelineActor {
  const type = asString(raw?.type || raw?.role, 80).toLowerCase();
  return {
    type: type === "admin" || type === "operator" || type === "landlord" ? type : "system",
    id: asString(raw?.id || raw?.userId, 240) || null,
  };
}

function entry(input: Omit<ReviewTimelineEntry, "timelineEntryId" | "manualOnly"> & { key: string }): ReviewTimelineEntry {
  const timestamp = toIso(input.timestamp, new Date(0).toISOString());
  const sourceId = asString(input.sourceId, 500) || null;
  const id =
    cleanId(["review_timeline", input.source, input.entryType, sourceId || input.key, timestamp].join(":")) ||
    "review_timeline:unknown";
  return {
    timelineEntryId: id,
    entryType: input.entryType,
    timestamp,
    label: asString(input.label, 180) || label(input.entryType),
    description: asString(input.description, 1200) || "Timeline context is available for manual review.",
    status: input.status,
    actor: input.actor || { type: "system", id: null },
    source: input.source,
    sourceId,
    destination: asString(input.destination, 500) || null,
    redacted: input.redacted === true,
    redactionReason: asString(input.redactionReason, 500) || null,
    blockedReason: asString(input.blockedReason, 500) || null,
    manualOnly: true,
  };
}

function isRelated(record: Record<string, any>, scope: ReviewTimelineScope, scopeId: string): boolean {
  const id = asString(scopeId, 500);
  if (!id) return false;
  if (scope === "decision" || scope === "workflow" || scope === "delinquency") {
    return [record.id, record.decisionId, record.scopeId, record.sourceId, record.resource?.id, record.resource?.parentId]
      .map((value) => asString(value, 500))
      .includes(id);
  }
  if (scope === "operator_review") {
    return asString(record.reviewSessionId || record.id, 500) === id || asString(record.resource?.id, 500) === id;
  }
  if (scope === "evidence_pack") return asString(record.evidencePackId || record.id, 500) === id;
  if (scope === "institution_export") return asString(record.packageId || record.scopeId || record.resource?.id, 500) === id;
  if (scope === "audit_compliance") return asString(record.readinessId || record.scopeId || record.resource?.id, 500) === id;
  if (scope === "lease") return asString(record.leaseId || record.id || record.relatedEntity?.id || record.resource?.id, 500) === id;
  if (scope === "property") return asString(record.propertyId || record.id || record.relatedEntity?.id || record.resource?.id, 500) === id;
  if (scope === "maintenance") return asString(record.maintenanceRequestId || record.workOrderId || record.id || record.relatedEntity?.id, 500) === id;
  return false;
}

function decisionEntries(input: DeriveCanonicalReviewTimelineInput, fallbackTime: string): ReviewTimelineEntry[] {
  return (input.decisions || [])
    .filter((decision) => isRelated(decision, input.scope, input.scopeId))
    .flatMap((decision) => {
      const at = decision.updatedAt || decision.createdAt || fallbackTime;
      const decisionId = asString(decision.id || decision.decisionId, 500);
      return [
        entry({
          key: decisionId || "decision",
          entryType: decision.workflow?.queue === "delinquency_review" ? "delinquency_review" : "decision",
          timestamp: at,
          label: decision.title || "Decision surfaced",
          description: decision.description || "Decision is available for review.",
          status: decision.status === "blocked" ? "blocked" : decision.status === "resolved" ? "completed" : "review_required",
          actor: { type: "system", id: null },
          source: "decision_inbox",
          sourceId: decisionId,
          destination: decision.destination || null,
          redacted: false,
          redactionReason: null,
          blockedReason: decision.status === "blocked" ? "Decision is currently blocked." : null,
        }),
        entry({
          key: `${decisionId}:workflow`,
          entryType: "workflow_transition",
          timestamp: at,
          label: "Workflow routed",
          description: `Queue ${decision.workflow?.queue || "general_review"}; state ${decision.workflow?.workflowState || "new"}; escalation ${decision.workflow?.escalationLevel || "none"}.`,
          status: decision.workflow?.workflowState === "resolved" ? "completed" : decision.workflow?.escalationLevel === "critical" ? "blocked" : "info",
          actor: { type: "system", id: null },
          source: "workflow_routing",
          sourceId: decisionId,
          destination: decision.destination || null,
          redacted: false,
          redactionReason: null,
          blockedReason: null,
        }),
      ];
    });
}

function operatorReviewEntries(input: DeriveCanonicalReviewTimelineInput): ReviewTimelineEntry[] {
  return (input.operatorReviewSessions || [])
    .filter((session) => isRelated(session, input.scope, input.scopeId) || asString(session.scopeId, 500) === input.scopeId)
    .flatMap((session) => {
      const id = asString(session.reviewSessionId || session.id, 500);
      const entries: ReviewTimelineEntry[] = [
        entry({
          key: `${id}:opened`,
          entryType: "operator_review",
          timestamp: session.openedAt,
          label: "Review session opened",
          description: `Manual operator review opened for ${session.scope || "scope"}.`,
          status: "review_required",
          actor: normalizeActor(session.openedBy),
          source: "operator_reviews",
          sourceId: id,
          destination: null,
          redacted: false,
          redactionReason: null,
          blockedReason: null,
        }),
      ];
      for (const note of session.notes || []) {
        entries.push(
          entry({
            key: `${id}:${note.noteId || note.createdAt}`,
            entryType: "operator_review",
            timestamp: note.createdAt,
            label: "Review note added",
            description: asString(note.text, 400) || "Review note recorded.",
            status: "info",
            actor: normalizeActor(note.actor),
            source: "operator_reviews",
            sourceId: id,
            destination: null,
            redacted: false,
            redactionReason: null,
            blockedReason: null,
          })
        );
      }
      if (session.outcome) {
        entries.push(
          entry({
            key: `${id}:outcome`,
            entryType: "operator_review",
            timestamp: session.outcome.recordedAt || session.closedAt || session.updatedAt,
            label: "Review outcome recorded",
            description: session.outcome.summary || `Outcome ${session.outcome.result}.`,
            status: session.outcome.result === "blocked" ? "blocked" : "completed",
            actor: normalizeActor(session.outcome.recordedBy),
            source: "operator_reviews",
            sourceId: id,
            destination: null,
            redacted: false,
            redactionReason: null,
            blockedReason: session.outcome.result === "blocked" ? session.outcome.summary || "Review outcome is blocked." : null,
          })
        );
      }
      if (session.closedAt) {
        entries.push(
          entry({
            key: `${id}:closed`,
            entryType: "operator_review",
            timestamp: session.closedAt,
            label: "Review session closed",
            description: `Review session closed with ${session.status || "completed"} status.`,
            status: session.status === "completed" ? "completed" : "review_required",
            actor: normalizeActor(session.outcome?.recordedBy || session.openedBy),
            source: "operator_reviews",
            sourceId: id,
            destination: null,
            redacted: false,
            redactionReason: null,
            blockedReason: null,
          })
        );
      }
      return entries;
    });
}

function canonicalEventEntries(input: DeriveCanonicalReviewTimelineInput): ReviewTimelineEntry[] {
  return (input.canonicalEvents || [])
    .filter((event) => isRelated(event, input.scope, input.scopeId))
    .map((event) =>
      entry({
        key: asString(event.id, 500) || event.type || "canonical_event",
        entryType: "canonical_event",
        timestamp: event.occurredAt || event.recordedAt,
        label: canonicalEventLabel(event),
        description: renewalNoticeCommunicationTimelineDescriptionForInput(event, input) || event.summary || "Canonical event recorded.",
        status: event.status === "blocked" ? "blocked" : "info",
        actor: normalizeActor(event.actor),
        source: "canonical_events",
        sourceId: event.id || null,
        destination: null,
        redacted: false,
        redactionReason: null,
        blockedReason: event.status === "blocked" ? event.summary || "Canonical event is blocked." : null,
      })
    );
}

function evidenceEntries(input: DeriveCanonicalReviewTimelineInput): ReviewTimelineEntry[] {
  const pack = input.evidencePack;
  if (!pack) return [];
  const entries: ReviewTimelineEntry[] = [
    entry({
      key: pack.evidencePackId || "evidence_pack",
      entryType: "evidence_reference",
      timestamp: pack.generatedAt,
      label: "Evidence pack generated",
      description: `Evidence pack status ${pack.status || "unavailable"} with ${pack.summary?.totalItems || 0} items.`,
      status: pack.status === "blocked" ? "blocked" : pack.status === "ready_for_review" ? "completed" : "review_required",
      actor: { type: "system", id: null },
      source: "evidence_packs",
      sourceId: pack.evidencePackId || null,
      destination: null,
      redacted: false,
      redactionReason: null,
      blockedReason: Array.isArray(pack.blockedReasons) ? pack.blockedReasons.join(" ") || null : null,
    }),
  ];
  for (const redaction of pack.redactions || []) {
    entries.push(
      entry({
        key: `${pack.evidencePackId}:${redaction.fieldCategory}`,
        entryType: "redaction_note",
        timestamp: pack.generatedAt,
        label: `Redaction applied: ${label(redaction.fieldCategory || "redaction")}`,
        description: redaction.reason || "Sensitive data is redacted.",
        status: "redacted",
        actor: { type: "system", id: null },
        source: "evidence_packs",
        sourceId: pack.evidencePackId || null,
        destination: null,
        redacted: true,
        redactionReason: redaction.reason || null,
        blockedReason: null,
      })
    );
  }
  return entries;
}

function exportEntries(input: DeriveCanonicalReviewTimelineInput): ReviewTimelineEntry[] {
  const pkg = input.institutionExportPackage;
  if (!pkg) return [];
  return [
    entry({
      key: pkg.packageId || "institution_export",
      entryType: "export_preview",
      timestamp: pkg.generatedAt,
      label: "Institution export preview generated",
      description: `Preview status ${pkg.status || "unavailable"}; external submission disabled.`,
      status: pkg.status === "blocked" ? "blocked" : "completed",
      actor: { type: "system", id: null },
      source: "institution_exports",
      sourceId: pkg.packageId || null,
      destination: "/institution-exports",
      redacted: false,
      redactionReason: null,
      blockedReason: Array.isArray(pkg.blockedReasons) ? pkg.blockedReasons.join(" ") || null : null,
    }),
  ];
}

function readinessEntries(input: DeriveCanonicalReviewTimelineInput): ReviewTimelineEntry[] {
  const readiness = input.auditComplianceReadiness;
  if (!readiness) return [];
  return (readiness.checks || []).map((check: any) =>
    entry({
      key: `${readiness.readinessId}:${check.checkKey}`,
      entryType: "readiness_check",
      timestamp: readiness.generatedAt,
      label: check.label || label(check.checkKey || "readiness_check"),
      description:
        (Array.isArray(check.evidence) && check.evidence.join(" ")) ||
        (Array.isArray(check.missingEvidence) && check.missingEvidence.join(" ")) ||
        (Array.isArray(check.blockedReasons) && check.blockedReasons.join(" ")) ||
        `Readiness check ${check.status}.`,
      status: check.status === "blocked" ? "blocked" : check.status === "passed" ? "completed" : "review_required",
      actor: { type: "system", id: null },
      source: "audit_compliance",
      sourceId: `${readiness.readinessId}:${check.checkKey}`,
      destination: "/audit-compliance",
      redacted: false,
      redactionReason: null,
      blockedReason: Array.isArray(check.blockedReasons) ? check.blockedReasons.join(" ") || null : null,
    })
  );
}

function recoveryEntries(input: DeriveCanonicalReviewTimelineInput): ReviewTimelineEntry[] {
  return (input.recoveryLogs || [])
    .filter((log) => isRelated(log, input.scope, input.scopeId) || asString(log.workflowInstanceKey, 500) === input.scopeId)
    .map((log) =>
      entry({
        key: asString(log.logId || log.timelineEntryId, 500) || "recovery_action",
        entryType: "recovery_action",
        timestamp: asString(log.createdAt || log.timestamp, 120),
        label: asString(log.label, 180) || "Recovery action recorded",
        description: asString(log.reasonSummary || log.description, 1200) || "Recovery action metadata recorded for manual review.",
        status: log.reconciliationDecision === "EVIDENCE_REVIEW_REQUIRED" ? "review_required" : "completed",
        actor: { type: "operator", id: null },
        source: "operator_recovery",
        sourceId: asString(log.logId || log.timelineEntryId, 500) || null,
        destination: null,
        redacted: false,
        redactionReason: null,
        blockedReason: null,
      })
    );
}

function filterValue<T extends string>(value: unknown, known: readonly T[]): T | null {
  const raw = asString(value, 80).toLowerCase();
  if (!raw || raw === "all") return null;
  return known.includes(raw as T) ? (raw as T) : null;
}

function uniqueInOrder<T extends string>(values: T[], known: readonly T[]): T[] {
  const set = new Set(values);
  return known.filter((value) => set.has(value));
}

export function deriveCanonicalReviewTimeline(input: DeriveCanonicalReviewTimelineInput): CanonicalReviewTimeline {
  const generated = generatedAt(input);
  const allEntries = [
    ...decisionEntries(input, generated),
    ...operatorReviewEntries(input),
    ...canonicalEventEntries(input),
    ...evidenceEntries(input),
    ...exportEntries(input),
    ...readinessEntries(input),
    ...recoveryEntries(input),
  ].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.source.localeCompare(b.source) || a.timelineEntryId.localeCompare(b.timelineEntryId));

  const entryType = filterValue(input.filters?.entryType, KNOWN_ENTRY_TYPES);
  const status = filterValue(input.filters?.status, KNOWN_STATUSES);
  const source = filterValue(input.filters?.source, KNOWN_SOURCES);
  const entries = allEntries.filter((item) => {
    if (entryType && item.entryType !== entryType) return false;
    if (status && item.status !== status) return false;
    if (source && item.source !== source) return false;
    return true;
  });

  return {
    timelineId:
      cleanId(`canonical_review_timeline:${input.scope}:${input.landlordId || "missing_landlord"}:${input.scopeId || "missing_scope"}`) ||
      "canonical_review_timeline:unknown",
    scope: input.scope,
    scopeId: asString(input.scopeId, 500),
    generatedAt: generated,
    manualReviewRequired: true,
    externalSharingEnabled: false,
    certificationIssued: false,
    entries,
    filters: {
      entryType: uniqueInOrder(allEntries.map((item) => item.entryType), KNOWN_ENTRY_TYPES),
      status: uniqueInOrder(allEntries.map((item) => item.status), KNOWN_STATUSES),
      source: uniqueInOrder(allEntries.map((item) => item.source), KNOWN_SOURCES),
    },
    summary: {
      total: entries.length,
      reviewRequired: entries.filter((item) => item.status === "review_required").length,
      blocked: entries.filter((item) => item.status === "blocked").length,
      completed: entries.filter((item) => item.status === "completed").length,
      redacted: entries.filter((item) => item.redacted || item.status === "redacted").length,
    },
  };
}
