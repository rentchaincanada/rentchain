import type {
  DeriveEvidencePackInput,
  EvidenceItem,
  EvidenceItemSource,
  EvidenceItemStatus,
  EvidenceItemType,
  EvidencePack,
  EvidencePackRedaction,
  EvidencePackScope,
  EvidencePackSection,
  EvidencePackSectionKey,
  EvidenceSectionStatus,
} from "./evidencePackTypes";
import {
  deriveEvidenceProjectionProfile,
  deriveEvidenceSourceReferences,
} from "./evidenceProjectionProfile";

const DEFAULT_DISCLAIMERS = [
  "Preview only. Evidence is not shared externally.",
  "Manual review is required before relying on or sharing this evidence.",
  "Sensitive data may be excluded or redacted.",
];

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function arrayOf<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function cleanId(value: unknown): string {
  return asString(value, 500)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeGeneratedAt(value: unknown): string {
  const raw = asString(value, 120);
  const date = raw ? new Date(raw) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function normalizeTimestamp(value: unknown): string | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function looksLikeInternalId(value: unknown): boolean {
  const raw = asString(value, 240);
  if (!raw) return false;
  if (/^[a-z]+:[A-Za-z0-9:_-]{8,}$/i.test(raw)) return true;
  if (/^[a-z]+_[a-z]+:/i.test(raw)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) return true;
  if (/^[A-Za-z0-9_-]{18,}$/.test(raw) && /[A-Z]/.test(raw) && /[a-z]/.test(raw) && /\d/.test(raw)) return true;
  return false;
}

function hasRawReferenceLabel(value: unknown): boolean {
  const raw = asString(value, 240);
  if (!raw) return false;
  if (looksLikeInternalId(raw)) return true;
  return /^(Lease|Property|Decision|Tenant|Unit)\s+[A-Za-z0-9:_-]+$/i.test(raw);
}

function unitLabel(value: unknown): string {
  const raw = asString(value, 80);
  if (!raw || looksLikeInternalId(raw)) return "";
  return /^unit\s+/i.test(raw) ? raw : `Unit ${raw}`;
}

function leaseContextLabel(lease: Record<string, any>): string {
  const property = asString(
    lease.propertyName || lease.propertyLabel || lease.property?.name || lease.propertyAddress || lease.address,
    120
  );
  const unit = unitLabel(lease.unitLabel || lease.unitNumber || lease.unitName || lease.unit);
  const tenant = asString(lease.tenantName || lease.primaryTenantName || lease.tenant?.name, 120);
  const parts = [property, unit].filter(Boolean);
  if (parts.length) return tenant ? `${parts.join(" · ")} · ${tenant}` : parts.join(" · ");
  if (tenant) return `${tenant} lease`;
  return "Lease context review";
}

function propertyContextLabel(property: Record<string, any>): string {
  const name = asString(property.name || property.propertyName || property.address || property.addressLine1, 160);
  return name && !hasRawReferenceLabel(name) ? name : "Property review";
}

function canonicalEventLabel(event: Record<string, any>): string {
  const raw = asString(event.type || event.action, 160);
  if (raw === "renewal_notice_draft_saved" || raw === "lease.renewal_notice_draft_saved") {
    return "Renewal notice draft snapshot";
  }
  return raw || "Canonical event";
}

function operationalDecisionLabel(decision: Record<string, any>): string {
  const title = asString(decision.title, 160);
  if (title && !hasRawReferenceLabel(title)) return title;
  const raw = asString(decision.id || decision.decisionId || decision.decisionType || decision.type, 240).toLowerCase();
  const queue = asString(decision.workflow?.queue, 120).toLowerCase();
  if (raw.includes("reduce_vacancy_risk") || raw.includes("vacancy")) return "Vacancy pressure review";
  if (raw.includes("revenue")) return "Revenue pressure review";
  if (raw.includes("missing_payment") || raw.includes("delinquency") || queue === "delinquency_review") {
    return "Delinquency review";
  }
  if (raw.includes("lease") || queue === "lease_review") return "Lease readiness review";
  if (raw.includes("screening") || queue === "screening_review") return "Screening workflow review";
  return "Operational review";
}

function evidenceItem(input: {
  itemType: EvidenceItemType;
  label: string;
  description: string;
  status?: EvidenceItemStatus;
  source: EvidenceItemSource;
  sourceId?: string | null;
  destination?: string | null;
  timestamp?: string | null;
  redacted?: boolean;
  redactionReason?: string | null;
  blockedReason?: string | null;
}): EvidenceItem {
  const sourceId = asString(input.sourceId, 500) || null;
  return {
    evidenceItemId:
      cleanId(["evidence_item", input.source, input.itemType, sourceId || input.label].join(":")) ||
      "evidence_item:unknown",
    itemType: input.itemType,
    label: asString(input.label, 160) || "Evidence item",
    description: asString(input.description, 1000) || "Evidence is available for manual review.",
    status: input.status || "included",
    source: input.source,
    sourceId,
    destination: asString(input.destination, 500) || null,
    timestamp: normalizeTimestamp(input.timestamp),
    redacted: input.redacted === true,
    redactionReason: asString(input.redactionReason, 500) || null,
    blockedReason: asString(input.blockedReason, 500) || null,
  };
}

function section(input: {
  sectionKey: EvidencePackSectionKey;
  label: string;
  items?: EvidenceItem[];
  missingEvidence?: string[];
  blockedReasons?: string[];
  fallbackStatus?: EvidenceSectionStatus;
}): EvidencePackSection {
  const items = input.items || [];
  const blockedReasons = (input.blockedReasons || []).filter(Boolean);
  const missingEvidence = (input.missingEvidence || []).filter(Boolean);
  const status: EvidenceSectionStatus = blockedReasons.length
    ? "blocked"
    : items.some((item) => item.status === "blocked")
      ? "blocked"
      : missingEvidence.length
        ? "incomplete"
        : items.length
          ? "included"
          : input.fallbackStatus || "unavailable";
  return {
    sectionKey: input.sectionKey,
    label: input.label,
    status,
    itemsCount: items.length,
    items,
    missingEvidence,
    blockedReasons,
  };
}

function isRelatedToScope(record: Record<string, any>, scope: EvidencePackScope, scopeId: string): boolean {
  const id = asString(scopeId, 500);
  if (!id) return false;
  if (scope === "decision" || scope === "workflow" || scope === "delinquency") {
    return [record.id, record.decisionId, record.scopeId, record.resource?.id, record.resource?.parentId]
      .map((value) => asString(value, 500))
      .includes(id);
  }
  if (scope === "institution_export") {
    return [record.packageId, record.scopeId, record.resource?.id, record.resource?.parentId]
      .map((value) => asString(value, 500))
      .includes(id);
  }
  if (scope === "audit_compliance") {
    return [record.readinessId, record.scopeId, record.resource?.id, record.resource?.parentId]
      .map((value) => asString(value, 500))
      .includes(id);
  }
  if (scope === "lease") return asString(record.leaseId || record.id || record.resource?.id, 500) === id;
  if (scope === "property") return asString(record.propertyId || record.id || record.resource?.id, 500) === id;
  if (scope === "maintenance") return asString(record.id || record.maintenanceRequestId || record.workOrderId, 500) === id;
  return false;
}

function decisionSections(input: DeriveEvidencePackInput): EvidencePackSection[] {
  const scopeId = asString(input.scopeId, 500);
  const decisions = arrayOf(input.decisions);
  const scopedDecisions = decisions.filter((decision: any) => {
    if (["decision", "workflow", "delinquency"].includes(input.scope)) {
      return asString(decision.id, 500) === scopeId || asString(decision.workflow?.queue, 120) === scopeId;
    }
    return isRelatedToScope(decision as any, input.scope, scopeId);
  });
  const target = scopedDecisions.length ? scopedDecisions : decisions.slice(0, 5);

  const decisionItems = target.map((decision) =>
    evidenceItem({
      itemType: "decision",
      label: operationalDecisionLabel(decision),
      description: decision.description,
      source: "decision_inbox",
      sourceId: decision.id,
      destination: decision.destination,
      timestamp: decision.updatedAt || decision.createdAt,
    })
  );

  const workflowItems = target.map((decision) =>
    evidenceItem({
      itemType: "workflow",
      label: "Workflow routing",
      description: `Queue ${decision.workflow.queue}; state ${decision.workflow.workflowState}; escalation ${decision.workflow.escalationLevel}.`,
      source: "workflow_routing",
      sourceId: decision.id,
      destination: decision.destination,
      timestamp: decision.updatedAt || decision.createdAt,
    })
  );

  return [
    section({
      sectionKey: "decision_lineage",
      label: "Decision lineage",
      items: decisionItems,
      missingEvidence: decisionItems.length ? [] : ["No landlord-safe decision evidence was available for this scope."],
    }),
    section({
      sectionKey: "workflow_routing",
      label: "Workflow routing",
      items: workflowItems,
      missingEvidence: workflowItems.length ? [] : ["No workflow routing metadata was available for this scope."],
    }),
  ];
}

function operatorReviewSection(input: DeriveEvidencePackInput): EvidencePackSection {
  const sessions = arrayOf(input.operatorReviewSessions).filter((session) =>
    isRelatedToScope(session as any, input.scope, input.scopeId)
  );
  return section({
    sectionKey: "operator_review_sessions",
    label: "Operator review sessions",
    items: sessions.map((session) =>
      evidenceItem({
        itemType: "operator_review",
        label: `Review session ${session.status}`,
        description: session.outcome?.summary || `Manual review session for ${session.scope}.`,
        source: "operator_review",
        sourceId: session.reviewSessionId,
        timestamp: session.updatedAt,
      })
    ),
    missingEvidence: sessions.length ? [] : ["No operator review sessions were available for this scope."],
  });
}

function canonicalEventsSection(input: DeriveEvidencePackInput): EvidencePackSection {
  const events = arrayOf(input.canonicalEvents)
    .filter((event) => isRelatedToScope(event, input.scope, input.scopeId))
    .slice(0, 20);
  return section({
    sectionKey: "audit_events",
    label: "Audit events",
    items: events.map((event) =>
      evidenceItem({
        itemType: "canonical_event",
        label: canonicalEventLabel(event),
        description: asString(event.summary, 1000) || "Canonical event is available.",
        source: "canonical_events",
        sourceId: event.id,
        timestamp: event.occurredAt || event.recordedAt,
      })
    ),
    missingEvidence: events.length ? [] : ["No landlord-scoped canonical events were available for this scope."],
  });
}

function exportSection(input: DeriveEvidencePackInput): EvidencePackSection {
  const exportPackage = input.institutionExportPackage;
  const items =
    exportPackage?.sections.map((item) =>
      evidenceItem({
        itemType: "export_section",
        label: item.label,
        description: `${item.recordsCount} aggregate records; status ${item.status}.`,
        status: item.status === "blocked" ? "blocked" : item.status === "included" ? "included" : "unavailable",
        source: "institution_exports",
        sourceId: `${exportPackage.packageId}:${item.sectionKey}`,
        timestamp: exportPackage.generatedAt,
        blockedReason: item.blockedReasons.join(" ") || null,
      })
    ) || [];
  return section({
    sectionKey: "export_readiness",
    label: "Export readiness",
    items,
    missingEvidence: items.length ? [] : ["No institution export preview was available for this evidence pack."],
  });
}

function readinessSection(input: DeriveEvidencePackInput): EvidencePackSection {
  const readiness = input.auditComplianceReadiness;
  const items =
    readiness?.checks.map((check) =>
      evidenceItem({
        itemType: "readiness_check",
        label: check.label,
        description:
          check.evidence.join(" ") ||
          check.missingEvidence.join(" ") ||
          check.blockedReasons.join(" ") ||
          `Readiness check status ${check.status}.`,
        status: check.status === "blocked" ? "blocked" : check.status === "passed" ? "included" : "unavailable",
        source: "audit_compliance",
        sourceId: `${readiness.readinessId}:${check.checkKey}`,
        timestamp: readiness.generatedAt,
        blockedReason: check.blockedReasons.join(" ") || null,
      })
    ) || [];
  return section({
    sectionKey: "audit_compliance_readiness",
    label: "Audit and compliance readiness",
    items,
    missingEvidence: items.length ? [] : ["No audit/compliance readiness checks were available for this scope."],
  });
}

function contextSections(input: DeriveEvidencePackInput): EvidencePackSection[] {
  const leaseItems = arrayOf(input.leases)
    .filter((lease) => input.scope !== "lease" || asString(lease.id || lease.leaseId, 240) === input.scopeId)
    .slice(0, 8)
    .map((lease) =>
      evidenceItem({
        itemType: "lease_summary",
        label: leaseContextLabel(lease),
        description: `Lease context includes property and unit linkage without private tenant documents.`,
        source: "lease_ledger",
        sourceId: asString(lease.id || lease.leaseId, 240) || null,
        destination: asString(lease.id || lease.leaseId, 240) ? `/leases/${encodeURIComponent(asString(lease.id || lease.leaseId, 240))}/ledger` : null,
        timestamp: lease.updatedAt || lease.createdAt,
      })
    );
  const propertyItems = arrayOf(input.properties)
    .filter((property) => input.scope !== "property" || asString(property.id || property.propertyId, 240) === input.scopeId)
    .slice(0, 8)
    .map((property) =>
      evidenceItem({
        itemType: "property_summary",
        label: propertyContextLabel(property),
        description: "Landlord-scoped property context is available.",
        source: "registry",
        sourceId: asString(property.id || property.propertyId, 240) || null,
        destination: "/properties",
        timestamp: property.updatedAt || property.createdAt,
      })
    );
  const maintenanceItems = arrayOf(input.maintenanceRequests)
    .filter((record) => input.scope !== "maintenance" || asString(record.id || record.maintenanceRequestId, 240) === input.scopeId)
    .slice(0, 8)
    .map((record) =>
      evidenceItem({
        itemType: "maintenance_summary",
        label: asString(record.title || record.category || record.id || "Maintenance record", 160),
        description: "Maintenance summary is included without private message contents.",
        source: "maintenance",
        sourceId: asString(record.id || record.maintenanceRequestId, 240) || null,
        destination: "/maintenance",
        timestamp: record.updatedAt || record.createdAt,
      })
    );

  return [
    section({
      sectionKey: "lease_context",
      label: "Lease context",
      items: leaseItems,
      missingEvidence: leaseItems.length ? [] : ["No landlord-scoped lease context was available."],
    }),
    section({
      sectionKey: "property_context",
      label: "Property context",
      items: propertyItems,
      missingEvidence: propertyItems.length ? [] : ["No landlord-scoped property context was available."],
    }),
    section({
      sectionKey: "maintenance_context",
      label: "Maintenance context",
      items: maintenanceItems,
      missingEvidence: maintenanceItems.length ? [] : ["No landlord-scoped maintenance context was available."],
    }),
  ];
}

function delinquencySection(input: DeriveEvidencePackInput): EvidencePackSection {
  const delinquency = arrayOf(input.decisions).filter((decision) => {
    return decision.workflow.queue === "delinquency_review" || decision.type === "billing";
  });
  return section({
    sectionKey: "delinquency_context",
    label: "Delinquency context",
    items: delinquency.slice(0, 8).map((decision) =>
      evidenceItem({
        itemType: "ledger_summary",
        label: operationalDecisionLabel(decision),
        description: decision.description,
        source: "lease_ledger",
        sourceId: decision.id,
        destination: decision.destination,
        timestamp: decision.updatedAt || decision.createdAt,
      })
    ),
    missingEvidence: delinquency.length ? [] : ["No landlord-safe delinquency context was available."],
  });
}

function redactionSection(input: DeriveEvidencePackInput): { section: EvidencePackSection; redactions: EvidencePackRedaction[] } {
  const redactions = [
    ...(input.institutionExportPackage?.redactions || []),
    ...(input.auditComplianceReadiness?.redactions || []),
  ];
  const byCategory = new Map<string, EvidencePackRedaction>();
  for (const redaction of redactions) {
    const fieldCategory = asString(redaction.fieldCategory, 160);
    const reason = asString(redaction.reason, 500);
    if (fieldCategory && reason) byCategory.set(fieldCategory, { fieldCategory, reason });
  }
  const normalized = Array.from(byCategory.values());
  return {
    redactions: normalized,
    section: section({
      sectionKey: "redaction_summary",
      label: "Redaction summary",
      items: normalized.map((redaction) =>
        evidenceItem({
          itemType: "redaction_note",
          label: redaction.fieldCategory,
          description: redaction.reason,
          status: "redacted",
          source: "institution_exports",
          sourceId: redaction.fieldCategory,
          redacted: true,
          redactionReason: redaction.reason,
        })
      ),
      blockedReasons: normalized.length ? [] : ["Redaction metadata is required before evidence can be review-ready."],
    }),
  };
}

function derivePackStatus(sections: EvidencePackSection[], hasScope: boolean): EvidencePack["status"] {
  if (!hasScope) return "unavailable";
  if (sections.some((item) => item.status === "blocked" && ["redaction_summary", "audit_compliance_readiness"].includes(item.sectionKey))) {
    return "blocked";
  }
  if (sections.some((item) => item.status === "blocked")) return "blocked";
  if (sections.some((item) => item.status === "incomplete" || item.status === "unavailable")) return "incomplete";
  return "ready_for_review";
}

function hasRestrictedRedactions(redactions: EvidencePackRedaction[]): boolean {
  return redactions.some((redaction) =>
    /account|bank|card|credential|identity|message|payload|provider|raw|screening|token/i.test(
      `${redaction.fieldCategory} ${redaction.reason}`,
    ),
  );
}

export function deriveEvidencePack(input: DeriveEvidencePackInput): EvidencePack {
  const scope = input.scope;
  const scopeId = asString(input.scopeId, 500);
  const generatedAt = normalizeGeneratedAt(input.generatedAt);
  const decisionRelatedSections = decisionSections(input);
  const redactions = redactionSection(input);
  const sections = [
    ...decisionRelatedSections,
    operatorReviewSection(input),
    canonicalEventsSection(input),
    exportSection(input),
    readinessSection(input),
    ...contextSections(input),
    delinquencySection(input),
    redactions.section,
  ];
  const allItems = sections.flatMap((item) => item.items);
  const sourceRefs = deriveEvidenceSourceReferences(allItems);
  const sourceCollections = Array.from(new Set(sourceRefs.map((item) => item.sourceCollection))).sort((a, b) =>
    a.localeCompare(b),
  );
  const restricted = hasRestrictedRedactions(redactions.redactions);
  const projectionProfile = deriveEvidenceProjectionProfile({
    scope,
    sourceCollections,
    hasRestrictedRedactions: restricted,
  });
  const blockedReasons = sections.flatMap((item) => item.blockedReasons);
  const missingItems = sections.reduce((sum, item) => sum + item.missingEvidence.length, 0);
  const hasScope = Boolean(scope && scopeId && input.landlordId);

  return {
    evidencePackId:
      cleanId(`evidence_pack:${scope}:${input.landlordId || "missing_landlord"}:${scopeId || "missing_scope"}`) ||
      "evidence_pack:unknown",
    scope,
    scopeId,
    status: derivePackStatus(sections, hasScope),
    projectionProfile,
    projectionVersion: projectionProfile.profileVersion,
    sensitivityClass: projectionProfile.sensitivityClass,
    sourceCollections,
    sourceRefs,
    redactionSummary: {
      redactionPolicy: projectionProfile.redactionPolicy,
      redactedFieldGroups: redactions.redactions.map((item) => item.fieldCategory).sort((a, b) => a.localeCompare(b)),
      redactionCount: redactions.redactions.length,
    },
    manualReviewRequired: true,
    externalSharingEnabled: false,
    certificationIssued: false,
    generatedAt,
    summary: {
      totalItems: allItems.length,
      includedItems: allItems.filter((item) => item.status === "included").length,
      redactedItems: allItems.filter((item) => item.redacted || item.status === "redacted").length,
      blockedItems: allItems.filter((item) => item.status === "blocked").length,
      missingItems,
    },
    sections,
    redactions: redactions.redactions,
    blockedReasons,
    disclaimers: DEFAULT_DISCLAIMERS,
  };
}
