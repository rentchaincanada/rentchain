import { db } from "../../firebase";
import { CANONICAL_EVENTS_COLLECTION } from "../../lib/events/buildEvent";
import {
  TRUST_COMPLIANCE_CENTER_VERSION,
  type TrustComplianceCenterSummary,
  type TrustComplianceSafeMetadata,
  type TrustComplianceSectionKey,
  type TrustComplianceSectionSummary,
  type TrustComplianceSourceAvailability,
  type TrustComplianceStatus,
  type TrustComplianceSummaryItem,
} from "./trustComplianceTypes";

type DocSnapshotLike = {
  id: string;
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

type CollectionLike = QueryLike;

export type TrustComplianceFirestoreLike = {
  collection: (name: string) => CollectionLike;
};

type RecordWithId = {
  id: string;
  data: any;
  collectionName: string;
};

type SourceLoad = {
  records: RecordWithId[];
  available: boolean;
};

const MAX_SECTION_ITEMS = 6;
const MAX_RECENT_AUDIT_ITEMS = 12;
const MAX_SOURCE_RECORDS = 100;

const SECTION_LABELS: Record<TrustComplianceSectionKey, string> = {
  evidence_exports: "Evidence & Exports",
  consent: "Consent",
  privacy: "Privacy",
  retention: "Retention",
  screening: "Screening",
  audit_trail: "Audit Trail",
  incident_readiness: "Breach / Incident Readiness",
};

const SECTION_EMPTY: Record<TrustComplianceSectionKey, string> = {
  evidence_exports: "No evidence package or institutional export events are available yet.",
  consent: "No landlord-scoped consent records are available yet.",
  privacy: "No privacy governance events are available yet.",
  retention: "No retention metadata is available yet.",
  screening: "No landlord-scoped screening status records are available yet.",
  audit_trail: "No landlord-scoped governance audit events are available yet.",
  incident_readiness: "No incident readiness signals are available yet.",
};

const REDACTIONS = [
  "Raw Firestore document IDs are not used as human-facing labels.",
  "Raw event metadata, storage paths, provider request IDs, payment processor IDs, private documents, message bodies, and screening reports are excluded.",
  "Section summaries are bounded and metadata-only.",
];

const UNSAFE_PATTERN =
  /gs:\/\/|storage\.googleapis\.com|providerRequestId|providerRequestRef|processor|paymentIntent|checkoutSession|stripe|secret|token|credential|privateKey|rawPayload|messageBody|documentUrl|storagePath|screeningReport|bureau/i;

function trustDb(firestore?: TrustComplianceFirestoreLike): TrustComplianceFirestoreLike {
  return firestore || (db as unknown as TrustComplianceFirestoreLike);
}

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function safeText(value: unknown, fallback: string, max = 240): string {
  const text = asString(value, max).replace(/\s+/g, " ");
  if (!text || UNSAFE_PATTERN.test(text)) return fallback;
  return text;
}

function normalizeKey(value: unknown): string {
  return asString(value, 120).toLowerCase().replace(/[\s.-]+/g, "_");
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

function occurredAt(record: any): string | null {
  return timestamp(record?.occurredAt || record?.createdAt || record?.updatedAt || record?.generatedAt || record?.acceptedAt);
}

function sortByActivity<T extends { occurredAt: string | null; label?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const left = a.occurredAt ? Date.parse(a.occurredAt) : 0;
    const right = b.occurredAt ? Date.parse(b.occurredAt) : 0;
    if (left !== right) return right - left;
    return asString(a.label).localeCompare(asString(b.label));
  });
}

function sourceAvailability(records: RecordWithId[], available: boolean): TrustComplianceSourceAvailability {
  if (!available) return "unavailable";
  return records.length ? "available" : "empty";
}

function uniqueRecords(records: RecordWithId[]): RecordWithId[] {
  const byKey = new Map<string, RecordWithId>();
  for (const record of records) byKey.set(`${record.collectionName}:${record.id}`, record);
  return Array.from(byKey.values());
}

async function loadByLandlordFields(
  firestore: TrustComplianceFirestoreLike,
  collectionName: string,
  landlordId: string,
  fields: string[] = ["landlordId", "ownerId", "userId", "createdByLandlordId", "metadata.landlordId", "actor.id"]
): Promise<SourceLoad> {
  const records: RecordWithId[] = [];
  let available = true;
  await Promise.all(
    fields.map(async (field) => {
      const query = firestore.collection(collectionName).where?.(field, "==", landlordId);
      const limited = query?.limit?.(MAX_SOURCE_RECORDS) || query;
      const snap = await limited?.get().catch(() => {
        available = false;
        return null;
      });
      for (const doc of snap?.docs || []) {
        records.push({ id: doc.id, data: doc.data() || {}, collectionName });
      }
    })
  );
  return { records: uniqueRecords(records), available };
}

