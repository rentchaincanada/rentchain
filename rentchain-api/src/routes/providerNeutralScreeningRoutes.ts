import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { requireAdmin } from "../middleware/requireAdmin";
import { db } from "../firebase";
import { uploadBufferToGcs } from "../lib/gcs";
import {
  ScreeningConsentService,
  ScreeningDecisionService,
  ScreeningManualReportService,
  ScreeningRequestService,
  ScreeningResultService,
  ScreeningWebhookService,
  ScreeningWorkflowError,
  projectRequest,
  projectResult,
} from "../services/screening/providerNeutralWorkflowService";
import { screeningProviderRegistry } from "../services/screening/providers/providerNeutralRegistry";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const consentService = new ScreeningConsentService();
const requestService = new ScreeningRequestService(consentService);
const webhookService = new ScreeningWebhookService();
const resultService = new ScreeningResultService(requestService);
const decisionService = new ScreeningDecisionService(requestService);
const manualReportService = new ScreeningManualReportService(requestService);

function tenantIdFromUser(user: any) {
  return String(user?.tenantId || user?.id || "").trim();
}

function landlordIdFromUser(user: any) {
  return String(user?.landlordId || user?.id || "").trim();
}

function safeError(res: any, error: unknown) {
  if (error instanceof ScreeningWorkflowError) {
    return res.status(error.status).json({ ok: false, code: error.code, error: error.code });
  }
  return res.status(500).json({ ok: false, code: "SCREENING_WORKFLOW_ERROR", error: "SCREENING_WORKFLOW_ERROR" });
}

function projectConsent(consent: any) {
  return {
    consentId: consent.id,
    tenantId: consent.tenantId,
    landlordId: consent.landlordId,
    unitId: consent.unitId,
    status: consent.status,
    grantedAt: consent.grantedAt,
    revokedAt: consent.revokedAt || null,
  };
}

router.post("/tenant/:tenantId/screeningConsent", requireAuth, async (req: any, res) => {
  try {
    const consent = await consentService.grantConsent({
      tenantId: String(req.params.tenantId || ""),
      landlordId: String(req.body?.landlordId || ""),
      unitId: String(req.body?.unitId || ""),
      actorTenantId: tenantIdFromUser(req.user),
    });
    return res.status(201).json({ ok: true, consent: projectConsent(consent) });
  } catch (error) {
    return safeError(res, error);
  }
});

router.delete("/tenant/:tenantId/screeningConsent/:consentId", requireAuth, async (req: any, res) => {
  try {
    const consent = await consentService.revokeConsent({
      tenantId: String(req.params.tenantId || ""),
      consentId: String(req.params.consentId || ""),
      actorTenantId: tenantIdFromUser(req.user),
    });
    return res.status(200).json({ ok: true, consent: projectConsent(consent) });
  } catch (error) {
    return safeError(res, error);
  }
});

router.get("/tenant/:tenantId/screeningConsent", requireAuth, async (req: any, res) => {
  try {
    const tenantId = String(req.params.tenantId || "");
    if (tenantId !== tenantIdFromUser(req.user)) {
      return res.status(403).json({ ok: false, code: "TENANT_FORBIDDEN", error: "TENANT_FORBIDDEN" });
    }
    const consents = await consentService.listActiveConsents(tenantId);
    return res.status(200).json({ ok: true, consents: consents.map(projectConsent) });
  } catch (error) {
    return safeError(res, error);
  }
});

router.post("/landlord/units/:unitId/screeningRequest", requireLandlord, async (req: any, res) => {
  try {
    const request = await requestService.initiateScreening({
      landlordId: landlordIdFromUser(req.user),
      unitId: String(req.params.unitId || ""),
      tenantId: String(req.body?.tenantId || ""),
      consentId: String(req.body?.consentId || ""),
      providerId: req.body?.providerId ? String(req.body.providerId) : null,
    });
    return res.status(201).json({
      ok: true,
      requestId: request.id,
      status: request.status,
      initiatedAt: request.requestedAt,
    });
  } catch (error) {
    return safeError(res, error);
  }
});

router.get("/landlord/units/:unitId/screeningRequest", requireLandlord, async (req: any, res) => {
  try {
    const requests = await requestService.listUnitRequests(landlordIdFromUser(req.user), String(req.params.unitId || ""));
    return res.status(200).json({ ok: true, requests: requests.map(projectRequest) });
  } catch (error) {
    return safeError(res, error);
  }
});

router.get("/landlord/units/:unitId/screeningRequest/:requestId", requireLandlord, async (req: any, res) => {
  try {
    const request = await requestService.getOwnedRequest(
      String(req.params.requestId || ""),
      landlordIdFromUser(req.user),
      String(req.params.unitId || ""),
    );
    return res.status(200).json({ ok: true, request: projectRequest(request) });
  } catch (error) {
    return safeError(res, error);
  }
});

router.get("/landlord/units/:unitId/screeningRequest/:requestId/result", requireLandlord, async (req: any, res) => {
  try {
    const request = await requestService.getOwnedRequest(
      String(req.params.requestId || ""),
      landlordIdFromUser(req.user),
      String(req.params.unitId || ""),
    );
    const result = await resultService.getResultForRequest(request.id, landlordIdFromUser(req.user));
    if (!result) return res.status(404).json({ ok: false, code: "RESULT_NOT_FOUND", error: "RESULT_NOT_FOUND" });
    return res.status(200).json({ ok: true, result: projectResult(result) });
  } catch (error) {
    return safeError(res, error);
  }
});

