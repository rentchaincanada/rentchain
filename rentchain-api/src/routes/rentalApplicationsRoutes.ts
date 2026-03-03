import { Router } from "express";
import { createHash, randomBytes } from "crypto";
import { db } from "../config/firebase";
import { authenticateJwt } from "../middleware/authMiddleware";
import { attachAccount } from "../middleware/attachAccount";
import { getStripeClient, isStripeConfigured } from "../services/stripeService";
import { requireCapability } from "../services/capabilityGuard";
import { getScreeningPricing } from "../billing/screeningPricing";
import { finalizeStripePayment } from "../services/stripeFinalize";
import { applyScreeningResultsFromOrder } from "../services/stripeScreeningProcessor";
import { buildScreeningStatusPayload } from "../services/screening/screeningPayload";
import { writeScreeningEvent } from "../services/screening/screeningEvents";
import { buildScreeningPdf } from "../services/screening/reportPdf";
import { buildShareUrl, createReportExport } from "../services/screening/reportExportService";
import { getScreeningProviderHealth } from "../services/screening/providerHealth";
import { getBureauProvider } from "../services/screening/providers/bureauProvider";
import { compareQuoteResponses } from "../services/screening/cutoverCompare";
import { getPrimaryTimeoutMs, hashSeedKey, isAllowlistedSeed, parseAllowlist } from "../services/screening/cutoverConfig";
import { logCutoverEvent } from "../services/screening/cutoverTelemetry";
import { runPrimaryWithFallback } from "../services/screening/runPrimaryWithFallback";
import { buildTenantInviteUrl, createInviteToken } from "../services/screening/inviteTokens";
import { createSignedUrl, putPdfObject } from "../storage/pdfStore";
import { buildReviewSummary, buildReviewSummaryPdf } from "../lib/reviewSummary";
import { rateLimitScreeningIp, rateLimitScreeningUser } from "../middleware/rateLimit";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "../services/emailService";

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
const CONSENT_VERSION = "v1.0";

const ALLOWED_REDIRECT_ORIGINS = ["https://www.rentchain.ai", "https://rentchain.ai", "http://localhost:5173"];
const REVIEW_SUMMARY_TEMPLATE_PATH = "src/lib/reviewSummary.ts";
const REVIEW_SUMMARY_ASSET_FILENAMES: string[] = [];

function isAllowedRedirectOrigin(origin: string) {
  if (!origin) return false;
  if (process.env.NODE_ENV === "production" && origin.includes("localhost")) return false;
  if (ALLOWED_REDIRECT_ORIGINS.includes(origin)) return true;
  if (/^https:\/\/.+\.vercel\.app$/i.test(origin)) return true;
  return false;
}


function normalizeOrigin(raw?: string | string[] | null) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return null;
  }
}

function resolveFrontendOrigin(req: any) {
  const headerOrigin =
    normalizeOrigin(req.headers?.["x-frontend-origin"]) ||
    normalizeOrigin(req.headers?.origin) ||
    normalizeOrigin(req.headers?.referer);
  if (headerOrigin && isAllowedRedirectOrigin(headerOrigin)) {
    return headerOrigin;
  }
  const envOrigin = normalizeOrigin(process.env.FRONTEND_ORIGIN || process.env.PUBLIC_APP_URL || "");
  if (envOrigin && isAllowedRedirectOrigin(envOrigin)) {
    return envOrigin;
  }
  const fallback =
    process.env.NODE_ENV === "production"
      ? "https://www.rentchain.ai"
      : "http://localhost:5173";
  const base = String(process.env.FRONTEND_URL || fallback).trim();
  return normalizeOrigin(base) || null;
}

function buildRedirectUrl(params: {
  input?: string;
  fallbackPath: string;
  frontendOrigin: string | null;
  applicationId?: string | null;
  orderId?: string | null;
  returnTo?: string | null;
}) {
  const rawInput = String(params.input || "").trim();
  const target = rawInput || params.fallbackPath;
  if (!target) return null;

  let url: URL;
  if (/^https?:\/\//i.test(target)) {
    try {
      url = new URL(target);
    } catch {
      return null;
    }
    if (!isAllowedRedirectOrigin(url.origin)) {
      return null;
    }
  } else {
    if (!params.frontendOrigin) return null;
    const path = target.startsWith("/") ? target : `/${target}`;
    url = new URL(path, params.frontendOrigin);
  }

  if (params.applicationId) {
    url.searchParams.set("applicationId", params.applicationId);
  }
  if (params.orderId) {
    url.searchParams.set("orderId", params.orderId);
  }
  if (params.returnTo) {
    url.searchParams.set("returnTo", params.returnTo);
  }
  return url.toString();
}

function applicantName(app: any): string {
  const first = String(app?.firstName || "").trim();
  const last = String(app?.lastName || "").trim();
  return `${first} ${last}`.trim() || "Applicant";
}

function seededNumber(input: string) {
  const hash = createHash("sha256").update(input).digest("hex");
  return parseInt(hash.slice(0, 8), 16);
}

function buildReferenceId(orderId: string) {
  const safe = String(orderId || "").replace(/[^a-z0-9]/gi, "");
  const suffix = safe.slice(-8).toUpperCase() || "UNKNOWN";
  return `RC-${suffix}`;
}

function createCorrelationId(): string {
  return randomBytes(6).toString("hex");
}

type CanonicalScreeningOrderStatus = "unpaid" | "paid" | "processing" | "failed" | "refunded";
type CanonicalScreeningJobStatus =
  | "queued"
  | "running"
  | "provider_calling"
  | "completed"
  | "failed";

function normalizeOrderStatus(order: any): CanonicalScreeningOrderStatus {
  const rawStatus = String(order?.status || "").trim().toLowerCase();
  const paymentStatus = String(order?.paymentStatus || "").trim().toLowerCase();
  if (
    rawStatus === "paid" ||
    rawStatus === "complete" ||
    rawStatus === "completed" ||
    rawStatus === "report_ready" ||
    paymentStatus === "paid" ||
    order?.finalized === true
  ) {
    return "paid";
  }
  if (rawStatus === "refunded" || paymentStatus === "refunded") {
    return "refunded";
  }
  if (
    rawStatus === "processing" ||
    rawStatus === "kba_in_progress" ||
    rawStatus === "in_progress"
  ) {
    return "processing";
  }
  if (rawStatus === "failed" || rawStatus === "kba_failed" || paymentStatus === "failed") {
    return "failed";
  }
  return "unpaid";
}

function normalizeOrderView(orderId: string | null, order: any) {
  const status = normalizeOrderStatus(order);
  return {
    applicationId: order?.applicationId || null,
    orderId: orderId || null,
    status,
    paidAt: order?.paidAt || null,
    amountTotalCents: Number(order?.amountTotalCents || order?.totalAmountCents || 0) || 0,
    currency: String(order?.currency || "cad").toLowerCase(),
    stripePaymentIntentId: order?.stripePaymentIntentId || null,
    stripeCheckoutSessionId: order?.stripeCheckoutSessionId || order?.stripeSessionId || null,
    lastUpdatedAt: order?.updatedAt || order?.finalizedAt || order?.createdAt || null,
  };
}

async function getLatestOrderByApplicationId(applicationId: string) {
  const snap = await db
    .collection("screeningOrders")
    .where("applicationId", "==", applicationId)
    .limit(20)
    .get();
  if (snap.empty) return null;
  const docs = snap.docs.slice().sort((a, b) => {
    const aData = a.data() as any;
    const bData = b.data() as any;
    const aTs = Number(aData?.updatedAt || aData?.createdAt || 0);
    const bTs = Number(bData?.updatedAt || bData?.createdAt || 0);
    return bTs - aTs;
  });
  return docs[0] || null;
}

function normalizeJobStatus(raw: unknown): CanonicalScreeningJobStatus {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (value === "queued") return "queued";
  if (value === "running") return "running";
  if (value === "provider_calling") return "provider_calling";
  if (value === "completed" || value === "complete") return "completed";
  if (value === "failed") return "failed";
  const legacy = String(raw || "").trim().toUpperCase();
  if (legacy === "QUEUED") return "queued";
  if (legacy === "RUNNING") return "running";
  if (legacy === "COMPLETE") return "completed";
  if (legacy === "FAILED") return "failed";
  return "queued";
}

function normalizeJobView(orderId: string, job: any) {
  return {
    orderId,
    applicationId: job?.applicationId || null,
    landlordId: job?.landlordId || null,
    status: normalizeJobStatus(job?.status),
    provider: job?.provider || null,
    attempt: Number(job?.attempt || 1) || 1,
    queuedAt: Number(job?.queuedAt || 0) || null,
    startedAt: Number(job?.startedAt || 0) || null,
    providerCalledAt: Number(job?.providerCalledAt || 0) || null,
    completedAt: Number(job?.completedAt || 0) || null,
    failedAt: Number(job?.failedAt || 0) || null,
    lastError: job?.lastError || null,
    updatedAt: Number(job?.updatedAt || 0) || null,
  };
}

async function getLatestJobByApplicationId(applicationId: string) {
  const snap = await db
    .collection("screeningJobs")
    .where("applicationId", "==", applicationId)
    .limit(20)
    .get();
  if (snap.empty) return null;
  const docs = snap.docs.slice().sort((a, b) => {
    const aData = a.data() as any;
    const bData = b.data() as any;
    const aTs = Number(aData?.updatedAt || aData?.queuedAt || 0);
    const bTs = Number(bData?.updatedAt || bData?.queuedAt || 0);
    return bTs - aTs;
  });
  return docs[0] || null;
}

