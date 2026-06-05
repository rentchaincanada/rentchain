import crypto from "crypto";
import { Router, type Request, type Response } from "express";
import { getEffectiveLandlordId } from "../auth/requestAuthority";
import type { InstitutionalTrustExportAudience, InstitutionalTrustExportPurpose } from "../lib/institutionTrustExports/institutionTrustExportTypes";
import type { InstitutionExportPackageType } from "../lib/institutionExports/institutionExportTypes";
import type { TrustWorkspaceSummary } from "../lib/trustWorkspace/trustWorkspaceTypes";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { requestSignatureForPackage } from "../services/attestation-service";
import { getTrustWorkspaceForUser } from "../services/trust-workspace-service";
import type { ExportAuthorizationContext } from "../types/export-authorization-types";
import type { ExportPackage } from "../types/export-package-types";
import type { ExportPurpose, ExportRecipientType } from "../types/export-recipient-types";

const router = Router();

const PACKAGE_TYPES = new Set<InstitutionExportPackageType>([
  "lender_due_diligence",
  "insurance_review",
  "government_program_review",
  "auditor_review",
  "internal_admin_review",
]);

const AUDIENCES = new Set<InstitutionalTrustExportAudience>([
  "insurer",
  "lender",
  "institutional_landlord",
  "subsidy_program",
  "government_review",
  "tenant_portability",
  "auditor",
  "internal_review",
]);

type SignoffRequestBody = {
  evidenceRef?: unknown;
  packageRef?: unknown;
  packageType?: unknown;
  audience?: unknown;
  purpose?: unknown;
};

type SignoffSuccessResponse = {
  ok: true;
  attestationRef: string;
  timestamp: number;
  status: "signature_requested";
};

type TrustContextResponse = {
  ok: true;
  context: TrustWorkspaceSummary;
};

type ErrorResponse = {
  ok: false;
  error:
    | "UNAUTHORIZED"
    | "INVALID_SCOPE"
    | "ATTESTATION_FORBIDDEN"
    | "EVIDENCE_NOT_FOUND"
    | "PACKAGE_NOT_FOUND"
    | "ATTESTATION_CHAIN_INVALID"
    | "TRUST_CONTEXT_FAILED"
    | "SIGNATURE_REQUEST_FAILED";
};

function asString(value: unknown, max = 240): string {
  return String(value ?? "").replace(/[<>]/g, "").trim().slice(0, max);
}

function stableHash(value: unknown, length = 32): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, length);
}

function validatePackageType(value: unknown): InstitutionExportPackageType | null {
  const raw = asString(value, 120) as InstitutionExportPackageType;
  return PACKAGE_TYPES.has(raw) ? raw : null;
}

function validateAudience(value: unknown): InstitutionalTrustExportAudience | null {
  const raw = asString(value, 120) as InstitutionalTrustExportAudience;
  return AUDIENCES.has(raw) ? raw : null;
}

function purposeForPackageType(packageType: InstitutionExportPackageType): InstitutionalTrustExportPurpose {
  if (packageType === "insurance_review") return "insurance_review";
  if (packageType === "lender_due_diligence") return "lender_review";
  if (packageType === "government_program_review") return "government_program_review";
  if (packageType === "auditor_review") return "auditor_review";
  return "internal_review";
}

function isSafeReference(value: string): boolean {
  return /^[a-z][a-z0-9_.:-]*:[a-z0-9_.:-]{12,180}$/i.test(value) || /^exp_[a-z0-9_:-]{12,180}$/i.test(value);
}

function makeErrorResponse(res: Response, status: number, error: ErrorResponse["error"]) {
  return res.status(status).json({ ok: false, error } satisfies ErrorResponse);
}

function makeSignoffResult(res: Response, input: { attestationRef: string; timestamp: number }) {
  return res.json({
    ok: true,
    attestationRef: input.attestationRef,
    timestamp: input.timestamp,
    status: "signature_requested",
  } satisfies SignoffSuccessResponse);
}

