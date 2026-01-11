// @ts-nocheck
import crypto from "crypto";
import {
  getApplicationByIdAsync,
  saveApplicationAsync,
} from "./applicationsService";
import { addConvertedTenant } from "./tenantDetailsService";
import { propertyService } from "./propertyService";
import { runScreeningWithCredits } from "./screeningsService";
import { logAuditEvent } from "./auditEventsService";
import { db } from "../config/firebase";
import sgMail from "@sendgrid/mail";

export async function convertApplicationToTenant(params: {
  landlordId: string;
  applicationId: string;
  runScreening: boolean;
  actorUserId?: string;
}): Promise<{
  tenantId: string;
  screening?: { screeningId: string; status: string };
  alreadyConverted: boolean;
  inviteUrl?: string | null;
  inviteEmailed?: boolean;
}> {
  const application = await getApplicationByIdAsync(params.applicationId);
  if (!application) {
    throw new Error("Application not found");
  }
  if (application.landlordId && application.landlordId !== params.landlordId) {
    throw new Error("Forbidden");
  }

  if (application.convertedTenantId) {
    await logAuditEvent({
      landlordId: params.landlordId,
      actorUserId: params.actorUserId,
      type: "application_converted",
      applicationId: application.id,
      tenantId: application.convertedTenantId,
      payload: { alreadyConverted: true, runScreening: params.runScreening },
      occurredAt: new Date().toISOString(),
    });
    return {
      tenantId: application.convertedTenantId,
      alreadyConverted: true,
      screening: application.screeningRequestId
        ? { screeningId: application.screeningRequestId, status: "completed" }
        : undefined,
      inviteUrl: application.inviteUrl ?? null,
      inviteEmailed: application.inviteEmailed ?? false,
    };
  }

  const tenantId = crypto.randomUUID();
  const createdAt = Date.now();
  const tenantRecord = {
    id: tenantId,
    landlordId: params.landlordId,
    fullName:
      application.applicantFullName ||
      application.fullName ||
      "Converted Applicant",
    email: application.applicantEmail ?? application.email ?? null,
    phone: application.applicantPhone ?? application.phone ?? null,
    propertyName: application.propertyName ?? null,
    propertyId: application.propertyId ?? null,
    unitId: application.unitApplied ?? application.unit ?? null,
    unit: application.unitApplied ?? application.unit ?? null,
    leaseStart: application.leaseStartDate ?? application.moveInDate ?? null,
    leaseEnd: null,
    monthlyRent: application.requestedRent ?? null,
    status: "active",
    balance: 0,
    riskLevel: "Low",
    source: "application_conversion",
    applicationId: application.id,
    createdAt,
  };

  addConvertedTenant(tenantRecord);

  try {
    await db.collection("tenants").doc(tenantId).set(tenantRecord, { merge: true });
  } catch (err) {
    console.error("[applicationConversion] failed to persist tenant", err);
  }

  if (application.propertyId && application.unitApplied) {
    const property = propertyService.getById(application.propertyId);
    if (property?.units) {
      const unit = property.units.find(
        (u) => u.unitNumber === application.unitApplied
      );
      if (unit) {
        unit.status = "occupied";
      }
    }
  }

  const invitation = await createAndEmailInvite({
    landlordId: params.landlordId,
    tenantId,
    propertyId: application.propertyId ?? null,
    unitId: application.unitApplied ?? application.unit ?? null,
    tenantEmail: application.applicantEmail ?? application.email ?? null,
    tenantName: application.applicantFullName ?? application.fullName ?? null,
  });

  const updated = {
    ...application,
    landlordId: params.landlordId,
    status: "converted",
    convertedTenantId: tenantId,
    updatedAt: new Date().toISOString(),
    inviteUrl: invitation.inviteUrl,
    inviteEmailed: invitation.inviteEmailed,
  };

  let screeningResult: { screeningId: string; status: string } | undefined;

  if (params.runScreening) {
    const screening = await runScreeningWithCredits({
      landlordId: params.landlordId,
      landlordEmail: application.applicantEmail ?? application.email,
      applicationId: application.id,
    });
    if (screening.screeningId) {
      updated.screeningRequestId = screening.screeningId;
      updated.screeningId = screening.screeningId;
      screeningResult = {
        screeningId: screening.screeningId,
        status: screening.status,
      };
      await logAuditEvent({
        landlordId: params.landlordId,
        actorUserId: params.actorUserId,
        type: "screening_triggered",
        applicationId: application.id,
        tenantId,
        screeningId: screening.screeningId,
        payload: { status: screening.status },
        occurredAt: new Date().toISOString(),
      });
    } else if (screening.status) {
      screeningResult = { screeningId: "", status: screening.status };
      if (screening.status === "blocked_no_credits") {
        await logAuditEvent({
          landlordId: params.landlordId,
          actorUserId: params.actorUserId,
          type: "screening_blocked_no_credits",
          applicationId: application.id,
          tenantId,
          payload: { status: screening.status },
          occurredAt: new Date().toISOString(),
        });
      }
    }
  }

  await saveApplicationAsync(updated);

  await logAuditEvent({
    landlordId: params.landlordId,
    actorUserId: params.actorUserId,
    type: "application_converted",
    applicationId: application.id,
    tenantId,
    payload: { alreadyConverted: false, runScreening: params.runScreening },
    occurredAt: new Date().toISOString(),
  });

  return {
    tenantId,
    screening: screeningResult,
    alreadyConverted: false,
    inviteUrl: invitation.inviteUrl,
    inviteEmailed: invitation.inviteEmailed,
  };
}

