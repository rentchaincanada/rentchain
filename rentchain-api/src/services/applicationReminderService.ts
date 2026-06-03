import { createHash, randomBytes } from "crypto";
import { db } from "../firebase";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "./emailService";

const APPLICATION_LINK_REMINDER_STATUSES = new Set(["started", "in_progress", "ready_to_submit"]);
export const APPLICATION_REMINDER_RESEND_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const APPLICATION_LINK_SECTION_LABELS: Record<string, string> = {
  personal_info: "Personal information",
  residential_history: "Residential history",
  employment: "Employment",
  references_assets: "References and assets",
  consent: "Consent",
};

export type NormalizedApplicationLinkPartialProgress = {
  status: "not_started" | "started" | "in_progress" | "ready_to_submit" | "submitted";
  completionPercent: number;
  currentStep: string | null;
  completedSections: string[];
  missingSections: string[];
  hasCoApplicant: boolean;
  viewingChoice: "already_viewed" | "request_viewing" | null;
  startedAt: number | null;
  lastActivityAt: number | null;
  submittedAt: number | null;
  reminderEligibleAt: number | null;
  reminderSentAt: number | null;
};

export function normalizeApplicationLinkPartialProgress(value: any): NormalizedApplicationLinkPartialProgress {
  const statusRaw = String(value?.status || "").trim();
  const currentStepRaw = String(value?.currentStep || "").trim();
  const viewingChoiceRaw = String(value?.viewingChoice || "").trim();
  const completionPercentRaw = Number(value?.completionPercent);
  return {
    status:
      statusRaw === "started" ||
      statusRaw === "in_progress" ||
      statusRaw === "ready_to_submit" ||
      statusRaw === "submitted" ||
      statusRaw === "not_started"
        ? statusRaw
        : "not_started",
    completionPercent: Number.isFinite(completionPercentRaw)
      ? Math.min(100, Math.max(0, Math.round(completionPercentRaw)))
      : 0,
    currentStep: currentStepRaw || null,
    completedSections: Array.isArray(value?.completedSections)
      ? value.completedSections.map((entry: any) => String(entry || "").trim()).filter(Boolean)
      : [],
    missingSections: Array.isArray(value?.missingSections)
      ? value.missingSections.map((entry: any) => String(entry || "").trim()).filter(Boolean)
      : [],
    hasCoApplicant: value?.hasCoApplicant === true,
    viewingChoice:
      viewingChoiceRaw === "already_viewed" || viewingChoiceRaw === "request_viewing" ? viewingChoiceRaw : null,
    startedAt: typeof value?.startedAt === "number" ? value.startedAt : null,
    lastActivityAt: typeof value?.lastActivityAt === "number" ? value.lastActivityAt : null,
    submittedAt: typeof value?.submittedAt === "number" ? value.submittedAt : null,
    reminderEligibleAt: typeof value?.reminderEligibleAt === "number" ? value.reminderEligibleAt : null,
    reminderSentAt: typeof value?.reminderSentAt === "number" ? value.reminderSentAt : null,
  };
}

