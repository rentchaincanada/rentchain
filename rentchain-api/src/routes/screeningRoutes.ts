// src/routes/screeningRoutes.ts
// @ts-nocheck
import { Router, Response } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import {
  getApplicationById,
  saveApplication,
} from "../services/applicationsService";
import {
  createScreeningRequestForApplication,
  getScreeningRequestById,
  getScreeningRequestForApplication,
  updateApplicationScreeningStatus,
  sanitizeScreeningResponse,
  purgeExpiredScreenings,
} from "../services/screeningRequestService";
import { getStripeClient, isStripeConfigured } from "../services/stripeService";
import { stripeNotConfiguredResponse, isStripeNotConfiguredError } from "../lib/stripeNotConfigured";
import {
  FRONTEND_URL,
  FRONTEND_URL_CONFIGURED,
  SCREENING_CURRENCY,
  SCREENING_PRICE_CENTS,
} from "../config/screeningConfig";
import { recordAuditEvent } from "../services/auditEventService";
import { getLastEmailPreview } from "../services/emailService";
import { recordApplicationEvent } from "../services/applicationEventsService";
import { propertyService } from "../services/propertyService";
import { getFlags } from "../services/featureFlagService";
import { runScreeningWithCredits } from "../services/screeningsService";
import { attachAccount } from "../middleware/attachAccount";
import { getScreeningProviderHealth } from "../services/screening/providerHealth";
import { compareCheckoutResponses } from "../services/screening/cutoverCompare";
import { getPrimaryTimeoutMs, hashSeedKey, isAllowlistedSeed, parseAllowlist } from "../services/screening/cutoverConfig";
import { logCutoverEvent } from "../services/screening/cutoverTelemetry";
import { runPrimaryWithFallback } from "../services/screening/runPrimaryWithFallback";
import { getBureauProvider } from "../services/screening/providers/bureauProvider";
import { listScreeningHistory, getScreeningHistoryDetail } from "../services/screening/screeningHistoryService";
import { resolveScreeningReportAccess, downloadScreeningReportBuffer } from "../services/screening/screeningAccessService";
import { writeScreeningEvent } from "../services/screening/screeningEvents";

const router = Router();

function shouldUseMockCheckoutOverride(params: { role: string; seedKey: string }) {
  const allowMock = process.env.ALLOW_MOCK_PROVIDER_CHECKOUT === "true";
  if (!allowMock) return false;
  if (params.role !== "admin") return false;
  return isAllowlistedSeed(params.seedKey, parseAllowlist());
}

function logMockProviderCheckout(seedKey: string) {
  logCutoverEvent({
    eventType: "bureau_cutover",
    name: "checkout",
    seedHash: hashSeedKey(seedKey || ""),
    selectedRoute: "adapter",
    responseSource: "adapter",
    fallbackUsed: false,
    adapter: { ok: true, status: 200 },
    legacy: { ok: false },
    diff: { isMatch: true, fields: [] },
    meta: {
      env: process.env.NODE_ENV || "development",
      ts: new Date().toISOString(),
      revision: process.env.K_REVISION || process.env.GIT_SHA || undefined,
      providerMode: "mock",
    },
  });
}

router.use(authenticateJwt, attachAccount);

router.get("/screenings/config", (_req, res: Response) => {
  res.status(200).json({
    stripeConfigured: isStripeConfigured(),
    frontendUrlConfigured: FRONTEND_URL_CONFIGURED,
    currency: SCREENING_CURRENCY || "cad",
    priceCents: SCREENING_PRICE_CENTS || 2999,
  });
});