function resolveProviderLabel(value?: string | null) {
  const raw = String(value || "").toLowerCase();
  if (!raw) return "TransUnion";
  if (raw.includes("transunion") || raw.includes("tu")) return "TransUnion";
  return raw;
}

function resolveReceiptStatus(application: any, order: any) {
  const status = String(
    application?.screeningStatus ||
      order?.status ||
      order?.paymentStatus ||
      ""
  ).toLowerCase();
  if (["complete", "completed", "report_ready"].includes(status)) return "completed";
  if (["paid", "processing"].includes(status)) return "paid";
  if (status === "failed") return "failed";
  return "pending";
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
    return {
      eligible: false,
      detail: "Application must be submitted before screening.",
      reasonCode: "APPLICATION_STATUS_NOT_READY",
    };
  }
  const consent = application?.consent || {};
  if (!consent?.creditConsent || !consent?.referenceConsent) {
    return {
      eligible: false,
      detail: "Consent for credit and references is required.",
      reasonCode: "MISSING_CONSENT",
    };
  }
  const dob = String(application?.applicant?.dob || "").trim();
  const sin = String(
    application?.applicant?.sinLast4 ||
      application?.applicant?.sin ||
      application?.applicantProfile?.sinLast4 ||
      application?.applicantProfile?.sin ||
      ""
  ).trim();
  const currentAddress = String(application?.residentialHistory?.[0]?.address || "").trim();
  if ((!dob && !sin) || !currentAddress) {
    return {
      eligible: false,
      detail: "DOB (or SIN) and current address are required.",
      reasonCode: "MISSING_TENANT_PROFILE",
    };
  }
  return { eligible: true, detail: null, reasonCode: "ELIGIBLE" };
}

function isScreeningAlreadyPaid(application: any) {
  const status = String(application?.screeningStatus || "").toLowerCase();
  return status === "paid" || status === "processing" || status === "complete" || status === "completed";
}

async function loadAuthorizedApplication(req: any, applicationId: string) {
  const role = String(req.user?.role || "").toLowerCase();
  if (role !== "landlord" && role !== "admin") {
    return { ok: false as const, status: 403, error: "FORBIDDEN" };
  }
  const landlordId = req.user?.landlordId || req.user?.id || null;
  if (role !== "admin" && !landlordId) {
    return { ok: false as const, status: 401, error: "UNAUTHORIZED" };
  }
  if (!applicationId) {
    return { ok: false as const, status: 404, error: "NOT_FOUND" };
  }
  const snap = await db.collection("rentalApplications").doc(applicationId).get();
  if (!snap.exists) {
    return { ok: false as const, status: 404, error: "NOT_FOUND" };
  }
  const data = snap.data() as any;
  if (role !== "admin" && data?.landlordId && data.landlordId !== landlordId) {
    return { ok: false as const, status: 403, error: "FORBIDDEN" };
  }
  return { ok: true as const, data, role, landlordId };
}

function resolveConsentPayload(body: any, application?: any) {
  const payload = body && typeof body === "object" ? body : {};
  const nestedConsent = payload?.consent && typeof payload.consent === "object" ? payload.consent : {};
  const consent = Object.keys(nestedConsent).length ? nestedConsent : payload;
  const appConsent = application?.consent || {};
  const timestamp = String(consent?.timestamp || appConsent?.acceptedAt || "").trim();
  const version = String(consent?.version || appConsent?.version || CONSENT_VERSION).trim();
  const textHash = consent?.textHash
    ? String(consent.textHash).trim()
    : appConsent?.textHash
    ? String(appConsent.textHash).trim()
    : null;
  return {
    given: Boolean(
      consent?.given || (appConsent?.creditConsent === true && appConsent?.referenceConsent === true)
    ),
    timestamp,
    version,
    textHash,
  };
}

function validateConsent(consent: ReturnType<typeof resolveConsentPayload>) {
  if (!consent.given) return { ok: false, error: "consent_required" };
  if (!consent.timestamp) return { ok: false, error: "consent_missing_timestamp" };
  if (consent.version !== CONSENT_VERSION) return { ok: false, error: "consent_version_mismatch" };
  return { ok: true };
}

function resolveServiceLevel(raw?: string | null) {
  const val = String(raw || "").toUpperCase();
  if (SERVICE_LEVELS.includes(val as any)) return val as (typeof SERVICE_LEVELS)[number];
  return "SELF_SERVE";
}

function resolveScreeningTier(raw?: string | null): "basic" | "verify" | "verify_ai" {
  const val = String(raw || "").trim().toLowerCase();
  if (val === "verify" || val === "verified") return "verify";
  if (val === "verify_ai" || val === "verified_ai" || val === "verify+ai") return "verify_ai";
  return "basic";
}

function normalizeAddons(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function resolvePricingInput(body: any) {
  const screeningTier = resolveScreeningTier(body?.screeningTier);
  const addons = normalizeAddons(body?.addons);
  const serviceLevel = resolveServiceLevel(
    body?.serviceLevel ||
      (screeningTier === "basic"
        ? "SELF_SERVE"
        : screeningTier === "verify"
        ? "VERIFIED"
        : "VERIFIED_AI")
  );
  const scoreAddOn = addons.includes("credit_score") || body?.scoreAddOn === true;
  const expeditedAddOn = addons.includes("expedited");
  const pricing = getScreeningPricing({ screeningTier, addons, currency: "CAD" });
  return { screeningTier, addons, serviceLevel, scoreAddOn, expeditedAddOn, pricing };
}

function buildQuotePayload(pricing: any) {
  return {
    ok: true,
    data: {
      baseAmountCents: pricing.baseAmountCents,
      verifiedAddOnCents: pricing.verifiedAddOnCents,
      aiAddOnCents: pricing.aiAddOnCents,
      scoreAddOnCents: pricing.scoreAddOnCents,
      expeditedAddOnCents: pricing.expeditedAddOnCents || 0,
      totalAmountCents: pricing.totalAmountCents,
      currency: pricing.currency,
      eligible: true,
    },
  };
}

async function runAdapterPrimaryProbe(params: {
  name: "checkout" | "run";
  seedKey: string;
  timeoutMs: number;
}) {
  await runPrimaryWithFallback({
    name: params.name,
    seedKey: params.seedKey,
    timeoutMs: params.timeoutMs,
    conservativeReturnLegacy: true,
    runLegacy: async () => ({ ok: true }),
    // Adapter probe is bounded and side-effect free; primary result remains legacy in Phase 2.
    runAdapter: async () => {
      const provider = getBureauProvider();
      const preflight = await provider.preflight();
      if (!preflight.ok) {
        throw new Error(preflight.detail || "adapter_preflight_failed");
      }
      return { ok: true, provider: provider.name };
    },
  });
}

function sanitizeAddressLine(line: any): string {
  return String(line || "").trim();
}

function logCutoverBlocked(params: {
  name: "quote" | "checkout" | "run";
  seedKey: string;
  skippedReason: "NOT_ELIGIBLE" | "consent_required" | "provider_not_ready";
}) {
  logCutoverEvent({
    eventType: "bureau_cutover",
    name: params.name,
    seedHash: hashSeedKey(params.seedKey || ""),
    selectedRoute: "none",
    responseSource: "blocked",
    fallbackUsed: false,
    adapter: { ok: false },
    legacy: { ok: false },
    diff: { isMatch: true, fields: [] },
    meta: {
      env: process.env.NODE_ENV || "development",
      ts: new Date().toISOString(),
      revision: process.env.K_REVISION || process.env.GIT_SHA || undefined,
      skippedReason: params.skippedReason,
    },
  });
}

function shouldUseMockCheckoutOverride(params: {
  role: string;
  seedKey: string;
}) {
  const allowMock = process.env.ALLOW_MOCK_PROVIDER_CHECKOUT === "true";
  if (!allowMock) return false;
  if (params.role !== "admin") return false;
  return isAllowlistedSeed(params.seedKey, parseAllowlist());
}

function logMockProviderCheckout(params: { name: "checkout" | "run"; seedKey: string }) {
  logCutoverEvent({
    eventType: "bureau_cutover",
    name: params.name,
    seedHash: hashSeedKey(params.seedKey || ""),
    selectedRoute: "adapter",
    responseSource: "adapter",
    fallbackUsed: false,
    adapter: { ok: true, status: 200 },
    legacy: { ok: false },
    diff: { isMatch: true, fields: [] },
    meta: {
      env: process.env.NODE_ENV || "development",
      ts: new Date().toISOString(),
      revision: process.env.K_REVISION || process.env.GIT_SHA || undefined,
      providerMode: "mock",
    },
  });
}

async function createManualApplicationFromOrderBody(opts: {
  landlordId: string;
  propertyId: string;
  unitId?: string | null;
  body: any;
}) {
  const manual = opts.body?.manualApplicant || opts.body || {};
  const firstName = String(manual?.firstName || "").trim();
  const lastName = String(manual?.lastName || "").trim();
  const dob = String(manual?.dob || "").trim();
  const sinRaw = String(manual?.sin || "").replace(/\D/g, "");
  const sinLast4 = sinRaw ? sinRaw.slice(-4) : "";
  const email = String(manual?.email || opts.body?.tenantEmail || "").trim().toLowerCase();
  const phone = String(manual?.phone || "").trim();
  const currentAddress = {
    line1: sanitizeAddressLine(manual?.currentAddress?.line1),
    city: sanitizeAddressLine(manual?.currentAddress?.city),
    province: sanitizeAddressLine(manual?.currentAddress?.province || manual?.currentAddress?.provinceState),
    postalCode: sanitizeAddressLine(manual?.currentAddress?.postal || manual?.currentAddress?.postalCode),
  };
  const consent = Boolean(manual?.consentGiven || opts.body?.consent?.given);

  if (!firstName || !lastName) {
    return { ok: false as const, status: 400, error: "missing_name" };
  }
  if (!currentAddress.line1 || !currentAddress.city || !currentAddress.province || !currentAddress.postalCode) {
    return { ok: false as const, status: 400, error: "missing_address" };
  }
  if (!dob && !sinLast4) {
    return { ok: false as const, status: 400, error: "missing_identity" };
  }
  if (!consent) {
    return { ok: false as const, status: 400, error: "consent_required" };
  }

  const now = Date.now();
  const appRef = db.collection("rentalApplications").doc();
  const addressParts = [
    currentAddress.line1,
    currentAddress.city,
    currentAddress.province,
    currentAddress.postalCode,
  ].filter(Boolean);

  const record: any = {
    id: appRef.id,
    landlordId: opts.landlordId,
    propertyId: opts.propertyId,
    unitId: opts.unitId || null,
    status: "SUBMITTED",
    createdAt: now,
    updatedAt: now,
    submittedAt: now,
    applicationLinkId: null,
    source: "manual_screening",
    applicant: {
      firstName,
      lastName,
      email: email || null,
      phoneHome: phone || null,
      dob: dob || null,
      sinLast4: sinLast4 || null,
    },
    residentialHistory: [
      {
        address: addressParts.join(", "),
      },
    ],
    consent: {
      creditConsent: true,
      referenceConsent: true,
      dataSharingConsent: true,
      acceptedAt: now,
      applicantNameTyped: `${firstName} ${lastName}`.trim(),
    },
    screeningStatus: "unpaid",
  };

  await appRef.set(record, { merge: false });
  return { ok: true as const, applicationId: appRef.id, data: record };
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

// Internal QA endpoint only. In production this requires ALLOW_DEV_SEED_ENDPOINTS=true and admin role.
router.post("/rental-applications/:id/dev/seed-consent", attachAccount, async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const isAdmin = role === "admin";
    const isProd = process.env.NODE_ENV === "production";
    const allowDevSeed = process.env.ALLOW_DEV_SEED_ENDPOINTS === "true";
    if (isProd && (!allowDevSeed || !isAdmin)) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const consentVersion = String((body as any)?.consentVersion || CONSENT_VERSION).trim() || CONSENT_VERSION;

    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const snap = await db.collection("rentalApplications").doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const data = snap.data() as any;
    if (!isAdmin && data?.landlordId && data.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const now = Date.now();
    const updates: any = {
      consent: {
        creditConsent: true,
        referenceConsent: true,
        dataSharingConsent: true,
        acceptedAt: now,
        version: consentVersion,
        textHash: createHash("sha256")
          .update(`seed-consent:${id}:${now}`)
          .digest("hex"),
      },
      updatedAt: now,
    };

    await db.collection("rentalApplications").doc(id).set(updates, { merge: true });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[rental-applications] dev seed consent failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "DEV_SEED_CONSENT_FAILED" });
  }
});

