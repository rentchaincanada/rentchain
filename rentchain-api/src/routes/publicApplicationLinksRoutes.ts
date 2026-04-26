import { Router } from "express";
import { createHash } from "crypto";
import { db } from "../config/firebase";
import { rateLimitPublicApply } from "../middleware/rateLimit";

const router = Router();

const PARTIAL_PROGRESS_STATUSES = ["not_started", "started", "in_progress", "ready_to_submit", "submitted"] as const;
const PARTIAL_PROGRESS_STEPS = [
  "personal_info",
  "residential_history",
  "employment",
  "references_assets",
  "consent",
] as const;
const PARTIAL_PROGRESS_SECTIONS = PARTIAL_PROGRESS_STEPS;
const PARTIAL_PROGRESS_VIEWING_CHOICES = ["already_viewed", "request_viewing"] as const;
const PARTIAL_PROGRESS_REMINDER_DELAY_MS = 24 * 60 * 60 * 1000;

type PartialProgressStatus = (typeof PARTIAL_PROGRESS_STATUSES)[number];
type PartialProgressStep = (typeof PARTIAL_PROGRESS_STEPS)[number];
type PartialProgressSection = (typeof PARTIAL_PROGRESS_SECTIONS)[number];
type PartialProgressViewingChoice = (typeof PARTIAL_PROGRESS_VIEWING_CHOICES)[number];
type SafePartialProgressInput = {
  status: PartialProgressStatus;
  completionPercent: number;
  currentStep: PartialProgressStep | null;
  completedSections: string[];
  missingSections: string[];
  hasCoApplicant: boolean;
  viewingChoice: PartialProgressViewingChoice | null;
};
type StoredPartialProgress = SafePartialProgressInput & {
  startedAt: number | null;
  lastActivityAt: number | null;
  submittedAt: number | null;
  reminderEligibleAt: number | null;
  reminderSentAt: number | null;
};

function normalizeStringArray(value: unknown, allowed: readonly string[]) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .map((entry) => String(entry || "").trim())
    .filter((entry) => allowed.includes(entry) && !seen.has(entry) && (seen.add(entry), true));
}

function sanitizePartialProgressInput(input: any) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false as const, error: "INVALID_PARTIAL_PROGRESS" };
  }

  const allowedKeys = new Set([
    "status",
    "completionPercent",
    "currentStep",
    "completedSections",
    "missingSections",
    "hasCoApplicant",
    "viewingChoice",
  ]);
  const incomingKeys = Object.keys(input || {});
  const unexpected = incomingKeys.filter((key) => !allowedKeys.has(key));
  if (unexpected.length) {
    return {
      ok: false as const,
      error: "INVALID_PARTIAL_PROGRESS_FIELDS",
      fields: unexpected,
    };
  }

  const statusRaw = String(input.status || "").trim();
  const currentStepRaw = String(input.currentStep || "").trim();
  const viewingChoiceRaw = String(input.viewingChoice || "").trim();
  const completionPercentRaw = Number(input.completionPercent);

  const status = PARTIAL_PROGRESS_STATUSES.includes(statusRaw as PartialProgressStatus)
    ? (statusRaw as PartialProgressStatus)
    : null;
  const currentStep = PARTIAL_PROGRESS_STEPS.includes(currentStepRaw as PartialProgressStep)
    ? (currentStepRaw as PartialProgressStep)
    : null;
  const viewingChoice = PARTIAL_PROGRESS_VIEWING_CHOICES.includes(viewingChoiceRaw as PartialProgressViewingChoice)
    ? (viewingChoiceRaw as PartialProgressViewingChoice)
    : null;
  const completionPercent = Number.isFinite(completionPercentRaw)
    ? Math.min(100, Math.max(0, Math.round(completionPercentRaw)))
    : 0;
  const completedSections = normalizeStringArray(input.completedSections, PARTIAL_PROGRESS_SECTIONS);
  const missingSections = normalizeStringArray(input.missingSections, PARTIAL_PROGRESS_SECTIONS);
  const hasCoApplicant = input.hasCoApplicant === true;

  return {
    ok: true as const,
    value: {
      status: status || (completionPercent >= 100 ? "ready_to_submit" : completionPercent > 0 ? "in_progress" : "not_started"),
      completionPercent,
      currentStep,
      completedSections,
      missingSections,
      hasCoApplicant,
      viewingChoice,
    },
  };
}