router.post("/landlord/units/:unitId/screeningRequest/:requestId/decision", requireLandlord, async (req: any, res) => {
  try {
    const request = await decisionService.recordDecision({
      landlordId: landlordIdFromUser(req.user),
      unitId: String(req.params.unitId || ""),
      requestId: String(req.params.requestId || ""),
      decision: req.body?.decision,
      reason: req.body?.reason,
      notes: req.body?.notes,
    });
    return res.status(200).json({
      ok: true,
      decisionId: request.id,
      decisionStatus: request.decisionStatus,
      decidedAt: request.decisionMadeAt,
    });
  } catch (error) {
    return safeError(res, error);
  }
});

router.post(
  "/landlord/units/:unitId/screeningRequest/:requestId/manualReport",
  requireLandlord,
  upload.single("file"),
  async (req: any, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ ok: false, code: "REPORT_FILE_REQUIRED", error: "REPORT_FILE_REQUIRED" });
      const safeName = String(file.originalname || "report").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
      const storagePath = `screening-reports/${landlordIdFromUser(req.user)}/${String(req.params.requestId || "")}/${Date.now()}-${safeName}`;
      const uploaded = await uploadBufferToGcs({
        path: storagePath,
        contentType: file.mimetype,
        buffer: file.buffer,
        metadata: {
          requestId: String(req.params.requestId || ""),
          unitId: String(req.params.unitId || ""),
        },
      });
      const request = await manualReportService.recordManualReport({
        landlordId: landlordIdFromUser(req.user),
        unitId: String(req.params.unitId || ""),
        requestId: String(req.params.requestId || ""),
        fileName: safeName,
        contentType: file.mimetype,
        storageUrl: `gs://${uploaded.bucket}/${uploaded.path}`,
      });
      return res.status(200).json({
        ok: true,
        reportUrl: request.manualReportUrl,
        uploadedAt: request.manualReportUploadedAt,
      });
    } catch (error) {
      return safeError(res, error);
    }
  },
);

router.post("/webhook/screening/:providerId", async (req: any, res) => {
  const providerId = String(req.params.providerId || "");
  const provider = screeningProviderRegistry.getProvider(providerId);
  if (!provider || !provider.isConfigured()) {
    await webhookService.recordWebhookLog({
      providerId,
      headers: req.headers,
      payload: req.body,
      verified: false,
      status: "rejected",
      errorCode: "PROVIDER_NOT_CONFIGURED",
    });
    return res.status(401).json({ ok: false, code: "PROVIDER_NOT_CONFIGURED", error: "PROVIDER_NOT_CONFIGURED" });
  }

  try {
    const verified = await provider.verifyWebhookSignature({ headers: req.headers, body: req.body, rawBody: req.rawBody });
    if (!verified) {
      await webhookService.recordWebhookLog({ providerId, headers: req.headers, payload: req.body, verified: false, status: "rejected" });
      return res.status(401).json({ ok: false, code: "WEBHOOK_SIGNATURE_INVALID", error: "WEBHOOK_SIGNATURE_INVALID" });
    }
    const parsed = await provider.parseWebhookPayload(req.body);
    await webhookService.recordWebhookLog({
      providerId,
      headers: req.headers,
      payload: req.body,
      verified: true,
      status: "verified",
      parsedRequestId: parsed.requestId,
    });
    await resultService.recordResult({ providerId, parsed, payload: req.body });
    return res.status(200).json({ status: "success" });
  } catch (error) {
    await webhookService.recordWebhookLog({
      providerId,
      headers: req.headers,
      payload: req.body,
      verified: true,
      status: "parse_failed",
      errorCode: error instanceof ScreeningWorkflowError ? error.code : "WEBHOOK_PARSE_FAILED",
    });
    return safeError(res, error);
  }
});

router.get("/admin/screening/auditLog", requireAdmin, async (_req, res) => {
  const snap = await db.collection("screeningRequests").get();
  const requests = snap.docs.map((doc: any) => {
    const data = doc.data() || {};
    return {
      requestId: doc.id,
      status: data.status || null,
      requestedAt: data.requestedAt || null,
      resultReceivedAt: data.resultReceivedAt || null,
      decisionStatus: data.decisionStatus || null,
      auditLog: Array.isArray(data.auditLog) ? data.auditLog : [],
    };
  });
  return res.status(200).json({ ok: true, requests });
});

async function listWebhookLogs(providerId: string, res: any) {
  const snap = await db.collection("screeningWebhookLogs").where("providerId", "==", providerId).get();
  const logs = snap.docs.map((doc: any) => {
    const data = doc.data() || {};
    return {
      logId: doc.id,
      providerId: data.providerId || null,
      timestamp: data.timestamp || null,
      verified: Boolean(data.verified),
      status: data.status || null,
      payloadDigest: data.payloadDigest || null,
      parsedRequestId: data.parsedRequestId || null,
      errorCode: data.errorCode || null,
    };
  });
  return res.status(200).json({ ok: true, logs });
}

router.get("/admin/screening/webhookLogs/:providerId", requireAdmin, async (req, res) => {
  return listWebhookLogs(String(req.params.providerId || ""), res);
});

router.get("/admin/screening/webookLogs/:providerId", requireAdmin, async (req, res) => {
  return listWebhookLogs(String(req.params.providerId || ""), res);
});

export default router;
