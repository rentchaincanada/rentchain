import crypto from "crypto";
import type {
  AttestationChainEvent,
  AttestationLink,
  AttestationSafeReference,
  SafeEvidenceReference,
} from "../types/attestation-types";
import { generateExportAuditSafeReference } from "./export-audit-trail-service";

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

function evidenceRef(value: unknown): SafeEvidenceReference {
  const text = safeText(value, 160);
  if (/^(evidence|exp_pkg_v1_|exportpackage|attestation|certificate)[:_]/.test(text)) return text as SafeEvidenceReference;
  return `evidence:${stableHash(["evidence", text])}`;
}

export function linkEvidencePackageToAttestation(input: {
  landlordId: string;
  attestationId: string;
  evidencePackageId: string;
  linkedAt?: string;
}): AttestationLink {
  const landlordRef = generateExportAuditSafeReference("landlord", input.landlordId);
  const exportPackageRef = generateExportAuditSafeReference("ExportPackage", input.evidencePackageId);
  return {
    attestationRef: attestationRef(input.attestationId),
    evidenceRef: evidenceRef(exportPackageRef),
    exportPackageRef,
    landlordRef,
    linkStatus: "linked",
    linkedAt: toUtcIso(input.linkedAt),
    revokedAt: null,
    metadataOnly: true,
    immutable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export function linkEvidenceToAttestation(input: {
  landlordId: string;
  attestationId: string;
  evidenceRef: string;
  exportPackageId: string;
  linkedAt?: string;
}): AttestationLink {
  return {
    ...linkEvidencePackageToAttestation({
      landlordId: input.landlordId,
      attestationId: input.attestationId,
      evidencePackageId: input.exportPackageId,
      linkedAt: input.linkedAt,
    }),
    evidenceRef: evidenceRef(input.evidenceRef),
  };
}

export function queryEvidenceAttestations(
  landlordId: string,
  evidencePackageId: string,
  links: readonly AttestationLink[]
): AttestationLink[] {
  const landlordRef = generateExportAuditSafeReference("landlord", landlordId);
  const packageRef = generateExportAuditSafeReference("ExportPackage", evidencePackageId);
  return links.filter((link) => link.landlordRef === landlordRef && link.exportPackageRef === packageRef);
}

export function buildEvidenceAttestationMap(
  landlordId: string,
  packageId: string,
  links: readonly AttestationLink[],
  events: readonly AttestationChainEvent[]
): Map<SafeEvidenceReference, AttestationChainEvent[]> {
  const scopedLinks = queryEvidenceAttestations(landlordId, packageId, links);
  const eventsByAttestation = new Map<AttestationSafeReference, AttestationChainEvent[]>();
  for (const event of events) {
    const current = eventsByAttestation.get(event.attestationRef) || [];
    current.push(event);
    eventsByAttestation.set(event.attestationRef, current);
  }
  const result = new Map<SafeEvidenceReference, AttestationChainEvent[]>();
  for (const link of scopedLinks) {
    result.set(link.evidenceRef, eventsByAttestation.get(link.attestationRef) || []);
  }
  return result;
}
