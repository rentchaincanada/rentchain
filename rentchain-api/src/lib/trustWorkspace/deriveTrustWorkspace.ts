import crypto from "crypto";
import { computeEvidenceRecordHash, isSha256Hash } from "../../lib/evidence-hash-service";
import { verifyAttestationEvidenceChain } from "../../services/attestation-hash-retrieval-service";
import { generateExportAuditSafeReference } from "../../services/export-audit-trail-service";
import type { AttestationAccessContext } from "../../types/attestation-api-types";
import type { ExportAuditEventPayload } from "../../types/export-audit-types";
import type { EvidenceRecord } from "../../types/evidence-record-types";
import type { PortableAttestation } from "../portableAttestations/portableAttestationTypes";
import { deriveInstitutionalTrustExportPackage } from "../institutionTrustExports/deriveInstitutionalTrustExportPackage";
import type {
  InstitutionalTrustExportAudience,
  InstitutionalTrustExportPurpose,
} from "../institutionTrustExports/institutionTrustExportTypes";
import { deriveCrossOrganizationTrust } from "../crossOrganizationTrust/deriveCrossOrganizationTrust";
import type { DeriveCrossOrganizationTrustInput } from "../crossOrganizationTrust/crossOrganizationTrustTypes";
import type {
  TrustWorkspaceAccessContext,
  TrustWorkspaceAttestationContext,
  TrustWorkspaceCrossOrgContext,
  TrustWorkspaceEvidenceChainSummary,
  TrustWorkspaceExportReadinessSummary,
  TrustWorkspaceLandlordContext,
  TrustWorkspaceSummary,
} from "./trustWorkspaceTypes";

export type TrustWorkspaceDerivationInput = {
  context: TrustWorkspaceAccessContext;
  evidenceRecords?: readonly EvidenceRecord[];
  auditEvents?: readonly ExportAuditEventPayload[];
  portableAttestations?: readonly PortableAttestation[];
  exportReadinessRequests?: ReadonlyArray<{
    audience: InstitutionalTrustExportAudience;
    purpose: InstitutionalTrustExportPurpose;
    exportRef?: string | null;
  }>;
  crossOrgInput?: Omit<DeriveCrossOrganizationTrustInput, "landlordId" | "generatedAt"> | null;
  derivedAt?: string;
};

function stableHash(value: unknown, length = 32): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, length);
}

