import { Request, Response, Router } from "express";
import Stripe from "stripe";
import { createHash } from "crypto";
import { db } from "../config/firebase";
import { getStripeClient } from "../services/stripeService";
import { STRIPE_WEBHOOK_SECRET } from "../config/screeningConfig";
import sgMail from "@sendgrid/mail";

interface StripeWebhookRequest extends Request {
  rawBody?: Buffer;
}

const router = Router();

function seededNumber(input: string) {
  const hash = createHash("sha256").update(input).digest("hex");
  return parseInt(hash.slice(0, 8), 16);
}

function buildStubResult(application: any, scoreAddOn: boolean, seed: number) {
  const applicant = application?.applicant || {};
  const currentAddress = String(application?.residentialHistory?.[0]?.address || "").trim();
  const missing = [
    applicant?.firstName,
    applicant?.lastName,
    applicant?.email,
    applicant?.dob,
    currentAddress,
  ].filter((v) => !String(v || "").trim()).length;

  const matchConfidence = missing >= 2 ? "LOW" : missing === 1 ? "MEDIUM" : "HIGH";
  const riskBand = (["LOW", "MEDIUM", "HIGH"] as const)[seed % 3];
  const fileFound = seed % 10 >= 2;
  const score = scoreAddOn && fileFound ? 540 + (seed % 241) : null;

  return {
    riskBand,
    matchConfidence,
    fileFound,
    score,
    tradelinesCount: fileFound ? 2 + (seed % 7) : 0,
    collectionsCount: seed % 3,
    bankruptciesCount: seed % 5 === 0 ? 1 : 0,
    notes: fileFound ? "Stub report generated for MVP." : "No credit file found in stub provider.",
  };
}

function buildAiVerification(applicationId: string, seed: number) {
  const confidenceScore = 60 + (seed % 36);
  const riskAssessment = (["LOW", "MODERATE", "HIGH"] as const)[seed % 3];
  const flagOptions = [
    "INCOME_STRESS",
    "ADDRESS_GAP",
    "EMPLOYMENT_SHORT_TENURE",
    "REFERENCE_WEAK",
    "IDENTITY_MISMATCH_HINT",
  ];
  const flags = flagOptions.filter((_f, idx) => ((seed >> idx) & 1) === 1).slice(0, 3);
  const recommendations = [
    "Consider cosigner",
    "Request additional employment proof",
    "Verify previous landlord reference",
  ].filter((_r, idx) => ((seed >> (idx + 2)) & 1) === 1);

  const summary = [
    `AI Verification generated for application ${applicationId}.`,
    `Risk assessment: ${riskAssessment.toLowerCase()} with confidence ${confidenceScore}/100.`,
    flags.length ? `Flags: ${flags.join(", ")}.` : "No material flags detected.",
  ].join(" ");

  return {
    enabled: true,
    riskAssessment,
    confidenceScore,
    flags,
    recommendations,
    summary,
    generatedAt: Date.now(),
  };
}