function normalizeStoredPartialProgress(input: any): StoredPartialProgress {
  const sanitized = sanitizePartialProgressInput({
    status: input?.status,
    completionPercent: input?.completionPercent,
    currentStep: input?.currentStep,
    completedSections: input?.completedSections,
    missingSections: input?.missingSections,
    hasCoApplicant: input?.hasCoApplicant,
    viewingChoice: input?.viewingChoice,
  });
  if (!sanitized.ok) {
    return {
      status: "not_started",
      completionPercent: 0,
      currentStep: null,
      completedSections: [],
      missingSections: [],
      hasCoApplicant: false,
      viewingChoice: null,
      startedAt: null,
      lastActivityAt: null,
      submittedAt: null,
      reminderEligibleAt: null,
      reminderSentAt: null,
    };
  }

  return {
    ...sanitized.value,
    startedAt: typeof input?.startedAt === "number" ? input.startedAt : null,
    lastActivityAt: typeof input?.lastActivityAt === "number" ? input.lastActivityAt : null,
    submittedAt: typeof input?.submittedAt === "number" ? input.submittedAt : null,
    reminderEligibleAt: typeof input?.reminderEligibleAt === "number" ? input.reminderEligibleAt : null,
    reminderSentAt: typeof input?.reminderSentAt === "number" ? input.reminderSentAt : null,
  };
}

function buildPartialProgressPatch(existing: any, safeInput: SafePartialProgressInput, now: number): StoredPartialProgress {
  const current = normalizeStoredPartialProgress(existing);
  const isStartedStatus = safeInput.status !== "not_started";
  const startedAt = current.startedAt || (isStartedStatus ? now : null);
  const submittedAt =
    safeInput.status === "submitted" ? current.submittedAt || now : current.submittedAt || null;
  return {
    status: safeInput.status,
    completionPercent: safeInput.status === "submitted" ? 100 : safeInput.completionPercent,
    currentStep: safeInput.status === "submitted" ? null : safeInput.currentStep,
    completedSections: safeInput.completedSections,
    missingSections: safeInput.status === "submitted" ? [] : safeInput.missingSections,
    hasCoApplicant: safeInput.hasCoApplicant,
    viewingChoice: safeInput.viewingChoice,
    startedAt,
    lastActivityAt: now,
    submittedAt,
    reminderEligibleAt: startedAt ? startedAt + PARTIAL_PROGRESS_REMINDER_DELAY_MS : null,
    reminderSentAt: current.reminderSentAt || null,
  };
}

async function findLinkByToken(token: string) {
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const snap = await db.collection("applicationLinks").where("tokenHash", "==", tokenHash).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...(doc.data() as any) };
}

function normalizeCurrentLeaseStatus(input: any) {
  if (!input || typeof input !== "object") return null;
  const hasActiveLease = input?.hasActiveLease === true;
  const leaseEndDateRaw = String(input?.leaseEndDate || "").trim();
  const landlordAwareRaw = String(input?.landlordAware || "").trim();
  const reasonForMovingRaw = String(input?.reasonForMoving || "").trim();
  const landlordAware =
    landlordAwareRaw === "yes" || landlordAwareRaw === "no" || landlordAwareRaw === "prefer_not_to_say"
      ? landlordAwareRaw
      : null;

  return {
    hasActiveLease,
    leaseEndDate: leaseEndDateRaw || null,
    landlordAware: hasActiveLease ? landlordAware : null,
    reasonForMoving: reasonForMovingRaw || null,
  };
}

