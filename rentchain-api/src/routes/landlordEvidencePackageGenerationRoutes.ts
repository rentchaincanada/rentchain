import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { getEffectiveLandlordId } from "../auth/requestAuthority";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import { buildDatedExportFilename, setAttachmentExportHeaders } from "../lib/exports/exportResponse";
import {
  auditMetadataForLeaseEvidencePackage,
  generateLeaseEvidencePackage,
} from "../services/evidencePackages/leaseEvidencePackageService";
import {
  buildLeaseEvidencePackageVerificationMetadata,
  LEASE_EVIDENCE_PACKAGE_VERSION,
} from "../services/evidencePackages/leaseEvidencePackageManifest";
import { renderLeaseEvidencePackagePdf } from "../services/evidencePackages/leaseEvidencePackagePdf";

const router = Router();
const EVIDENCE_PACKAGE_ROUTE_VERSION = LEASE_EVIDENCE_PACKAGE_VERSION;

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function statusFor(error: any): number {
  const status = Number(error?.status);
  return Number.isInteger(status) && status >= 400 && status < 600 ? status : 500;
}

function codeFor(error: any): string {
  const code = asString(error?.message, 120);
  if (code === "lease_not_found") return "LEASE_NOT_FOUND";
  if (code === "forbidden") return "FORBIDDEN";
  if (code === "lease_id_required") return "LEASE_ID_REQUIRED";
  if (code === "landlord_id_required") return "UNAUTHORIZED";
  return "LEASE_EVIDENCE_PACKAGE_GENERATION_FAILED";
}

function evidencePackageRouteVersion(_req: any, res: any, next: any) {
  res.setHeader("x-evidence-package-route-version", EVIDENCE_PACKAGE_ROUTE_VERSION);
  return next();
}

router.get("/evidence-packages/leases/:leaseId.pdf", evidencePackageRouteVersion, requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(getEffectiveLandlordId(req), 240);
    const leaseId = asString(req.params?.leaseId, 240);
    const generatedBy = asString(req.user?.id || req.user?.uid || req.user?.email || landlordId, 240);
    const pkg = await generateLeaseEvidencePackage({ leaseId, landlordId, generatedBy });
    pkg.governance.verification = buildLeaseEvidencePackageVerificationMetadata(pkg);
    const pdf = await renderLeaseEvidencePackagePdf(pkg);

    await writeCanonicalEvent({
      domain: "lease",
      action: "evidence_package_generated",
      status: "generated",
      actor: {
        type: "landlord",
        role: "landlord",
        id: generatedBy,
      },
      resource: {
        type: "lease",
        id: leaseId,
      },
      occurredAt: pkg.governance.generatedAt,
      visibility: "internal",
      summary: "Lease evidence package PDF generated",
      metadata: auditMetadataForLeaseEvidencePackage(pkg),
    });

    setAttachmentExportHeaders(res, {
      filename: buildDatedExportFilename({ prefix: "rentchain-lease-evidence-package", format: "pdf" }),
      format: "pdf",
      sensitivity: "confidential",
    });
    res.setHeader("X-RentChain-Evidence-Package-Id", pkg.governance.evidencePackageId);
    return res.status(200).send(pdf);
  } catch (error: any) {
    const status = statusFor(error);
    if (status >= 500) {
      console.error("[lease-evidence-package] generation failed", { message: error?.message || "failed" });
    }
    return res.status(status).json({ ok: false, error: codeFor(error) });
  }
});

export default router;
