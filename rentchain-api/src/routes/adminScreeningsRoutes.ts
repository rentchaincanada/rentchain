import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { devOnly } from "../middleware/devOnly";
import {
  getScreeningRequestById,
  sanitizeScreeningResponse,
  applyProviderResult,
  markScreeningFailed,
  purgeExpiredScreenings,
} from "../services/screeningRequestService";
import { buildProviderRequest } from "../services/screening/screeningRequestBuilder";
import { getCreditProvider } from "../services/screening/providers";
import { sendEmail } from "../services/emailService";
import { FRONTEND_URL } from "../config/screeningConfig";
import { getApplicationById } from "../services/applicationsService";
import { SCREENING_REQUESTS_INTERNAL } from "../services/screeningRequestService";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";

const router = Router();

router.use(devOnly, authenticateJwt);

router.get("/", (_req, res) => {
  const safe = SCREENING_REQUESTS_INTERNAL.map((req) => ({
    id: req.id,
    applicationId: req.applicationId,
    landlordId: req.landlordId,
    status: req.status,
    providerName: req.providerName,
    providerReferenceId: req.providerReferenceId,
    createdAt: req.createdAt,
    paidAt: req.paidAt,
    completedAt: req.completedAt,
    deleteAfterAt: req.deleteAfterAt,
    failureReason: req.failureReason,
    lastWebhookEventId: req.lastWebhookEventId,
    lastProviderDurationMs: req.lastProviderDurationMs,
  }));
  res.status(200).json({ screenings: safe });
});

router.post("/:id/retry", async (req, res) => {
  const { id } = req.params;
  const screening = getScreeningRequestById(id);
  if (!screening) {
    return res.status(404).json({ error: "Screening not found" });
  }

  const build = buildProviderRequest(id);
  if (!build.ok) {
    markScreeningFailed(id, "Missing required applicant details.");
    return res.status(400).json({ error: "missing_fields", missing: build.missing });
  }

  const provider = getCreditProvider(screening.providerOverride);
  try {
    const started = Date.now();
    const result = await provider.createReport(build.request);
    applyProviderResult(id, result, Date.now() - started);
    return res
      .status(200)
      .json({ screeningRequest: sanitizeScreeningResponse(getScreeningRequestById(id)!) });
  } catch (err: any) {
    const code = err?.code || err?.message;
    if (code === "provider_not_configured") {
      markScreeningFailed(id, "Screening provider is not configured yet.");
    } else if (code === "provider_validation_error") {
      markScreeningFailed(
        id,
        "Missing required applicant details. Please complete application fields and retry."
      );
    } else {
      markScreeningFailed(id, "Unable to complete screening at this time.");
    }
    return res.status(200).json({
      screeningRequest: sanitizeScreeningResponse(getScreeningRequestById(id)!),
    });
  }
});

router.post("/:id/resend-email", async (req, res) => {
  const { id } = req.params;
  const screening = getScreeningRequestById(id);
  if (!screening) {
    return res.status(404).json({ error: "Screening not found" });
  }

  const application = screening.applicationId
    ? getApplicationById(screening.applicationId)
    : null;
  const recipient = screening.landlordEmail || application?.applicantEmail;
  const frontendUrl = process.env.FRONTEND_URL || FRONTEND_URL;
  if (!recipient || !frontendUrl) {
    return res.status(400).json({ error: "recipient_not_found" });
  }

  const linkTarget = screening.applicationId
    ? `${frontendUrl.replace(/\/$/, "")}/screening?applicationId=${encodeURIComponent(
        screening.applicationId
      )}`
    : `${frontendUrl.replace(/\/$/, "")}/screening`;

  await sendEmail({
    to: recipient,
    subject: "RentChain: Screening report ready",
    text: buildEmailText({
      intro: "Your screening report is ready.",
      ctaText: "View screening",
      ctaUrl: linkTarget,
    }),
    html: buildEmailHtml({
      title: "Screening report ready",
      intro: "Your screening report is ready.",
      ctaText: "View screening",
      ctaUrl: linkTarget,
    }),
  });

  return res.status(200).json({ success: true });
});

router.delete("/expired", (_req, res) => {
  const result = purgeExpiredScreenings();
  res.status(200).json({ deletedCount: result.purgedCount });
});

export default router;