// Internal QA endpoint only. In production this requires ALLOW_DEV_SEED_ENDPOINTS=true and admin role.
router.post("/rental-applications/dev/create-submitted", attachAccount, async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const isAdmin = role === "admin";
    const allowDev =
      process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_SEED_ENDPOINTS === "true";
    if (!isAdmin || !allowDev) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    const landlordId = String(req.user?.landlordId || "").trim();
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const now = Date.now();
    const applicationRef = db.collection("rentalApplications").doc();
    const rentalApplicationId = applicationRef.id;
    const seededApplication = {
      id: rentalApplicationId,
      landlordId,
      status: "SUBMITTED",
      screeningStatus: "unpaid",
      createdAt: now,
      updatedAt: now,
      submittedAt: now,
      applicant: {
        firstName: "Dev",
        lastName: "Seed",
        email: `dev-seed+${rentalApplicationId}@example.com`,
        dob: "1990-01-01",
        sinLast4: "1234",
      },
      residentialHistory: [{ address: "123 Dev Street" }],
      consent: {
        creditConsent: true,
        referenceConsent: true,
        dataSharingConsent: true,
        acceptedAt: now,
        version: CONSENT_VERSION,
      },
    };

    await applicationRef.set(seededApplication, { merge: false });
    return res.json({ ok: true, data: { rentalApplicationId, landlordId } });
  } catch (err: any) {
    console.error("[rental-applications] dev create submitted failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "DEV_CREATE_SUBMITTED_FAILED" });
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
      const seedKey = [id, data?.landlordId || landlordId].filter(Boolean).join(":");
      const eligibility = evaluateEligibility(data);
      await writeScreeningEvent({
        applicationId: id,
        landlordId: data?.landlordId || null,
        type: "eligibility_checked",
        at: Date.now(),
        meta: { reasonCode: eligibility.reasonCode, status: eligibility.eligible ? "eligible" : "ineligible" },
        actor: role === "admin" ? "admin" : "landlord",
      });
      if (!eligibility.eligible) {
        logCutoverBlocked({ name: "quote", seedKey, skippedReason: "NOT_ELIGIBLE" });
        return res.json({ ok: false, error: "NOT_ELIGIBLE", detail: eligibility.detail });
      }

      const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
      const consent = resolveConsentPayload(body, data);
      const consentCheck = validateConsent(consent);
      if (!consentCheck.ok) {
        logCutoverBlocked({ name: "quote", seedKey, skippedReason: "consent_required" });
        return res.status(400).json({
          ok: false,
          error: "consent_required",
          detail: consentCheck.error,
        });
      }
      const { pricing } = resolvePricingInput(body);
      const quoteResult = await runPrimaryWithFallback({
        name: "quote",
        seedKey,
        timeoutMs: getPrimaryTimeoutMs(),
        runLegacy: async () => buildQuotePayload(pricing),
        // Adapter pathway is intentionally conservative in Phase 2: keep legacy contract/result.
        runAdapter: async () => buildQuotePayload(pricing),
        compare: compareQuoteResponses,
      });

      return res.json(quoteResult);
    } catch (err: any) {
      console.error("[rental-applications] screening quote failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "SCREENING_QUOTE_FAILED" });
    }
  }
);

