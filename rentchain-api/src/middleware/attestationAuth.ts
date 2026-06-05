import type { NextFunction, Request, Response } from "express";
import { requireAuth } from "./requireAuth";
import type { SafeEvidenceReference } from "../types/attestation-types";
import type { AttestationAccessContext, AttestationAccessRole } from "../types/attestation-api-types";
import { buildAttestationLandlordRef } from "../services/attestation-hash-retrieval-service";
import { generateExportAuditSafeReference } from "../services/export-audit-trail-service";

type AttestationUser = {
  id?: string;
  sub?: string;
  role?: string;
  landlordId?: string;
  evidenceRefs?: string[];
  tenantEvidenceRefs?: string[];
  attestationEvidenceRefs?: string[];
};

export type AttestationRequest = Request & {
  user?: AttestationUser;
  attestationAccess?: AttestationAccessContext;
};

function roleFromUser(user: AttestationUser): AttestationAccessRole | null {
  const role = String(user.role || "").toLowerCase();
  if (role === "tenant") return "tenant";
  if (role === "landlord") return "landlord";
  if (role === "admin") return "admin";
  if (role === "support" || role === "adminsupport") return "support";
  return null;
}

function safeSubjectRef(user: AttestationUser): string {
  const id = user.id || user.sub;
  return generateExportAuditSafeReference("actor", id || "unknown");
}

function safeEvidenceRefs(user: AttestationUser): SafeEvidenceReference[] {
  const refs = [
    ...(user.evidenceRefs || []),
    ...(user.tenantEvidenceRefs || []),
    ...(user.attestationEvidenceRefs || []),
  ];
  return refs
    .map((value) => String(value || "").trim())
    .filter((value): value is SafeEvidenceReference => /^[a-z][a-z0-9_.:-]*:[a-f0-9][a-z0-9_.:-]{11,160}$/i.test(value));
}

export function buildAttestationAccessContext(user: AttestationUser | null | undefined): AttestationAccessContext | null {
  if (!user) return null;
  const role = roleFromUser(user);
  if (!role) return null;
  const landlordId = String(user.landlordId || (role === "landlord" ? user.id || "" : "")).trim();
  return {
    role,
    subjectRef: safeSubjectRef(user),
    landlordRef: landlordId ? buildAttestationLandlordRef(landlordId) : null,
    allowedEvidenceRefs: safeEvidenceRefs(user),
    supportPurpose: role === "admin" || role === "support" ? "attestation_metadata_review" : null,
    rawIdsIncluded: false,
  };
}

export async function requireAttestationAccess(req: AttestationRequest, res: Response, next: NextFunction) {
  return requireAuth(req, res, () => {
    const context = buildAttestationAccessContext(req.user);
    if (!context) {
      return res.status(403).json({
        success: false,
        data: null,
        error: "ATTESTATION_FORBIDDEN",
        code: "ATTESTATION_FORBIDDEN",
      });
    }
    req.attestationAccess = context;
    return next();
  });
}