function workspaceHasEvidence(workspace: TrustWorkspaceSummary, evidenceRef: string): boolean {
  return workspace.evidenceSummaries.some((summary) => summary.evidenceRef === evidenceRef);
}

function workspaceHasPackage(workspace: TrustWorkspaceSummary, packageRef: string): boolean {
  return workspace.exportReadinessStates.some(
    (summary) => summary.exportPackageRef === packageRef && summary.policyGateStatus !== "unavailable"
  );
}

function workspaceHasVerifiedAttestation(workspace: TrustWorkspaceSummary, evidenceRef: string): boolean {
  const evidence = workspace.evidenceSummaries.find((summary) => summary.evidenceRef === evidenceRef);
  if (!evidence || evidence.attestationStatus !== "SignatureVerified") return false;
  return workspace.attestationContexts.some((context) => context.evidenceRef === evidenceRef && context.hashVerificationStatus === "verified");
}

function exportRecipientForAudience(audience: InstitutionalTrustExportAudience): ExportRecipientType {
  if (audience === "insurer") return "InsuranceAdjuster";
  if (audience === "government_review" || audience === "subsidy_program" || audience === "auditor") return "Regulator";
  if (audience === "internal_review") return "SelfArchive";
  return "ReservedFutureInstitution";
}

function exportPurposeForAudience(audience: InstitutionalTrustExportAudience): ExportPurpose {
  if (audience === "insurer") return "InsuranceClaim";
  if (audience === "government_review" || audience === "subsidy_program") return "RegulatoryCompliance";
  if (audience === "auditor") return "AuditReview";
  if (audience === "internal_review") return "SelfReview";
  return "ReservedFuturePurpose";
}

