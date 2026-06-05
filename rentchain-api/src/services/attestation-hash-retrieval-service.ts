import { db } from "../firebase";
import { CANONICAL_EVENTS_COLLECTION } from "../lib/events/buildEvent";
import { isSha256Hash } from "../lib/evidence-hash-service";
import {
  buildHashChainFromAttestation,
  validateHashChainIntegrity,
  verifyEvidenceHashAgainstChain,
} from "./hash-chain-validation-service";
import { verifyAttestationChainIntegrity } from "./attestation-service";
import {
  generateExportAuditSafeReference,
  type ExportAuditTrailFirestoreLike,
} from "./export-audit-trail-service";
import type {
  AttestationChain,
  AttestationChainEvent,
  AttestationLifecycleState,
  AttestationSafeReference,
  CertificateSafeReference,
  SafeEvidenceReference,
  SignatureAlgorithm,
} from "../types/attestation-types";
import type { ExportAuditEventPayload } from "../types/export-audit-types";
import type {
  AttestationAccessContext,
  AttestationChainEventResponse,
  AttestationChainResponse,
  AttestationHashMetadataResponse,
  AttestationVerifyResponse,
} from "../types/attestation-api-types";

type QuerySnapshotLike<T> = {
  docs?: Array<{ data: () => T }>;
};

type QueryLike<T> = {
  where?: (fieldPath: string, opStr: string, value: unknown) => QueryLike<T>;
  orderBy?: (fieldPath: string, directionStr?: "asc" | "desc") => QueryLike<T>;
  limit?: (limit: number) => QueryLike<T>;
  get: () => Promise<QuerySnapshotLike<T>>;
};

type RetrievalOptions = {
  firestore?: ExportAuditTrailFirestoreLike;
  events?: readonly ExportAuditEventPayload[];
};

type ChainLookup = {
  chain: AttestationChain;
  events: ExportAuditEventPayload[];
};

const ATTESTATION_EVENTS = new Set([
  "ExportPackageSignatureRequested",
  "ExportPackageSignatureGenerated",
  "ExportPackageSignatureVerified",
  "ExportPackageAttestationLinked",
  "ExportPackageAttestationRevoked",
]);

const STATE_BY_EVENT_TYPE: Partial<Record<ExportAuditEventPayload["eventType"], AttestationLifecycleState>> = {
  ExportPackageSignatureRequested: "SignatureRequested",
  ExportPackageSignatureGenerated: "SignatureGenerated",
  ExportPackageSignatureVerified: "SignatureVerified",
  ExportPackageAttestationLinked: "AttestationLinked",
  ExportPackageAttestationRevoked: "AttestationRevoked",
};

const SAFE_EVIDENCE_REF = /^[a-z][a-z0-9_.:-]*:[a-f0-9][a-z0-9_.:-]{11,160}$/i;

function firestore(options: RetrievalOptions): ExportAuditTrailFirestoreLike {
  return options.firestore || (db as unknown as ExportAuditTrailFirestoreLike);
}

function queryWhere<T>(query: QueryLike<T>, field: string, value: unknown): QueryLike<T> {
  if (!query.where) throw new Error("attestation_query_unavailable");
  return query.where(field, "==", value);
}

async function runQuery(
  options: RetrievalOptions,
  filters: Array<{ field: string; value: unknown }>,
  limit?: number
): Promise<ExportAuditEventPayload[]> {
  if (options.events) {
    return options.events
      .filter((event) =>
        filters.every((filter) => {
          if (filter.field === "metadata.details.contentHash") return event.metadata.details.contentHash === filter.value;
          if (filter.field === "metadata.details.linkedEvidenceRef") return event.metadata.details.linkedEvidenceRef === filter.value;
          return event[filter.field as keyof ExportAuditEventPayload] === filter.value;
        })
      )
      .slice(0, limit || Number.MAX_SAFE_INTEGER);
  }

  const collection = firestore(options).collection<ExportAuditEventPayload>(CANONICAL_EVENTS_COLLECTION);
  let query = collection.get ? (collection as unknown as QueryLike<ExportAuditEventPayload>) : null;
  for (const filter of filters) {
    query = queryWhere(query || (collection as unknown as QueryLike<ExportAuditEventPayload>), filter.field, filter.value);
  }
  if (query?.orderBy) query = query.orderBy("timestamp", "asc");
  if (limit && query?.limit) query = query.limit(limit);
  if (!query?.get) throw new Error("attestation_query_unavailable");
  return (await query.get()).docs?.map((doc) => doc.data()) || [];
}

