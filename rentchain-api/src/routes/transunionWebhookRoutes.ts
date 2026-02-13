import { Request, Response, Router } from "express";
import crypto from "crypto";
import { db } from "../config/firebase";
import sgMail from "@sendgrid/mail";
import { getBureauProvider } from "../services/screening/providers/bureauProvider";
import { putPdfObject } from "../storage/pdfStore";
import { writeScreeningEvent } from "../services/screening/screeningEvents";
import { getStripeClient, isStripeConfigured } from "../services/stripeService";
import { resolveFrontendBase } from "../services/screening/inviteTokens";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";

interface WebhookRequest extends Request {
  rawBody?: Buffer;
}

const router = Router();

function verifySignature(rawBody: Buffer, signature: string, secret: string) {
  const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
}

function extractEvent(payload: any) {
  const eventType =
    payload?.eventType ||
    payload?.event ||
    payload?.type ||
    payload?.status ||
    payload?.data?.status;
  const requestId =
    payload?.requestId ||
    payload?.data?.requestId ||
    payload?.data?.id ||
    payload?.id;
  return { eventType: String(eventType || "").toUpperCase(), requestId: String(requestId || "").trim() };
}

async function findOrderByRequestId(requestId: string) {
  const snap = await db
    .collection("screeningOrders")
    .where("providerRequestId", "==", requestId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0];
}

async function markOrderStatus(doc: FirebaseFirestore.DocumentSnapshot, patch: Record<string, any>) {
  await doc.ref.set({ ...patch, updatedAt: Date.now() }, { merge: true });
}

export const transunionWebhookHandler = async (req: WebhookRequest, res: Response) => {
  const secret = String(process.env.TU_RESELLER_WEBHOOK_SECRET || "").trim();
  const signatureHeader =
    String(req.headers["x-tu-signature"] || req.headers["x-signature"] || "").trim();

  if (secret) {
    if (!signatureHeader) {
      return res.status(400).json({ ok: false, error: "missing_signature" });
    }
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const ok = verifySignature(rawBody, signatureHeader, secret);
    if (!ok) return res.status(400).json({ ok: false, error: "invalid_signature" });
  }

  const payload = Buffer.isBuffer(req.body)
    ? JSON.parse(req.body.toString("utf8"))
    : req.body || {};
  const { eventType, requestId } = extractEvent(payload);
  if (!requestId) {
    return res.status(400).json({ ok: false, error: "missing_request_id" });
  }

  const orderDoc = await findOrderByRequestId(requestId);
  if (!orderDoc) {
    return res.status(404).json({ ok: false, error: "order_not_found" });
  }

  const provider = getBureauProvider();
  const orderData = orderDoc.data() as any;

  if (eventType === "KBA_IN_PROGRESS") {
    await markOrderStatus(orderDoc, { status: "KBA_IN_PROGRESS", kbaStatus: "in_progress" });
    await writeScreeningEvent({
      orderId: orderDoc.id,
      applicationId: orderData?.applicationId || null,
      landlordId: orderData?.landlordId || null,
      type: "kba_in_progress",
      at: Date.now(),
      meta: { status: "kba_in_progress" },
      actor: "system",
    });
    return res.json({ ok: true });
  }

  if (eventType === "KBA_FAILED") {
    await markOrderStatus(orderDoc, {
      status: "FAILED",
      kbaStatus: "failed",
      failureCode: "KBA_FAILED",
      failureDetail: payload?.reason || null,
    });
    await writeScreeningEvent({
      orderId: orderDoc.id,
      applicationId: orderData?.applicationId || null,
      landlordId: orderData?.landlordId || null,
      type: "kba_failed",
      at: Date.now(),
      meta: { status: "kba_failed" },
      actor: "system",
    });

    if (isStripeConfigured() && !orderData?.stripeIdentitySessionId) {
      try {
        const stripe = getStripeClient();
        const session = await stripe.identity.verificationSessions.create({
          type: "document",
          metadata: {
            orderId: orderDoc.id,
            landlordId: orderData?.landlordId || "",
            applicationId: orderData?.applicationId || "",
          },
          return_url: `${resolveFrontendBase()}/verify/identity-complete`,
        });

        await markOrderStatus(orderDoc, {
          stripeIdentitySessionId: session.id,
          stripeIdentityStatus: session.status,
        });

        const tenantEmail = String(orderData?.tenantEmail || "").trim();
        const tenantName = String(orderData?.tenantName || "").trim() || "there";
        if (tenantEmail) {
          const apiKey = String(process.env.SENDGRID_API_KEY || "").trim();
          const from =
            String(
              process.env.SENDGRID_FROM_EMAIL ||
                process.env.SENDGRID_FROM ||
                process.env.FROM_EMAIL ||
                ""
            ).trim();
          if (apiKey && from && session.url) {
            sgMail.setApiKey(apiKey);
            await sgMail.send({
              to: tenantEmail,
              from,
              subject: "RentChain: Verify your identity",
              text: buildEmailText({
                intro: `Hi ${tenantName},\n\nWe couldn't complete KBA verification. Please verify your identity to finish screening.`,
                ctaText: "Verify identity",
                ctaUrl: session.url,
              }),
              html: buildEmailHtml({
                title: "Verify your identity",
                intro: `Hi ${tenantName}, We couldn't complete KBA verification. Please verify your identity to finish screening.`,
                ctaText: "Verify identity",
                ctaUrl: session.url,
              }),
              trackingSettings: {
                clickTracking: { enable: false, enableText: false },
                openTracking: { enable: false },
              },
              mailSettings: { footer: { enable: false } },
            });
          }
        }
      } catch (err: any) {
        console.error("[transunion-webhook] identity fallback failed", err?.message || err);
      }
    }

    return res.json({ ok: true });
  }

  if (eventType === "COMPLETED") {
    try {
      const report = await provider.fetchReportPdf(requestId);
      const uploaded = await putPdfObject({
        objectKey: `screening-reports/${orderDoc.id}.pdf`,
        pdfBuffer: report.pdfBuffer,
      });

      await markOrderStatus(orderDoc, {
        status: "REPORT_READY",
        kbaStatus: "passed",
        reportBucket: uploaded.bucket,
        reportObjectKey: uploaded.path,
      });

      await writeScreeningEvent({
        orderId: orderDoc.id,
        applicationId: orderData?.applicationId || null,
        landlordId: orderData?.landlordId || null,
        type: "report_ready",
        at: Date.now(),
        meta: { status: "report_ready" },
        actor: "system",
      });
      return res.json({ ok: true });
    } catch (err: any) {
      await markOrderStatus(orderDoc, {
        status: "FAILED",
        failureCode: "REPORT_FETCH_FAILED",
        failureDetail: String(err?.message || err),
      });
      return res.status(502).json({ ok: false, error: "report_fetch_failed" });
    }
  }

  return res.json({ ok: true, ignored: true });
};

router.post("/", transunionWebhookHandler);

export default router;