function exportPackageForSignoff(input: {
  packageRef: string;
  packageType: InstitutionExportPackageType;
  audience: InstitutionalTrustExportAudience;
  landlordId: string;
  timestamp: string;
}): ExportPackage {
  return {
    exportPackageId: input.packageRef,
    exportRequestId: `exp_req_v1_${stableHash(["signoff_request", input.packageRef], 20)}`,
    landlordId: input.landlordId,
    recipientType: exportRecipientForAudience(input.audience),
    purpose: exportPurposeForAudience(input.audience),
    packageMetadata: {
      assembledAt: input.timestamp,
      assembledBy: "landlord_operator",
      assemblyVersion: `trust_signoff_${input.packageType}`,
      includedEvidenceCount: 1,
      totalPackageSize: 1,
      checksumAlgorithm: "sha256",
      checksumValue: null,
    },
    evidenceManifest: {
      evidenceClasses: ["AuditEvidence"],
      dateRangeApplied: { start: null, end: null },
      unitsScopeApplied: [],
      redactionPolicyApplied: "Redacted",
      excludedEvidence: [],
    },
    status: "Assembled",
    auditTrailReference: `export_audit:${stableHash(["trust_signoff", input.packageRef], 24)}`,
    metadata: {
      packageType: input.packageType,
      audience: input.audience,
      metadataOnly: true,
    },
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

function authorizationContext(input: { req: Request; landlordId: string; purpose: string; timestamp: string }): ExportAuthorizationContext {
  const user = (input.req as Request & { user?: { id?: string; uid?: string; sub?: string } }).user;
  const actor = user?.id || user?.uid || user?.sub || "landlord_operator";
  const landlordScope = `landlord:${stableHash(["landlord_scope", input.landlordId], 24)}`;
  return {
    requestingActorId: `actor:${stableHash(["landlord_actor", actor], 24)}`,
    requestingActorRole: "LandlordAdmin",
    requestingActorScope: landlordScope,
    requestingPurpose: input.purpose || "evidence_export_trust_signoff",
    timestamp: input.timestamp,
    rawIdsIncluded: false,
  };
}

router.get("/evidence-export-trust-context", requireAuth, requireLandlord, async (req: Request, res: Response) => {
  try {
    const landlordId = asString(getEffectiveLandlordId(req), 240);
    if (!landlordId) return makeErrorResponse(res, 401, "UNAUTHORIZED");
    const result = await getTrustWorkspaceForUser({
      id: ((req as Request & { user?: { id?: string } }).user?.id || landlordId),
      role: "landlord",
      landlordId,
    });
    if (!result.ok) return makeErrorResponse(res, 500, "TRUST_CONTEXT_FAILED");
    return res.json({ ok: true, context: result.workspace } satisfies TrustContextResponse);
  } catch (error) {
    console.error("[landlord-evidence-export-trust-signoff] context failed", {
      message: error instanceof Error ? error.message : "failed",
    });
    return makeErrorResponse(res, 500, "TRUST_CONTEXT_FAILED");
  }
});

router.post("/evidence-export-trust-signoff", requireAuth, requireLandlord, async (req: Request, res: Response) => {
  try {
    const landlordId = asString(getEffectiveLandlordId(req), 240);
    if (!landlordId) return makeErrorResponse(res, 401, "UNAUTHORIZED");
    const body = (req.body || {}) as SignoffRequestBody;
    const evidenceRef = asString(body.evidenceRef, 240);
    const packageRef = asString(body.packageRef, 240);
    const packageType = validatePackageType(body.packageType);
    const audience = validateAudience(body.audience);
    const purpose = asString(body.purpose, 120);
    if (!evidenceRef || !packageRef || !packageType || !audience || !purpose) {
      return makeErrorResponse(res, 400, "INVALID_SCOPE");
    }
    if (!isSafeReference(evidenceRef) || !isSafeReference(packageRef)) {
      return makeErrorResponse(res, 400, "INVALID_SCOPE");
    }

    const workspace = await getTrustWorkspaceForUser(
      {
        id: ((req as Request & { user?: { id?: string } }).user?.id || landlordId),
        role: "landlord",
        landlordId,
      },
      {
        exportReadinessRequests: [{ audience, purpose: purposeForPackageType(packageType), exportRef: packageRef }],
      }
    );
    if (!workspace.ok) return makeErrorResponse(res, 500, "TRUST_CONTEXT_FAILED");
    if (!workspaceHasEvidence(workspace.workspace, evidenceRef)) return makeErrorResponse(res, 404, "EVIDENCE_NOT_FOUND");
    if (!workspaceHasPackage(workspace.workspace, packageRef)) return makeErrorResponse(res, 404, "PACKAGE_NOT_FOUND");
    if (!workspaceHasVerifiedAttestation(workspace.workspace, evidenceRef)) {
      return makeErrorResponse(res, 400, "ATTESTATION_CHAIN_INVALID");
    }

    const timestamp = new Date().toISOString();
    const landlordScope = `landlord:${stableHash(["landlord_scope", landlordId], 24)}`;
    const pkg = exportPackageForSignoff({ packageRef, packageType, audience, landlordId: landlordScope, timestamp });
    const event = await requestSignatureForPackage(pkg, authorizationContext({ req, landlordId, purpose, timestamp }), {
      attestationId: `attestation:${stableHash(["trust_signoff", landlordId, packageRef, evidenceRef], 32)}`,
      reason: "evidence_export_trust_signoff",
      timestamp,
    });
    const attestationRef = asString(event?.metadata.details.attestationRef, 160);
    if (!event || !attestationRef.startsWith("attestation:")) {
      return makeErrorResponse(res, 500, "SIGNATURE_REQUEST_FAILED");
    }
    return makeSignoffResult(res, { attestationRef, timestamp: Date.parse(event.timestamp) });
  } catch (error) {
    console.error("[landlord-evidence-export-trust-signoff] signoff failed", {
      message: error instanceof Error ? error.message : "failed",
    });
    return makeErrorResponse(res, 500, "SIGNATURE_REQUEST_FAILED");
  }
});

export default router;
