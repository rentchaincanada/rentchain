import type {
  DeriveVerifiedRentalHistoryInput,
  RentalHistoryCanonicalEvent,
  RentalHistoryEntry,
  RentalHistoryEntryStatus,
  RentalHistoryLedgerStatus,
  RentalHistoryReference,
  VerifiedRentalHistoryLedger,
} from "./rentalHistoryLedgerTypes";
import { isAvailableReference, rentalHistoryReference } from "./rentalHistoryVerificationModels";

const REDACTIONS = [
  "Raw government identity numbers are excluded.",
  "Raw screening and credit bureau payloads are excluded.",
  "Payment account details are excluded.",
  "Private tenant documents are excluded.",
  "Unrestricted tenant communications are excluded.",
];

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function cleanId(value: unknown): string {
  return asString(value, 800)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function toIso(value: unknown): string | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function generatedAt(value: unknown): string {
  return toIso(value) || new Date(0).toISOString();
}

function records<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function tenantIdOf(input: DeriveVerifiedRentalHistoryInput): string {
  return (
    asString(input.identityId, 500) ||
    asString(input.tenant?.tenantId || input.tenant?.id || input.tenant?.profileId, 500) ||
    "unknown"
  );
}

function includesTenant(record: Record<string, unknown>, tenantId: string): boolean {
  const tenantIds = Array.isArray(record.tenantIds) ? record.tenantIds.map((item) => asString(item, 500)) : [];
  return [record.tenantId, record.tenantID, record.primaryTenantId, record.applicantTenantId, record.id]
    .map((value) => asString(value, 500))
    .concat(tenantIds)
    .includes(tenantId);
}

function relatedByAnyId(record: Record<string, unknown>, ids: string[], keys: string[]): boolean {
  const safeIds = ids.map((id) => asString(id, 500)).filter(Boolean);
  if (!safeIds.length) return false;
  return keys.some((key) => safeIds.includes(asString(record[key], 500)));
}

function findProperty(properties: Record<string, unknown>[], lease: Record<string, unknown>): Record<string, unknown> | null {
  const propertyId = asString(lease.propertyId, 500);
  return properties.find((property) => [property.id, property.propertyId].map((value) => asString(value, 500)).includes(propertyId)) || null;
}

function leaseReference(lease: Record<string, unknown>): RentalHistoryReference {
  const leaseId = asString(lease.id || lease.leaseId, 500);
  return rentalHistoryReference({
    referenceId: `lease:${leaseId || "unknown"}`,
    referenceType: "lease",
    label: "Lease participation reference",
    destination: leaseId ? `/leases/${encodeURIComponent(leaseId)}` : null,
    occurredAt: lease.updatedAt || lease.createdAt || lease.startDate,
    status: leaseId ? "available" : "missing",
    blockedReason: leaseId ? null : "Lease reference is missing.",
  });
}

function propertyReference(property: Record<string, unknown> | null, lease: Record<string, unknown>): RentalHistoryReference {
  const propertyId = asString(property?.id || property?.propertyId || lease.propertyId, 500);
  const label = asString(property?.name || property?.addressLine1 || property?.label, 160) || "Property identity reference";
  return rentalHistoryReference({
    referenceId: `property:${propertyId || "unknown"}`,
    referenceType: "property",
    label,
    destination: propertyId ? `/properties?propertyId=${encodeURIComponent(propertyId)}` : null,
    occurredAt: property?.updatedAt || property?.createdAt || lease.updatedAt,
    status: propertyId ? "available" : "missing",
    blockedReason: propertyId ? null : "Property identity reference is missing.",
  });
}

function reviewReferencesFor(
  sessions: Record<string, unknown>[],
  tenantId: string,
  lease: Record<string, unknown> | null
): RentalHistoryReference[] {
  const leaseId = asString(lease?.id || lease?.leaseId, 500);
  return sessions
    .filter((session) => {
      return (
        asString(session.scopeId, 500) === tenantId ||
        asString(session.tenantId, 500) === tenantId ||
        (leaseId && asString(session.scopeId, 500) === leaseId)
      );
    })
    .map((session) =>
      rentalHistoryReference({
        referenceId: `operator_review:${session.reviewSessionId || session.id || "unknown"}`,
        referenceType: "operator_review",
        label: "Operator review verification",
        destination: "/review-timeline",
        occurredAt: session.closedAt || session.updatedAt || session.openedAt,
      })
    );
}

function evidenceReferencesFor(evidencePacks: Record<string, unknown>[], ids: string[]): RentalHistoryReference[] {
  return evidencePacks
    .filter((pack) => relatedByAnyId(pack, ids, ["scopeId", "identityId", "tenantId", "leaseId"]))
    .map((pack) =>
      rentalHistoryReference({
        referenceId: `evidence:${pack.evidencePackId || pack.id || "unknown"}`,
        referenceType: "evidence",
        label: "Evidence lineage reference",
        destination: "/evidence-packs",
        occurredAt: pack.generatedAt || pack.updatedAt || pack.createdAt,
      })
    );
}

function canonicalEventReferences(events: Record<string, unknown>[], ids: string[]): RentalHistoryReference[] {
  return events
    .filter((event) => relatedByAnyId(event, ids, ["resourceId", "tenantId", "leaseId", "propertyId"]))
    .map((event) =>
      rentalHistoryReference({
        referenceId: `canonical_event:${event.id || event.eventId || "unknown"}`,
        referenceType: "canonical_event",
        label: asString(event.type || event.eventType || event.action, 160) || "Canonical event",
        destination: "/review-timeline",
        occurredAt: event.occurredAt || event.recordedAt || event.createdAt,
        redacted: Boolean(event.redacted),
        status: event.redacted ? "redacted" : "available",
        blockedReason: event.redacted ? "Event payload is redacted for rental-history safety." : null,
      })
    );
}

function verificationStatus(references: RentalHistoryReference[], blockedReason: string | null): RentalHistoryEntryStatus {
  if (blockedReason) return "blocked";
  const available = references.filter(isAvailableReference).length;
  const missing = references.filter((reference) => reference.status === "missing").length;
  if (available >= 3 && missing === 0) return "verified";
  if (available > 0) return "partially_verified";
  return "unavailable";
}

function makeEntry(input: {
  entryType: RentalHistoryEntry["entryType"];
  tenantId: string;
  lease: Record<string, unknown> | null;
  property: Record<string, unknown> | null;
  reviewLineage: RentalHistoryReference[];
  evidenceLineage: RentalHistoryReference[];
  blockedReason?: string | null;
}): RentalHistoryEntry {
  const leaseRef = input.lease ? leaseReference(input.lease) : null;
  const propertyRef = input.lease ? propertyReference(input.property, input.lease) : null;
  const allReferences = [leaseRef, propertyRef, ...input.reviewLineage, ...input.evidenceLineage].filter(Boolean) as RentalHistoryReference[];
  const status = verificationStatus(allReferences, input.blockedReason || null);
  const leaseId = asString(input.lease?.id || input.lease?.leaseId || input.tenantId, 500);
  return {
    historyEntryId: cleanId(["rental_history_entry", input.entryType, input.tenantId, leaseId].join(":")),
    entryType: input.entryType,
    status,
    propertyReference: propertyRef,
    leaseReference: leaseRef,
    occupancyPeriod: {
      startDate: toIso(input.lease?.startDate || input.lease?.leaseStartDate || input.lease?.moveInDate),
      endDate: toIso(input.lease?.endDate || input.lease?.leaseEndDate || input.lease?.moveOutDate),
    },
    verificationSummary: {
      verifiedReferences: allReferences.filter(isAvailableReference).length,
      missingReferences: allReferences.filter((reference) => reference.status === "missing").length,
      blockedReferences: allReferences.filter((reference) => reference.status === "blocked").length,
    },
    reviewLineage: input.reviewLineage,
    evidenceLineage: input.evidenceLineage,
    redacted: false,
    redactionReason: null,
    blockedReason: input.blockedReason || null,
  };
}

function canonicalEvent(input: {
  eventType: RentalHistoryCanonicalEvent["eventType"];
  status: RentalHistoryLedgerStatus;
  ledgerId: string;
  summary: string;
}): RentalHistoryCanonicalEvent {
  return {
    eventType: input.eventType,
    action: input.eventType.replace(/^rental_history_/, "").replace(/_/g, "."),
    status: input.status,
    resourceType: "rental_history_ledger",
    resourceId: input.ledgerId,
    summary: input.summary,
  };
}

export function deriveVerifiedRentalHistory(input: DeriveVerifiedRentalHistoryInput): VerifiedRentalHistoryLedger {
  const tenantId = tenantIdOf(input);
  const identityId = `tenant:${tenantId}`;
  const ledgerId = cleanId(`verified_rental_history:${identityId}`);
  const leases = records(input.leases).filter((lease) => includesTenant(lease, tenantId));
  const properties = records(input.properties);
  const maintenanceRequests = records(input.maintenanceRequests).filter((request) =>
    includesTenant(request, tenantId) || relatedByAnyId(request, leases.map((lease) => asString(lease.id || lease.leaseId, 500)), ["leaseId"])
  );
  const decisions = records(input.decisions).filter((decision) => {
    const queue = asString((decision.workflow as any)?.queue || decision.queue || decision.type, 120);
    const leaseIds = leases.map((lease) => asString(lease.id || lease.leaseId, 500));
    const relatedEntityId = asString((decision.relatedEntity as any)?.id, 500);
    return (
      queue === "delinquency_review" &&
      (includesTenant(decision, tenantId) || relatedByAnyId(decision, leaseIds, ["leaseId", "relatedEntityId"]) || leaseIds.includes(relatedEntityId))
    );
  });
  const reviews = records(input.operatorReviewSessions);
  const evidencePacks = records(input.evidencePacks);
  const events = records(input.canonicalEvents);
  const consentReferences = records(input.consentRecords)
    .filter((record) => includesTenant(record, tenantId) || asString(record.identityId, 500) === tenantId)
    .map((record) =>
      rentalHistoryReference({
        referenceId: `consent:${record.id || record.consentId || "unknown"}`,
        referenceType: "consent",
        label: asString(record.scope || record.consentScope || record.type, 160) || "Consent lineage reference",
        occurredAt: record.createdAt || record.updatedAt || record.signedAt || record.consentAt,
      })
    );

  const historyEntries: RentalHistoryEntry[] = leases.flatMap((lease) => {
    const leaseId = asString(lease.id || lease.leaseId, 500);
    const property = findProperty(properties, lease);
    const ids = [tenantId, leaseId, asString(lease.propertyId, 500)].filter(Boolean);
    const reviewLineage = reviewReferencesFor(reviews, tenantId, lease);
    const evidenceLineage = [
      ...evidenceReferencesFor(evidencePacks, ids),
      ...canonicalEventReferences(events, ids).slice(0, 5),
    ];
    return [
      makeEntry({ entryType: "lease_participation", tenantId, lease, property, reviewLineage, evidenceLineage }),
      makeEntry({ entryType: "occupancy", tenantId, lease, property, reviewLineage, evidenceLineage }),
    ];
  });

  for (const request of maintenanceRequests) {
    const lease = leases.find((item) => asString(item.id || item.leaseId, 500) === asString(request.leaseId, 500)) || null;
    historyEntries.push(
      makeEntry({
        entryType: "maintenance_history",
        tenantId,
        lease,
        property: lease ? findProperty(properties, lease) : null,
        reviewLineage: reviewReferencesFor(reviews, tenantId, lease),
        evidenceLineage: [
          rentalHistoryReference({
            referenceId: `maintenance:${request.id || request.maintenanceRequestId || "unknown"}`,
            referenceType: "maintenance",
            label: "Maintenance participation summary",
            destination: "/maintenance",
            occurredAt: request.updatedAt || request.createdAt,
          }),
        ],
      })
    );
  }

  for (const decision of decisions) {
    const lease = leases.find((item) => asString(item.id || item.leaseId, 500) === asString(decision.leaseId || (decision.relatedEntity as any)?.id, 500)) || null;
    historyEntries.push(
      makeEntry({
        entryType: "delinquency_review",
        tenantId,
        lease,
        property: lease ? findProperty(properties, lease) : null,
        reviewLineage: reviewReferencesFor(reviews, tenantId, lease),
        evidenceLineage: [
          rentalHistoryReference({
            referenceId: `delinquency:${decision.id || decision.decisionId || "unknown"}`,
            referenceType: "delinquency",
            label: "Delinquency review reference",
            destination: decision.destination ? asString(decision.destination, 500) : "/decision-inbox",
            occurredAt: decision.updatedAt || decision.createdAt,
          }),
        ],
      })
    );
  }

  const identityReferences = records(input.identityReferences).map((reference) =>
    rentalHistoryReference({
      referenceId: `identity:${reference.referenceId || reference.id || identityId}`,
      referenceType: "identity",
      label: asString(reference.label || reference.referenceType, 160) || "Identity verification reference",
      destination: "/identity-layer",
      occurredAt: reference.occurredAt || reference.updatedAt || reference.createdAt,
      status: asString(reference.status, 80) === "missing" ? "missing" : "available",
      redacted: Boolean(reference.redacted),
      blockedReason: asString(reference.blockedReason, 500) || null,
    })
  );

  const blockedReasons: string[] = [];
  if (!input.tenant) blockedReasons.push("Tenant identity context is unavailable.");
  if (!leases.length) blockedReasons.push("Lease participation history is unavailable.");
  if (identityReferences.some((reference) => reference.status === "blocked")) {
    blockedReasons.push("Identity lineage contains a blocked reference.");
  }

  const verifiedEntries = historyEntries.filter((entry) => entry.status === "verified").length;
  const partiallyVerifiedEntries = historyEntries.filter((entry) => entry.status === "partially_verified").length;
  const blockedEntries = historyEntries.filter((entry) => entry.status === "blocked").length;
  const unavailableEntries = historyEntries.filter((entry) => entry.status === "unavailable").length;
  const hasConsent = consentReferences.length > 0;
  const status: RentalHistoryLedgerStatus = !input.tenant
    ? "unknown"
    : blockedReasons.some((reason) => reason.toLowerCase().includes("blocked")) || blockedEntries > 0
      ? "blocked"
      : leases.length && verifiedEntries > 0 && hasConsent
        ? "verified"
        : leases.length
          ? "partially_verified"
          : "review_required";

  const reviewReferences = historyEntries.flatMap((entry) => entry.reviewLineage);
  const evidenceReferences = historyEntries.flatMap((entry) => entry.evidenceLineage);
  const verificationReferences = [...identityReferences, ...historyEntries.map((entry) => entry.leaseReference).filter(Boolean), ...historyEntries.map((entry) => entry.propertyReference).filter(Boolean)] as RentalHistoryReference[];
  const uniqueProperties = new Set(historyEntries.map((entry) => entry.propertyReference?.referenceId).filter(Boolean));
  const uniqueLeases = new Set(historyEntries.map((entry) => entry.leaseReference?.referenceId).filter(Boolean));
  const canonicalEvents: RentalHistoryCanonicalEvent[] = [
    canonicalEvent({
      eventType: "rental_history_ledger_derived",
      status,
      ledgerId,
      summary: "Verified rental history ledger derived from permission-scoped operational references.",
    }),
    canonicalEvent({
      eventType: "rental_history_redaction_applied",
      status,
      ledgerId,
      summary: "Sensitive rental-history payloads are excluded or redacted.",
    }),
  ];
  if (verifiedEntries > 0) {
    canonicalEvents.push(
      canonicalEvent({
        eventType: "rental_history_entry_verified",
        status,
        ledgerId,
        summary: "At least one rental-history entry has verification lineage.",
      })
    );
  }
  if (status === "review_required" || status === "partially_verified") {
    canonicalEvents.push(
      canonicalEvent({
        eventType: "rental_history_review_required",
        status,
        ledgerId,
        summary: "Manual review is required before relying on this rental-history ledger.",
      })
    );
  }
  if (status === "blocked") {
    canonicalEvents.push(
      canonicalEvent({
        eventType: "rental_history_blocked",
        status,
        ledgerId,
        summary: "Rental-history ledger is blocked by conflicting or unsafe references.",
      })
    );
  }

  return {
    ledgerId,
    identityId,
    ledgerType: "tenant_rental_history",
    status,
    manualReviewRequired: true,
    publiclyShareable: false,
    externalInstitutionSharingEnabled: false,
    tokenizationEnabled: false,
    generatedAt: generatedAt(input.generatedAt),
    summary: {
      totalEntries: historyEntries.length,
      verifiedEntries,
      partiallyVerifiedEntries,
      blockedEntries,
      unavailableEntries,
      propertiesReferenced: uniqueProperties.size,
      leasesReferenced: uniqueLeases.size,
      maintenanceReferences: maintenanceRequests.length,
      delinquencyReviewReferences: decisions.length,
    },
    historyEntries,
    verificationReferences,
    reviewReferences,
    evidenceReferences,
    consentReferences,
    redactions: REDACTIONS,
    blockedReasons,
    canonicalEvents,
  };
}