router.get("/application-links/:token", async (req: any, res) => {
  res.setHeader("x-route-source", "publicApplicationLinksRoutes");
  try {
    const token = String(req.params?.token || "").trim();
    if (!token) return res.status(400).json({ ok: false, error: "Missing token" });

    const link = await findLinkByToken(token);
    const now = Date.now();
    const isExpired = link?.expiresAt && now > Number(link.expiresAt);
    if (!link || link.status !== "ACTIVE" || isExpired) {
      if (link?.id && isExpired && link.status === "ACTIVE") {
        try {
          await db.collection("applicationLinks").doc(link.id).set({ status: "EXPIRED" }, { merge: true });
        } catch {
          // ignore
        }
      }
      return res.status(404).json({ ok: false, error: "APPLICATION_LINK_NOT_FOUND" });
    }

    // Fetch context (best-effort)
    let propertyName: string | null = null;
    let unitLabel: string | null = null;

    if (link.propertyId) {
      try {
        const propSnap = await db.collection("properties").doc(String(link.propertyId)).get();
        if (propSnap.exists) {
          propertyName = (propSnap.data() as any)?.name || (propSnap.data() as any)?.addressLine1 || null;
        }
      } catch {
        /* ignore */
      }
    }

    if (link.unitId) {
      try {
        const unitSnap = await db.collection("units").doc(String(link.unitId)).get();
        if (unitSnap.exists) {
          unitLabel = (unitSnap.data() as any)?.unitNumber || null;
        }
      } catch {
        /* ignore */
      }
    }

    return res.json({
      ok: true,
      data: {
        propertyId: link.propertyId || null,
        unitId: link.unitId || null,
        expiresAt: link.expiresAt ?? null,
        landlordBrandName: null,
        partialProgress: normalizeStoredPartialProgress(link.partialProgress),
      },
      context: { propertyName, unitLabel },
    });
  } catch (err: any) {
    console.error("[public application-links] lookup failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to load application link" });
  }
});