router.post(
  "/rental-applications/:id/screening/checkout",
  rateLimitScreeningIp,
  rateLimitScreeningUser,
  attachAccount,
  async (req: any, res) => {
    const logBase = { route: "screening_checkout", applicationId: String(req.params?.id || "") };
    try {
      res.setHeader("x-route-source", "rentalApplicationsRoutes:screeningCheckout");
      const role = String(req.user?.role || "").toLowerCase();
      if (role !== "landlord" && role !== "admin") {
        return res.status(401).json({ ok: false, error: "unauthorized" });
      }
      const landlordId = req.user?.landlordId || req.user?.id || null;
      if (!landlordId) return res.status(401).json({ ok: false, error: "unauthorized" });

      const id = String(req.params?.id || "").trim();
      if (!id) return res.status(404).json({ ok: false, error: "not_found" });
      const snap = await db.collection("rentalApplications").doc(id).get();
      if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
      const data = snap.data() as any;
      if (role !== "admin" && data?.landlordId && data.landlordId !== landlordId) {
        return res.status(401).json({ ok: false, error: "unauthorized" });
      }
      await runAdapterPrimaryProbe({
        name: "checkout",
        seedKey: [id, data?.landlordId || landlordId].filter(Boolean).join(":"),
        timeoutMs: getPrimaryTimeoutMs(),
      });

      if (isScreeningAlreadyPaid(data)) {
        await writeScreeningEvent({
          applicationId: id,
          landlordId: data?.landlordId || null,
          type: "checkout_blocked",
          at: Date.now(),
          meta: { status: "already_paid" },
          actor: role === "admin" ? "admin" : "landlord",
        });
        return res.status(400).json({ ok: false, error: "screening_already_paid" });
      }

      const eligibility = evaluateEligibility(data);
      const eligibilityCheckedAt = Date.now();
      await writeScreeningEvent({
        applicationId: id,
        landlordId: data?.landlordId || null,
        type: "eligibility_checked",
        at: eligibilityCheckedAt,
        meta: { reasonCode: eligibility.reasonCode, status: eligibility.eligible ? "eligible" : "ineligible" },
        actor: role === "admin" ? "admin" : "landlord",
      });
      await db.collection("rentalApplications").doc(id).set(
        {
          screeningLastEligibilityReasonCode: eligibility.reasonCode || null,
          screeningLastEligibilityCheckedAt: eligibilityCheckedAt,
          screeningStatus: eligibility.eligible ? "unpaid" : "ineligible",
        },
        { merge: true }
      );
      if (!eligibility.eligible) {
        return res.status(400).json({
          ok: false,
          error: "not_eligible",
          detail: eligibility.detail,
          reasonCode: eligibility.reasonCode,
        });
      }

      const providerHealth = await getScreeningProviderHealth();
      const allowMockOverride = shouldUseMockCheckoutOverride({ role, seedKey: id });
      if (
        process.env.NODE_ENV === "production" &&
        (!providerHealth.configured || !providerHealth.preflightOk) &&
        !allowMockOverride
      ) {
        logCutoverBlocked({ name: "checkout", seedKey: id, skippedReason: "provider_not_ready" });
        await writeScreeningEvent({
          applicationId: id,
          landlordId: data?.landlordId || null,
          type: "checkout_blocked",
          at: Date.now(),
          meta: { status: "provider_unavailable", reasonCode: providerHealth.preflightDetail || "not_ready" },
          actor: role === "admin" ? "admin" : "landlord",
        });
        return res.status(503).json({
          ok: false,
          error: "screening_unavailable",
          detail: "provider_not_ready",
        });
      }
      if (
        process.env.NODE_ENV === "production" &&
        (!providerHealth.configured || !providerHealth.preflightOk) &&
        allowMockOverride
      ) {
        logMockProviderCheckout({ name: "checkout", seedKey: id });
      }

      const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
      const consent = resolveConsentPayload(body, data);
      const consentCheck = validateConsent(consent);
      if (!consentCheck.ok) {
        return res.status(400).json({ ok: false, error: "consent_required", detail: consentCheck.error });
      }
      const { screeningTier, addons, serviceLevel, scoreAddOn, expeditedAddOn, pricing } =
        resolvePricingInput(body);
      const rawReturnTo = String(body?.returnTo || "/dashboard");
      const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/dashboard";
      const frontendOrigin = resolveFrontendOrigin(req);
      const successUrl = buildRedirectUrl({
        input: body?.successPath,
        fallbackPath: "/screening/success",
        frontendOrigin,
        applicationId: id,
        returnTo,
      });
      const cancelUrl = buildRedirectUrl({
        input: body?.cancelPath,
        fallbackPath: "/screening/cancel",
        frontendOrigin,
        applicationId: id,
        returnTo,
      });
      if (!successUrl || !cancelUrl) {
        console.warn("[screening_checkout] invalid redirect origin", logBase);
        return res.status(400).json({ ok: false, error: "invalid_redirect_origin" });
      }
      let stripe: any;
      try {
        stripe = getStripeClient();
      } catch (err: any) {
        if (err?.code === "stripe_not_configured" || err?.message === "stripe_not_configured") {
          return res.status(400).json({ ok: false, error: "stripe_not_configured" });
        }
        throw err;
      }

      const now = Date.now();
      const orderRef = db.collection("screeningOrders").doc();
      const orderId = orderRef.id;
      const aiVerification = serviceLevel === "VERIFIED_AI";
        const orderPayload: any = {
          id: orderId,
          referenceId: buildReferenceId(orderId),
          landlordId,
          applicationId: id,
          propertyId: data?.propertyId || null,
          unitId: data?.unitId || null,
          createdAt: now,
          amountCents: pricing.baseAmountCents,
          currency: "CAD",
          status: "unpaid",
          paymentStatus: "unpaid",
          finalized: false,
          finalizedAt: null,
          lastStripeEventId: null,
          amountTotalCents: pricing.totalAmountCents,
          screeningTier,
          addons,
          scoreAddOn,
          scoreAddOnCents: pricing.scoreAddOnCents,
          expeditedAddOn,
          expeditedAddOnCents: pricing.expeditedAddOnCents,
          provider: providerHealth.provider,
          inquiryType: "soft",
          providerRequestId: null,
          paidAt: null,
          error: null,
          serviceLevel,
          aiVerification,
          aiPriceCents: aiVerification ? pricing.aiAddOnCents : 0,
          totalAmountCents: pricing.totalAmountCents,
          reviewerStatus: "QUEUED",
          stripeSessionId: null,
          stripeCheckoutSessionId: null,
          stripePaymentIntentId: null,
          stripeChargeId: null,
        consentGiven: true,
        consentTimestamp: consent.timestamp,
        consentVersion: consent.version,
        consentTextHash: consent.textHash,
      };

      await orderRef.set(orderPayload, { merge: true });

      const currency = String(orderPayload.currency || "CAD").toLowerCase();
      const lineItems: any[] = [
        {
          price_data: {
            currency,
            product_data: { name: "Rental screening" },
            unit_amount: pricing.baseAmountCents,
          },
          quantity: 1,
        },
      ];
      if (pricing.verifiedAddOnCents) {
        lineItems.push({
          price_data: {
            currency,
            product_data: { name: "Verified screening add-on" },
            unit_amount: pricing.verifiedAddOnCents,
          },
          quantity: 1,
        });
      }
      if (pricing.aiAddOnCents) {
        lineItems.push({
          price_data: {
            currency,
            product_data: { name: "AI verification add-on" },
            unit_amount: pricing.aiAddOnCents,
          },
          quantity: 1,
        });
      }
      if (pricing.scoreAddOnCents) {
        lineItems.push({
          price_data: {
            currency,
            product_data: { name: "Credit score add-on" },
            unit_amount: pricing.scoreAddOnCents,
          },
          quantity: 1,
        });
      }
      if (pricing.expeditedAddOnCents) {
        lineItems.push({
          price_data: {
            currency,
            product_data: { name: "Expedited processing add-on" },
            unit_amount: pricing.expeditedAddOnCents,
          },
          quantity: 1,
        });
      }

      // Ensure Stripe-safe integers
      const safeInt = (n: unknown) => {
        const x = Number(n);
        if (!Number.isFinite(x)) return 0;
        return Math.round(x);
      };

      // (Optional) sanity clamp: avoid negative or zero charges accidentally
      const normalizeLineItems = (items: any[]) =>
        items.map((it) => ({
          ...it,
          price_data: {
            ...it.price_data,
            unit_amount: Math.max(0, safeInt(it.price_data?.unit_amount)),
            currency: String(it.price_data?.currency || currency).toLowerCase(),
          },
        }));

      const normalizedLineItems = normalizeLineItems(lineItems);

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: normalizedLineItems,

        // Use this to correlate in Stripe dashboard & API searches
        client_reference_id: orderId,

        success_url: successUrl,
        cancel_url: cancelUrl,

        // Keep lightweight order context here (shows up on the Session)
        metadata: {
          orderId,
          applicationId: id,
          landlordId,
          serviceLevel,
          scoreAddOn: String(scoreAddOn),
          screeningTier,
          addons: addons.join(","),
          totalAmountCents: String(pricing.totalAmountCents),
        },

        // Recommended: also stamp the PaymentIntent so webhook handling is simpler
        payment_intent_data: {
          metadata: {
            orderId,
            applicationId: id,
            landlordId,
            serviceLevel,
            scoreAddOn: String(scoreAddOn),
            screeningTier,
            addons: addons.join(","),
            totalAmountCents: String(pricing.totalAmountCents),
          },
        },
      });

      await orderRef.set(
        { stripeSessionId: session.id, stripeCheckoutSessionId: session.id, updatedAt: Date.now() },
        { merge: true }
      );

      await db.collection("rentalApplications").doc(id).set(
        {
          screening: {
            requested: true,
            requestedAt: now,
            status: "PENDING",
            provider: "STUB",
            orderId,
            amountCents: pricing.baseAmountCents,
            currency: "CAD",
            paidAt: null,
            screeningTier,
            addons,
            scoreAddOn,
            scoreAddOnCents: pricing.scoreAddOnCents,
            expeditedAddOn,
            expeditedAddOnCents: pricing.expeditedAddOnCents,
            totalAmountCents: pricing.totalAmountCents,
            serviceLevel,
            aiVerification,
            consentGiven: true,
            consentTimestamp: consent.timestamp,
            consentVersion: consent.version,
            consentTextHash: consent.textHash,
            ai: null,
            result: null,
          },
          updatedAt: now,
        },
        { merge: true }
      );

      console.log("[screening_checkout] create_session_ok", {
        ...logBase,
        event: "create_session_ok",
      });
      return res.json({ ok: true, checkoutUrl: session.url });
    } catch (err: any) {
      console.error("[screening_checkout] create_session_fail", {
        ...logBase,
        event: "create_session_fail",
        error: err?.message || "unknown",
      });
      return res.status(500).json({
        ok: false,
        error: "internal_error",
        detail: String(err?.message || ""),
      });
    }
  }
);

