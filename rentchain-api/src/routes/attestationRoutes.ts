import { Router, type Response } from "express";
import {
  requireAttestationAccess,
  type AttestationRequest,
} from "../middleware/attestationAuth";
import {
  getAttestationEvidenceChain,
  getAttestationHashMetadata,
  verifyAttestationEvidenceChain,
} from "../services/attestation-hash-retrieval-service";
import type { AttestationApiEnvelope } from "../types/attestation-api-types";

const router = Router();

function ok<T>(res: Response, data: T) {
  const body: AttestationApiEnvelope<T> = {
    success: true,
    data,
    error: null,
    code: "OK",
  };
  return res.json(body);
}

function error(res: Response, status: number, code: Exclude<AttestationApiEnvelope<never>["code"], "OK">) {
  return res.status(status).json({
    success: false,
    data: null,
    error: code,
    code,
  });
}

function isForbidden(message: string): boolean {
  return message === "attestation_access_forbidden" || message === "attestation_access_context_invalid";
}

function isBadRequest(message: string): boolean {
  return message === "attestation_hash_invalid" || message === "attestation_evidence_ref_invalid";
}

function handleRouteError(res: Response, routeError: unknown) {
  const message = routeError instanceof Error ? routeError.message : "";
  if (isBadRequest(message)) return error(res, 400, "ATTESTATION_BAD_REQUEST");
  if (isForbidden(message)) return error(res, 403, "ATTESTATION_FORBIDDEN");
  return error(res, 500, "ATTESTATION_INTERNAL_ERROR");
}

router.get("/hash/:hashValue", requireAttestationAccess, async (req: AttestationRequest, res) => {
  try {
    const result = await getAttestationHashMetadata(String(req.params.hashValue || ""), req.attestationAccess!);
    if (!result) return error(res, 404, "ATTESTATION_NOT_FOUND");
    return ok(res, result);
  } catch (routeError) {
    return handleRouteError(res, routeError);
  }
});

router.get("/evidence/:evidenceId/chain", requireAttestationAccess, async (req: AttestationRequest, res) => {
  try {
    const result = await getAttestationEvidenceChain(String(req.params.evidenceId || ""), req.attestationAccess!, {
      limit: req.query.limit,
    });
    if (!result) return error(res, 404, "ATTESTATION_NOT_FOUND");
    return ok(res, result);
  } catch (routeError) {
    return handleRouteError(res, routeError);
  }
});

router.get("/evidence/:evidenceId/verify", requireAttestationAccess, async (req: AttestationRequest, res) => {
  try {
    const result = await verifyAttestationEvidenceChain(String(req.params.evidenceId || ""), req.attestationAccess!, {
      limit: req.query.limit,
    });
    if (!result) return error(res, 404, "ATTESTATION_NOT_FOUND");
    return ok(res, result);
  } catch (routeError) {
    return handleRouteError(res, routeError);
  }
});

export default router;
