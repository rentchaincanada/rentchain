import { Router } from "express";
import { createHash } from "crypto";
import { db } from "../config/firebase";
import { authenticateJwt } from "../middleware/authMiddleware";
import { attachAccount } from "../middleware/attachAccount";
import { requireFeature } from "../middleware/entitlements";

const router = Router();

const ALLOWED_STATUS = [
  "DRAFT",
  "SUBMITTED",
  "IN_REVIEW",
  "APPROVED",
  "DECLINED",
  "CONDITIONAL_COSIGNER",
  "CONDITIONAL_DEPOSIT",
];

const ELIGIBLE_STATUS = ["SUBMITTED", "IN_REVIEW"];
const SERVICE_LEVELS = ["SELF_SERVE", "VERIFIED", "VERIFIED_AI"] as const;

const BASE_AMOUNT_CENTS = 1999;
const VERIFIED_ADD_ON_CENTS = 1000;
const AI_ADD_ON_CENTS = 1000;
const SCORE_ADD_ON_CENTS = 110;

function applicantName(app: any): string {
  const first = String(app?.firstName || "").trim();
  const last = String(app?.lastName || "").trim();
  return `${first} ${last}`.trim() || "Applicant";
}

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

function evaluateEligibility(application: any) {
  const status = String(application?.status || "").toUpperCase();
  if (!ELIGIBLE_STATUS.includes(status)) {
    return { eligible: false, detail: "Application must be submitted before screening." };
  }
  const consent = application?.consent || {};
  if (!consent?.creditConsent || !consent?.referenceConsent) {
    return { eligible: false, detail: "Consent for credit and references is required." };
  }
  const dob = String(application?.applicant?.dob || "").trim();
  const currentAddress = String(application?.residentialHistory?.[0]?.address || "").trim();
  if (!dob || !currentAddress) {
    return { eligible: false, detail: "DOB and current address are required." };
  }
  return { eligible: true, detail: null };
}

function resolveServiceLevel(raw?: string | null) {
  const val = String(raw || "").toUpperCase();
  if (SERVICE_LEVELS.includes(val as any)) return val as (typeof SERVICE_LEVELS)[number];
  return "SELF_SERVE";
}

function computePricing(serviceLevel: string, scoreAddOn: boolean) {
  const isVerified = serviceLevel === "VERIFIED" || serviceLevel === "VERIFIED_AI";
  const isAi = serviceLevel === "VERIFIED_AI";
  const verifiedAddOn = isVerified ? VERIFIED_ADD_ON_CENTS : 0;
  const aiAddOn = isAi ? AI_ADD_ON_CENTS : 0;
  const scoreAddOnCents = scoreAddOn ? SCORE_ADD_ON_CENTS : 0;
  const totalAmountCents = BASE_AMOUNT_CENTS + verifiedAddOn + aiAddOn + scoreAddOnCents;
  return {
    baseAmountCents: BASE_AMOUNT_CENTS,
    verifiedAddOnCents: verifiedAddOn,
    aiAddOnCents: aiAddOn,
    scoreAddOnCents,
    totalAmountCents,
  };
}

router.use(authenticateJwt);

router.get("/rental-applications", async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const propertyId = String(req.query?.propertyId || "").trim();
    const status = String(req.query?.status || "").trim().toUpperCase();

    let query: FirebaseFirestore.Query = db
      .collection("rentalApplications")
      .where("landlordId", "==", landlordId);

    if (propertyId) {
      query = query.where("propertyId", "==", propertyId);
    }
    if (status) {
      query = query.where("status", "==", status);
    }

    let snap: FirebaseFirestore.QuerySnapshot;
    try {
      snap = await query.limit(200).get();
    } catch (err) {
      snap = await db
        .collection("rentalApplications")
        .where("landlordId", "==", landlordId)
        .limit(200)
        .get();
    }

    const items = snap.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        applicantName: applicantName(data?.applicant),
        email: data?.applicant?.email || null,
        propertyId: data?.propertyId || null,
        unitId: data?.unitId || null,
        status: data?.status || "SUBMITTED",
        submittedAt: data?.submittedAt || null,
      };
    });

    items.sort((a, b) => Number(b.submittedAt || 0) - Number(a.submittedAt || 0));
    return res.json({ ok: true, data: items });
  } catch (err: any) {
    console.error("[rental-applications] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "RENTAL_APPLICATIONS_LIST_FAILED" });
  }
});

router.get("/rental-applications/:id", async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const snap = await db.collection("rentalApplications").doc(id).get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    const data = snap.data() as any;
    if (data?.landlordId && data.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    return res.json({ ok: true, data: { id: snap.id, ...(data as any) } });
  } catch (err: any) {
    console.error("[rental-applications] read failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "RENTAL_APPLICATION_READ_FAILED" });
  }
});

router.patch("/rental-applications/:id", async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const snap = await db.collection("rentalApplications").doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const data = snap.data() as any;
    if (data?.landlordId && data.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const updates: any = { updatedAt: Date.now() };
    if (req.body?.status) {
      const nextStatus = String(req.body.status || "").toUpperCase();
      if (ALLOWED_STATUS.includes(nextStatus)) {
        updates.status = nextStatus;
      }
    }
    if (req.body?.note !== undefined) {
      const note = req.body.note;
      updates.landlordNote = note === null ? null : String(note || "").trim().slice(0, 5000);
    }

    await db.collection("rentalApplications").doc(id).set(updates, { merge: true });
    const refreshed = await db.collection("rentalApplications").doc(id).get();
    return res.json({ ok: true, data: { id: refreshed.id, ...(refreshed.data() as any) } });
  } catch (err: any) {
    console.error("[rental-applications] update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "RENTAL_APPLICATION_UPDATE_FAILED" });
  }
});