router.post(
  "/screening/orders",
  attachAccount,
  async (req: any, res) => {
    const logBase = { route: "screening_orders", applicationId: String(req.body?.applicationId || "") };
    try {
      res.setHeader("x-route-source", "rentalApplicationsRoutes:screeningOrders");
      const role = String(req.user?.role || "").toLowerCase();
      if (role !== "landlord" && role !== "admin") {
        return res.status(401).json({ ok: false, error: "unauthorized" });
      }
      const landlordId = req.user?.landlordId || req.user?.id || null;
      if (!landlordId) return res.status(401).json({ ok: false, error: "unauthorized" });

      const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
      const existingApplicationId = String(body?.applicationId || "").trim();
      let applicationId = existingApplicationId;
      const propertyIdInput = String(body?.propertyId || "").trim();
      const unitIdInput = String(body?.unitId || "").trim();
      let data: any = null;

      if (!applicationId && !propertyIdInput) {
        return res.status(400).json({ ok: false, error: "missing_property" });
      }

      if (applicationId) {
        const snap = await db.collection("rentalApplications").doc(applicationId).get();
        if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
        data = snap.data() as any;
        if (role !== "admin" && data?.landlordId && data.landlordId !== landlordId) {
          return res.status(401).json({ ok: false, error: "unauthorized" });
        }

        const eligibility = evaluateEligibility(data);
        if (!eligibility.eligible) {
          return res.status(400).json({
            ok: false,
            error: "not_eligible",
            detail: eligibility.detail,
            reasonCode: eligibility.reasonCode,
          });
        }
      } else {
        const manualApp = await createManualApplicationFromOrderBody({
          landlordId: String(landlordId),
          propertyId: propertyIdInput,
          unitId: unitIdInput || null,
          body,
        });
        if (!manualApp.ok) {
          if (manualApp.error === "consent_required") {
            return res.status(400).json({
              ok: false,
              error: "consent_required",
              detail: "consent_required",
            });
          }
          if (manualApp.error === "missing_name") {
            return res.status(400).json({ ok: false, error: "missing_name" });
          }
          if (manualApp.error === "missing_address") {
            return res.status(400).json({ ok: false, error: "missing_address" });
          }
          if (manualApp.error === "missing_identity") {
            return res.status(400).json({ ok: false, error: "missing_identity" });
          }
          return res.status(400).json({ ok: false, error: "invalid_manual_application" });
        }
        applicationId = manualApp.applicationId;
        data = manualApp.data;
      }

      const consent = resolveConsentPayload(body, data);
      if (existingApplicationId) {
        const consentCheck = validateConsent(consent);
        if (!consentCheck.ok) {
          return res.status(400).json({
            ok: false,
            error: "consent_required",
            detail: consentCheck.error,
          });
        }
      }

      const providerHealth = await getScreeningProviderHealth();
      const allowMockOverride = shouldUseMockCheckoutOverride({ role, seedKey: applicationId });
      if (
        process.env.NODE_ENV === "production" &&
        (!providerHealth.configured || !providerHealth.preflightOk) &&
        !allowMockOverride
      ) {
        logCutoverBlocked({ name: "checkout", seedKey: applicationId, skippedReason: "provider_not_ready" });
        await writeScreeningEvent({
          applicationId,
          landlordId: data?.landlordId || null,
          type: "checkout_blocked",
          at: Date.now(),
          meta: { status: "provider_unavailable", reasonCode: providerHealth.preflightDetail || "not_ready" },
          actor: role === "admin" ? "admin" : "landlord",
        });
        return res.status(503).json({
          ok: false,
          error: "screening_unavailable",
          detail: "provider_not_ready",
        });
      }
      if (
        process.env.NODE_ENV === "production" &&
        (!providerHealth.configured || !providerHealth.preflightOk) &&
        allowMockOverride
      ) {
        logMockProviderCheckout({ name: "checkout", seedKey: applicationId });
      }

      const { screeningTier, addons, serviceLevel, scoreAddOn, expeditedAddOn, pricing } =
        resolvePricingInput(body);

      let stripe: any;
      try {
        stripe = getStripeClient();
      } catch (err: any) {
        if (err?.code === "stripe_not_configured" || err?.message === "stripe_not_configured") {
          return res.status(400).json({ ok: false, error: "stripe_not_configured" });
        }
        throw err;
      }

      const now = Date.now();
      const orderRef = db.collection("screeningOrders").doc();
      const orderId = orderRef.id;
      const rawReturnTo = String(body?.returnTo || "/dashboard");
      const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/dashboard";
      const frontendOrigin = resolveFrontendOrigin(req);
      const successUrl = buildRedirectUrl({
        input: body?.successPath,
        fallbackPath: "/screening/success",
        frontendOrigin,
        applicationId: applicationId,
        orderId,
        returnTo,
      });
      const cancelUrl = buildRedirectUrl({
        input: body?.cancelPath,
        fallbackPath: "/screening/cancel",
        frontendOrigin,
        applicationId: applicationId,
        orderId,
        returnTo,
      });
      if (!successUrl || !cancelUrl) {
        console.warn("[screening_orders] invalid redirect origin", logBase);
        return res.status(400).json({ ok: false, error: "invalid_redirect_origin" });
      }
      const aiVerification = serviceLevel === "VERIFIED_AI";
      const { token, tokenHash } = createInviteToken();
      const tenantInviteUrl = buildTenantInviteUrl(token);

      const applicant = data?.applicant || {};
      const tenantName =
        String(body?.tenantName || "").trim() ||
        [applicant?.firstName, applicant?.lastName].filter(Boolean).join(" ").trim();
      const tenantEmail = String(body?.tenantEmail || applicant?.email || "").trim().toLowerCase();
      if (!tenantEmail && !applicationId) {
        return res.status(400).json({ ok: false, error: "missing_tenant_email" });
      }

      const orderPayload: any = {
        id: orderId,
        referenceId: buildReferenceId(orderId),
        landlordId,
        applicationId: applicationId || null,
        propertyId: data?.propertyId || propertyIdInput || null,
        unitId: data?.unitId || unitIdInput || null,
        createdAt: now,
        amountCents: pricing.baseAmountCents,
        currency: "CAD",
        status: "unpaid",
        paymentStatus: "unpaid",
        finalized: false,
        finalizedAt: null,
        lastStripeEventId: null,
        amountTotalCents: pricing.totalAmountCents,
        screeningTier,
        addons,
        scoreAddOn,
        scoreAddOnCents: pricing.scoreAddOnCents,
        expeditedAddOn,
        expeditedAddOnCents: pricing.expeditedAddOnCents,
        provider: providerHealth.provider,
        inquiryType: "soft",
        providerRequestId: null,
        paidAt: null,
        error: null,
        serviceLevel,
        aiVerification,
        aiPriceCents: aiVerification ? pricing.aiAddOnCents : 0,
        totalAmountCents: pricing.totalAmountCents,
        reviewerStatus: "QUEUED",
        stripeSessionId: null,
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: null,
        stripeChargeId: null,
        tenantInviteTokenHash: tokenHash,
        tenantInviteCreatedAt: now,
        tenantInviteSentAt: null,
        tenantName: tenantName || null,
        tenantEmail: tenantEmail || null,
        consentGiven: applicationId ? true : null,
        consentTimestamp: applicationId ? consent.timestamp : null,
        consentVersion: applicationId ? consent.version : null,
        consentTextHash: applicationId ? consent.textHash : null,
      };

      await orderRef.set(orderPayload, { merge: true });

      if (applicationId) {
        await db.collection("rentalApplications").doc(applicationId).set(
          {
            screening: {
              consentGiven: true,
              consentTimestamp: consent.timestamp,
              consentVersion: consent.version,
              consentTextHash: consent.textHash,
            },
            updatedAt: now,
          },
          { merge: true }
        );
      }

      const currency = String(orderPayload.currency || "CAD").toLowerCase();
      const lineItems: any[] = [
        {
          price_data: {
            currency,
            product_data: { name: "Rental screening" },
            unit_amount: pricing.baseAmountCents,
          },
          quantity: 1,
        },
      ];
      if (pricing.verifiedAddOnCents) {
        lineItems.push({
          price_data: {
            currency,
            product_data: { name: "Verified screening add-on" },
            unit_amount: pricing.verifiedAddOnCents,
          },
          quantity: 1,
        });
      }
      if (pricing.aiAddOnCents) {
        lineItems.push({
          price_data: {
            currency,
            product_data: { name: "AI verification add-on" },
            unit_amount: pricing.aiAddOnCents,
          },
          quantity: 1,
        });
      }
      if (pricing.scoreAddOnCents) {
        lineItems.push({
          price_data: {
            currency,
            product_data: { name: "Credit score add-on" },
            unit_amount: pricing.scoreAddOnCents,
          },
          quantity: 1,
        });
      }
      if (pricing.expeditedAddOnCents) {
        lineItems.push({
          price_data: {
            currency,
            product_data: { name: "Expedited processing add-on" },
            unit_amount: pricing.expeditedAddOnCents,
          },
          quantity: 1,
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: lineItems,
        client_reference_id: orderId,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          orderId,
          applicationId,
          landlordId,
          serviceLevel,
          scoreAddOn: String(scoreAddOn),
          screeningTier,
          addons: addons.join(","),
          totalAmountCents: String(pricing.totalAmountCents),
        },
        payment_intent_data: {
          metadata: {
            orderId,
            applicationId,
            landlordId,
            serviceLevel,
            scoreAddOn: String(scoreAddOn),
            screeningTier,
            addons: addons.join(","),
            totalAmountCents: String(pricing.totalAmountCents),
          },
        },
      });

      await orderRef.set(
        { stripeSessionId: session.id, stripeCheckoutSessionId: session.id, updatedAt: Date.now() },
        { merge: true }
      );

      if (tenantEmail) {
        const apiKey = String(process.env.SENDGRID_API_KEY || "").trim();
        const from =
          String(process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL || "")
            .trim();
        if (apiKey && from) {
          try {
            const subject = "RentChain: Complete your screening";
            const safeName = tenantName || "there";
            await sendEmail({
              to: tenantEmail,
              from,
              subject,
              text: buildEmailText({
                intro: `Hi ${safeName},\n\nYour landlord has requested a tenant screening.`,
                ctaText: "Start verification",
                ctaUrl: tenantInviteUrl,
              }),
              html: buildEmailHtml({
                title: "Complete your screening",
                intro: `Hi ${safeName}, your landlord has requested a tenant screening.`,
                ctaText: "Start verification",
                ctaUrl: tenantInviteUrl,
              }),
            });
            await orderRef.set({ tenantInviteSentAt: Date.now() }, { merge: true });
          } catch (err: any) {
            console.error("[screening_orders] invite email failed", {
              orderId,
              error: err?.message || err,
            });
          }
        }
      }

      return res.json({ ok: true, orderId, checkoutUrl: session.url, tenantInviteUrl });
    } catch (err: any) {
      console.error("[screening_orders] failed", {
        ...logBase,
        error: err?.message || "unknown",
      });
      return res.status(500).json({ ok: false, error: "internal_error" });
    }
  }
);

