import crypto from "crypto";
import type { ExportAuthorizationContext } from "../types/export-authorization-types";
import type {
  AttestationChain,
  AttestationChainEvent,
  AttestationLifecycleState,
  AttestationProjection,
  AttestationSafeReference,
  CertificateSafeReference,
  SafeEvidenceReference,
  SignatureAlgorithm,
} from "../types/attestation-types";
import { SIGNATURE_ALGORITHMS } from "../types/attestation-types";
import type { ExportAuditEventPayload, ExportAuditEventType } from "../types/export-audit-types";
import type { ExportPackage } from "../types/export-package-types";
import { CANONICAL_EVENTS_COLLECTION } from "../lib/events/buildEvent";
import {
  appendAuditEventSafely,
  generateExportAuditSafeReference,
  type ExportAuditTrailFirestoreLike,
} from "./export-audit-trail-service";
import { linkEvidenceToAttestation as createEvidenceAttestationLink } from "./evidence-attestation-linker";
import { isSha256Hash } from "../lib/evidence-hash-service";
import { generateSignature } from "./signature-generation-service";
import type { VerificationResult } from "./hash-chain-validation-service";

const ATTESTATION_EVENT_TYPES = new Set<ExportAuditEventType>([
  "ExportPackageSignatureRequested",
  "ExportPackageSignatureGenerated",
  "ExportPackageSignatureVerified",
  "ExportPackageAttestationLinked",
  "ExportPackageAttestationRevoked",
]);

const STATE_BY_EVENT_TYPE: Partial<Record<ExportAuditEventType, AttestationLifecycleState>> = {
  ExportPackageSignatureRequested: "SignatureRequested",
  ExportPackageSignatureGenerated: "SignatureGenerated",
  ExportPackageSignatureVerified: "SignatureVerified",
  ExportPackageAttestationLinked: "AttestationLinked",
  ExportPackageAttestationRevoked: "AttestationRevoked",
};

const STATE_ORDER: AttestationLifecycleState[] = [
  "SignatureRequested",
  "SignatureGenerated",
  "SignatureVerified",
  "AttestationLinked",
  "AttestationRevoked",
];

function stableHash(value: unknown, length = 32): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, length);
}

