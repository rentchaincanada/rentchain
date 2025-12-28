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
import { getStripeClient } from "../services/stripeService";
import {
  FRONTEND_URL,
  FRONTEND_URL_CONFIGURED,
  SCREENING_CURRENCY,
  SCREENING_PRICE_CENTS,
  STRIPE_SECRET_CONFIGURED,
} from "../config/screeningConfig";
import { recordAuditEvent } from "../services/auditEventService";
import { getLastEmailPreview } from "../services/emailService";
import { recordApplicationEvent } from "../services/applicationEventsService";
import { propertyService } from "../services/propertyService";
import { getFlags } from "../services/featureFlagService";
import {
  decrementScreeningCredit,
  ensureLandlordProfile,
  getLandlordProfile,
} from "../services/landlordProfileService";
import { recordScreeningCreditUsed } from "../services/screeningCreditEventsService";
import {
  markScreeningPaid,
  completeScreening,
} from "../services/screeningRequestService";
import { createLedgerEvent } from "../services/ledgerEventsService";
import { attachAccount } from "../middleware/attachAccount";
import { requireFeature } from "../middleware/entitlements";

const router = Router();

let PDFDocument: any | null = null;
async function loadPDFKit() {
  if (PDFDocument) return PDFDocument;
  try {
    const mod: any = await import("pdfkit");
    PDFDocument = mod?.default ?? mod;
    return PDFDocument;
  } catch (err) {
    const e: any = new Error("PDFKIT_MISSING");
    e.cause = err;
    throw e;
  }
}

router.use(authenticateJwt, attachAccount, requireFeature("screening"));

router.get("/screenings/config", (_req, res: Response) => {
  res.status(200).json({
    stripeConfigured: STRIPE_SECRET_CONFIGURED,
    frontendUrlConfigured: FRONTEND_URL_CONFIGURED,
    currency: SCREENING_CURRENCY || "cad",
    priceCents: SCREENING_PRICE_CENTS || 2999,
  });
});

router.get(
  "/screenings/credits",
  (req: AuthenticatedRequest, res: Response) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const profile = ensureLandlordProfile(req.user.id, req.user.email);
    return res
      .status(200)
      .json({ screeningCredits: profile?.screeningCredits ?? 0 });
  }
);

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
        if (result.status === "blocked_no_credits") {
          const profile = ensureLandlordProfile(req.user!.id, req.user!.email);
          return res.status(402).json({
            error: "insufficient_credits",
            message:
              "No screening credits available. Add credits to run a screening.",
            screeningCredits: profile?.screeningCredits ?? 0,
          });
        }
        return res.status(201).json({
          screeningRequest: result.screeningRequest,
          screeningCredits: ensureLandlordProfile(
            req.user!.id,
            req.user!.email
          )?.screeningCredits,
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
    const screeningRequest = getScreeningRequestById(id);
    const frontendUrl = process.env.FRONTEND_URL || FRONTEND_URL;

    if (!screeningRequest) {
      return res.status(404).json({ error: "Screening request not found" });
    }

    if (!req.user?.id || screeningRequest.landlordId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!STRIPE_SECRET_CONFIGURED || !FRONTEND_URL_CONFIGURED) {
      return res.status(400).json({
        error: "stripe_not_configured",
        message: "Stripe is not configured for screenings",
      });
    }

    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(400).json({
        error: "stripe_not_configured",
        message: "Stripe is not configured for screenings",
      });
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
      PDF = await loadPDFKit();
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
