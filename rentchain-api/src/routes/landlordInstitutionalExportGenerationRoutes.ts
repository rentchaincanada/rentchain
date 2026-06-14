import { Router } from "express";
import { getEffectiveLandlordId } from "../auth/requestAuthority";
import { buildDatedExportFilename, setAttachmentExportHeaders } from "../lib/exports/exportResponse";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import {
  generateLeaseEvidenceInstitutionalExport,
  INSTITUTIONAL_EXPORT_VERSION,
  parseInstitutionalExportRequest,
} from "../services/institutionalExports/institutionalExportService";

const router = Router();

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
  if (code === "UNSUPPORTED_EXPORT_FORMAT") return "UNSUPPORTED_EXPORT_FORMAT";
  if (code === "UNSUPPORTED_EXPORT_SCOPE") return "UNSUPPORTED_EXPORT_SCOPE";
  if (code === "UNSUPPORTED_EXPORT_RESOURCE") return "UNSUPPORTED_EXPORT_RESOURCE";
  if (code === "INVALID_EXPORT_REASON") return "INVALID_EXPORT_REASON";
  if (code === "LEASE_ID_REQUIRED") return "LEASE_ID_REQUIRED";
  return "INSTITUTIONAL_EXPORT_GENERATION_FAILED";
}

function institutionalExportRouteVersion(_req: any, res: any, next: any) {
  res.setHeader("X-RentChain-Institutional-Export-Version", INSTITUTIONAL_EXPORT_VERSION);
  return next();
}

router.post("/institutional-exports", institutionalExportRouteVersion, requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(getEffectiveLandlordId(req), 240);
    const generatedBy = asString(req.user?.id || req.user?.uid || req.user?.email || landlordId, 240);
    const request = parseInstitutionalExportRequest(req.body);
    const result = await generateLeaseEvidenceInstitutionalExport({ request, landlordId, generatedBy });

    await writeCanonicalEvent({
      domain: "lease",
      action: "institutional_export_generated",
      status: "generated",
      actor: {
        type: "landlord",
        role: "landlord",
        id: generatedBy,
      },
      resource: {
        type: "lease",
        id: request.leaseId,
      },
      occurredAt: result.metadata.generatedAt,
      visibility: "internal",
      summary: "Lease institutional evidence export generated",
      metadata: result.metadata,
    });

    setAttachmentExportHeaders(res, {
      filename: buildDatedExportFilename({ prefix: result.filenamePrefix, format: "pdf" }),
      format: "pdf",
      sensitivity: "confidential",
    });
    res.setHeader("X-RentChain-Institutional-Export-Id", result.metadata.exportId);
    res.setHeader("X-RentChain-Institutional-Export-Version", result.metadata.exportVersion);
    res.setHeader("X-RentChain-Evidence-Package-Id", result.metadata.evidencePackageId);
    return res.status(200).send(result.pdf);
  } catch (error: any) {
    const status = statusFor(error);
    if (status >= 500) {
      console.error("[institutional-export] generation failed", { message: error?.message || "failed" });
    }
    return res.status(status).json({ ok: false, error: codeFor(error) });
  }
});

export default router;
