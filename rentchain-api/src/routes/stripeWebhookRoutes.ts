import { Request, Response, Router } from "express";
import Stripe from "stripe";
import {
  STRIPE_WEBHOOK_CONFIGURED,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_SECRET_CONFIGURED,
  FRONTEND_URL,
} from "../config/screeningConfig";
import { getStripeClient } from "../services/stripeService";
import {
  markScreeningPaid,
  getScreeningRequestById,
  markScreeningFailed,
  applyProviderResult,
} from "../services/screeningRequestService";
import { buildProviderRequest } from "../services/screening/screeningRequestBuilder";
import { getCreditProvider } from "../services/screening/providers";
import { recordApplicationEvent } from "../services/applicationEventsService";
import { sendEmail } from "../services/emailService";
import { getApplicationById } from "../services/applicationsService";
import { setLastProviderError } from "../services/screeningRequestService";
import { addRecord } from "../services/billingService";
import { BillingRecord } from "../types/billing";

interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
}

const router = Router();
const isDev = process.env.NODE_ENV !== "production";

router.post(
  "/webhook",
  async (req: StripeWebhookRequest, res: Response): Promise<void> => {
    const stripe = getStripeClient();
    if (!stripe) {
      res.status(400).json({
        error: "stripe_not_configured",
        message: "Stripe is not configured for screenings",
      });
      return;
    }

    if (!STRIPE_SECRET_CONFIGURED || !STRIPE_WEBHOOK_CONFIGURED) {
      res.status(400).json({
        error: "stripe_not_configured",
        message: "Stripe is not configured for screenings",
      });
      return;
    }

    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).send("Missing Stripe signature");
      return;
    }

    let event: Stripe.Event;
    try {
      const rawBody =
        req.rawBody ??
        Buffer.from(
          typeof req.body === "string" ? req.body : JSON.stringify(req.body)
        );

      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err: any) {
      console.error("[stripe-webhook] Signature verification failed", {
        message: err && (err as any).message ? (err as any).message : String(err),
      });
      res.status(400).send("Signature verification failed");
      return;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const screeningRequestId =
        session.metadata && session.metadata.screeningRequestId
          ? session.metadata.screeningRequestId
          : undefined;
      const applicationId =
        session.metadata && session.metadata.applicationId
          ? session.metadata.applicationId
          : undefined;
      const landlordId =
        session.metadata && session.metadata.landlordId
          ? session.metadata.landlordId
          : undefined;

      if (isDev) {
        const metaKeys = session.metadata ? Object.keys(session.metadata) : [];
        const idsOnly =
          session.metadata &&
          Object.values(session.metadata).every(
            (value) => typeof value === "string"
          ) &&
          metaKeys.every((key) => key.toLowerCase().includes("id"));
        console.log("[webhook] checkout.session.completed", {
          eventType: event.type,
          sessionId: session.id,
          paymentStatus: session.payment_status,
          metadata: idsOnly ? session.metadata : metaKeys,
        });
      }

      if (!screeningRequestId) {
        if (isDev) {
          console.warn(
            "[webhook] checkout.session.completed missing screeningRequestId metadata"
          );
        }
        res.sendStatus(200);
        return;
      }

      const screeningRequest = getScreeningRequestById(screeningRequestId);
      if (!screeningRequest) {
        if (isDev) {
          console.warn(
            "[webhook] checkout.session.completed could not find screeningRequest",
            { screeningRequestId }
          );
        }
        res.sendStatus(200);
        return;
      }
      const application = screeningRequest.applicationId
        ? getApplicationById(screeningRequest.applicationId)
        : null;

      markScreeningPaid(screeningRequestId);
      screeningRequest.lastWebhookEventId = event.id;
      if (screeningRequest.applicationId) {
        recordApplicationEvent({
          applicationId: screeningRequest.applicationId,
          type: "screening_paid",
          message: "Screening payment received",
          actor: "system",
          metadata: { screeningRequestId },
        });
      }

      const buildResult = buildProviderRequest(screeningRequest.id);

      if (!buildResult.ok) {
        markScreeningFailed(
          screeningRequestId,
          "Missing required information for screening."
        );
        return res.sendStatus(200);
      }

      const provider = getCreditProvider(screeningRequest.providerOverride);

      try {
        const startedAt = Date.now();
        const result = await provider.createReport(buildResult.request);
        const durationMs = Date.now() - startedAt;
        applyProviderResult(screeningRequestId, result, durationMs);
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : null;
        let receiptUrl: string | null = null;

        if (paymentIntentId && stripe) {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            const latestChargeId =
              paymentIntent && typeof paymentIntent.latest_charge === "string"
                ? paymentIntent.latest_charge
                : null;
            if (latestChargeId) {
              const charge = await stripe.charges.retrieve(latestChargeId);
              if (charge && (charge as any).receipt_url) {
                receiptUrl = (charge as any).receipt_url as string;
              }
            }
          } catch (err) {
            if (isDev) {
              console.warn("[stripe-webhook] Unable to fetch receipt", {
                message:
                  err && (err as any).message ? (err as any).message : String(err),
              });
            }
            receiptUrl = null;
          }
        }
        const amountCents =
          typeof session.amount_total === "number" ? session.amount_total : 0;
        const record: Omit<BillingRecord, "id" | "createdAt"> = {
          landlordId:
            landlordId ||
            screeningRequest.landlordId ||
            (application ? application.landlordId : "unknown"),
          provider: "stripe",
          kind: "screening_purchase",
          screeningRequestId,
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          amountCents,
          currency: (session.currency || "cad").toLowerCase(),
          status: "paid",
          receiptUrl,
          description: "Tenant screening",
        };
        addRecord(record);
        if (screeningRequest.applicationId) {
          recordApplicationEvent({
            applicationId: screeningRequest.applicationId,
            type: "screening_completed",
            message: "Screening completed",
            actor: "system",
            metadata: { screeningRequestId },
          });
        }

        const recipient =
          screeningRequest.landlordEmail ||
          (application ? application.applicantEmail : undefined);
        const frontendUrl = process.env.FRONTEND_URL || FRONTEND_URL;
        if (recipient && frontendUrl) {
          const baseUrl = frontendUrl.replace(/\/$/, "");
          const linkTarget =
            application && application.id
              ? `${baseUrl}/screening?applicationId=${encodeURIComponent(application.id)}`
              : `${baseUrl}/screening`;
          sendEmail({
            to: recipient,
            subject: "RentChain: Screening report ready",
            text: `Your screening report is ready. View it here: ${linkTarget}`,
            html: `<p>Your screening report is ready.</p><p><a href="${linkTarget}">View screening</a></p>`,
          }).catch((err) => {
            if (isDev) {
              console.warn("[stripe-webhook] Failed to send email", {
                message:
                  err && (err as any).message ? (err as any).message : String(err),
              });
            }
          });
        }
      } catch (err: any) {
        const code = err && err.code ? err.code : err && err.message ? err.message : undefined;
        if (code === "provider_not_configured") {
          markScreeningFailed(
            screeningRequestId,
            "Screening provider is not configured yet."
          );
          setLastProviderError(new Date().toISOString());
          return res.sendStatus(200);
        }
        if (code === "provider_validation_error") {
          markScreeningFailed(
            screeningRequestId,
            "Missing required applicant details. Please complete application fields and retry."
          );
          setLastProviderError(new Date().toISOString());
          return res.sendStatus(200);
        }
        if (code === "provider_rate_limited") {
          markScreeningFailed(
            screeningRequestId,
            "Screening provider rate limited. Please retry shortly."
          );
          setLastProviderError(new Date().toISOString());
          return res.sendStatus(200);
        }
        if (code === "provider_timeout") {
          markScreeningFailed(
            screeningRequestId,
            "Screening provider timed out. Please retry."
          );
          setLastProviderError(new Date().toISOString());
          return res.sendStatus(200);
        }

        markScreeningFailed(
          screeningRequestId,
          "Unable to complete screening at this time."
        );
        setLastProviderError(new Date().toISOString());
        if (isDev) {
          console.error("[stripe-webhook] provider error", {
            message:
              err && (err as any).message ? (err as any).message : String(err),
          });
        }
        return res.sendStatus(200);
      }

      if (isDev) {
        console.log("[stripe] screening completed", {
          screeningRequestId,
          applicationId,
          paymentStatus: session.payment_status,
        });
      }
    }

    res.sendStatus(200);
  }
);

export default router;