router.post("/", async (req: StripeWebhookRequest, res: Response) => {
  const stripe = getStripeClient();
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(400).json({ ok: false, error: "stripe_not_configured" });
  }

  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).send("Missing Stripe signature");
  }

  let event: Stripe.Event;
  try {
    const rawBody = req.body as Buffer;
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err: any) {
    console.error("[stripe-webhook-orders] signature verification failed", err?.message || err);
    return res.status(400).send("Signature verification failed");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    let orderDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    try {
      if (orderId) {
        orderDoc = await db.collection("screeningOrders").doc(String(orderId)).get();
      }
      if (!orderDoc || !orderDoc.exists) {
        const snap = await db
          .collection("screeningOrders")
          .where("stripeSessionId", "==", session.id)
          .limit(1)
          .get();
        if (!snap.empty) {
          orderDoc = snap.docs[0];
        }
      }

      if (!orderDoc || !orderDoc.exists) {
        return res.sendStatus(200);
      }

      const order = orderDoc.data() as any;
      if (order?.status === "PAID") {
        return res.sendStatus(200);
      }

      const now = Date.now();
      const applicationId = order?.applicationId;
      const appSnap = applicationId
        ? await db.collection("rentalApplications").doc(String(applicationId)).get()
        : null;
      if (!appSnap || !appSnap.exists) {
        await db.collection("screeningOrders").doc(orderDoc.id).set(
          {
            status: "FAILED",
            error: "APPLICATION_NOT_FOUND",
            updatedAt: now,
          },
          { merge: true }
        );
        return res.sendStatus(200);
      }

      const application = appSnap.data() as any;
      if (String(application?.screening?.status || "").toUpperCase() === "COMPLETE") {
        await db.collection("screeningOrders").doc(orderDoc.id).set(
          { status: "PAID", paidAt: now, updatedAt: now },
          { merge: true }
        );
        return res.sendStatus(200);
      }
      const scoreAddOn = order?.scoreAddOn === true;
      const serviceLevel = String(order?.serviceLevel || "SELF_SERVE").toUpperCase();
      const aiVerification = serviceLevel === "VERIFIED_AI";
      const seed = seededNumber(String(applicationId || orderDoc.id));
      const result = buildStubResult(application, scoreAddOn, seed);
      const ai = aiVerification ? buildAiVerification(String(applicationId), seed) : null;

      await db.collection("screeningOrders").doc(orderDoc.id).set(
        {
          status: "PAID",
          paidAt: now,
          stripeSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          updatedAt: now,
        },
        { merge: true }
      );

      await db.collection("rentalApplications").doc(String(applicationId)).set(
        {
          screening: {
            requested: true,
            requestedAt: order?.createdAt || now,
            status: "COMPLETE",
            provider: "STUB",
            orderId: orderDoc.id,
            amountCents: order?.amountCents ?? null,
            currency: order?.currency || "CAD",
            paidAt: now,
            scoreAddOn: scoreAddOn,
            scoreAddOnCents: order?.scoreAddOnCents ?? null,
            totalAmountCents: order?.totalAmountCents ?? null,
            serviceLevel,
            aiVerification,
            ai,
            result,
          },
          updatedAt: now,
        },
        { merge: true }
      );

      if (serviceLevel === "VERIFIED" || serviceLevel === "VERIFIED_AI") {
        const existingQueue = await db
          .collection("verifiedScreeningQueue")
          .where("orderId", "==", orderDoc.id)
          .limit(1)
          .get();
        if (existingQueue.empty) {
          const applicantFirst = String(application?.applicant?.firstName || "").trim();
          const applicantLast = String(application?.applicant?.lastName || "").trim();
          const applicantName = `${applicantFirst} ${applicantLast}`.trim() || "Applicant";
          const applicantEmail = String(application?.applicant?.email || "").trim();
          const queueRef = db.collection("verifiedScreeningQueue").doc();
          const queueDoc = {
            id: queueRef.id,
            createdAt: now,
            updatedAt: now,
            status: "QUEUED",
            serviceLevel,
            landlordId: order?.landlordId || application?.landlordId || null,
            applicationId: applicationId,
            orderId: orderDoc.id,
            propertyId: order?.propertyId || application?.propertyId || null,
            unitId: order?.unitId || application?.unitId || null,
            applicant: { name: applicantName, email: applicantEmail || "" },
            aiIncluded: serviceLevel === "VERIFIED_AI",
            scoreAddOn,
            totalAmountCents: order?.totalAmountCents ?? null,
            currency: order?.currency || "CAD",
            notesInternal: null,
            reviewer: null,
            completedAt: null,
            resultSummary: null,
            recommendation: null,
            notify: {
              attemptedAt: null,
              emailed: false,
              error: null,
              to: null,
            },
          };
          await queueRef.set(queueDoc, { merge: true });

          const opsEmail = String(process.env.VERIFIED_SCREENING_NOTIFY_EMAIL || "").trim();
          let notifiedOps = false;
          let notifyError: string | null = null;
          if (!opsEmail) {
            notifyError = "MISSING_VERIFIED_SCREENING_NOTIFY_EMAIL";
          } else {
            try {
              const apiKey = process.env.SENDGRID_API_KEY;
              const from =
                process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
              const replyTo = process.env.SENDGRID_REPLY_TO || process.env.SENDGRID_REPLYTO_EMAIL;
              if (!apiKey || !from) {
                notifyError = "EMAIL_NOT_CONFIGURED";
              } else {
                const baseUrl = (process.env.PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
                const adminLink = `${baseUrl}/admin/verified-screenings`;
                sgMail.setApiKey(apiKey);
                await sgMail.send({
                  to: opsEmail,
                  from,
                  replyTo: replyTo || from,
                  subject: `Verified screening queued — ${applicantName}`,
                  text: [
                    "A verified screening is queued.",
                    "",
                    `Applicant: ${applicantName} (${applicantEmail || "n/a"})`,
                    `Service level: ${serviceLevel}`,
                    `Application ID: ${applicationId}`,
                    `Order ID: ${orderDoc.id}`,
                    `Property ID: ${application?.propertyId || "n/a"}`,
                    application?.unitId ? `Unit ID: ${application.unitId}` : null,
                    `Total paid: ${(Number(order?.totalAmountCents || 0) / 100).toFixed(2)} ${order?.currency || "CAD"}`,
                    "",
                    `View queue: ${adminLink}`,
                  ]
                    .filter(Boolean)
                    .join("\n"),
                  html: `
                    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a;">
                      <h3 style="margin:0 0 8px 0;">Verified screening queued</h3>
                      <div><strong>Applicant:</strong> ${applicantName} ${applicantEmail ? `(${applicantEmail})` : ""}</div>
                      <div><strong>Service level:</strong> ${serviceLevel}</div>
                      <div><strong>Application ID:</strong> ${applicationId}</div>
                      <div><strong>Order ID:</strong> ${orderDoc.id}</div>
                      <div><strong>Property ID:</strong> ${application?.propertyId || "n/a"}</div>
                      ${application?.unitId ? `<div><strong>Unit ID:</strong> ${application.unitId}</div>` : ""}
                      <div><strong>Total paid:</strong> ${(Number(order?.totalAmountCents || 0) / 100).toFixed(2)} ${order?.currency || "CAD"}</div>
                      <p style="margin:14px 0;">
                        <a href="${adminLink}" style="display:inline-block;padding:10px 14px;background:#2563eb;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;">View queue</a>
                      </p>
                    </div>
                  `,
                  trackingSettings: {
                    clickTracking: { enable: false, enableText: false },
                    openTracking: { enable: false },
                  },
                  mailSettings: {
                    footer: { enable: false },
                  },
                });
                notifiedOps = true;
              }
            } catch (err: any) {
              notifyError = err?.response?.body ? JSON.stringify(err.response.body) : err?.message || "SEND_FAILED";
              console.error("[verified-screening] ops email failed", { opsEmail, notifyError });
            }
          }

          await queueRef.set(
            {
              notify: {
                attemptedAt: Date.now(),
                emailed: notifiedOps,
                error: notifyError,
                to: opsEmail || null,
              },
            },
            { merge: true }
          );
        }
      }
    } catch (err: any) {
      console.error("[stripe-webhook-orders] handler failed", err?.message || err);
    }
  }

  return res.sendStatus(200);
});

export default router;
