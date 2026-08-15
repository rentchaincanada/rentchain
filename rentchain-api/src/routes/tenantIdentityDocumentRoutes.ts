import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { db } from "../firebase";
import {
  FirestoreIdentityDocumentRepository,
  GcsIdentityDocumentStorage,
  IdentityDocumentApplicationError,
  IdentityDocumentApplicationService,
  IdentityDocumentImageError,
  MAX_IDENTITY_DOCUMENT_FILE_BYTES,
  buildTenantIdentityRequirementStatus,
  type CanonicalIdentitySubjectContext,
  type IdentityDocumentRuntimePolicy,
} from "../lib/identityDocuments";
import { authenticateJwt } from "../middleware/authMiddleware";
import { previewQaAuth } from "../middleware/previewQaAuth";
import { resolveTenancyContext } from "../services/tenantPortal/tenancyContextService";

const router = Router();
router.use(authenticateJwt);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IDENTITY_DOCUMENT_FILE_BYTES, files: 1 },
});

const consentSchema = z.object({ acknowledged: z.literal(true), displayedLocale: z.string().trim().min(2).max(20) }).strict();
const uploadSchema = z
  .object({
    documentType: z.enum(["drivers_license", "passport", "provincial_id", "other_government_photo_id"]),
    side: z.enum(["front", "back", "photo_page", "single"]),
    issuingCountry: z.string().trim().length(2),
    issuingRegion: z.string().trim().min(1).max(120).optional(),
    replaceDocumentId: z.string().uuid().optional(),
  })
  .strict();

function requiredPolicyValue(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export function identityDocumentRuntimePolicyFromEnvironment(): IdentityDocumentRuntimePolicy {
  return {
    requirementPolicyId: requiredPolicyValue("IDENTITY_DOCUMENT_REQUIREMENT_POLICY_ID"),
    requirementPolicyVersion: requiredPolicyValue("IDENTITY_DOCUMENT_REQUIREMENT_POLICY_VERSION"),
    policyTextVersion: requiredPolicyValue("IDENTITY_DOCUMENT_POLICY_TEXT_VERSION"),
    privacyNoticeVersion: requiredPolicyValue("IDENTITY_DOCUMENT_PRIVACY_NOTICE_VERSION"),
    retentionPolicyId: requiredPolicyValue("IDENTITY_DOCUMENT_RETENTION_POLICY_ID"),
    retentionPolicyVersion: requiredPolicyValue("IDENTITY_DOCUMENT_RETENTION_POLICY_VERSION"),
  };
}

function service() {
  return new IdentityDocumentApplicationService(
    new FirestoreIdentityDocumentRepository(),
    new GcsIdentityDocumentStorage(),
    identityDocumentRuntimePolicyFromEnvironment(),
  );
}

async function loadApplication(applicationId: string) {
  for (const collection of ["applications", "rentalApplications"]) {
    const snapshot = await db.collection(collection).doc(applicationId).get();
    if (snapshot.exists) return snapshot.data() as any;
  }
  return null;
}

async function resolveCanonicalSubject(req: any): Promise<CanonicalIdentitySubjectContext | null> {
  const actorUserId = String(req.user?.id || "").trim();
  const role = String(req.user?.role || "").trim().toLowerCase();
  if (!actorUserId || role !== "tenant") return null;
  const tenancy = await resolveTenancyContext({
    uid: actorUserId,
    email: String(req.user?.email || "").trim() || null,
    tenantId: String(req.user?.tenantId || "").trim() || null,
    leaseId: String(req.user?.leaseId || "").trim() || null,
  });
  if (!tenancy.ok || tenancy.authority === "invite" || !tenancy.propertyId) return null;
  const property = await db.collection("properties").doc(tenancy.propertyId).get();
  const organizationId = property.exists ? String((property.data() as any)?.landlordId || "").trim() : "";
  if (!organizationId) return null;

  let subjectId = String(tenancy.tenantId || "").trim();
  let applicantParticipantId: string | null = null;
  if (!subjectId && tenancy.applicationId) {
    const application = await loadApplication(tenancy.applicationId);
    applicantParticipantId = String(application?.applicantParticipantId || application?.participantId || "").trim() || null;
    subjectId = String(application?.identitySubjectId || applicantParticipantId || "").trim();
  }
  if (!subjectId) return null;

  return {
    actorUserId,
    subjectId,
    organizationId,
    tenantId: tenancy.tenantId,
    applicantParticipantId,
    applicationIds: tenancy.applicationId ? [tenancy.applicationId] : [],
    activeWorkflow: true,
  };
}

export function forbiddenAuthorityOverride(body: unknown) {
  if (!body || typeof body !== "object") return false;
  return ["subjectId", "tenantId", "applicantId", "applicantParticipantId", "organizationId", "bucket", "objectId"].some(
    (key) => Object.prototype.hasOwnProperty.call(body, key),
  );
}

function respondError(res: any, error: unknown) {
  if (error instanceof IdentityDocumentImageError) {
    return res.status(error.code === "FILE_TOO_LARGE" ? 413 : 400).json({ ok: false, error: error.code });
  }
  if (error instanceof IdentityDocumentApplicationError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "CONSENT_REQUIRED" ? 409 : error.code === "DOCUMENT_NOT_READY" ? 409 : 403;
    return res.status(status).json({ ok: false, error: error.code });
  }
  console.error("[tenant-identity-documents] operation failed", {
    message: error instanceof Error ? error.message : "failed",
  });
  return res.status(500).json({ ok: false, error: "IDENTITY_DOCUMENT_OPERATION_FAILED" });
}

router.post("/identity-documents/consent", previewQaAuth("tenant-identity-consent"), async (req: any, res) => {
  try {
    if (forbiddenAuthorityOverride(req.body)) return res.status(400).json({ ok: false, error: "IDENTITY_OVERRIDE_NOT_ALLOWED" });
    const parsed = consentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ ok: false, error: "IDENTITY_DOCUMENT_CONSENT_INVALID" });
    const context = await resolveCanonicalSubject(req);
    if (!context) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const data = await service().recordConsent(context, parsed.data.displayedLocale);
    return res.status(201).json({ ok: true, data });
  } catch (error) {
    return respondError(res, error);
  }
});