function toIso(value: unknown): string {
  const raw = String(value ?? "").trim();
  const parsed = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function safeEvidenceRef(value: unknown): string {
  const text = String(value ?? "").trim();
  return text.startsWith("evidence:") ? text : `evidence:${stableHash(["evidence", text], 24)}`;
}

function accessForAttestation(context: TrustWorkspaceAccessContext): AttestationAccessContext {
  return {
    role: context.role,
    subjectRef: context.requesterRef,
    landlordRef: context.landlordRef,
    allowedEvidenceRefs: context.allowedEvidenceRefs,
    supportPurpose: context.supportPurpose,
    rawIdsIncluded: false,
  };
}

function assertContext(context: TrustWorkspaceAccessContext): void {
  if (!context.requesterRef || context.rawIdsIncluded !== false) throw new Error("trust_workspace_invalid_context");
  if (!["tenant", "landlord", "admin", "support"].includes(context.role)) throw new Error("trust_workspace_invalid_role");
  if ((context.role === "landlord" || context.role === "support") && !context.landlordRef) {
    throw new Error("trust_workspace_missing_landlord_scope");
  }
  if (context.role === "tenant" && !context.allowedEvidenceRefs.length) throw new Error("trust_workspace_missing_tenant_scope");
}

export function buildTrustWorkspaceContext(input: {
  context: TrustWorkspaceAccessContext;
  derivedAt?: string;
}): TrustWorkspaceLandlordContext {
  assertContext(input.context);
  const derivedAt = toIso(input.derivedAt);
  const workspaceRef = `trust_workspace:${stableHash([
    input.context.role,
    input.context.landlordRef,
    input.context.tenantRef,
    input.context.allowedEvidenceRefs,
    derivedAt.slice(0, 10),
  ])}`;
  return {
    ...input.context,
    derivedAt,
    workspaceRef,
    metadataOnly: true,
    immutable: true,
    nonPublic: true,
    nonShareable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

function isEvidenceVisible(record: EvidenceRecord, context: TrustWorkspaceLandlordContext): boolean {
  const recordLandlordRef = generateExportAuditSafeReference("landlord", record.landlordId);
  const evidenceRef = safeEvidenceRef(record.safeReference.safeReferenceKey) as TrustWorkspaceEvidenceChainSummary["evidenceRef"];
  if (context.role === "admin") return true;
  if (context.role === "support") return Boolean(context.landlordRef && context.landlordRef === recordLandlordRef);
  if (context.role === "landlord") return Boolean(context.landlordRef && context.landlordRef === recordLandlordRef);
  if (context.role === "tenant") return context.allowedEvidenceRefs.includes(evidenceRef);
  return false;
}

export async function deriveEvidenceChainSummary(
  record: EvidenceRecord,
  context: TrustWorkspaceLandlordContext,
  options: { auditEvents?: readonly ExportAuditEventPayload[] } = {}
): Promise<TrustWorkspaceEvidenceChainSummary> {
  if (!isEvidenceVisible(record, context)) throw new Error("trust_workspace_evidence_forbidden");
  const evidenceRef = safeEvidenceRef(record.safeReference.safeReferenceKey) as TrustWorkspaceEvidenceChainSummary["evidenceRef"];
  const attestation = await verifyAttestationEvidenceChain(evidenceRef, accessForAttestation(context), {
    events: options.auditEvents,
  }).catch(() => null);
  const contentHash = record.rawIdsIncluded === false && record.metadataOnly === true ? computeEvidenceRecordHash(record) : null;
  return {
    evidenceRef,
    evidenceClass: record.evidenceClass,
    evidenceType: record.evidenceType,
    resourceType: record.resourceType,
    status: record.status,
    contentHash: isSha256Hash(contentHash) ? contentHash : null,
    provenanceChain: record.provenanceMetadata.provenanceChain.map((item) => safeEvidenceRef(item.safeReferenceKey) as TrustWorkspaceEvidenceChainSummary["evidenceRef"]),
    authority: {
      authorityRole: record.provenanceMetadata.authority.authorityRole,
      landlordRef: record.provenanceMetadata.authority.landlordRef,
      tenantRef: context.role === "admin" || context.role === "support" ? record.provenanceMetadata.authority.tenantRef : null,
      supportAllowed: record.provenanceMetadata.authority.supportAllowed,
      rawIdsIncluded: false,
    },
    attestationStatus: attestation?.chain?.currentState || (attestation?.verified ? "SignatureVerified" : "Unlinked"),
    policyEvaluationState: attestation?.verified ? "export_ready" : "unavailable",
    metadataOnly: true,
    immutable: true,
    nonPublic: true,
    nonShareable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export async function deriveAttestationContext(
  evidenceRef: string,
  context: TrustWorkspaceLandlordContext,
  options: { auditEvents?: readonly ExportAuditEventPayload[] } = {}
): Promise<TrustWorkspaceAttestationContext | null> {
  const verified = await verifyAttestationEvidenceChain(evidenceRef, accessForAttestation(context), {
    events: options.auditEvents,
  }).catch(() => null);
  if (!verified) return null;
  const lastEvent = verified.chain?.events.at(-1) || null;
  return {
    attestationRef: verified.attestationRef || "attestation:unavailable",
    evidenceRef: verified.evidenceRef,
    lifecycleState: verified.chain?.currentState || null,
    signatureRef: lastEvent?.signatureRef || null,
    certificateRef: lastEvent?.certificateRef || null,
    signatureAlgorithm: lastEvent?.signatureAlgorithm || null,
    hashValue: verified.matchedHash,
    hashVerificationStatus: verified.verified ? "verified" : verified.verificationErrors.length ? "invalid" : "unavailable",
    linkedEvidence: [verified.evidenceRef],
    metadataOnly: true,
    immutable: true,
    nonPublic: true,
    nonShareable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export function deriveExportReadinessSummary(input: {
  audience: InstitutionalTrustExportAudience;
  purpose: InstitutionalTrustExportPurpose;
  exportRef?: string | null;
  attestations?: readonly PortableAttestation[];
  derivedAt?: string;
}): TrustWorkspaceExportReadinessSummary {
  const pkg = deriveInstitutionalTrustExportPackage({
    exportId: input.exportRef || `trust_workspace_export:${input.audience}:${input.purpose}`,
    audience: input.audience,
    purpose: input.purpose,
    generatedAt: input.derivedAt,
    attestations: [...(input.attestations || [])],
  });
  return {
    exportPackageRef: generateExportAuditSafeReference("TrustWorkspace", pkg.exportId),
    audience: pkg.audience,
    purpose: pkg.purpose,
    status: pkg.status,
    policyGateStatus: pkg.status === "export_ready" ? "ready" : pkg.status === "blocked" ? "blocked" : "unavailable",
    blockedReasonCount: pkg.blockedReasons.length,
    exportableAttestationCount: pkg.auditMetadata.exportableAttestationCount,
    blockedAttestationCount: pkg.auditMetadata.blockedAttestationCount,
    manualOnly: true,
    publicAccessEnabled: false,
    externalSubmissionEnabled: false,
    metadataOnly: true,
    immutable: true,
    nonPublic: true,
    nonShareable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

function stateFromCount(verified: number, blocked: number, unavailable: number): TrustWorkspaceCrossOrgContext["evidenceTrustState"] {
  if (blocked > 0) return "blocked";
  if (unavailable > 0) return "review_required";
  return verified > 0 ? "verified" : "unknown";
}

export function deriveCrossOrgContext(
  landlordRef: string,
  input: Omit<DeriveCrossOrganizationTrustInput, "landlordId" | "generatedAt"> | null | undefined,
  derivedAt?: string
): TrustWorkspaceCrossOrgContext[] {
  if (!input) return [];
  const relationship = deriveCrossOrganizationTrust({
    ...input,
    landlordId: landlordRef,
    generatedAt: derivedAt,
  });
  return [
    {
      trustRelationshipRef: generateExportAuditSafeReference("TrustWorkspace", relationship.trustRelationshipId),
      relationshipType: relationship.relationshipType,
      status: relationship.status,
      evidenceTrustState: stateFromCount(
        relationship.evidenceReferences.filter((item) => item.status === "verified").length,
        relationship.evidenceReferences.filter((item) => item.status === "blocked").length,
        relationship.evidenceReferences.filter((item) => item.status === "unavailable").length
      ),
      reviewTrustState: stateFromCount(
        relationship.reviewReferences.filter((item) => item.status === "verified").length,
        relationship.reviewReferences.filter((item) => item.status === "blocked").length,
        relationship.reviewReferences.filter((item) => item.status === "unavailable").length
      ),
      settlementTrustState: stateFromCount(
        relationship.settlementReferences.filter((item) => item.status === "verified").length,
        relationship.settlementReferences.filter((item) => item.status === "blocked").length,
        relationship.settlementReferences.filter((item) => item.status === "unavailable").length
      ),
      restrictionCount: relationship.trustRestrictions.length,
      blockedReasonCount: relationship.blockedReasons.length,
      manualReviewRequired: true,
      publicTrustExposureEnabled: false,
      autonomousTrustApprovalEnabled: false,
      metadataOnly: true,
      immutable: true,
      nonPublic: true,
      nonShareable: true,
      rawIdsIncluded: false,
      payloadIncluded: false,
    },
  ];
}

export async function assembleTrustWorkspaceSummary(input: TrustWorkspaceDerivationInput): Promise<TrustWorkspaceSummary> {
  const context = buildTrustWorkspaceContext({ context: input.context, derivedAt: input.derivedAt });
  const evidenceRecords = (input.evidenceRecords || []).filter((record) => isEvidenceVisible(record, context));
  if (context.role === "tenant" && !evidenceRecords.length) throw new Error("trust_workspace_no_tenant_evidence");
  const evidenceSummaries = await Promise.all(
    evidenceRecords.map((record) => deriveEvidenceChainSummary(record, context, { auditEvents: input.auditEvents }))
  );
  const attestationContexts = (
    await Promise.all(evidenceSummaries.map((summary) => deriveAttestationContext(summary.evidenceRef, context, { auditEvents: input.auditEvents })))
  ).filter((item): item is TrustWorkspaceAttestationContext => item !== null);
  const exportReadinessStates =
    context.role === "tenant"
      ? []
      : (input.exportReadinessRequests || []).map((request) =>
          deriveExportReadinessSummary({
            ...request,
            attestations: input.portableAttestations,
            derivedAt: context.derivedAt,
          })
        );
  const crossOrgContexts =
    context.role === "tenant" ? [] : deriveCrossOrgContext(context.landlordRef || "landlord:unavailable", input.crossOrgInput, context.derivedAt);
  return {
    workspaceRef: context.workspaceRef,
    derivedAt: context.derivedAt,
    role: context.role,
    landlordRef: context.landlordRef,
    tenantRef: context.role === "admin" || context.role === "support" || context.role === "tenant" ? context.tenantRef : null,
    evidenceSummaries,
    attestationContexts: context.role === "tenant" ? [] : attestationContexts,
    exportReadinessStates,
    crossOrgContexts,
    errorFlags: [
      ...(evidenceSummaries.some((summary) => summary.attestationStatus === "Invalid") ? ["attestation_invalid"] : []),
      ...(exportReadinessStates.some((summary) => summary.policyGateStatus === "blocked") ? ["export_policy_blocked"] : []),
      ...(crossOrgContexts.some((summary) => summary.status === "blocked") ? ["cross_org_blocked"] : []),
    ],
    metadataOnly: true,
    immutable: true,
    nonPublic: true,
    nonShareable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}