router.get(
  "/screening/orders/:id((?!status|reconcile)[^/]+)",
  attachAccount,
  async (req: any, res) => {
    res.setHeader("x-route-source", "rentalApplicationsRoutes:screeningOrderGet");
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId && role !== "admin") {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(404).json({ ok: false, error: "not_found" });
    const snap = await db.collection("screeningOrders").doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
    const data = snap.data() as any;
    if (role !== "admin" && data?.landlordId && data.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    return res.json({
      ok: true,
      data: {
        id: snap.id,
        landlordId: data?.landlordId || null,
        applicationId: data?.applicationId || null,
        propertyId: data?.propertyId || null,
        unitId: data?.unitId || null,
        status: data?.status || null,
        paymentStatus: data?.paymentStatus || null,
        paidAt: data?.paidAt || null,
        consentedAt: data?.consentedAt || data?.consent?.consentedAt || null,
        provider: data?.provider || null,
        providerRequestId: data?.providerRequestId || null,
        reportBucket: data?.reportBucket || null,
        reportObjectKey: data?.reportObjectKey || null,
        failureCode: data?.failureCode || null,
        failureDetail: data?.failureDetail || null,
        stripeIdentitySessionId: data?.stripeIdentitySessionId || null,
        updatedAt: data?.updatedAt || null,
      },
    });
  }
);

router.get(
  "/screening/jobs/status",
  attachAccount,
  async (req: any, res) => {
    res.setHeader("x-route-source", "rentalApplicationsRoutes:screeningJobStatus");
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId && role !== "admin") {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const orderId = String(req.query?.orderId || "").trim();
    const applicationId = String(req.query?.applicationId || "").trim();
    if (!orderId && !applicationId) {
      return res.status(400).json({ ok: false, error: "missing_order_or_application_id" });
    }

    let jobDoc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot | null = null;
    if (orderId) {
      const snap = await db.collection("screeningJobs").doc(orderId).get();
      if (snap.exists) jobDoc = snap;
    } else if (applicationId) {
      jobDoc = await getLatestJobByApplicationId(applicationId);
    }

    if (!jobDoc) {
      return res.status(404).json({ ok: false, error: "not_found" });
    }

    const job = jobDoc.data() as any;
    if (
      role !== "admin" &&
      (!job?.landlordId || String(job.landlordId).trim() !== String(landlordId || "").trim())
    ) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    return res.json({
      ok: true,
      data: normalizeJobView(jobDoc.id, job),
    });
  }
);

router.get(
  "/screening/orders/status",
  attachAccount,
  async (req: any, res) => {
    res.setHeader("x-route-source", "rentalApplicationsRoutes:screeningOrderStatus");
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId && role !== "admin") {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const orderId = String(req.query?.orderId || "").trim();
    const applicationId = String(req.query?.applicationId || "").trim();
    if (!orderId && !applicationId) {
      return res.status(400).json({ ok: false, error: "missing_order_or_application_id" });
    }

    let orderDoc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot | null = null;
    if (orderId) {
      const snap = await db.collection("screeningOrders").doc(orderId).get();
      if (snap.exists) orderDoc = snap;
    } else if (applicationId) {
      orderDoc = await getLatestOrderByApplicationId(applicationId);
    }

    if (!orderDoc) {
      if (applicationId) {
        const access = await loadAuthorizedApplication(req, applicationId);
        if (!access.ok) {
          return res.status(access.status).json({ ok: false, error: access.error });
        }
      }
      return res.json({
        ok: true,
        data: {
          applicationId: applicationId || null,
          orderId: null,
          status: "unpaid",
          paidAt: null,
          amountTotalCents: 0,
          currency: "cad",
          stripePaymentIntentId: null,
          stripeCheckoutSessionId: null,
          lastUpdatedAt: null,
        },
      });
    }

    const data = orderDoc.data() as any;
    if (role !== "admin" && data?.landlordId && data.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }
    return res.json({ ok: true, data: normalizeOrderView(orderDoc.id, data) });
  }
);

router.post(
  "/screening/orders/reconcile",
  attachAccount,
  async (req: any, res) => {
    res.setHeader("x-route-source", "rentalApplicationsRoutes:screeningOrderReconcile");
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId && role !== "admin") {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const orderId = String(body?.orderId || "").trim();
    const applicationId = String(body?.applicationId || "").trim();
    if (!orderId && !applicationId) {
      return res.status(400).json({ ok: false, error: "missing_order_or_application_id" });
    }

    let orderDoc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot | null = null;
    if (orderId) {
      const snap = await db.collection("screeningOrders").doc(orderId).get();
      if (snap.exists) orderDoc = snap;
    } else {
      orderDoc = await getLatestOrderByApplicationId(applicationId);
    }

    if (!orderDoc) {
      return res.json({
        ok: true,
        data: {
          applicationId: applicationId || null,
          orderId: null,
          status: "unpaid",
          paidAt: null,
          amountTotalCents: 0,
          currency: "cad",
          stripePaymentIntentId: null,
          stripeCheckoutSessionId: null,
          lastUpdatedAt: null,
        },
      });
    }

    const order = orderDoc.data() as any;
    if (role !== "admin" && order?.landlordId && order.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    const currentStatus = normalizeOrderStatus(order);
    if (currentStatus === "paid") {
      return res.json({ ok: true, data: normalizeOrderView(orderDoc.id, order) });
    }
    const now = Date.now();
    const lastReconcileAt = Number(order?.lastReconcileAt || 0);
    if (lastReconcileAt > 0 && now - lastReconcileAt < 20_000) {
      return res.json({ ok: true, data: normalizeOrderView(orderDoc.id, order) });
    }
    await db.collection("screeningOrders").doc(orderDoc.id).set({ lastReconcileAt: now }, { merge: true });

    let stripe: any;
    try {
      stripe = getStripeClient();
    } catch (err: any) {
      if (err?.code === "stripe_not_configured" || err?.message === "stripe_not_configured") {
        return res.status(400).json({ ok: false, error: "stripe_not_configured" });
      }
      throw err;
    }

    const stripeSessionId = String(order?.stripeCheckoutSessionId || order?.stripeSessionId || "").trim();
    const stripePaymentIntentId = String(order?.stripePaymentIntentId || "").trim();
    let paid = false;
    let resolvedPaymentIntentId = stripePaymentIntentId || null;
    let resolvedChargeId: string | null = null;
    let paidAt = order?.paidAt || now;
    try {
      if (stripeSessionId) {
        const session = await stripe.checkout.sessions.retrieve(stripeSessionId, {
          expand: ["payment_intent"],
        });
        const sessionPi =
          typeof session?.payment_intent === "string"
            ? session.payment_intent
            : session?.payment_intent?.id || null;
        resolvedPaymentIntentId = resolvedPaymentIntentId || sessionPi;
        const paymentIntent =
          typeof session?.payment_intent === "string" ? null : session?.payment_intent || null;
        const piSucceeded = String(paymentIntent?.status || "").toLowerCase() === "succeeded";
        paid = String(session?.payment_status || "").toLowerCase() === "paid" || piSucceeded;
        if (paid && paymentIntent && paymentIntent.latest_charge) {
          resolvedChargeId = String(paymentIntent.latest_charge);
        }
      } else if (stripePaymentIntentId) {
        const paymentIntent = await stripe.paymentIntents.retrieve(stripePaymentIntentId);
        paid = String(paymentIntent?.status || "").toLowerCase() === "succeeded";
        if (paid && paymentIntent?.latest_charge) {
          resolvedChargeId = String(paymentIntent.latest_charge);
        }
      }
    } catch (err: any) {
      console.warn("[screening/orders/reconcile] stripe lookup failed", {
        orderId: orderDoc.id,
        applicationId: order?.applicationId || applicationId || null,
        error: err?.message || String(err),
      });
    }

    if (paid) {
      const updates: any = {
        status: "paid",
        paymentStatus: "paid",
        paidAt,
        finalized: true,
        finalizedAt: order?.finalizedAt || now,
        updatedAt: now,
        stripeCheckoutSessionId: stripeSessionId || null,
        stripeSessionId: stripeSessionId || null,
        stripePaymentIntentId: resolvedPaymentIntentId || null,
      };
      if (resolvedChargeId) {
        updates.stripeChargeId = resolvedChargeId;
      }
      await db.collection("screeningOrders").doc(orderDoc.id).set(updates, { merge: true });
      if (order?.applicationId) {
        await db
          .collection("rentalApplications")
          .doc(String(order.applicationId))
          .set(
            {
              screeningStatus: "paid",
              screeningPaidAt: paidAt,
              screeningSessionId: stripeSessionId || null,
              screeningPaymentIntentId: resolvedPaymentIntentId || null,
              screeningLastUpdatedAt: now,
              screening: {
                status: "paid",
                paidAt,
                orderId: orderDoc.id,
              },
              updatedAt: now,
            },
            { merge: true }
          );
      }
    }

    const refreshed = await db.collection("screeningOrders").doc(orderDoc.id).get();
    const refreshedData = (refreshed.data() as any) || order;
    return res.json({ ok: true, data: normalizeOrderView(orderDoc.id, refreshedData) });
  }
);

router.get(
  "/screening/orders/:id((?!status|reconcile)[^/]+)/report",
  attachAccount,
  async (req: any, res) => {
    res.setHeader("x-route-source", "rentalApplicationsRoutes:screeningOrderReport");
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId && role !== "admin") {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(404).json({ ok: false, error: "not_found" });
    const snap = await db.collection("screeningOrders").doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "not_found" });
    const data = snap.data() as any;
    if (role !== "admin" && data?.landlordId && data.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "forbidden" });
    }

    if (!data?.reportBucket || !data?.reportObjectKey) {
      return res.status(409).json({ ok: false, error: "report_not_ready" });
    }

    const url = await createSignedUrl({
      bucket: data.reportBucket,
      objectKey: data.reportObjectKey,
      expiresSeconds: 10 * 60,
    });
    return res.json({ ok: true, url, expiresInSeconds: 10 * 60 });
  }
);