router.patch("/application-links/:token/progress", async (req: any, res) => {
  res.setHeader("x-route-source", "publicApplicationLinksRoutes");
  try {
    const token = String(req.params?.token || "").trim();
    if (!token) return res.status(400).json({ ok: false, error: "Missing token" });

    const link = await findLinkByToken(token);
    const now = Date.now();
    const isExpired = link?.expiresAt && now > Number(link.expiresAt);
    if (!link || link.status !== "ACTIVE" || isExpired) {
      if (link?.id && isExpired && link.status === "ACTIVE") {
        try {
          await db.collection("applicationLinks").doc(link.id).set({ status: "EXPIRED" }, { merge: true });
        } catch {
          // ignore
        }
      }
      return res.status(404).json({ ok: false, error: "APPLICATION_LINK_NOT_FOUND" });
    }

    const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
    const partialProgressInput = sanitizePartialProgressInput(body?.partialProgress);
    if (!partialProgressInput.ok) {
      return res.status(400).json({
        ok: false,
        error: partialProgressInput.error,
        fields: "fields" in partialProgressInput ? partialProgressInput.fields : undefined,
      });
    }

    const nextPartialProgress = buildPartialProgressPatch(link.partialProgress, partialProgressInput.value, now);
    await db.collection("applicationLinks").doc(link.id).set({ partialProgress: nextPartialProgress }, { merge: true });

    return res.json({ ok: true, data: { partialProgress: nextPartialProgress } });
  } catch (err: any) {
    console.error("[public application-links] progress update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "APPLICATION_LINK_PROGRESS_UPDATE_FAILED" });
  }
});

router.post("/rental-applications", rateLimitPublicApply, async (req: any, res) => {
  res.setHeader("x-route-source", "publicApplicationLinksRoutes");
  try {
    const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
    const token = String(body?.token || "").trim();
    if (!token) return res.status(400).json({ ok: false, error: "token_required" });

    const link = await findLinkByToken(token);
    const now = Date.now();
    const isExpired = link?.expiresAt && now > Number(link.expiresAt);
    if (!link || link.status !== "ACTIVE" || isExpired) {
      if (link?.id && isExpired && link.status === "ACTIVE") {
        try {
          await db.collection("applicationLinks").doc(link.id).set({ status: "EXPIRED" }, { merge: true });
        } catch {
          // ignore
        }
      }
      return res.status(404).json({ ok: false, error: "APPLICATION_LINK_NOT_FOUND" });
    }

    const applicant = body?.applicant || {};
    const firstName = String(applicant?.firstName || "").trim();
    const lastName = String(applicant?.lastName || "").trim();
    const email = String(applicant?.email || "").trim();
    const dob = String(applicant?.dob || "").trim();
    const residentialHistory = Array.isArray(body?.residentialHistory) ? body.residentialHistory : [];
    const currentAddress = String(residentialHistory?.[0]?.address || "").trim();
    const consent = body?.consent || {};
    const applicantProfile = body?.applicantProfile || null;
    const applicationConsent = body?.applicationConsent || null;
    const currentLeaseStatus = normalizeCurrentLeaseStatus(body?.currentLeaseStatus);
    const creditConsent = consent?.creditConsent === true;
    const referenceConsent = consent?.referenceConsent === true;
    const acceptedAt =
      typeof consent?.acceptedAt === "number" && Number.isFinite(consent.acceptedAt)
        ? consent.acceptedAt
        : null;

    if (!firstName || !lastName || !email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "INVALID_APPLICANT" });
    }
    if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob) || !currentAddress) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST",
        detail: "DOB and current address are required.",
      });
    }
    if (!creditConsent || !referenceConsent || !acceptedAt) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_REQUEST",
        detail: "Credit and reference consent are required.",
      });
    }
    if (currentLeaseStatus?.hasActiveLease && !currentLeaseStatus.leaseEndDate) {
      return res.status(400).json({
        ok: false,
        error: "validation_failed",
        detail: "Lease end date is required when an active lease is disclosed.",
        fields: ["currentLeaseStatus.leaseEndDate"],
      });
    }

    const missingProfile: string[] = [];
    if (!applicantProfile?.currentAddress?.line1) missingProfile.push("currentAddress.line1");
    if (!applicantProfile?.currentAddress?.city) missingProfile.push("currentAddress.city");
    if (!applicantProfile?.currentAddress?.provinceState) missingProfile.push("currentAddress.provinceState");
    if (!applicantProfile?.currentAddress?.postalCode) missingProfile.push("currentAddress.postalCode");
    if (
      applicantProfile?.timeAtCurrentAddressMonths == null ||
      !Number.isFinite(Number(applicantProfile?.timeAtCurrentAddressMonths))
    ) {
      missingProfile.push("timeAtCurrentAddressMonths");
    }
    if (
      applicantProfile?.currentRentAmountCents == null ||
      !Number.isFinite(Number(applicantProfile?.currentRentAmountCents))
    ) {
      missingProfile.push("currentRentAmountCents");
    }
    if (!applicantProfile?.employment?.employerName) missingProfile.push("employment.employerName");
    if (!applicantProfile?.employment?.jobTitle) missingProfile.push("employment.jobTitle");
    if (
      applicantProfile?.employment?.incomeAmountCents == null ||
      !Number.isFinite(Number(applicantProfile?.employment?.incomeAmountCents))
    ) {
      missingProfile.push("employment.incomeAmountCents");
    }
    if (!applicantProfile?.employment?.incomeFrequency) missingProfile.push("employment.incomeFrequency");
    if (
      applicantProfile?.employment?.monthsAtJob == null ||
      !Number.isFinite(Number(applicantProfile?.employment?.monthsAtJob))
    ) {
      missingProfile.push("employment.monthsAtJob");
    }
    if (!applicantProfile?.workReference?.name) missingProfile.push("workReference.name");
    if (!applicantProfile?.workReference?.phone) missingProfile.push("workReference.phone");
    const sig = applicantProfile?.signature;
    if (!sig) {
      missingProfile.push("signature");
    } else if (sig.type === "drawn") {
      if (!sig.drawnDataUrl) missingProfile.push("signature.drawnDataUrl");
    } else if (sig.type === "typed") {
      if (!sig.typedName) missingProfile.push("signature.typedName");
      if (!sig.typedAcknowledge) missingProfile.push("signature.typedAcknowledge");
    }
    if (!applicationConsent?.accepted || !applicationConsent?.acceptedAt) {
      missingProfile.push("applicationConsent");
    }
    if (missingProfile.length) {
      return res.status(400).json({
        ok: false,
        error: "validation_failed",
        detail: "Required profile fields are missing.",
        fields: missingProfile,
      });
    }

    const appRef = db.collection("rentalApplications").doc();
    const applicationId = appRef.id;
    const createdAt = now;
    const payload: any = {
      landlordId: link.landlordId || null,
      propertyId: link.propertyId || null,
      unitId: link.unitId || null,
      applicationLinkId: link.id,
      createdAt,
      submittedAt: createdAt,
      updatedAt: createdAt,
      status: "SUBMITTED",
      applicant: {
        firstName,
        middleInitial: applicant?.middleInitial ?? null,
        lastName,
        email,
        phoneHome: applicant?.phoneHome ?? null,
        phoneWork: applicant?.phoneWork ?? null,
        dob: dob,
        maritalStatus: applicant?.maritalStatus ?? null,
      },
      coApplicant: body?.coApplicant
        ? {
            firstName: body?.coApplicant?.firstName ?? null,
            middleInitial: body?.coApplicant?.middleInitial ?? null,
            lastName: body?.coApplicant?.lastName ?? null,
            email: body?.coApplicant?.email ?? null,
            phoneHome: body?.coApplicant?.phoneHome ?? null,
            phoneWork: body?.coApplicant?.phoneWork ?? null,
            dob: body?.coApplicant?.dob ?? null,
            maritalStatus: body?.coApplicant?.maritalStatus ?? null,
          }
        : null,
      otherResidents: Array.isArray(body?.otherResidents) ? body.otherResidents : [],
      currentLeaseStatus,
      residentialHistory,
      employment: body?.employment ?? { applicant: {}, coApplicant: null },
      references: body?.references ?? null,
      loans: Array.isArray(body?.loans) ? body.loans : [],
      vehicles: Array.isArray(body?.vehicles) ? body.vehicles : [],
      nextOfKin: body?.nextOfKin ?? null,
      coNextOfKin: body?.coNextOfKin ?? null,
      consent: {
        creditConsent: creditConsent,
        referenceConsent: referenceConsent,
        dataSharingConsent: consent?.dataSharingConsent === true,
        acceptedAt,
        applicantNameTyped: consent?.applicantNameTyped ?? null,
        coApplicantNameTyped: consent?.coApplicantNameTyped ?? null,
        ip: req.ip || null,
        userAgent: req.get("user-agent") || null,
      },
      applicantProfile: applicantProfile,
      applicationConsent: applicationConsent,
      formVersion: body?.formVersion || "v2",
      screening: {
        requested: false,
        requestedAt: null,
        status: "NOT_REQUESTED",
        provider: "STUB",
        orderId: null,
        result: null,
        amountCents: null,
        currency: "CAD",
        paidAt: null,
        scoreAddOn: false,
        scoreAddOnCents: null,
        totalAmountCents: null,
        serviceLevel: "SELF_SERVE",
        aiVerification: false,
        ai: null,
      },
      identityMatchBasis: "DOB_ADDRESS",
    };

    await appRef.set(payload, { merge: true });
    await db.collection("applicationLinks").doc(link.id).set(
      {
        partialProgress: buildPartialProgressPatch(link.partialProgress, {
          status: "submitted",
          completionPercent: 100,
          currentStep: null,
          completedSections: [...PARTIAL_PROGRESS_SECTIONS],
          missingSections: [],
          hasCoApplicant: Boolean(body?.coApplicant),
          viewingChoice:
            body?.viewingChoice === "already_viewed" || body?.viewingChoice === "request_viewing"
              ? body.viewingChoice
              : normalizeStoredPartialProgress(link.partialProgress).viewingChoice,
        }, createdAt),
      },
      { merge: true }
    );

    return res.json({ ok: true, data: { applicationId } });
  } catch (err: any) {
    console.error("[public applications] create failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "Failed to submit application" });
  }
});

function safeParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default router;