router.post(
  "/screenings/run",
  (req: AuthenticatedRequest, res: Response) => {
    const { applicationId } = req.body || {};
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!applicationId) {
      return res.status(400).json({ error: "applicationId is required" });
    }

    const application = getApplicationById(String(applicationId));
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (
      !application.consentCreditCheck ||
      !application.phoneVerified ||
      !application.referencesContacted
    ) {
      return res.status(400).json({
        error:
          "Application is not ready for screening. Ensure consent, phone verification, and references are complete.",
      });
    }

    runScreeningWithCredits({
      landlordId: req.user.id,
      landlordEmail: req.user.email,
      applicationId: application.id,
    })
      .then((result) => {
        return res.status(201).json({
          screeningRequest: result.screeningRequest,
        });
      })
      .catch((err) => {
        console.error("[screenings/run] error", err);
        return res
          .status(500)
          .json({ error: "Unable to start screening", message: err?.message });
      });
  }
);

router.post(
  "/screenings/request",
  (req: AuthenticatedRequest, res: Response) => {
    const { applicationId } = req.body || {};

    if (!applicationId) {
      return res.status(400).json({ error: "applicationId is required" });
    }

    const application = getApplicationById(String(applicationId));
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (
      !application.consentCreditCheck ||
      !application.phoneVerified ||
      !application.referencesContacted
    ) {
      return res.status(400).json({
        error:
          "Application is not ready for screening. Ensure consent, phone verification, and references are complete.",
      });
    }

    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const existing = getScreeningRequestForApplication(application.id);
    if (existing) {
      updateApplicationScreeningStatus(application.id, "requested", existing.id);
      return res
        .status(200)
        .json({ screeningRequest: sanitizeScreeningResponse(existing) });
    }

    const screeningRequest = createScreeningRequestForApplication({
      applicationId: application.id,
      landlordId: req.user.id,
      landlordEmail: req.user.email,
      providerOverride: getFlags().useSingleKeyForNewScreenings ? "singlekey" : undefined,
    });

    saveApplication({
      ...application,
      screeningStatus: "requested",
      screeningRequestId: screeningRequest.id,
    });

    recordApplicationEvent({
      applicationId: application.id,
      type: "screening_requested",
      message: "Screening requested",
      actor: "landlord",
      metadata: { screeningRequestId: screeningRequest.id },
    });

    return res
      .status(201)
      .json({ screeningRequest: sanitizeScreeningResponse(screeningRequest) });
  }
);

router.post(
  "/screenings/:id/checkout",
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const role = String(req.user?.role || "").toLowerCase();
    const isAdmin = role === "admin";
    const screeningRequest = getScreeningRequestById(id);
    const frontendUrl = String(
      process.env.FRONTEND_URL ||
        FRONTEND_URL ||
        (process.env.NODE_ENV === "production"
          ? "https://www.rentchain.ai"
          : "http://localhost:5173")
    )
      .trim()
      .replace(/\/$/, "");

    if (!screeningRequest) {
      return res.status(404).json({ error: "Screening request not found" });
    }

    if (!req.user?.id || (screeningRequest.landlordId !== req.user.id && !isAdmin)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    await runPrimaryWithFallback({
      name: "legacy_checkout",
      seedKey: `${id}:${screeningRequest.landlordId || req.user?.id || ""}`,
      timeoutMs: getPrimaryTimeoutMs(),
      conservativeReturnLegacy: true,
      runLegacy: async () => ({ ok: true, url: "" }),
      runAdapter: async () => {
        const provider = getBureauProvider();
        const preflight = await provider.preflight();
        if (!preflight.ok) {
          throw new Error(preflight.detail || "adapter_preflight_failed");
        }
        return { ok: true, provider: provider.name, url: "adapter-ready" };
      },
      compare: compareCheckoutResponses,
    });

    const providerHealth = await getScreeningProviderHealth();
    const allowMockOverride = shouldUseMockCheckoutOverride({ role, seedKey: id });
    if (
      process.env.NODE_ENV === "production" &&
      (!providerHealth.configured || !providerHealth.preflightOk) &&
      !allowMockOverride
    ) {
      logCutoverEvent({
        eventType: "bureau_cutover",
        name: "checkout",
        seedHash: hashSeedKey(id || ""),
        selectedRoute: "none",
        responseSource: "blocked",
        fallbackUsed: false,
        adapter: { ok: false },
        legacy: { ok: false },
        diff: { isMatch: true, fields: [] },
        meta: {
          env: process.env.NODE_ENV || "development",
          ts: new Date().toISOString(),
          revision: process.env.K_REVISION || process.env.GIT_SHA || undefined,
          skippedReason: "provider_not_ready",
        },
      });
      return res.status(503).json({
        ok: false,
        error: "screening_unavailable",
        detail: "provider_not_ready",
      });
    }
    if (
      process.env.NODE_ENV === "production" &&
      (!providerHealth.configured || !providerHealth.preflightOk) &&
      allowMockOverride
    ) {
      logMockProviderCheckout(id);
    }

    if (!isStripeConfigured()) {
      return res.status(400).json(stripeNotConfiguredResponse());
    }

    let stripe: any;
    try {
      stripe = getStripeClient();
    } catch (err) {
      if (isStripeNotConfiguredError(err)) {
        return res.status(400).json(stripeNotConfiguredResponse());
      }
      throw err;
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: screeningRequest.currency || "cad",
              product_data: { name: "Tenant screening" },
              unit_amount: screeningRequest.priceCents || 2999,
            },
            quantity: 1,
          },
        ],
        metadata: {
          screeningRequestId: screeningRequest.id,
          applicationId: screeningRequest.applicationId || "",
          landlordId: screeningRequest.landlordId || "",
        },
        success_url: `${frontendUrl}/screening/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/screening/cancel`,
      });

      screeningRequest.checkoutSessionId = session.id;

      return res.status(200).json({ url: session.url });
    } catch (err: any) {
      console.error("[screenings/checkout] Failed to create Checkout Session", {
        message: err?.message,
      });
      return res.status(500).json({
        error: "Unable to create checkout session",
      });
    }
  }
);