function safeText(value: unknown, max = 240): string {
  return String(value ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function toUtcIso(value: unknown): string {
  const raw = safeText(value, 120);
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function attestationRef(value: unknown): AttestationSafeReference {
  const text = safeText(value, 160);
  return text.startsWith("attestation:") ? (text as AttestationSafeReference) : `attestation:${stableHash(["attestation", text])}`;
}

function certificateRef(value: unknown): CertificateSafeReference | null {
  if (!value) return null;
  const text = safeText(value, 160);
  return text.startsWith("certificate:") ? (text as CertificateSafeReference) : `certificate:${stableHash(["certificate", text])}`;
}

function signatureRef(value: unknown): string | null {
  if (!value) return null;
  const text = safeText(value, 160);
  return text.startsWith("signature:") ? text : `signature:${stableHash(["signature", text])}`;
}

function evidenceRef(value: unknown): SafeEvidenceReference | null {
  if (!value) return null;
  const text = safeText(value, 160);
  if (!text) return null;
  return (/^(evidence|exportpackage|attestation|certificate)[:_]/.test(text) ? text : `evidence:${stableHash(["evidence", text])}`) as SafeEvidenceReference;
}

function algorithm(value: unknown): SignatureAlgorithm | null {
  return SIGNATURE_ALGORITHMS.includes(value as SignatureAlgorithm) ? (value as SignatureAlgorithm) : null;
}

function safeContentHash(value: unknown): string | null {
  return isSha256Hash(value) ? value : null;
}

function assertContext(context: ExportAuthorizationContext, landlordId: string): void {
  if (context.rawIdsIncluded !== false || !context.requestingActorId) throw new Error("attestation_context_invalid");
  if (context.requestingActorScope !== landlordId && context.requestingActorRole !== "SystemService") {
    throw new Error("attestation_landlord_scope_mismatch");
  }
}

function attestationDetails(input: {
  attestationId: string;
  lifecycleState: AttestationLifecycleState;
  signatureId?: string | null;
  certificateId?: string | null;
  signatureAlgorithm?: SignatureAlgorithm | null;
  contentHash?: string | null;
  evidenceReference?: string | null;
}) {
  if (input.contentHash !== undefined && input.contentHash !== null && !isSha256Hash(input.contentHash)) {
    throw new Error("attestation_content_hash_invalid");
  }
  return {
    attestationRef: attestationRef(input.attestationId),
    signatureRef: signatureRef(input.signatureId),
    certificateRef: certificateRef(input.certificateId),
    signatureAlgorithm: input.signatureAlgorithm || null,
    contentHash: input.contentHash || null,
    lifecycleState: input.lifecycleState,
    linkedEvidenceRef: evidenceRef(input.evidenceReference),
    metadataOnly: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

async function appendAttestationAuditEvent(input: {
  pkg: ExportPackage;
  eventType: ExportAuditEventType;
  context: ExportAuthorizationContext;
  eventSummary: string;
  statusSummary: string;
  reason?: string | null;
  attestationId: string;
  lifecycleState: AttestationLifecycleState;
  signatureId?: string | null;
  certificateId?: string | null;
  signatureAlgorithm?: SignatureAlgorithm | null;
  contentHash?: string | null;
  evidenceReference?: string | null;
  timestamp?: string;
  firestore?: ExportAuditTrailFirestoreLike;
}): Promise<ExportAuditEventPayload | null> {
  assertContext(input.context, input.pkg.landlordId);
  return appendAuditEventSafely(
    {
      eventType: input.eventType,
      targetType: "ExportPackage",
      targetId: input.pkg.exportPackageId,
      landlordId: input.pkg.landlordId,
      context: input.context,
      eventSummary: input.eventSummary,
      statusSummary: input.statusSummary,
      reason: input.reason || null,
      details: attestationDetails(input),
      timestamp: toUtcIso(input.timestamp || input.context.timestamp),
    },
    { firestore: input.firestore }
  );
}

export async function appendSignatureRequestedAuditEvent(
  pkg: ExportPackage,
  context: ExportAuthorizationContext,
  input: { attestationId: string; reason?: string | null; timestamp?: string; firestore?: ExportAuditTrailFirestoreLike }
): Promise<ExportAuditEventPayload | null> {
  return appendAttestationAuditEvent({
    pkg,
    context,
    eventType: "ExportPackageSignatureRequested",
    eventSummary: "Export package signature requested.",
    statusSummary: "signature_requested",
    reason: input.reason || context.requestingPurpose,
    attestationId: input.attestationId,
    lifecycleState: "SignatureRequested",
    timestamp: input.timestamp,
    firestore: input.firestore,
  });
}

export async function appendSignatureGeneratedAuditEvent(
  pkg: ExportPackage,
  context: ExportAuthorizationContext,
  input: {
    attestationId: string;
    signatureId: string;
    certificateId: string;
    signatureAlgorithm: SignatureAlgorithm;
    contentHash?: string | null;
    reason?: string | null;
    timestamp?: string;
    firestore?: ExportAuditTrailFirestoreLike;
  }
): Promise<ExportAuditEventPayload | null> {
  if (!algorithm(input.signatureAlgorithm)) throw new Error("attestation_signature_algorithm_invalid");
  return appendAttestationAuditEvent({
    pkg,
    context,
    eventType: "ExportPackageSignatureGenerated",
    eventSummary: "Export package signature metadata generated.",
    statusSummary: "signature_generated",
    reason: input.reason || context.requestingPurpose,
    attestationId: input.attestationId,
    lifecycleState: "SignatureGenerated",
    signatureId: input.signatureId,
    certificateId: input.certificateId,
    signatureAlgorithm: input.signatureAlgorithm,
    contentHash: input.contentHash,
    timestamp: input.timestamp,
    firestore: input.firestore,
  });
}

export async function appendSignatureVerifiedAuditEvent(
  pkg: ExportPackage,
  context: ExportAuthorizationContext,
  input: {
    attestationId: string;
    signatureId: string;
    certificateId: string;
    signatureAlgorithm: SignatureAlgorithm;
    contentHash?: string | null;
    reason?: string | null;
    timestamp?: string;
    firestore?: ExportAuditTrailFirestoreLike;
  }
): Promise<ExportAuditEventPayload | null> {
  if (!algorithm(input.signatureAlgorithm)) throw new Error("attestation_signature_algorithm_invalid");
  return appendAttestationAuditEvent({
    pkg,
    context,
    eventType: "ExportPackageSignatureVerified",
    eventSummary: "Export package signature metadata verified.",
    statusSummary: "signature_verified",
    reason: input.reason || context.requestingPurpose,
    attestationId: input.attestationId,
    lifecycleState: "SignatureVerified",
    signatureId: input.signatureId,
    certificateId: input.certificateId,
    signatureAlgorithm: input.signatureAlgorithm,
    contentHash: input.contentHash,
    timestamp: input.timestamp,
    firestore: input.firestore,
  });
}

export async function appendAttestationLinkedAuditEvent(
  pkg: ExportPackage,
  context: ExportAuthorizationContext,
  input: {
    attestationId: string;
    evidenceReference: string;
    reason?: string | null;
    timestamp?: string;
    firestore?: ExportAuditTrailFirestoreLike;
  }
): Promise<ExportAuditEventPayload | null> {
  return appendAttestationAuditEvent({
    pkg,
    context,
    eventType: "ExportPackageAttestationLinked",
    eventSummary: "Export package attestation linked.",
    statusSummary: "attestation_linked",
    reason: input.reason || context.requestingPurpose,
    attestationId: input.attestationId,
    lifecycleState: "AttestationLinked",
    evidenceReference: input.evidenceReference,
    timestamp: input.timestamp,
    firestore: input.firestore,
  });
}

export function linkEvidenceToAttestation(input: Parameters<typeof createEvidenceAttestationLink>[0]) {
  return createEvidenceAttestationLink(input);
}

function packageAttestationId(pkg: ExportPackage, context: ExportAuthorizationContext): string {
  return `attestation:${stableHash(["export_package_signature", pkg.exportPackageId, pkg.landlordId, context.requestingActorId])}`;
}

export async function requestSignatureForPackage(
  pkg: ExportPackage,
  context: ExportAuthorizationContext,
  options: { attestationId?: string; reason?: string | null; timestamp?: string; firestore?: ExportAuditTrailFirestoreLike } = {}
): Promise<ExportAuditEventPayload | null> {
  assertContext(context, pkg.landlordId);
  return appendSignatureRequestedAuditEvent(pkg, context, {
    attestationId: options.attestationId || packageAttestationId(pkg, context),
    reason: options.reason,
    timestamp: options.timestamp,
    firestore: options.firestore,
  });
}

export async function recordGeneratedSignature(
  pkg: ExportPackage,
  hash: string,
  signatureAlgorithm: SignatureAlgorithm,
  certificateId: string,
  context: ExportAuthorizationContext,
  options: { attestationId?: string; reason?: string | null; timestamp?: string; firestore?: ExportAuditTrailFirestoreLike } = {}
): Promise<ExportAuditEventPayload | null> {
  assertContext(context, pkg.landlordId);
  const signature = generateSignature(hash, signatureAlgorithm, context, {
    certificateRef: certificateId,
    signedAt: options.timestamp || context.timestamp,
  });
  return appendSignatureGeneratedAuditEvent(pkg, context, {
    attestationId: options.attestationId || packageAttestationId(pkg, context),
    signatureId: signature.signatureRef,
    certificateId: signature.certificateRef,
    signatureAlgorithm: signature.signatureAlgorithm,
    contentHash: signature.contentHash,
    reason: options.reason,
    timestamp: options.timestamp,
    firestore: options.firestore,
  });
}

export async function recordVerifiedSignature(
  pkg: ExportPackage,
  hash: string,
  attestationId: string,
  context: ExportAuthorizationContext,
  options: {
    events?: readonly ExportAuditEventPayload[];
    firestore?: ExportAuditTrailFirestoreLike;
    evidenceReference?: string | null;
    reason?: string | null;
    timestamp?: string;
  } = {}
): Promise<VerificationResult> {
  assertContext(context, pkg.landlordId);
  const errors: string[] = [];
  if (!isSha256Hash(hash)) errors.push("verification_hash_invalid");
  const chain = await buildAttestationChain({
    landlordId: pkg.landlordId,
    exportPackageId: pkg.exportPackageId,
    attestationId,
    events: options.events,
    firestore: options.firestore,
  });
  const chainIntegrity = verifyAttestationChainIntegrity(chain);
  if (!chainIntegrity.valid) errors.push(...chainIntegrity.errors);
  const generated = chain.events.find((event) => event.lifecycleState === "SignatureGenerated");
  if (!generated) errors.push("verification_signature_generated_missing");
  if (generated?.contentHash && generated.contentHash !== hash) errors.push("verification_hash_mismatch");
  if (!generated?.contentHash) errors.push("verification_generated_hash_missing");
  if (!generated?.signatureRef) errors.push("verification_signature_reference_missing");
  if (!generated?.certificateRef) errors.push("verification_certificate_reference_missing");
  if (!generated?.signatureAlgorithm) errors.push("verification_signature_algorithm_missing");
  if (errors.length === 0 && generated) {
    const event = await appendSignatureVerifiedAuditEvent(pkg, context, {
      attestationId,
      signatureId: generated.signatureRef as string,
      certificateId: generated.certificateRef as string,
      signatureAlgorithm: generated.signatureAlgorithm as SignatureAlgorithm,
      contentHash: hash,
      reason: options.reason,
      timestamp: options.timestamp,
      firestore: options.firestore,
    });
    if (!event) errors.push("verification_audit_append_failed");
    if (options.evidenceReference) {
      createEvidenceAttestationLink({
        landlordId: pkg.landlordId,
        attestationId,
        evidenceRef: options.evidenceReference,
        exportPackageId: pkg.exportPackageId,
        linkedAt: options.timestamp || context.timestamp,
      });
    }
  }
  return {
    success: errors.length === 0,
    matchedHash: errors.length === 0 ? hash : null,
    attestationRef: attestationRef(attestationId),
    chainEventReferences: chain.events.map((event) => event.eventId),
    errors,
    metadataOnly: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

function chainEventFromAuditEvent(event: ExportAuditEventPayload): AttestationChainEvent | null {
  if (!ATTESTATION_EVENT_TYPES.has(event.eventType)) return null;
  const state = STATE_BY_EVENT_TYPE[event.eventType];
  if (!state) return null;
  const details = event.metadata.details;
  const attestation = attestationRef(details.attestationRef || event.targetReferenceId);
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    lifecycleState: state,
    timestamp: event.timestamp,
    attestationRef: attestation,
    signatureRef: signatureRef(details.signatureRef),
    certificateRef: certificateRef(details.certificateRef),
    signatureAlgorithm: algorithm(details.signatureAlgorithm),
    contentHash: safeContentHash(details.contentHash),
    evidenceRef: evidenceRef(details.linkedEvidenceRef),
    eventSummary: event.metadata.eventSummary,
    metadataOnly: true,
    immutable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

async function queryPackageAuditEvents(input: {
  landlordId: string;
  exportPackageId: string;
  firestore: ExportAuditTrailFirestoreLike;
}): Promise<ExportAuditEventPayload[]> {
  const landlordRef = generateExportAuditSafeReference("landlord", input.landlordId);
  const packageRef = generateExportAuditSafeReference("ExportPackage", input.exportPackageId);
  const collection = input.firestore.collection<ExportAuditEventPayload>(CANONICAL_EVENTS_COLLECTION);
  let query = collection.where?.("landlordReferenceId", "==", landlordRef);
  query = query?.where?.("targetType", "==", "ExportPackage");
  query = query?.where?.("targetReferenceId", "==", packageRef);
  query = query?.orderBy?.("timestamp", "asc") || query;
  if (!query?.get) throw new Error("attestation_query_unavailable");
  return (await query.get()).docs?.map((doc) => doc.data()) || [];
}

export async function buildAttestationChain(input: {
  landlordId: string;
  exportPackageId: string;
  attestationId?: string;
  events?: readonly ExportAuditEventPayload[];
  firestore?: ExportAuditTrailFirestoreLike;
}): Promise<AttestationChain> {
  const rawEvents = input.events || (input.firestore ? await queryPackageAuditEvents({
    landlordId: input.landlordId,
    exportPackageId: input.exportPackageId,
    firestore: input.firestore,
  }) : []);
  const packageRef = generateExportAuditSafeReference("ExportPackage", input.exportPackageId);
  const landlordRef = generateExportAuditSafeReference("landlord", input.landlordId);
  const wantedAttestationRef = input.attestationId ? attestationRef(input.attestationId) : null;
  const events = rawEvents
    .filter((event) => event.landlordReferenceId === landlordRef && event.targetReferenceId === packageRef)
    .map(chainEventFromAuditEvent)
    .filter((event): event is AttestationChainEvent => event !== null)
    .filter((event) => !wantedAttestationRef || event.attestationRef === wantedAttestationRef)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return {
    attestationRef: wantedAttestationRef || events[0]?.attestationRef || attestationRef(packageRef),
    landlordRef,
    exportPackageRef: packageRef,
    events,
    currentState: events.at(-1)?.lifecycleState || null,
    metadataOnly: true,
    appendOnly: true,
    immutable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export function verifyAttestationChainIntegrity(chain: AttestationChain): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (chain.rawIdsIncluded !== false || chain.payloadIncluded !== false) errors.push("attestation_chain_raw_or_payload_included");
  if (!chain.events.length) errors.push("attestation_chain_empty");
  let previousTime = 0;
  let previousOrder = -1;
  for (const event of chain.events) {
    const parsed = Date.parse(event.timestamp);
    if (!Number.isFinite(parsed)) errors.push("attestation_event_timestamp_invalid");
    if (parsed < previousTime) errors.push("attestation_event_timestamp_out_of_order");
    previousTime = parsed;
    if (event.attestationRef !== chain.attestationRef) errors.push("attestation_event_ref_mismatch");
    if (event.rawIdsIncluded !== false || event.payloadIncluded !== false) errors.push("attestation_event_raw_or_payload_included");
    const order = STATE_ORDER.indexOf(event.lifecycleState);
    if (order === -1) errors.push("attestation_event_state_invalid");
    if (order < previousOrder) errors.push("attestation_event_state_regression");
    if (event.lifecycleState !== "AttestationRevoked") previousOrder = order;
  }
  const states = chain.events.map((event) => event.lifecycleState);
  if (states.includes("SignatureGenerated") && !states.includes("SignatureRequested")) errors.push("attestation_chain_missing_signature_request");
  if (states.includes("SignatureVerified") && !states.includes("SignatureGenerated")) errors.push("attestation_chain_missing_signature_generation");
  if (states.includes("AttestationLinked") && !states.includes("SignatureVerified")) errors.push("attestation_chain_missing_signature_verification");
  return { valid: errors.length === 0, errors };
}

export function projectAttestationForLandlord(landlordId: string, chain: AttestationChain): AttestationProjection {
  const landlordRef = generateExportAuditSafeReference("landlord", landlordId);
  if (chain.landlordRef !== landlordRef) throw new Error("attestation_projection_landlord_scope_mismatch");
  return {
    attestationRef: chain.attestationRef,
    exportPackageRef: chain.exportPackageRef,
    currentState: chain.currentState,
    events: chain.events.map((event) => ({
      eventType: event.eventType,
      lifecycleState: event.lifecycleState,
      timestamp: event.timestamp,
      signatureAlgorithm: event.signatureAlgorithm,
      certificateRef: event.certificateRef,
      contentHash: event.contentHash,
      evidenceRef: event.evidenceRef,
    })),
    metadataOnly: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}
