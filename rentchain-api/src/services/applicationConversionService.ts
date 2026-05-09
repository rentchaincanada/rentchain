// @ts-nocheck
import crypto from "crypto";
import { addConvertedTenant } from "./tenantDetailsService";
import { runScreeningWithCredits } from "./screeningsService";
import { logAuditEvent } from "./auditEventsService";
import { db } from "../config/firebase";
import { sendEmail } from "./emailService";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { createTenancyIfMissing } from "./tenanciesService";
import { createReplacementTenancyInvite } from "./tenantPortal/tenantInviteService";
import { syncPropertyUnitOccupancyForTenantContext } from "./tenantPortal/tenantOccupancySyncService";

async function loadApplicationForConversion(applicationId: string): Promise<{ application: any; collectionName: string } | null> {
  const rentalSnap = await db.collection("rentalApplications").doc(applicationId).get();
  if (rentalSnap.exists) {
    return { application: { id: rentalSnap.id, ...(rentalSnap.data() as any) }, collectionName: "rentalApplications" };
  }
  const legacySnap = await db.collection("applications").doc(applicationId).get();
  if (legacySnap.exists) {
    return { application: { id: legacySnap.id, ...(legacySnap.data() as any) }, collectionName: "applications" };
  }
  return null;
}

async function saveConvertedApplication(collectionName: string, updated: any) {
  await db.collection(collectionName).doc(String(updated.id)).set(updated, { merge: true });
  if (collectionName !== "applications") {
    await db.collection("applications").doc(String(updated.id)).set(updated, { merge: true });
  }
}

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
  const loaded = await loadApplicationForConversion(params.applicationId);
  if (!loaded) {
    throw new Error("Application not found");
  }
  const application = loaded.application;
  if (application.landlordId && application.landlordId !== params.landlordId) {
    throw new Error("Forbidden");
  }
  const applicantFirstName = String(application?.applicant?.firstName || application?.firstName || "").trim();
  const applicantLastName = String(application?.applicant?.lastName || application?.lastName || "").trim();
  const applicantFullName =
    String(application?.applicantFullName || application?.fullName || "").trim() ||
    `${applicantFirstName} ${applicantLastName}`.trim();
  const applicantEmail = String(application?.applicantEmail || application?.email || application?.applicant?.email || "").trim().toLowerCase();
  const applicantPhone = String(application?.applicantPhone || application?.phone || application?.applicant?.phoneHome || application?.applicant?.phoneWork || "").trim();
  const unitId = application.unitId ?? application.unitApplied ?? application.unit ?? null;

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
      applicantFullName ||
      "Converted Applicant",
    email: applicantEmail || null,
    phone: applicantPhone || null,
    propertyName: application.propertyName ?? null,
    propertyId: application.propertyId ?? null,
    unitId,
    unit: unitId,
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

  try {
    await createTenancyIfMissing({
      tenantId,
      landlordId: params.landlordId,
      propertyId: application.propertyId ?? null,
      unitId,
      unitLabel: unitId,
      moveInAt: application.leaseStartDate ?? application.moveInDate ?? null,
    });
  } catch (err) {
    console.warn("[applicationConversion] tenancy backfill failed", err);
  }

  try {
    await syncPropertyUnitOccupancyForTenantContext({
      tenantId,
      leaseId: application.leaseId ?? application.currentLeaseId ?? null,
      applicationId: application.id,
      landlordId: params.landlordId,
      propertyId: application.propertyId ?? null,
      unitId,
    });
  } catch (err) {
    console.warn("[applicationConversion] occupancy sync skipped", err);
  }

  const invitation = await createAndEmailInvite({
    landlordId: params.landlordId,
    tenantId,
    propertyId: application.propertyId ?? null,
    unitId,
    applicationId: application.id,
    tenantEmail: applicantEmail || null,
    tenantName: applicantFullName || null,
    createdBy: params.actorUserId || params.landlordId,
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
    }
  }

  await saveConvertedApplication(loaded.collectionName, updated);

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
  applicationId?: string | null;
  tenantEmail?: string | null;
  tenantName?: string | null;
  createdBy?: string | null;
}): Promise<{ inviteUrl: string | null; inviteEmailed: boolean }> {
  const tenantEmail = (opts.tenantEmail || "").trim();
  const hasEmail = !!tenantEmail;
  if (!opts.propertyId) {
    console.warn("[applicationConversion] missing propertyId, skipping tenant invite");
    return { inviteUrl: null, inviteEmailed: false };
  }
  const created = await createReplacementTenancyInvite({
    landlordId: opts.landlordId,
    propertyId: opts.propertyId,
    applicationId: opts.applicationId || null,
    invitedEmail: tenantEmail || null,
    invitedName: opts.tenantName || null,
    unitId: opts.unitId || null,
    leaseId: null,
    createdBy: opts.createdBy || opts.landlordId,
  });
  const baseUrl = (process.env.PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
  const inviteUrl = `${baseUrl}/tenant/invite/${created.token}`;

  if (!hasEmail) {
    return { inviteUrl, inviteEmailed: false };
  }

  const from = process.env.EMAIL_FROM || process.env.FROM_EMAIL;
  if (!from) {
    console.warn("[applicationConversion] missing email sender env, skipping email");
    return { inviteUrl, inviteEmailed: false };
  }

  const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      p,
      new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`SEND_TIMEOUT_${ms}MS`)), ms)),
    ]);

  try {
    const subject = "You're invited to RentChain";
    const greet = opts.tenantName ? `Hi ${opts.tenantName},` : "Hi,";
    const text = buildEmailText({
      intro: `${greet}\n\nYou've been invited to join RentChain as a tenant. This link may expire.`,
      ctaText: "View invitation",
      ctaUrl: inviteUrl,
      footerNote: "If you weren't expecting this, you can ignore this email.",
    });
    const html = buildEmailHtml({
      title: "You're invited to RentChain",
      intro: `${greet} You've been invited to join RentChain as a tenant. This link may expire.`,
      ctaText: "View invitation",
      ctaUrl: inviteUrl,
      footerNote: "If you weren't expecting this, you can ignore this email.",
    });

    await withTimeout(
      sendEmail({
        to: tenantEmail,
        from: from as string,
        subject,
        text,
        html,
      }),
      8000
    );
    return { inviteUrl, inviteEmailed: true };
  } catch (err) {
    console.error("[applicationConversion] invite email failed", err?.message || err);
    return { inviteUrl, inviteEmailed: false };
  }
}