function isAttestationEvent(event: ExportAuditEventPayload): boolean {
  return ATTESTATION_EVENTS.has(event.eventType);
}

function isSafeEvidenceReference(value: unknown): value is AttestationVerifyResponse["evidenceRef"] {
  const text = String(value ?? "").trim();
  return SAFE_EVIDENCE_REF.test(text);
}

function safeSignatureAlgorithm(value: unknown): SignatureAlgorithm | null {
  return value === "RSA-SHA256" || value === "ECDSA-SHA256" ? value : null;
}

function safeCertificateRef(value: unknown): CertificateSafeReference | null {
  const text = String(value ?? "").trim();
  return text.startsWith("certificate:") ? (text as CertificateSafeReference) : null;
}

function safeEvidenceRef(value: unknown): SafeEvidenceReference | null {
  return isSafeEvidenceReference(value) ? value : null;
}

function chainEventFromAudit(event: ExportAuditEventPayload): AttestationChainEvent | null {
  const lifecycleState = STATE_BY_EVENT_TYPE[event.eventType];
  if (!lifecycleState) return null;
  const details = event.metadata.details;
  const attestationRef = String(details.attestationRef || "").trim();
  if (!attestationRef.startsWith("attestation:")) return null;
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    lifecycleState,
    timestamp: event.timestamp,
    attestationRef: attestationRef as AttestationSafeReference,
    signatureRef: details.signatureRef ? String(details.signatureRef) : null,
    certificateRef: safeCertificateRef(details.certificateRef),
    signatureAlgorithm: safeSignatureAlgorithm(details.signatureAlgorithm),
    contentHash: isSha256Hash(details.contentHash) ? String(details.contentHash) : null,
    evidenceRef: safeEvidenceRef(details.linkedEvidenceRef),
    eventSummary: event.metadata.eventSummary,
    metadataOnly: true,
    immutable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

function normalizeLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 50;
  return Math.min(parsed, 100);
}

function assertAccess(context: AttestationAccessContext, chain: AttestationChain): void {
  if (context.rawIdsIncluded !== false || !context.subjectRef) throw new Error("attestation_access_context_invalid");
  if (context.role === "admin" || context.role === "support") return;
  if (context.role === "landlord" && context.landlordRef && context.landlordRef === chain.landlordRef) return;
  if (
    context.role === "tenant" &&
    chain.events.some((event) => event.evidenceRef && context.allowedEvidenceRefs.includes(event.evidenceRef))
  ) {
    return;
  }
  throw new Error("attestation_access_forbidden");
}