router.get(
  "/screenings/history",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const role = String(req.user?.role || "").toLowerCase();
      if (role !== "landlord" && role !== "admin") {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
      const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
      if (!landlordId && role !== "admin") {
        return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
      }
      const applicationId = String(req.query?.applicationId || "").trim();
      const tenantId = String(req.query?.tenantId || "").trim();
      const limit = Number(req.query?.limit || 10);
      if (!applicationId && !tenantId) {
        return res.status(400).json({ ok: false, error: "APPLICATION_OR_TENANT_REQUIRED" });
      }

      const items = await listScreeningHistory({
        landlordId,
        applicationId: applicationId || null,
        tenantId: tenantId || null,
        limit,
      });

      return res.json({ ok: true, items });
    } catch (err: any) {
      console.error("[screenings/history] failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "SCREENING_HISTORY_READ_FAILED" });
    }
  }
);

router.get(
  "/screenings/history/:id",
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const role = String(req.user?.role || "").toLowerCase();
      if (role !== "landlord" && role !== "admin") {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
      const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
      if (!landlordId && role !== "admin") {
        return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
      }

      const detail = await getScreeningHistoryDetail({
        landlordId,
        screeningId: String(req.params?.id || ""),
      });

      if (!detail) {
        return res.status(404).json({ ok: false, error: "SCREENING_NOT_FOUND" });
      }

      await writeScreeningEvent({
        applicationId: detail.applicationId,
        orderId: detail.metadata.sourceType === "order" ? detail.metadata.sourceId : null,
        landlordId: detail.landlordId,
        type: "summary_viewed",
        actor: role === "admin" ? "admin" : "landlord",
        meta: {
          status: detail.status,
          from: "screenings/history",
        },
      });

      return res.json({ ok: true, screening: detail });
    } catch (err: any) {
      console.error("[screenings/history/:id] failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "SCREENING_DETAIL_READ_FAILED" });
    }
  }
);

