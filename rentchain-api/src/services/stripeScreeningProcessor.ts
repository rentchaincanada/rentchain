import sgMail from "@sendgrid/mail";
import { createHash } from "crypto";
import { db } from "../config/firebase";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";

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

export async function applyScreeningResultsFromOrder(params: {
  orderId: string;
  applicationId: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const { orderId, applicationId } = params;
  const orderDoc = await db.collection("screeningOrders").doc(orderId).get();
  const appSnap = await db.collection("rentalApplications").doc(String(applicationId)).get();
  if (!orderDoc.exists || !appSnap.exists) {
    return { ok: false, error: "missing_order_or_application" };
  }

  const order = orderDoc.data() as any;
  const application = appSnap.data() as any;
  if (String(application?.screening?.status || "").toUpperCase() === "COMPLETE") {
    return { ok: true, skipped: true };
  }

  const now = Date.now();
  const scoreAddOn = order?.scoreAddOn === true;
  const serviceLevel = String(order?.serviceLevel || "SELF_SERVE").toUpperCase();
  const aiVerification = serviceLevel === "VERIFIED_AI";
  const seed = seededNumber(String(applicationId || orderId));
  const result = buildStubResult(application, scoreAddOn, seed);
  const ai = aiVerification ? buildAiVerification(String(applicationId), seed) : null;

  await db.collection("rentalApplications").doc(String(applicationId)).set(
    {
      screening: {
        requested: true,
        requestedAt: order?.createdAt || now,
        status: "COMPLETE",
        provider: "STUB",
        orderId,
        amountCents: order?.amountCents ?? null,
        currency: order?.currency || "CAD",
        paidAt: order?.paidAt || now,
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
      .where("orderId", "==", orderId)
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
        orderId: orderId,
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
              text: buildEmailText({
                intro: `A verified screening is queued.\nApplicant: ${applicantName} (${applicantEmail || "n/a"})\nService level: ${serviceLevel}\nApplication ID: ${applicationId}\nOrder ID: ${orderId}\nProperty ID: ${application?.propertyId || "n/a"}${application?.unitId ? `\nUnit ID: ${application.unitId}` : ""}\nTotal paid: ${(Number(order?.totalAmountCents || 0) / 100).toFixed(2)} ${order?.currency || "CAD"}`,
                ctaText: "View queue",
                ctaUrl: adminLink,
                footerNote: "You received this because you are on verified screening notifications.",
              }),
              html: buildEmailHtml({
                title: "Verified screening queued",
                intro: `Applicant: ${applicantName} (${applicantEmail || "n/a"}). Service level: ${serviceLevel}. Application ID: ${applicationId}. Order ID: ${orderId}.`,
                ctaText: "View queue",
                ctaUrl: adminLink,
                footerNote: "You received this because you are on verified screening notifications.",
              }),
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

  return { ok: true };
}