function belongsToLandlord(record: any, landlordId: string): boolean {
  const candidates = [
    record?.landlordId,
    record?.ownerId,
    record?.userId,
    record?.createdByLandlordId,
    record?.metadata?.landlordId,
    record?.actor?.id,
  ];
  return candidates.some((value) => asString(value, 240) === landlordId);
}

function pickSafeMetadata(metadata: any): TrustComplianceSafeMetadata | undefined {
  const safe: TrustComplianceSafeMetadata = {};
  for (const key of [
    "evidencePackageId",
    "manifestHash",
    "manifestVersion",
    "packageVersion",
    "exportFormat",
    "exportReason",
    "exportScope",
    "sensitivity",
    "retentionCategory",
    "consentState",
    "consentType",
    "screeningStatus",
  ] as const) {
    const value = asString(metadata?.[key], key === "manifestHash" ? 128 : 120);
    if (value && !UNSAFE_PATTERN.test(value)) safe[key] = value;
  }
  return Object.keys(safe).length ? safe : undefined;
}

function eventItem(event: any, fallbackLabel: string): TrustComplianceSummaryItem {
  const action = asString(event?.action, 120);
  const type = asString(event?.type, 160);
  return {
    label: safeText(event?.summary, fallbackLabel, 180),
    description: safeText(type || action, "Governance event metadata available.", 180),
    eventType: type || null,
    action: action || null,
    status: asString(event?.status, 80) || null,
    occurredAt: occurredAt(event),
    safeMetadata: pickSafeMetadata(event?.metadata || {}),
  };
}

function sourceItem(record: RecordWithId, params: { label: string; description: string; safeMetadata?: TrustComplianceSafeMetadata }): TrustComplianceSummaryItem {
  return {
    label: params.label,
    description: params.description,
    status: asString(record.data?.status || record.data?.state || record.data?.lifecycle, 80) || null,
    occurredAt: occurredAt(record.data),
    safeMetadata: params.safeMetadata,
  };
}

function buildSection(input: {
  key: TrustComplianceSectionKey;
  items: TrustComplianceSummaryItem[];
  availability: TrustComplianceSourceAvailability;
  forceStatus?: TrustComplianceStatus;
}): TrustComplianceSectionSummary {
  const items = sortByActivity(input.items).slice(0, MAX_SECTION_ITEMS);
  const lastActivityAt = sortByActivity(input.items)[0]?.occurredAt || null;
  const status = input.forceStatus || (input.availability === "unavailable" ? "unavailable" : input.items.length ? "ready" : "needs_attention");
  return {
    key: input.key,
    label: SECTION_LABELS[input.key],
    status,
    count: input.items.length,
    lastActivityAt,
    sourceAvailability: input.availability,
    items,
    emptyState: SECTION_EMPTY[input.key],
  };
}

function aggregateStatus(sections: TrustComplianceSectionSummary[]): TrustComplianceStatus {
  if (sections.every((section) => section.sourceAvailability === "unavailable")) return "unavailable";
  if (sections.some((section) => section.status === "needs_attention" || section.status === "unavailable")) return "needs_attention";
  return "ready";
}

