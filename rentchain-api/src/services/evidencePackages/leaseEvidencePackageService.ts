import crypto from "crypto";
import { db } from "../../firebase";
import type {
  LeaseEvidencePackage,
  LeaseEvidencePackageItem,
  LeaseEvidencePackageSection,
  LeaseEvidencePackageSectionKey,
} from "./leaseEvidencePackageTypes";

type DocSnapshotLike = {
  id: string;
  exists?: boolean;
  data: () => any;
};

type QuerySnapshotLike = {
  docs?: DocSnapshotLike[];
};

type QueryLike = {
  where?: (field: string, op: string, value: unknown) => QueryLike;
  limit?: (value: number) => QueryLike;
  get: () => Promise<QuerySnapshotLike>;
};

type CollectionLike = QueryLike & {
  doc: (id?: string) => {
    id?: string;
    get: () => Promise<DocSnapshotLike>;
  };
};

export type LeaseEvidencePackageFirestoreLike = {
  collection: (name: string) => CollectionLike;
};

export type GenerateLeaseEvidencePackageInput = {
  leaseId: string;
  landlordId: string;
  generatedBy: string;
  generatedAt?: string | Date | null;
  firestore?: LeaseEvidencePackageFirestoreLike;
};

type RecordWithId = {
  id: string;
  data: any;
  collectionName: string;
};

const SECTION_TITLES: Record<LeaseEvidencePackageSectionKey, string> = {
  cover_summary: "Cover Summary",
  lease_information: "Lease Information",
  parties: "Parties",
  timeline: "Timeline",
  documents: "Documents",
  messages: "Messages",
  payments: "Payments",
  maintenance_events: "Maintenance Events",
  notices: "Notices",
  signature_events: "Signature Events",
  audit_trail: "Audit Trail",
};

const SECTION_EMPTY: Record<LeaseEvidencePackageSectionKey, string> = {
  cover_summary: "No cover summary details were available.",
  lease_information: "No lease information was available.",
  parties: "No party records were available.",
  timeline: "No timeline entries were available.",
  documents: "No lease document metadata was available.",
  messages: "No landlord-visible messages were available.",
  payments: "No lease payment records were available.",
  maintenance_events: "No maintenance events were available.",
  notices: "No lease notices were available.",
  signature_events: "No signature events were available.",
  audit_trail: "No canonical audit events were available.",
};

const SENSITIVE_TEXT_PATTERN =
  /gs:\/\/|storage\.googleapis\.com|providerRequestId|providerRequestRef|stripe|processor|paymentIntent|checkoutSession|secret|token|credential|accountNumber|storagePath/i;

function evidenceDb(firestore?: LeaseEvidencePackageFirestoreLike): LeaseEvidencePackageFirestoreLike {
  return firestore || (db as unknown as LeaseEvidencePackageFirestoreLike);
}

function stableHash(parts: readonly unknown[], length = 20): string {
  return crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, length);
}

function safeReference(collection: string, id: unknown): string {
  return `${collection}:${stableHash([collection, String(id || "unknown")])}`;
}

function cleanText(value: unknown, max = 500): string {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
  if (!text) return "";
  return SENSITIVE_TEXT_PATTERN.test(text) ? "[redacted]" : text;
}

function money(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Amount unavailable";
  return `$${amount.toFixed(2)}`;
}