router.post(
  "/rental-applications/:id/screening/run",
  rateLimitScreeningIp,
  rateLimitScreeningUser,
  attachAccount,
  async (req: any, res) => {
    try {
      if (isStripeConfigured()) {
        return res.status(400).json({ ok: false, error: "USE_CHECKOUT" });
      }
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
      await runAdapterPrimaryProbe({
        name: "run",
        seedKey: [id, data?.landlordId || landlordId].filter(Boolean).join(":"),
        timeoutMs: getPrimaryTimeoutMs(),
      });

      const eligibility = evaluateEligibility(data);
      if (!eligibility.eligible) {
        return res.status(400).json({ ok: false, error: "NOT_ELIGIBLE", detail: eligibility.detail });
      }

      const providerHealth = await getScreeningProviderHealth();
      const allowMockOverride = shouldUseMockCheckoutOverride({ role, seedKey: id });
      if (
        process.env.NODE_ENV === "production" &&
        (!providerHealth.configured || !providerHealth.preflightOk) &&
        !allowMockOverride
      ) {
        logCutoverBlocked({ name: "run", seedKey: id, skippedReason: "provider_not_ready" });
        await writeScreeningEvent({
          applicationId: id,
          landlordId: data?.landlordId || null,
          type: "checkout_blocked",
          at: Date.now(),
          meta: { status: "provider_unavailable", reasonCode: providerHealth.preflightDetail || "not_ready" },
          actor: role === "admin" ? "admin" : "landlord",
        });
        return res.status(503).json({
          ok: false,
          error: "screening_unavailable",
          detail: "provider_not_ready",
        });
      }
      if (
        process.env.NODE_ENV === "production" &&
        (!providerHealth.configured || !providerHealth.preflightOk) &&
        allowMockOverride
      ) {
        logMockProviderCheckout({ name: "run", seedKey: id });
      }

      const body = typeof req.body === "string" ? safeParse(req.body) : req.body || {};
      const consent = resolveConsentPayload(body, data);
      const consentCheck = validateConsent(consent);
      if (!consentCheck.ok) {
        return res.status(400).json({ ok: false, error: "consent_required", detail: consentCheck.error });
      }
      const { screeningTier, addons, serviceLevel, scoreAddOn, expeditedAddOn, pricing } =
        resolvePricingInput(body);
      const now = Date.now();
      const orderRef = db.collection("screeningOrders").doc();
      const orderId = orderRef.id;
      const aiVerification = serviceLevel === "VERIFIED_AI";
        const orderPayload: any = {
          id: orderId,
          referenceId: buildReferenceId(orderId),
          landlordId,
          applicationId: id,
          propertyId: data?.propertyId || null,
          unitId: data?.unitId || null,
          createdAt: now,
          amountCents: pricing.baseAmountCents,
          currency: "CAD",
          status: "CREATED",
          screeningTier,
          addons,
          scoreAddOn,
          scoreAddOnCents: pricing.scoreAddOnCents,
          expeditedAddOn,
          expeditedAddOnCents: pricing.expeditedAddOnCents,
          provider: providerHealth.provider,
          inquiryType: "soft",
          providerRequestId: null,
          paidAt: null,
          error: null,
          serviceLevel,
        aiVerification,
        aiPriceCents: aiVerification ? pricing.aiAddOnCents : 0,
        totalAmountCents: pricing.totalAmountCents,
        reviewerStatus: "QUEUED",
        consentGiven: true,
        consentTimestamp: consent.timestamp,
        consentVersion: consent.version,
        consentTextHash: consent.textHash,
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
        screeningTier,
        addons,
        scoreAddOn,
        scoreAddOnCents: pricing.scoreAddOnCents,
        expeditedAddOn,
        expeditedAddOnCents: pricing.expeditedAddOnCents,
        totalAmountCents: pricing.totalAmountCents,
        serviceLevel,
        aiVerification,
        consentGiven: true,
        consentTimestamp: consent.timestamp,
        consentVersion: consent.version,
        consentTextHash: consent.textHash,
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

      if (serviceLevel === "VERIFIED" || serviceLevel === "VERIFIED_AI") {
        try {
          const applicantFirst = String(data?.applicant?.firstName || "").trim();
          const applicantLast = String(data?.applicant?.lastName || "").trim();
          const applicantName = `${applicantFirst} ${applicantLast}`.trim() || "Applicant";
          const applicantEmail = String(data?.applicant?.email || "").trim();
          const queueRef = db.collection("verifiedScreeningQueue").doc();
          const queueDoc = {
            id: queueRef.id,
            createdAt: now,
            updatedAt: now,
            status: "QUEUED",
            serviceLevel,
            landlordId,
            applicationId: id,
            orderId,
            propertyId: data?.propertyId || null,
            unitId: data?.unitId || null,
            applicant: { name: applicantName, email: applicantEmail || "" },
            aiIncluded: serviceLevel === "VERIFIED_AI",
            scoreAddOn,
            totalAmountCents: pricing.totalAmountCents,
            currency: orderPayload.currency,
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
                await sendEmail({
                  to: opsEmail,
                  from,
                  replyTo: replyTo || from,
                  subject: `Verified screening queued — ${applicantName}`,
                  text: buildEmailText({
                    intro: `A verified screening is queued.\nApplicant: ${applicantName} (${applicantEmail || "n/a"})\nService level: ${serviceLevel}\nApplication ID: ${id}\nOrder ID: ${orderId}\nProperty ID: ${data?.propertyId || "n/a"}${data?.unitId ? `\nUnit ID: ${data.unitId}` : ""}\nTotal paid: ${(pricing.totalAmountCents / 100).toFixed(2)} ${orderPayload.currency}`,
                    ctaText: "View queue",
                    ctaUrl: adminLink,
                    footerNote: "You received this because you are on verified screening notifications.",
                  }),
                  html: buildEmailHtml({
                    title: "Verified screening queued",
                    intro: `Applicant: ${applicantName} (${applicantEmail || "n/a"}). Service level: ${serviceLevel}. Application ID: ${id}. Order ID: ${orderId}.`,
                    ctaText: "View queue",
                    ctaUrl: adminLink,
                    footerNote: "You received this because you are on verified screening notifications.",
                  }),
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

          (res as any).locals = (res as any).locals || {};
          (res as any).locals.opsNotify = { notifiedOps, notifyError };
        } catch (queueErr: any) {
          console.error("[rental-applications] verified queue/create failed", queueErr?.message || queueErr);
        }
      }

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
          notifiedOps: (res as any).locals?.opsNotify?.notifiedOps ?? false,
          notifyError: (res as any).locals?.opsNotify?.notifyError ?? null,
        },
      });
    } catch (err: any) {
      console.error("[rental-applications] screening run failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "SCREENING_RUN_FAILED" });
    }
  }
);

router.post(
  "/screening/stripe/confirm",
  attachAccount,
  async (req: any, res) => {
    try {
      const role = String(req.user?.role || "").toLowerCase();
      if (role !== "landlord" && role !== "admin") {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
      const sessionId = String(req.body?.sessionId || "").trim();
      if (!sessionId) {
        return res.status(400).json({ ok: false, error: "missing_session_id" });
      }

      let stripe: any;
      try {
        stripe = getStripeClient();
      } catch (err: any) {
        if (err?.code === "stripe_not_configured" || err?.message === "stripe_not_configured") {
          return res.status(400).json({ ok: false, error: "stripe_not_configured" });
        }
        throw err;
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });
      if (!session || session.payment_status !== "paid") {
        return res.status(409).json({
          ok: false,
          error: "not_paid",
          payment_status: session?.payment_status || null,
          status: session?.status || null,
        });
      }

      const paymentIntent =
        typeof session.payment_intent === "string"
          ? null
          : (session.payment_intent as any);
      const paymentIntentId =
        typeof session.payment_intent === "string" ? session.payment_intent : paymentIntent?.id;

      const orderId =
        (session.client_reference_id as string | null) ||
        (session.metadata?.orderId as string | undefined);
      const applicationId = session.metadata?.applicationId;
      const landlordId = session.metadata?.landlordId;

      const finalize = await finalizeStripePayment({
        eventId: `manual_confirm_${session.id}_${paymentIntentId || "na"}`,
        eventType: "manual.confirm",
        orderId: orderId || undefined,
        sessionId: session.id,
        paymentIntentId,
        amountTotalCents: typeof session.amount_total === "number" ? session.amount_total : undefined,
        currency: session.currency || undefined,
        landlordId: landlordId || undefined,
        applicationId: applicationId || undefined,
      });

      if (!finalize.ok) {
        return res.status(404).json({ ok: false, error: finalize.error || "finalize_failed" });
      }

      const resolvedOrderId = finalize.orderIdResolved || orderId;
      if (!finalize.alreadyFinalized && resolvedOrderId && applicationId) {
        await applyScreeningResultsFromOrder({
          orderId: resolvedOrderId,
          applicationId: String(applicationId),
        });
      }

      return res.json({
        ok: true,
        orderId: resolvedOrderId || null,
        applicationId: applicationId || null,
        alreadyProcessed: finalize.alreadyProcessed,
        alreadyFinalized: finalize.alreadyFinalized,
      });
    } catch (err: any) {
      console.error("[screening/stripe/confirm] failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "STRIPE_CONFIRM_FAILED" });
    }
  }
);

router.get(
  "/rental-applications/:id/screening",
  attachAccount,
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

      const screening = buildScreeningStatusPayload(data);
      return res.json({ ok: true, screening });
    } catch (err: any) {
      console.error("[rental-applications] screening read failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "SCREENING_READ_FAILED" });
    }
  }
);

router.get(
  "/rental-applications/:id/screening/result",
  attachAccount,
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

      const resultId = String(data?.screeningResultId || "");
      if (!resultId) return res.status(404).json({ ok: false, error: "no_result" });

      const resultSnap = await db.collection("screeningResults").doc(resultId).get();
      if (!resultSnap.exists) return res.status(404).json({ ok: false, error: "no_result" });
      const result = resultSnap.data() as any;

      return res.json({
        ok: true,
        result: {
          summary: result?.summary || null,
          reportUrl: result?.reportUrl || null,
          reportText: result?.reportText || null,
        },
      });
    } catch (err: any) {
      console.error("[rental-applications] screening result read failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "SCREENING_RESULT_READ_FAILED" });
    }
  }
);

router.get(
  "/rental-applications/:id/screening/receipt",
  attachAccount,
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
      if (role !== "admin" && data?.landlordId && data.landlordId !== landlordId) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      const orderId = String(data?.screening?.orderId || "").trim();
      let order: any = null;
      if (orderId) {
        const orderSnap = await db.collection("screeningOrders").doc(orderId).get();
        order = orderSnap.exists ? (orderSnap.data() as any) : null;
      }

      const providerValue = order?.provider || data?.screeningProvider || data?.screening?.provider || null;
      const providerLabel = resolveProviderLabel(providerValue);
      const referenceId = order?.referenceId || (orderId ? buildReferenceId(orderId) : null);
      const consentVersion = order?.consentVersion || data?.screening?.consentVersion || CONSENT_VERSION;
      const consentTimestamp =
        order?.consentTimestamp ||
        data?.screening?.consentTimestamp ||
        data?.consent?.acceptedAt ||
        null;
      const generatedAt =
        order?.reportGeneratedAt ||
        data?.screeningCompletedAt ||
        order?.completedAt ||
        null;

      let reportUrl: string | null = null;
      if (order?.reportBucket && order?.reportObjectKey) {
        try {
          reportUrl = await createSignedUrl({
            bucket: order.reportBucket,
            objectKey: order.reportObjectKey,
            expiresSeconds: 10 * 60,
          });
        } catch {
          reportUrl = null;
        }
      }

      return res.json({
        ok: true,
        receipt: {
          status: resolveReceiptStatus(data, order),
          provider: providerLabel,
          inquiryType: "Soft inquiry (no score impact)",
          referenceId,
          consentVersion,
          consentTimestamp,
          generatedAt,
          reportUrl,
          pdfUrl: reportUrl,
        },
      });
    } catch (err: any) {
      console.error("[screening_receipt] failed", err?.message || err);
      return res.status(500).json({ ok: false, error: "internal_error" });
    }
  }
);