async function createAndEmailInvite(opts: {
  landlordId: string;
  tenantId: string;
  propertyId?: string | null;
  unitId?: string | null;
  tenantEmail?: string | null;
  tenantName?: string | null;
}): Promise<{ inviteUrl: string | null; inviteEmailed: boolean }> {
  const tenantEmail = (opts.tenantEmail || "").trim();
  const hasEmail = !!tenantEmail;
  const token = crypto.randomBytes(24).toString("hex");
  const now = Date.now();
  const expiresAt = now + 1000 * 60 * 60 * 24 * 7;
  const baseUrl = (process.env.PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
  const inviteUrl = `${baseUrl}/tenant/invite/${token}`;

  await db.collection("tenantInvites").doc(token).set({
    token,
    landlordId: opts.landlordId,
    tenantEmail: hasEmail ? tenantEmail : null,
    tenantName: opts.tenantName || null,
    propertyId: opts.propertyId || null,
    unitId: opts.unitId || null,
    tenantId: opts.tenantId || null,
    status: "pending",
    createdAt: now,
    expiresAt,
  });

  if (!hasEmail) {
    return { inviteUrl, inviteEmailed: false };
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  const from =
    process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
  if (!apiKey || !from) {
    console.warn("[applicationConversion] missing sendgrid env, skipping email");
    return { inviteUrl, inviteEmailed: false };
  }

  const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`SEND_TIMEOUT_${ms}MS`)), ms)),
    ]);

  try {
    sgMail.setApiKey(apiKey as string);
    const subject = "You're invited to RentChain";
    const greet = opts.tenantName ? `Hi ${opts.tenantName},` : "Hi,";
    const text =
      `${greet}\n\n` +
      `You've been invited to join RentChain as a tenant. ` +
      `Open this link to accept your invite:\n${inviteUrl}\n\n` +
      `Note: this link may expire. If you weren't expecting this, you can ignore this email.\n\n` +
      `— RentChain`;

    await withTimeout(
      sgMail.send({
        to: tenantEmail,
        from: from as string,
        subject,
        text,
        trackingSettings: {
          clickTracking: { enable: false, enableText: false },
          openTracking: { enable: false },
        },
        mailSettings: {
          footer: { enable: false },
        },
      }),
      8000
    );
    return { inviteUrl, inviteEmailed: true };
  } catch (err) {
    console.error("[applicationConversion] invite email failed", err?.message || err);
    return { inviteUrl, inviteEmailed: false };
  }
}