function timestamp(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof (value as any)?.toDate === "function") {
    const date = (value as any).toDate();
    return Number.isFinite(date?.getTime?.()) ? date.toISOString() : null;
  }
  if (typeof (value as any)?.toMillis === "function") {
    const millis = Number((value as any).toMillis());
    return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function sortItems(items: LeaseEvidencePackageItem[]): LeaseEvidencePackageItem[] {
  return [...items].sort((a, b) => {
    const left = a.timestamp ? Date.parse(a.timestamp) : 0;
    const right = b.timestamp ? Date.parse(b.timestamp) : 0;
    if (left !== right) return left - right;
    const label = a.label.localeCompare(b.label);
    if (label !== 0) return label;
    return a.sourceReference.localeCompare(b.sourceReference);
  });
}

function section(key: LeaseEvidencePackageSectionKey, items: LeaseEvidencePackageItem[]): LeaseEvidencePackageSection {
  return {
    key,
    title: SECTION_TITLES[key],
    items: sortItems(items),
    emptyState: SECTION_EMPTY[key],
  };
}

async function docById(firestore: LeaseEvidencePackageFirestoreLike, collectionName: string, id: string): Promise<RecordWithId | null> {
  if (!id) return null;
  const snap = await firestore.collection(collectionName).doc(id).get().catch(() => null);
  if (!snap?.exists) return null;
  return { id: snap.id, data: snap.data() || {}, collectionName };
}

async function byField(
  firestore: LeaseEvidencePackageFirestoreLike,
  collectionName: string,
  field: string,
  value: string,
  limit = 200
): Promise<RecordWithId[]> {
  if (!value) return [];
  const query = firestore.collection(collectionName).where?.(field, "==", value).limit?.(limit) ||
    firestore.collection(collectionName).where?.(field, "==", value);
  const snap = await query?.get().catch(() => null);
  return (snap?.docs || []).map((doc) => ({ id: doc.id, data: doc.data() || {}, collectionName }));
}

function uniqueRecords(records: RecordWithId[]): RecordWithId[] {
  const byKey = new Map<string, RecordWithId>();
  for (const record of records) byKey.set(`${record.collectionName}:${record.id}`, record);
  return Array.from(byKey.values());
}

function item(input: {
  label: string;
  description: string;
  timestamp?: unknown;
  sourceCollection: string;
  sourceId: unknown;
}): LeaseEvidencePackageItem {
  return {
    label: cleanText(input.label, 160) || "Evidence item",
    description: cleanText(input.description, 1200) || "Evidence metadata available for review.",
    timestamp: timestamp(input.timestamp),
    sourceCollection: input.sourceCollection,
    sourceReference: safeReference(input.sourceCollection, input.sourceId),
  };
}

function propertyDisplayLabel(lease: any, property?: RecordWithId | null): string {
  return cleanText(
    property?.data?.name ||
      property?.data?.propertyName ||
      property?.data?.address ||
      property?.data?.propertyAddress ||
      lease?.propertyName ||
      lease?.propertyLabel ||
      lease?.propertyAddress,
    140
  );
}

function unitDisplayLabel(lease: any, unit?: RecordWithId | null): string {
  const value = cleanText(
    unit?.data?.unitNumber ||
      unit?.data?.unitLabel ||
      unit?.data?.label ||
      unit?.data?.name ||
      unit?.data?.unit ||
      lease?.unitNumber ||
      lease?.unitLabel,
    80
  );
  if (!value) return "";
  return /^unit\b/i.test(value) ? value : `Unit ${value}`;
}

function leaseTitle(lease: any, property?: RecordWithId | null, unit?: RecordWithId | null): string {
  return cleanText(
    [
      propertyDisplayLabel(lease, property),
      unitDisplayLabel(lease, unit),
      lease?.tenantName || lease?.primaryTenantName,
    ].filter(Boolean).join(" · "),
    220
  ) || "Lease Evidence Package";
}

function messageExcerpt(body: unknown): string {
  const text = cleanText(body, 180);
  if (!text || text === "[redacted]") return "Message body redacted.";
  return text.length >= 180 ? `${text.slice(0, 177)}...` : text;
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function collectInlineTimeline(lease: RecordWithId): LeaseEvidencePackageItem[] {
  return [
    ...asArray(lease.data?.timeline),
    ...asArray(lease.data?.statusHistory),
    ...asArray(lease.data?.riskTimeline),
  ].map((entry, index) =>
    item({
      label: entry?.label || entry?.status || entry?.eventType || entry?.trigger || "Lease timeline event",
      description: entry?.description || entry?.message || entry?.summary || "Lease timeline metadata.",
      timestamp: entry?.createdAt || entry?.updatedAt || entry?.occurredAt,
      sourceCollection: "leases",
      sourceId: `${lease.id}:timeline:${index}`,
    })
  );
}

function leaseInformationItems(lease: RecordWithId): LeaseEvidencePackageItem[] {
  const raw = lease.data || {};
  return [
    item({
      label: "Lease term",
      description: `Status ${cleanText(raw.status || "unknown", 80)}; start ${cleanText(raw.startDate || raw.leaseStartDate || "not recorded", 80)}; end ${cleanText(raw.endDate || raw.leaseEndDate || "not recorded", 80)}.`,
      timestamp: raw.updatedAt || raw.createdAt || raw.startDate,
      sourceCollection: "leases",
      sourceId: lease.id,
    }),
    item({
      label: "Rent terms",
      description: `Rent ${money(raw.monthlyRent ?? raw.rent ?? raw.rentAmount)}; due day ${cleanText(raw.rentDueDay || raw.dueDay || "not recorded", 40)}.`,
      timestamp: raw.updatedAt || raw.createdAt,
      sourceCollection: "leases",
      sourceId: `${lease.id}:rent`,
    }),
  ];
}

function partiesItems(lease: RecordWithId, tenant: RecordWithId | null, property: RecordWithId | null, unit: RecordWithId | null): LeaseEvidencePackageItem[] {
  const raw = lease.data || {};
  return [
    item({
      label: "Landlord",
      description: cleanText(raw.landlordName || raw.landlordDisplayName || "Landlord of record", 180),
      timestamp: raw.createdAt,
      sourceCollection: "leases",
      sourceId: `${lease.id}:landlord`,
    }),
    item({
      label: "Tenant",
      description: cleanText(tenant?.data?.fullName || tenant?.data?.name || raw.tenantName || raw.primaryTenantName || "Tenant of record", 180),
      timestamp: tenant?.data?.updatedAt || raw.updatedAt,
      sourceCollection: tenant ? "tenants" : "leases",
      sourceId: tenant?.id || `${lease.id}:tenant`,
    }),
    item({
      label: "Property and unit",
      description: cleanText(
        [
          propertyDisplayLabel(raw, property) || "Property",
          unitDisplayLabel(raw, unit),
        ].filter(Boolean).join(" · "),
        220
      ),
      timestamp: property?.data?.updatedAt || unit?.data?.updatedAt || raw.updatedAt,
      sourceCollection: property ? "properties" : "leases",
      sourceId: property?.id || `${lease.id}:property`,
    }),
  ];
}

function documentItems(lease: RecordWithId, attachments: RecordWithId[]): LeaseEvidencePackageItem[] {
  const raw = lease.data || {};
  const items: LeaseEvidencePackageItem[] = [];
  if (raw.documentUrl || raw.approvedDocumentUrl || raw.documentRef || raw.documentGeneratedAt || raw.signedDocumentId) {
    items.push(item({
      label: raw.signedDocumentId ? "Signed lease document" : "Lease document",
      description: `Lease document status ${cleanText(raw.documentStatus || raw.leaseDocumentStatus || raw.status || "available", 120)}.`,
      timestamp: raw.documentGeneratedAt || raw.signedAt || raw.updatedAt,
      sourceCollection: "leases",
      sourceId: `${lease.id}:document`,
    }));
  }
  for (const attachment of attachments) {
    items.push(item({
      label: attachment.data?.title || attachment.data?.fileName || "Lease attachment",
      description: `Attachment metadata: ${cleanText(attachment.data?.category || attachment.data?.purpose || "lease document", 120)}.`,
      timestamp: attachment.data?.createdAt || attachment.data?.updatedAt,
      sourceCollection: attachment.collectionName,
      sourceId: attachment.id,
    }));
  }
  return items;
}

function paymentItems(payments: RecordWithId[]): LeaseEvidencePackageItem[] {
  return payments.map((paymentRecord) => {
    const raw = paymentRecord.data || {};
    const amount = raw.amountCents != null ? Number(raw.amountCents) / 100 : raw.amount;
    return item({
      label: `Payment ${cleanText(raw.status || raw.entryType || "recorded", 80)}`,
      description: `${money(amount)} via ${cleanText(raw.method || "recorded method", 80)}.`,
      timestamp: raw.paidAt || raw.effectiveDate || raw.createdAt,
      sourceCollection: paymentRecord.collectionName,
      sourceId: paymentRecord.id,
    });
  });
}

function maintenanceItems(records: RecordWithId[]): LeaseEvidencePackageItem[] {
  return records.map((record) =>
    item({
      label: record.data?.title || record.data?.category || "Maintenance event",
      description: `Status ${cleanText(record.data?.status || "unknown", 80)}. ${cleanText(record.data?.description || record.data?.completionSummary || "", 240)}`,
      timestamp: record.data?.updatedAt || record.data?.createdAt,
      sourceCollection: record.collectionName,
      sourceId: record.id,
    })
  );
}

function noticeItems(records: RecordWithId[]): LeaseEvidencePackageItem[] {
  return records.map((record) =>
    item({
      label: record.data?.noticeType || "Lease notice",
      description: `Delivery ${cleanText(record.data?.deliveryStatus || "pending", 80)}; response ${cleanText(record.data?.tenantResponse || "pending", 80)}.`,
      timestamp: record.data?.sentAt || record.data?.createdAt || record.data?.noticeDueAt,
      sourceCollection: record.collectionName,
      sourceId: record.id,
    })
  );
}

function signingItems(requests: RecordWithId[], events: RecordWithId[]): LeaseEvidencePackageItem[] {
  return [
    ...requests.map((record) =>
      item({
        label: `Signing request ${cleanText(record.data?.currentSigningStatus || "created", 80)}`,
        description: `Dispatch status ${cleanText(record.data?.providerDispatchStatus || "not recorded", 120)}.`,
        timestamp: record.data?.sentAt || record.data?.createdAt,
        sourceCollection: record.collectionName,
        sourceId: record.id,
      })
    ),
    ...events.map((record) =>
      item({
        label: `Signing ${cleanText(record.data?.type || "event", 80)}`,
        description: `Actor role ${cleanText(record.data?.actorRole || "system", 80)}.`,
        timestamp: record.data?.occurredAt || record.data?.createdAt,
        sourceCollection: record.collectionName,
        sourceId: record.id,
      })
    ),
  ];
}

function auditItems(records: RecordWithId[]): LeaseEvidencePackageItem[] {
  return records.map((record) =>
    item({
      label: record.data?.type || record.data?.eventType || record.data?.action || "Audit event",
      description: record.data?.summary || record.data?.redactionSummary || "Audit event metadata.",
      timestamp: record.data?.occurredAt || record.data?.timestamp || record.data?.recordedAt || record.data?.createdAt,
      sourceCollection: record.collectionName,
      sourceId: record.id || record.data?.eventId || record.data?.id,
    })
  );
}

function matchesLeaseContext(record: RecordWithId, lease: RecordWithId): boolean {
  const raw = record.data || {};
  const leaseData = lease.data || {};
  const leaseId = lease.id;
  const tenantId = String(leaseData.tenantId || leaseData.primaryTenantId || "").trim();
  const propertyId = String(leaseData.propertyId || "").trim();
  const unitId = String(leaseData.unitId || "").trim();
  return [raw.leaseId, raw.currentLeaseId, raw.resource?.id].some((value) => String(value || "").trim() === leaseId) ||
    Boolean(tenantId && String(raw.tenantId || "").trim() === tenantId) ||
    Boolean(propertyId && String(raw.propertyId || "").trim() === propertyId) ||
    Boolean(unitId && String(raw.unitId || "").trim() === unitId);
}

async function loadAll(firestore: LeaseEvidencePackageFirestoreLike, lease: RecordWithId, landlordId: string) {
  const leaseData = lease.data || {};
  const tenantId = String(leaseData.tenantId || leaseData.primaryTenantId || "").trim();
  const propertyId = String(leaseData.propertyId || "").trim();
  const unitId = String(leaseData.unitId || "").trim();
  const [
    tenant,
    property,
    unit,
    attachments,
    directPayments,
    rentPayments,
    ledgerEntries,
    maintenanceByLease,
    maintenanceByTenant,
    maintenanceByUnit,
    notices,
    signingRequests,
    signingEvents,
    conversationsByLease,
    conversationsByTenant,
    canonicalEvents,
    legacyEvents,
    leaseWorkflowEvents,
  ] = await Promise.all([
    docById(firestore, "tenants", tenantId),
    docById(firestore, "properties", propertyId),
    docById(firestore, "units", unitId),
    byField(firestore, "ledgerAttachments", "leaseId", lease.id),
    byField(firestore, "payments", "leaseId", lease.id),
    byField(firestore, "rentPayments", "leaseId", lease.id),
    byField(firestore, "ledgerEntries", "leaseId", lease.id),
    byField(firestore, "maintenanceRequests", "leaseId", lease.id),
    byField(firestore, "maintenanceRequests", "tenantId", tenantId),
    byField(firestore, "maintenanceRequests", "unitId", unitId),
    byField(firestore, "leaseNotices", "leaseId", lease.id),
    byField(firestore, "leaseSigningRequests", "leaseId", lease.id),
    byField(firestore, "leaseSigningEvents", "leaseId", lease.id),
    byField(firestore, "conversations", "leaseId", lease.id),
    byField(firestore, "conversations", "tenantId", tenantId),
    byField(firestore, "canonicalEvents", "resource.id", lease.id).catch(() => []),
    byField(firestore, "events", "leaseId", lease.id),
    byField(firestore, "leaseWorkflowEvents", "leaseId", lease.id),
  ]);

  const conversations = uniqueRecords([...conversationsByLease, ...conversationsByTenant])
    .filter((record) => String(record.data?.landlordId || "") === landlordId)
    .filter((record) => matchesLeaseContext(record, lease));
  const messageLists = await Promise.all(conversations.map((record) => byField(firestore, "messages", "conversationId", record.id, 200)));
  const messages = uniqueRecords(messageLists.flat()).filter((record) => {
    const conversation = conversations.find((entry) => entry.id === String(record.data?.conversationId || ""));
    return Boolean(conversation);
  });
  const maintenance = uniqueRecords([...maintenanceByLease, ...maintenanceByTenant, ...maintenanceByUnit])
    .filter((record) => String(record.data?.landlordId || "") === landlordId)
    .filter((record) => matchesLeaseContext(record, lease));
  const payments = uniqueRecords([...directPayments, ...rentPayments, ...ledgerEntries])
    .filter((record) => String(record.data?.landlordId || "") === landlordId || !record.data?.landlordId)
    .filter((record) => matchesLeaseContext(record, lease));
  const auditTrail = uniqueRecords([...canonicalEvents, ...legacyEvents, ...leaseWorkflowEvents])
    .filter((record) => matchesLeaseContext(record, lease));

  return {
    tenant,
    property,
    unit,
    attachments: uniqueRecords(attachments).filter((record) => matchesLeaseContext(record, lease)),
    payments,
    maintenance,
    notices: uniqueRecords(notices).filter((record) => String(record.data?.landlordId || "") === landlordId),
    signingRequests: uniqueRecords(signingRequests).filter((record) => String(record.data?.landlordId || "") === landlordId),
    signingEvents: uniqueRecords(signingEvents).filter((record) => String(record.data?.landlordId || "") === landlordId),
    messages,
    auditTrail,
    legacyEvents,
    leaseWorkflowEvents,
  };
}

export async function generateLeaseEvidencePackage(input: GenerateLeaseEvidencePackageInput): Promise<LeaseEvidencePackage> {
  const leaseId = cleanText(input.leaseId, 240);
  const landlordId = cleanText(input.landlordId, 240);
  if (!leaseId) throw Object.assign(new Error("lease_id_required"), { status: 400 });
  if (!landlordId) throw Object.assign(new Error("landlord_id_required"), { status: 401 });
  const firestore = evidenceDb(input.firestore);
  const lease = await docById(firestore, "leases", leaseId);
  if (!lease) throw Object.assign(new Error("lease_not_found"), { status: 404 });
  if (String(lease.data?.landlordId || "").trim() !== landlordId) {
    throw Object.assign(new Error("forbidden"), { status: 403 });
  }

  const generatedAt = timestamp(input.generatedAt) || new Date().toISOString();
  const sources = await loadAll(firestore, lease, landlordId);
  const messageItems = sources.messages.map((record) =>
    item({
      label: `Message from ${cleanText(record.data?.senderRole || "participant", 80)}`,
      description: messageExcerpt(record.data?.body || record.data?.message || record.data?.text),
      timestamp: record.data?.createdAt,
      sourceCollection: record.collectionName,
      sourceId: record.id,
    })
  );
  const timeline = [
    ...collectInlineTimeline(lease),
    ...noticeItems(sources.notices),
    ...signingItems(sources.signingRequests, sources.signingEvents),
    ...maintenanceItems(sources.maintenance),
    ...paymentItems(sources.payments),
    ...auditItems(sources.auditTrail),
  ];
  const sections: LeaseEvidencePackageSection[] = [
    section("cover_summary", [
      item({
        label: "Evidence package generated",
        description: `${leaseTitle(lease.data, sources.property, sources.unit)} evidence package generated for manual review.`,
        timestamp: generatedAt,
        sourceCollection: "leases",
        sourceId: lease.id,
      }),
    ]),
    section("lease_information", leaseInformationItems(lease)),
    section("parties", partiesItems(lease, sources.tenant, sources.property, sources.unit)),
    section("timeline", timeline),
    section("documents", documentItems(lease, sources.attachments)),
    section("messages", messageItems),
    section("payments", paymentItems(sources.payments)),
    section("maintenance_events", maintenanceItems(sources.maintenance)),
    section("notices", noticeItems(sources.notices)),
    section("signature_events", signingItems(sources.signingRequests, sources.signingEvents)),
    section("audit_trail", auditItems(sources.auditTrail)),
  ];
  const sourceReferences = sections
    .flatMap((entry) => entry.items)
    .map((entry) => ({ sourceCollection: entry.sourceCollection, sourceReference: entry.sourceReference }));
  const auditReferences = sections
    .find((entry) => entry.key === "audit_trail")!
    .items.map((entry) => ({ sourceCollection: entry.sourceCollection, sourceReference: entry.sourceReference }));

  return {
    title: "Lease Evidence Package",
    subtitle: leaseTitle(lease.data, sources.property, sources.unit),
    governance: {
      evidencePackageId: `lep_${stableHash([landlordId, leaseId, generatedAt], 24)}`,
      generatedBy: cleanText(input.generatedBy, 240) || "unknown",
      generatedAt,
      leaseId,
      landlordId,
      packageType: "lease_evidence_pdf",
      sourceReferences,
      auditReferences,
      sectionsIncluded: sections.map((entry) => entry.key),
    },
    sections,
  };
}

export function auditMetadataForLeaseEvidencePackage(pkg: LeaseEvidencePackage) {
  return {
    leaseId: pkg.governance.leaseId,
    landlordId: pkg.governance.landlordId,
    generatedBy: pkg.governance.generatedBy,
    generatedAt: pkg.governance.generatedAt,
    packageType: pkg.governance.packageType,
    sectionsIncluded: pkg.governance.sectionsIncluded,
    ...(pkg.governance.verification || {}),
  };
}