router.get(
  "/screenings/history/:id/report",
  async (req: AuthenticatedRequest, res: Response) => {
    const role = String(req.user?.role || "").toLowerCase();
    const landlordId = String(req.user?.landlordId || req.user?.id || "").trim();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    if (!landlordId && role !== "admin") {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const screeningId = String(req.params?.id || "").trim();
    const detail = await getScreeningHistoryDetail({ landlordId, screeningId });
    if (!detail) {
      return res.status(404).json({ ok: false, error: "SCREENING_NOT_FOUND" });
    }

    const access = await resolveScreeningReportAccess({ landlordId, screeningId });
    if (!access.ok) {
      await writeScreeningEvent({
        applicationId: detail.applicationId,
        orderId: detail.metadata.sourceType === "order" ? detail.metadata.sourceId : null,
        landlordId: detail.landlordId,
        type: "report_access_denied",
        actor: role === "admin" ? "admin" : "landlord",
        meta: {
          status: detail.report.status,
          reasonCode: access.error,
        },
      });
      return res.status(access.status).json({ ok: false, error: access.error, reportStatus: detail.report.status });
    }

    try {
      const buffer = await downloadScreeningReportBuffer({
        bucket: access.bucket,
        objectKey: access.objectKey,
      });

      await writeScreeningEvent({
        applicationId: detail.applicationId,
        orderId: detail.metadata.sourceType === "order" ? detail.metadata.sourceId : null,
        landlordId: detail.landlordId,
        type: "report_viewed",
        actor: role === "admin" ? "admin" : "landlord",
        meta: {
          status: detail.report.status,
        },
      });

      res.setHeader("Content-Type", access.contentType);
      res.setHeader("Content-Disposition", `inline; filename="${access.filename}"`);
      return res.status(200).send(buffer);
    } catch (err: any) {
      console.error("[screenings/history/:id/report] failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "REPORT_STREAM_FAILED" });
    }
  }
);

router.get(
  "/screenings/:id",
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const screeningRequest = getScreeningRequestById(id);

    if (!screeningRequest) {
      return res.status(404).json({ error: "Screening request not found" });
    }

    if (!req.user?.id || screeningRequest.landlordId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const safeScreening = sanitizeScreeningResponse(screeningRequest);

    if (req.user?.id) {
      recordAuditEvent({
        entityType: "application",
        entityId: screeningRequest.applicationId || screeningRequest.id,
        applicationId: screeningRequest.applicationId || null,
        tenantId: null,
        propertyId: null,
        paymentId: null,
        kind: "screening.viewed",
        summary: "Screening viewed",
        meta: {
          screeningRequestId: screeningRequest.id,
          actorId: req.user.id,
          action: "screening.viewed",
        },
      }).catch((err) =>
        console.error("[screenings/:id] Failed to record audit event", {
          message: err?.message,
        })
      );
    }

    return res.status(200).json({ screeningRequest: safeScreening });
  }
);

router.get(
  "/screenings/detail/:screeningId",
  (req: AuthenticatedRequest, res: Response) => {
    const { screeningId } = req.params;
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const screening = getScreeningRequestById(screeningId);
    if (!screening || screening.landlordId !== req.user.id) {
      return res.status(404).json({ error: "Screening not found" });
    }
    return res.status(200).json({
      id: screening.id,
      provider: screening.providerName || "mock",
      status: screening.status,
      requestedAt: screening.createdAt,
      completedAt: screening.completedAt,
      resultSummary: screening.reportSummary
        ? {
            score: screening.reportSummary.score,
            riskLevel: screening.reportSummary.riskBand,
            notes: screening.reportSummary.headline,
          }
        : undefined,
      error: screening.failureReason
        ? { code: "failure", message: screening.failureReason }
        : undefined,
    });
  }
);

router.get(
  "/screenings/:id/report.pdf",
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const screeningRequest = getScreeningRequestById(id);

    if (!screeningRequest) {
      return res.status(404).json({ error: "Screening request not found" });
    }

    if (!req.user?.id || screeningRequest.landlordId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const application = screeningRequest.applicationId
      ? getApplicationById(screeningRequest.applicationId)
      : undefined;
    const property = application?.propertyId
      ? propertyService.getById(application.propertyId)
      : undefined;

    let PDF: any;
    try {
      const mod: any = await import("pdfkit");
      PDF = mod?.default ?? mod;
    } catch (err: any) {
      console.error("[screenings/:id/report.pdf] pdfkit missing", err?.message || err);
      return res.status(501).json({
        ok: false,
        code: "PDFKIT_MISSING",
        message: "PDF generation temporarily unavailable",
      });
    }

    const doc = new PDF({ margin: 50 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="screening_${screeningRequest.id}.pdf"`
    );

    doc.pipe(res);

    doc.fontSize(18).text("Screening Report", { underline: true });
    doc.moveDown();

    doc.fontSize(12).text(`Screening ID: ${screeningRequest.id}`);
    doc.text(`Status: ${screeningRequest.status}`);
    if (screeningRequest.providerName) {
      doc.text(`Provider: ${screeningRequest.providerName}`);
    }
    if (screeningRequest.completedAt) {
      doc.text(`Completed: ${screeningRequest.completedAt}`);
    }
    doc.moveDown();

    if (application) {
      const applicantName =
        application.fullName ||
        [application.firstName, application.lastName].filter(Boolean).join(" ");
      doc.fontSize(14).text("Applicant", { underline: true });
      doc.fontSize(12).text(`Name: ${applicantName}`);
      doc.text(`Email: ${application.email}`);
      doc.text(`Phone: ${application.phone}`);
      doc.moveDown();

      doc.fontSize(14).text("Property", { underline: true });
      doc.fontSize(12).text(
        `Property: ${application.propertyName || application.propertyId}`
      );
      doc.text(`Unit: ${application.unitApplied || application.unit || "-"}`);
      if (application.leaseStartDate) {
        doc.text(`Lease start: ${application.leaseStartDate}`);
      }
      const addressLine = [
        property?.addressLine1 || application.recentAddress?.streetNumber,
        property?.addressLine1 ? property.addressLine2 : application.recentAddress?.streetName,
      ]
        .filter(Boolean)
        .join(" ");
      const cityLine = [
        property?.city || application.recentAddress?.city,
        property?.province || application.recentAddress?.province,
        property?.postalCode || application.recentAddress?.postalCode,
      ]
        .filter(Boolean)
        .join(", ");
      if (addressLine) doc.text(`Address: ${addressLine}`);
      if (cityLine) doc.text(cityLine);
      doc.moveDown();
    }

    const summary = screeningRequest.reportSummary;
    if (summary) {
      doc.fontSize(14).text("Report Summary", { underline: true });
      doc.fontSize(12).text(summary.headline);
      if (summary.providerName) {
        doc.text(`Provider: ${summary.providerName}`);
      }
      if (summary.providerReferenceId) {
        doc.text(`Reference: ${summary.providerReferenceId}`);
      }
      if (summary.createdAt) {
        doc.text(`Generated: ${summary.createdAt}`);
      }
      if (summary.score !== undefined) {
        doc.text(`Score: ${summary.score}`);
      }
      if (summary.highlights?.length) {
        doc.moveDown(0.5);
        doc.text("Highlights:");
        summary.highlights.forEach((item) => doc.text(`• ${item}`));
      }
      doc.moveDown();
      doc.text("Summary:");
      doc.text(summary.headline);
    }

    doc.moveDown();
    doc.fontSize(10).text("Confidential – for tenant screening purposes", {
      align: "center",
    });

    doc.end();
  }
);

router.delete(
  "/admin/screenings/expired",
  (_req: AuthenticatedRequest, res: Response) => {
    const result = purgeExpiredScreenings();
    return res.status(200).json({
      purged: result.purgedCount,
      purgedIds: result.purgedIds,
    });
  }
);

router.get("/debug/last-email", (_req: AuthenticatedRequest, res: Response) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }
  return res.status(200).json({ preview: getLastEmailPreview() });
});

export default router;