export function buildApplicationResumeUrl(token: string) {
  const baseUrl = (process.env.PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
  return `${baseUrl}/apply/${encodeURIComponent(token)}`;
}

function summarizeMissingSections(sections: string[]) {
  return sections
    .map((section) => APPLICATION_LINK_SECTION_LABELS[section] || section.replace(/_/g, " "))
    .filter(Boolean);
}

export function getApplicationLinkReminderEligibility(link: any, now: number) {
  const partialProgress = normalizeApplicationLinkPartialProgress(link?.partialProgress);
  const expiresAt = typeof link?.expiresAt === "number" ? link.expiresAt : Number(link?.expiresAt || 0) || null;
  const applicantEmail = String(link?.applicantEmail || "").trim().toLowerCase();
  const cooldownElapsed =
    partialProgress.reminderSentAt == null || partialProgress.reminderSentAt <= now - APPLICATION_REMINDER_RESEND_COOLDOWN_MS;
  const isEligible =
    String(link?.status || "").trim().toUpperCase() === "ACTIVE" &&
    (!expiresAt || expiresAt > now) &&
    APPLICATION_LINK_REMINDER_STATUSES.has(partialProgress.status) &&
    partialProgress.submittedAt == null &&
    partialProgress.reminderEligibleAt != null &&
    partialProgress.reminderEligibleAt <= now &&
    cooldownElapsed &&
    Boolean(applicantEmail);

  return {
    isEligible,
    partialProgress,
    applicantEmail,
    cooldownElapsed,
  };
}

async function resolveApplicationLinkReminderContext(link: any) {
  let propertyLabel: string | null = null;
  let unitLabel: string | null = null;

  if (link?.propertyId) {
    try {
      const propertySnap = await db.collection("properties").doc(String(link.propertyId)).get();
      if (propertySnap.exists) {
        const property = propertySnap.data() as any;
        propertyLabel = property?.name || property?.addressLine1 || "Property";
      }
    } catch {
      // ignore best-effort lookup failures
    }
  }

  if (link?.unitId) {
    try {
      const unitSnap = await db.collection("units").doc(String(link.unitId)).get();
      if (unitSnap.exists) {
        const unit = unitSnap.data() as any;
        unitLabel = unit?.unitNumber || unit?.name || unit?.label || null;
      }
    } catch {
      // ignore best-effort lookup failures
    }
  }

  return { propertyLabel, unitLabel };
}

export async function sendApplicationLinkReminder(linkId: string, options?: { actorType?: "landlord" | "internal" }) {
  const now = Date.now();
  const linkRef = db.collection("applicationLinks").doc(String(linkId).trim());
  const freshSnap = await linkRef.get();
  if (!freshSnap.exists) {
    return { ok: false as const, error: "APPLICATION_LINK_NOT_FOUND" as const };
  }

  const link = { id: freshSnap.id, ...(freshSnap.data() as any) };
  const eligibility = getApplicationLinkReminderEligibility(link, now);
  if (!eligibility.isEligible) {
    return { ok: false as const, error: "APPLICATION_REMINDER_NOT_ELIGIBLE" as const };
  }

  const reminderToken = randomBytes(32).toString("hex");
  const reminderTokenHash = createHash("sha256").update(reminderToken).digest("hex");
  const resumeUrl = buildApplicationResumeUrl(reminderToken);
  const { propertyLabel, unitLabel } = await resolveApplicationLinkReminderContext(link);
  const completionPercent = eligibility.partialProgress.completionPercent;
  const missingSections = summarizeMissingSections(eligibility.partialProgress.missingSections);
  const propertySummary = [propertyLabel, unitLabel ? `Unit ${unitLabel}` : null].filter(Boolean).join(" - ");
  const introParts = [
    "You can continue your rental application using the secure link below.",
    propertySummary ? `Property: ${propertySummary}.` : null,
    completionPercent > 0 ? `You're ${completionPercent}% complete.` : null,
  ].filter(Boolean);

  await sendEmail({
    to: eligibility.applicantEmail,
    from: process.env.EMAIL_FROM || process.env.FROM_EMAIL,
    replyTo:
      process.env.EMAIL_REPLY_TO || process.env.REPLY_TO_EMAIL || process.env.EMAIL_FROM || process.env.FROM_EMAIL,
    subject: "Finish your rental application",
    text: buildEmailText({
      intro: `Hi,\n\n${introParts.join(" ")}`,
      bullets: missingSections.length ? missingSections.map((section) => `Missing section: ${section}`) : undefined,
      ctaText: "Continue where you left off",
      ctaUrl: resumeUrl,
      footerNote: "This reminder includes only safe progress details and never includes your draft answers.",
    }),
    html: buildEmailHtml({
      title: "Finish your rental application",
      intro: `Hi, ${introParts.join(" ")}`,
      bullets: missingSections.length ? missingSections.map((section) => `Missing section: ${section}`) : undefined,
      ctaText: "Continue where you left off",
      ctaUrl: resumeUrl,
      footerNote: "This reminder includes only safe progress details and never includes your draft answers.",
      preheader: "Resume your rental application with your secure link.",
    }),
  });

  const nextPartialProgress = {
    ...eligibility.partialProgress,
    reminderSentAt: now,
  };
  await linkRef.set(
    {
      tokenHash: reminderTokenHash,
      partialProgress: nextPartialProgress,
    },
    { merge: true }
  );

  console.info(
    "[application_reminder_send]",
    JSON.stringify({
      applicationLinkId: link.id,
      landlordId: String(link?.landlordId || ""),
      actorType: options?.actorType || "landlord",
      success: true,
    })
  );

  return {
    ok: true as const,
    data: {
      id: link.id,
      sentAt: now,
      partialProgress: nextPartialProgress,
    },
  };
}

export async function processEligibleApplicationLinkReminders(limitRaw?: number) {
  const requestedLimit = Number(limitRaw);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(20, Math.max(1, Math.round(requestedLimit)))
    : 10;
  const scanLimit = Math.min(200, Math.max(limit * 5, limit));
  const now = Date.now();

  const snap = await db.collection("applicationLinks").where("status", "==", "ACTIVE").limit(scanLimit).get();
  const scannedDocs = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
  const eligibleCandidates = scannedDocs.filter((link) => getApplicationLinkReminderEligibility(link, now).isEligible);
  const candidates = eligibleCandidates.slice(0, limit);

  const processedLinkIds: string[] = [];
  const skippedLinkIds: string[] = scannedDocs
    .filter((link) => !getApplicationLinkReminderEligibility(link, now).isEligible)
    .map((link) => link.id);
  const failedLinkIds: string[] = [];
  let sent = 0;

  for (const candidate of candidates) {
    processedLinkIds.push(candidate.id);
    try {
      const result = await sendApplicationLinkReminder(candidate.id, { actorType: "internal" });
      if (result.ok) {
        sent += 1;
      } else {
        skippedLinkIds.push(candidate.id);
      }
    } catch (err: any) {
      failedLinkIds.push(candidate.id);
      console.error(
        "[application_reminder_send]",
        JSON.stringify({
          applicationLinkId: candidate.id,
          landlordId: String(candidate?.landlordId || ""),
          actorType: "internal",
          success: false,
          error: err?.message || String(err),
        })
      );
    }
  }

  return {
    scanned: scannedDocs.length,
    eligible: eligibleCandidates.length,
    sent,
    skipped: skippedLinkIds.length,
    failed: failedLinkIds.length,
    processedLinkIds,
  };
}