router.get("/rental-applications/:id/review-summary", async (req: any, res) => {
  try {
    res.setHeader("x-route-source", "rentalApplicationsRoutes.ts");
    const id = String(req.params?.id || "").trim();
    const access = await loadAuthorizedApplication(req, id);
    if (!access.ok) {
      return res.status(access.status).json({
        ok: false,
        status: access.status,
        error: access.error,
      });
    }
    const summary = buildReviewSummary(id, access.data);
    return res.json({ ok: true, summary });
  } catch (err: any) {
    console.error("[review_summary] failed", err?.message || err);
    return res.status(500).json({
      ok: false,
      status: 500,
      error: "REVIEW_SUMMARY_FAILED",
    });
  }
});

router.get("/rental-applications/:id/review-summary.pdf", async (req: any, res) => {
  const id = String(req.params?.id || "").trim();
  const correlationId = createCorrelationId();
  const resolvedTemplatePath = `${process.cwd().replace(/\\/g, "/")}/${REVIEW_SUMMARY_TEMPLATE_PATH}`;
  try {
    res.setHeader("x-route-source", "rentalApplicationsRoutes.ts");
    const access = await loadAuthorizedApplication(req, id);
    if (!access.ok) {
      return res.status(access.status).json({
        ok: false,
        status: access.status,
        error: access.error,
      });
    }
    const summary = buildReviewSummary(id, access.data);
    const pdfBuffer = await buildReviewSummaryPdf(summary);
    const bucket = String(process.env.GCS_UPLOAD_BUCKET || "").trim();

    if (!bucket) {
      console.warn("[review_summary_pdf] GCS_UPLOAD_BUCKET missing; returning inline PDF", {
        correlationId,
        rentalApplicationId: id || null,
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'inline; filename="review-summary.pdf"');
      return res.status(200).send(pdfBuffer);
    }

    const timestamp = Date.now();
    const objectKey = `review-summaries/${id}/application-review-summary-${timestamp}.pdf`;
    const uploaded = await putPdfObject({
      objectKey,
      pdfBuffer,
    });
    const url = await createSignedUrl({
      bucket: uploaded.bucket,
      objectKey: uploaded.path,
      expiresSeconds: 10 * 60,
    });

    return res.status(200).json({ ok: true, url });
  } catch (err: any) {
    console.error("[review_summary_pdf] failed", {
      correlationId,
      rentalApplicationId: id || null,
      templatePath: resolvedTemplatePath,
      assetFilenames: REVIEW_SUMMARY_ASSET_FILENAMES,
      errorMessage: String(err?.message || "unknown_error"),
      errorStack: String(err?.stack || ""),
    });
    return res.status(500).json({
      ok: false,
      status: 500,
      error: "REVIEW_SUMMARY_PDF_FAILED",
      correlationId,
    });
  }
});

router.get("/rental-applications/:id/screening/events", attachAccount, async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const landlordId = req.user?.landlordId || req.user?.id || null;
    const id = String(req.params?.id || "").trim();

    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    if (role !== "admin" && !landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const snap = await db.collection("rentalApplications").doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const data = snap.data() as any;
    if (role !== "admin" && data?.landlordId && data.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const rawLimit = Number(req.query?.limit);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50;

    let eventsDocs: Array<{ id: string;[k: string]: any }> = [];

    try {
      const eventsSnap = await db
        .collection("screeningEvents")
        .where("applicationId", "==", id)
        .orderBy("at", "desc")
        .limit(limit)
        .get();
      eventsDocs = eventsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
    } catch (err: any) {
      console.warn("[screening_events_read] orderBy failed, falling back to unordered query", {
        applicationId: id,
        error: String(err?.message || err),
      });
      const eventsSnap = await db
        .collection("screeningEvents")
        .where("applicationId", "==", id)
        .limit(limit)
        .get();
      eventsDocs = eventsSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
    }

    const events = eventsDocs
      .sort((a, b) => Number(b.at ?? b.createdAt ?? 0) - Number(a.at ?? a.createdAt ?? 0))
      .map((e) => ({
        id: e.id,
        type: e.type,
        at: e.at ?? e.createdAt ?? 0,
        actor: e.actor,
        meta: e.meta || {},
      }));

    return res.json({ ok: true, events });
  } catch (err: any) {
    const role = String(req.user?.role || "").toLowerCase();
    const landlordId = req.user?.landlordId || req.user?.id || null;
    const id = String(req.params?.id || "").trim();

    console.error("[rental-applications] screening events read failed", {
      route: "screening_events_read",
      applicationId: id,
      userRole: role || "unknown",
      landlordId: landlordId || null,
      error: String(err?.message || err),
    });

    return res.status(500).json({ ok: false, error: "SCREENING_EVENTS_READ_FAILED" });
  }
});



router.post("/rental-applications/:id/screening/export", attachAccount, async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId && role !== "admin") {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const snap = await db.collection("rentalApplications").doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const data = snap.data() as any;
    if (role !== "admin" && data?.landlordId && data.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    if (role !== "admin") {
      const cap = await requireCapability(String(landlordId), "exports_basic", req.user);
      if (!cap.ok) {
        return res.status(402).json({
          ok: false,
          error: "upgrade_required",
          capability: "exports_basic",
          requiredPlan: "pro",
          plan: cap.plan,
          source: "screening_export",
        });
      }
    }

    const status = String(data?.screeningStatus || "").toLowerCase();
    if (status !== "complete" || !data?.screeningResultId) {
      return res.status(400).json({ ok: false, error: "SCREENING_NOT_COMPLETE" });
    }

    const resultSnap = await db.collection("screeningResults").doc(String(data.screeningResultId)).get();
    if (!resultSnap.exists) {
      return res.status(404).json({ ok: false, error: "RESULT_NOT_FOUND" });
    }
    const result = resultSnap.data() as any;

    const pdfBuffer = await buildScreeningPdf({
      summary: result?.summary || null,
      reportText: result?.reportText || null,
      applicationId: id,
    });

    const exportRecord = await createReportExport({
      applicationId: id,
      landlordId: data?.landlordId || null,
      resultId: String(data.screeningResultId),
      pdfBuffer,
    });

    const shareUrl = buildShareUrl(exportRecord.exportId, exportRecord.token);

    console.log("[screening_export]", {
      route: "screening_export",
      applicationId: id,
      exportId: exportRecord.exportId,
      status: "ready",
    });

    return res.json({
      ok: true,
      exportId: exportRecord.exportId,
      shareUrl,
      expiresAt: exportRecord.expiresAt,
    });
  } catch (err: any) {
    console.error("[screening_export] failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "SCREENING_EXPORT_FAILED" });
  }
});

function safeParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export const __testing = {
  isAllowedRedirectOrigin,
  normalizeOrigin,
  resolveFrontendOrigin,
  buildRedirectUrl,
  isScreeningAlreadyPaid,
  buildScreeningStatusPayload,
};

export default router;