function eventResponse(event: AttestationChain["events"][number]): AttestationChainEventResponse {
  return {
    eventType: event.eventType,
    lifecycleState: event.lifecycleState,
    timestamp: event.timestamp,
    hashValue: event.contentHash,
    signatureRef: event.signatureRef,
    certificateRef: event.certificateRef,
    signatureAlgorithm: event.signatureAlgorithm,
    evidenceRef: event.evidenceRef,
    metadataOnly: true,
    immutable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

function chainResponse(chain: AttestationChain, limit: number): AttestationChainResponse {
  const events = chain.events.map(eventResponse);
  const limited = events.slice(0, limit);
  return {
    attestationRef: chain.attestationRef,
    exportPackageRef: chain.exportPackageRef,
    currentState: chain.currentState,
    events: limited,
    pagination: {
      limit,
      returned: limited.length,
      hasMore: events.length > limit,
    },
    metadataOnly: true,
    appendOnly: true,
    immutable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

async function buildChainForEvent(event: ExportAuditEventPayload, options: RetrievalOptions): Promise<ChainLookup> {
  const events = await runQuery(options, [
    { field: "landlordReferenceId", value: event.landlordReferenceId },
    { field: "targetReferenceId", value: event.targetReferenceId },
  ]);
  const filtered = events.filter(isAttestationEvent);
  const wantedAttestationRef = String(event.metadata.details.attestationRef || "").trim();
  const chainEvents = filtered
    .map(chainEventFromAudit)
    .filter((entry): entry is AttestationChainEvent => Boolean(entry))
    .filter((entry) => !wantedAttestationRef || entry.attestationRef === wantedAttestationRef)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const chain: AttestationChain = {
    attestationRef: (wantedAttestationRef || chainEvents[0]?.attestationRef || "attestation:unavailable") as AttestationSafeReference,
    landlordRef: event.landlordReferenceId,
    exportPackageRef: event.targetReferenceId,
    events: chainEvents,
    currentState: chainEvents.at(-1)?.lifecycleState || null,
    metadataOnly: true,
    appendOnly: true,
    immutable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
  return { chain, events: filtered };
}

async function findChainsForEvidence(
  evidenceRef: AttestationVerifyResponse["evidenceRef"],
  options: RetrievalOptions
): Promise<ChainLookup[]> {
  const linkEvents = await runQuery(options, [{ field: "metadata.details.linkedEvidenceRef", value: evidenceRef }]);
  const lookups: ChainLookup[] = [];
  const seen = new Set<string>();
  for (const event of linkEvents.filter(isAttestationEvent)) {
    const key = `${event.landlordReferenceId}:${event.targetReferenceId}:${event.metadata.details.attestationRef || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lookups.push(await buildChainForEvent(event, options));
  }
  return lookups;
}

export function buildAttestationLandlordRef(landlordId: string): string {
  return generateExportAuditSafeReference("landlord", landlordId);
}

export async function getAttestationHashMetadata(
  hashValue: string,
  access: AttestationAccessContext,
  options: RetrievalOptions = {}
): Promise<AttestationHashMetadataResponse | null> {
  if (!isSha256Hash(hashValue)) throw new Error("attestation_hash_invalid");
  const matches = await runQuery(options, [{ field: "metadata.details.contentHash", value: hashValue }], 20);
  const event = matches.filter(isAttestationEvent).sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0];
  if (!event) return null;
  const { chain } = await buildChainForEvent(event, options);
  assertAccess(access, chain);
  const integrity = verifyAttestationChainIntegrity(chain);
  const hashChain = buildHashChainFromAttestation(chain);
  const hashIntegrity = validateHashChainIntegrity(hashChain);
  const responseEvent = chain.events.find((entry) => entry.contentHash === hashValue) || chain.events.at(-1) || null;
  return {
    hashValue,
    attestationRef: chain.attestationRef,
    exportPackageRef: chain.exportPackageRef,
    evidenceRef: responseEvent?.evidenceRef || chain.events.find((entry) => entry.evidenceRef)?.evidenceRef || null,
    lifecycleState: responseEvent?.lifecycleState || chain.currentState,
    signature: {
      signatureRef: responseEvent?.signatureRef || null,
      certificateRef: responseEvent?.certificateRef || null,
      signatureAlgorithm: responseEvent?.signatureAlgorithm || null,
    },
    verificationStatus: integrity.valid && hashIntegrity.success && hashChain.verifiedHash === hashValue ? "verified" : "unverified",
    observedAt: responseEvent?.timestamp || null,
    metadataOnly: true,
    immutable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export async function getAttestationEvidenceChain(
  evidenceRefInput: string,
  access: AttestationAccessContext,
  options: RetrievalOptions & { limit?: unknown } = {}
): Promise<AttestationChainResponse | null> {
  if (!isSafeEvidenceReference(evidenceRefInput)) throw new Error("attestation_evidence_ref_invalid");
  const lookups = await findChainsForEvidence(evidenceRefInput, options);
  const lookup = lookups[0];
  if (!lookup) return null;
  assertAccess(access, lookup.chain);
  return chainResponse(lookup.chain, normalizeLimit(options.limit));
}

export async function verifyAttestationEvidenceChain(
  evidenceRefInput: string,
  access: AttestationAccessContext,
  options: RetrievalOptions & { limit?: unknown } = {}
): Promise<AttestationVerifyResponse | null> {
  if (!isSafeEvidenceReference(evidenceRefInput)) throw new Error("attestation_evidence_ref_invalid");
  const lookups = await findChainsForEvidence(evidenceRefInput, options);
  const lookup = lookups[0];
  if (!lookup) return null;
  assertAccess(access, lookup.chain);
  const hashChain = buildHashChainFromAttestation(lookup.chain);
  const hashValue = hashChain.verifiedHash || hashChain.generatedHash;
  const verification = hashValue
    ? verifyEvidenceHashAgainstChain(hashValue, lookup.chain)
    : {
        success: false,
        matchedHash: null,
        attestationRef: lookup.chain.attestationRef,
        chainEventReferences: [],
        errors: ["verification_hash_missing"],
        metadataOnly: true as const,
        rawIdsIncluded: false as const,
        payloadIncluded: false as const,
      };
  return {
    evidenceRef: evidenceRefInput,
    verified: verification.success,
    matchedHash: verification.matchedHash,
    attestationRef: lookup.chain.attestationRef,
    verificationErrors: verification.errors,
    chain: chainResponse(lookup.chain, normalizeLimit(options.limit)),
    metadataOnly: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}