router.post(
  "/rental-applications/:id/screening/quote",
  attachAccount,
  requireFeature("screening"),
  async (req: any, res) => {
    try {
      const role = String(req.user?.role || "").toLowerCase();
      if (role !== "landlord" && role !== "admin") {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
      const landlordId = req.user?.landlordId || req.user?.id || null;
      if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

      const id = String(req.params?.id || "").trim();
      if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const snap = await db.collection("rentalApplications").doc(id).get();
      if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const data = snap.data() as any;
      if (data?.landlordId && data.landlordId !== landlordId) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      const eligibility = evaluateEligibility(data);
      if (!eligibility.eligible) {
        return res.json({ ok: false, error: "NOT_ELIGIBLE", detail: eligibility.detail });
      }

      const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
      const serviceLevel = resolveServiceLevel(body?.serviceLevel);
      const scoreAddOn = body?.scoreAddOn === true;
      const pricing = computePricing(serviceLevel, scoreAddOn);

      return res.json({
        ok: true,
        data: {
          baseAmountCents: pricing.baseAmountCents,
          verifiedAddOnCents: pricing.verifiedAddOnCents,
          aiAddOnCents: pricing.aiAddOnCents,
          scoreAddOnCents: pricing.scoreAddOnCents,
          totalAmountCents: pricing.totalAmountCents,
          currency: "CAD",
          eligible: true,
        },
      });
    } catch (err: any) {
      console.error("[rental-applications] screening quote failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "SCREENING_QUOTE_FAILED" });
    }
  }
);

router.post(
  "/rental-applications/:id/screening/run",
  attachAccount,
  requireFeature("screening"),
  async (req: any, res) => {
    try {
      const role = String(req.user?.role || "").toLowerCase();
      if (role !== "landlord" && role !== "admin") {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
      const landlordId = req.user?.landlordId || req.user?.id || null;
      if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

      const id = String(req.params?.id || "").trim();
      if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const snap = await db.collection("rentalApplications").doc(id).get();
      if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const data = snap.data() as any;
      if (data?.landlordId && data.landlordId !== landlordId) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      const eligibility = evaluateEligibility(data);
      if (!eligibility.eligible) {
        return res.status(400).json({ ok: false, error: "NOT_ELIGIBLE", detail: eligibility.detail });
      }

      const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
      const serviceLevel = resolveServiceLevel(body?.serviceLevel);
      const scoreAddOn = body?.scoreAddOn === true;
      const pricing = computePricing(serviceLevel, scoreAddOn);
      const now = Date.now();
      const orderRef = db.collection("screeningOrders").doc();
      const orderId = orderRef.id;
      const aiVerification = serviceLevel === "VERIFIED_AI";
      const orderPayload: any = {
        id: orderId,
        landlordId,
        applicationId: id,
        propertyId: data?.propertyId || null,
        unitId: data?.unitId || null,
        createdAt: now,
        amountCents: pricing.baseAmountCents,
        currency: "CAD",
        status: "CREATED",
        scoreAddOn,
        scoreAddOnCents: pricing.scoreAddOnCents,
        provider: "STUB",
        providerRequestId: null,
        paidAt: null,
        error: null,
        serviceLevel,
        aiVerification,
        aiPriceCents: aiVerification ? pricing.aiAddOnCents : 0,
        totalAmountCents: pricing.totalAmountCents,
        reviewerStatus: "QUEUED",
      };

      await orderRef.set(orderPayload, { merge: true });
      await orderRef.set({ status: "PAID", paidAt: now }, { merge: true });

      const seed = seededNumber(id);
      const result = buildStubResult(data, scoreAddOn, seed);
      const ai = aiVerification ? buildAiVerification(id, seed) : null;
      const screeningUpdate = {
        requested: true,
        requestedAt: now,
        status: "COMPLETE",
        provider: "STUB",
        orderId,
        amountCents: pricing.baseAmountCents,
        currency: orderPayload.currency,
        paidAt: now,
        scoreAddOn,
        scoreAddOnCents: pricing.scoreAddOnCents,
        totalAmountCents: pricing.totalAmountCents,
        serviceLevel,
        aiVerification,
        ai,
        result,
      };

      await db.collection("rentalApplications").doc(id).set(
        {
          screening: screeningUpdate,
          updatedAt: now,
        },
        { merge: true }
      );

      return res.json({
        ok: true,
        data: {
          orderId,
          status: "COMPLETE",
          result,
          amountCents: pricing.baseAmountCents,
          currency: orderPayload.currency,
          paidAt: now,
          scoreAddOn,
          scoreAddOnCents: pricing.scoreAddOnCents,
          totalAmountCents: pricing.totalAmountCents,
          serviceLevel,
          aiVerification,
          ai,
        },
      });
    } catch (err: any) {
      console.error("[rental-applications] screening run failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "SCREENING_RUN_FAILED" });
    }
  }
);

router.get(
  "/rental-applications/:id/screening",
  attachAccount,
  requireFeature("screening"),
  async (req: any, res) => {
    try {
      const role = String(req.user?.role || "").toLowerCase();
      if (role !== "landlord" && role !== "admin") {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
      const landlordId = req.user?.landlordId || req.user?.id || null;
      if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
      const id = String(req.params?.id || "").trim();
      if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

      const snap = await db.collection("rentalApplications").doc(id).get();
      if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const data = snap.data() as any;
      if (data?.landlordId && data.landlordId !== landlordId) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      const screening =
        data?.screening || {
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
        };

      return res.json({ ok: true, data: screening });
    } catch (err: any) {
      console.error("[rental-applications] screening read failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "SCREENING_READ_FAILED" });
    }
  }
);

function safeParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default router;