export async function buildTrustComplianceSummary(input: {
  landlordId: string;
  firestore?: TrustComplianceFirestoreLike;
  generatedAt?: string | Date | null;
}): Promise<TrustComplianceCenterSummary> {
  const landlordId = asString(input.landlordId, 240);
  if (!landlordId) throw Object.assign(new Error("landlord_id_required"), { status: 401 });
  const firestore = trustDb(input.firestore);
  const generatedAt = timestamp(input.generatedAt) || new Date().toISOString();

  const [eventLoad, consentLoad, reportingConsentLoad, screeningOrderLoad, screeningEventLoad] = await Promise.all([
    loadByLandlordFields(firestore, CANONICAL_EVENTS_COLLECTION, landlordId),
    loadByLandlordFields(firestore, "consents", landlordId),
    loadByLandlordFields(firestore, "reportingConsents", landlordId, ["landlordId", "ownerId", "userId"]),
    loadByLandlordFields(firestore, "screeningOrders", landlordId),
    loadByLandlordFields(firestore, "screeningEvents", landlordId),
  ]);

  const canonicalEvents = eventLoad.records.map((record) => record.data).filter((event) => belongsToLandlord(event, landlordId));
  const evidenceEvents = canonicalEvents.filter((event) =>
    ["lease.evidence_package_generated", "lease.institutional_export_generated"].includes(asString(event?.type, 160)) ||
    ["evidence_package_generated", "institutional_export_generated"].includes(asString(event?.action, 160))
  );
  const consentRecords = uniqueRecords([...consentLoad.records, ...reportingConsentLoad.records]);
  const screeningRecords = uniqueRecords([...screeningOrderLoad.records, ...screeningEventLoad.records]);

  const privacyEvents = canonicalEvents.filter((event) => {
    const haystack = `${event?.domain || ""} ${event?.type || ""} ${event?.action || ""} ${event?.summary || ""}`.toLowerCase();
    return haystack.includes("privacy") || haystack.includes("consent") || haystack.includes("projection") || haystack.includes("access");
  });

  const retentionEvents = canonicalEvents.filter((event) => {
    const metadata = event?.metadata || {};
    return Boolean(metadata.retentionCategory || metadata.retentionClass || metadata.sensitivity);
  });

  const screeningEvents = canonicalEvents.filter((event) => {
    const domain = normalizeKey(event?.domain);
    const type = normalizeKey(event?.type);
    const action = normalizeKey(event?.action);
    return domain === "screening" || type.includes("screening") || action.includes("screening");
  });

  const incidentEvents = canonicalEvents.filter((event) => {
    const haystack = `${event?.domain || ""} ${event?.type || ""} ${event?.action || ""} ${event?.summary || ""}`.toLowerCase();
    return haystack.includes("incident") || haystack.includes("breach") || haystack.includes("security");
  });

  const sections = [
    buildSection({
      key: "evidence_exports",
      availability: sourceAvailability(evidenceEvents.map((data, index) => ({ id: String(index), data, collectionName: CANONICAL_EVENTS_COLLECTION })), eventLoad.available),
      items: evidenceEvents.map((event) => eventItem(event, "Evidence/export governance event")),
    }),
    buildSection({
      key: "consent",
      availability: sourceAvailability(consentRecords, consentLoad.available || reportingConsentLoad.available),
      items: consentRecords.map((record) =>
        sourceItem(record, {
          label: "Consent record",
          description: "Consent lifecycle metadata is available.",
          safeMetadata: {
            consentState: asString(record.data?.status || record.data?.state || record.data?.consentState, 80) || undefined,
            consentType: asString(record.data?.type || record.data?.consentType || record.data?.scope, 100) || undefined,
          },
        })
      ),
    }),
    buildSection({
      key: "privacy",
      availability: sourceAvailability(privacyEvents.map((data, index) => ({ id: String(index), data, collectionName: CANONICAL_EVENTS_COLLECTION })), eventLoad.available),
      items: privacyEvents.map((event) => eventItem(event, "Privacy governance event")),
    }),
    buildSection({
      key: "retention",
      availability: sourceAvailability(retentionEvents.map((data, index) => ({ id: String(index), data, collectionName: CANONICAL_EVENTS_COLLECTION })), eventLoad.available),
      items: retentionEvents.map((event) => eventItem(event, "Retention governance metadata")),
    }),
    buildSection({
      key: "screening",
      availability: sourceAvailability([...screeningRecords, ...screeningEvents.map((data, index) => ({ id: `event-${index}`, data, collectionName: CANONICAL_EVENTS_COLLECTION }))], screeningOrderLoad.available || screeningEventLoad.available || eventLoad.available),
      items: [
        ...screeningRecords.map((record) =>
          sourceItem(record, {
            label: "Screening status record",
            description: "Screening posture metadata is available.",
            safeMetadata: { screeningStatus: asString(record.data?.status || record.data?.state, 80) || undefined },
          })
        ),
        ...screeningEvents.map((event) => eventItem(event, "Screening governance event")),
      ],
    }),
    buildSection({
      key: "audit_trail",
      availability: sourceAvailability(canonicalEvents.map((data, index) => ({ id: String(index), data, collectionName: CANONICAL_EVENTS_COLLECTION })), eventLoad.available),
      items: canonicalEvents.map((event) => eventItem(event, "Governance audit event")),
    }),
    buildSection({
      key: "incident_readiness",
      availability: eventLoad.available ? (incidentEvents.length ? "available" : "empty") : "unavailable",
      items: incidentEvents.map((event) => eventItem(event, "Incident readiness signal")),
    }),
  ] satisfies TrustComplianceSectionSummary[];

  const recentAuditTrail = sortByActivity(canonicalEvents.map((event) => eventItem(event, "Governance audit event"))).slice(0, MAX_RECENT_AUDIT_ITEMS);

  return {
    version: TRUST_COMPLIANCE_CENTER_VERSION,
    generatedAt,
    landlordId,
    overallStatus: aggregateStatus(sections),
    sections,
    recentAuditTrail,
    redactions: REDACTIONS,
  };
}