router.get("/identity-documents", previewQaAuth("tenant-identity-list"), async (req: any, res) => {
  try {
    const context = await resolveCanonicalSubject(req);
    if (!context) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return res.json({ ok: true, data: await service().list(context) });
  } catch (error) {
    return respondError(res, error);
  }
});

router.get("/identity-documents/status", previewQaAuth("tenant-identity-status"), async (req: any, res) => {
  try {
    const context = await resolveCanonicalSubject(req);
    if (!context) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const runtimePolicy = identityDocumentRuntimePolicyFromEnvironment();
    const documents = await service().list(context);
    return res.json({
      ok: true,
      data: buildTenantIdentityRequirementStatus({ context, policy: runtimePolicy, documents }),
    });
  } catch (error) {
    return respondError(res, error);
  }
});

router.post("/identity-documents", previewQaAuth("tenant-identity-upload"), async (req: any, res) => {
  upload.single("file")(req, res, async (uploadError: any) => {
    try {
      if (uploadError) {
        return res.status(String(uploadError?.code) === "LIMIT_FILE_SIZE" ? 413 : 400).json({ ok: false, error: String(uploadError?.code) === "LIMIT_FILE_SIZE" ? "FILE_TOO_LARGE" : "UPLOAD_FAILED" });
      }
      if (forbiddenAuthorityOverride(req.body)) return res.status(400).json({ ok: false, error: "IDENTITY_OVERRIDE_NOT_ALLOWED" });
      const parsed = uploadSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ ok: false, error: "IDENTITY_DOCUMENT_INPUT_INVALID" });
      const file = req.file as Express.Multer.File | undefined;
      if (!file?.buffer?.length) return res.status(400).json({ ok: false, error: "FILE_REQUIRED" });
      const context = await resolveCanonicalSubject(req);
      if (!context) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
      const data = await service().upload(context, {
        ...parsed.data,
        bytes: file.buffer,
        declaredMimeType: file.mimetype,
      });
      return res.status(201).json({ ok: true, data });
    } catch (error) {
      return respondError(res, error);
    }
  });
});

router.post("/identity-documents/:documentId/access", previewQaAuth("tenant-identity-access"), async (req: any, res) => {
  try {
    const context = await resolveCanonicalSubject(req);
    if (!context) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    return res.json({ ok: true, data: await service().access(context, String(req.params.documentId || "")) });
  } catch (error) {
    return respondError(res, error);
  }
});

router.delete("/identity-documents/:documentId", previewQaAuth("tenant-identity-delete"), async (req: any, res) => {
  try {
    const context = await resolveCanonicalSubject(req);
    if (!context) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    await service().delete(context, String(req.params.documentId || ""));
    return res.status(204).send();
  } catch (error) {
    return respondError(res, error);
  }
});

export default router;
