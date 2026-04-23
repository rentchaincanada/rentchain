import { db } from "../config/firebase";
import { getStripeClient } from "./stripeService";
import { getScreeningPricing } from "../billing/screeningPricing";
import {
  PACKAGE_TO_LEGACY_TIER,
  SCREENING_ADDONS_V2,
  SCREENING_PACKAGES_V2,
} from "../lib/screeningMonetizationV2/screeningPackages";
import {
  calculateScreeningPrice,
  isScreeningAddonKey,
  isScreeningPackageKey,
} from "../lib/screeningMonetizationV2/calculateScreeningPrice";
import { buildTransUnionReferralUrl } from "./screening/transunionReferral";
import { writeReferralInitiated } from "./screening/referralTracking";
import { enqueueScreeningJob } from "./screeningJobs";
import { recordScreeningPaymentInitiated } from "./screeningPaymentTransactionService";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import {
  buildScreeningMonetizationPatch,
  buildScreeningMonetizationSummary,
  normalizeScreeningMonetizationState,
} from "./screening/screeningMonetizationService";
import { hashSeedKey, isAllowlistedSeed, parseAllowlist } from "./screening/cutoverConfig";
import { logCutoverEvent } from "./screening/cutoverTelemetry";

const ALLOWED_REDIRECT_ORIGINS = ["https://www.rentchain.ai", "https://rentchain.ai", "http://localhost:5173"];

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

function resolveFrontendOrigin(frontendOrigin?: string | null) {
  const inputOrigin = normalizeOrigin(frontendOrigin);
  if (inputOrigin && isAllowedRedirectOrigin(inputOrigin)) {
    return inputOrigin;
  }
  const envOrigin = normalizeOrigin(process.env.FRONTEND_ORIGIN || process.env.PUBLIC_APP_URL || "");
  if (envOrigin && isAllowedRedirectOrigin(envOrigin)) {
    return envOrigin;
  }
  const fallback =
    process.env.NODE_ENV === "production" ? "https://www.rentchain.ai" : "http://localhost:5173";
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

function resolveScreeningTier(raw?: string | null): "basic" | "verify" | "verify_ai" {
  const val = String(raw || "").trim().toLowerCase();
  if (val === "verify" || val === "verified") return "verify";
  if (val === "verify_ai" || val === "verified_ai" || val === "verify+ai") return "verify_ai";
  return "basic";
}

function resolveScreeningPackage(raw?: string | null): "basic" | "standard" | "premium" | null {
  const val = String(raw || "").trim().toLowerCase();
  if (isScreeningPackageKey(val)) return val;
  return null;
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

function normalizeScreeningV2Addons(raw: any) {
  return normalizeAddons(raw).filter((value) => isScreeningAddonKey(value));
}

function resolvePaymentResponsibility(raw?: string | null): "landlord" | "tenant" {
  return String(raw || "").trim().toLowerCase() === "tenant" ? "tenant" : "landlord";
}

function resolvePricingInput(body: any) {
  const requestedPackage = resolveScreeningPackage(body?.screeningPackage || body?.package);
  const v2Addons = normalizeScreeningV2Addons(body?.addons);
  const screeningTier = resolveScreeningTier(
    body?.screeningTier || (requestedPackage ? PACKAGE_TO_LEGACY_TIER[requestedPackage] : undefined)
  );
  const screeningPackage =
    requestedPackage || (screeningTier === "verify" ? "standard" : screeningTier === "verify_ai" ? "premium" : "basic");
  const legacyAddons = normalizeAddons(body?.addons).filter(
    (value) => value === "credit_score" || value === "expedited"
  );
  const addons = [...v2Addons, ...legacyAddons];
  const serviceLevel =
    String(
      body?.serviceLevel ||
        (screeningTier === "basic" ? "SELF_SERVE" : screeningTier === "verify" ? "VERIFIED" : "VERIFIED_AI")
    )
      .trim()
      .toUpperCase() || "SELF_SERVE";
  const scoreAddOn = addons.includes("credit_score") || body?.scoreAddOn === true;
  const expeditedAddOn = addons.includes("expedited");
  const paymentResponsibility = resolvePaymentResponsibility(body?.paymentResponsibility || body?.payer);
  const pricing = getScreeningPricing({
    screeningTier,
    packageKey: screeningPackage,
    addons,
    currency: "CAD",
  });
  const packagePricing = calculateScreeningPrice({
    packageKey: screeningPackage,
    addons: v2Addons,
    currency: "CAD",
  });
  return {
    screeningTier,
    screeningPackage,
    addons,
    v2Addons,
    serviceLevel,
    scoreAddOn,
    expeditedAddOn,
    paymentResponsibility,
    pricing: {
      ...pricing,
      packageAmountCents: packagePricing.packageAmountCents,
      addonAmountCents: packagePricing.addonAmountCents,
    },
  };
}

function buildScreeningLineItems(params: {
  currency: string;
  screeningPackage: string;
  addons: string[];
  pricing: any;
}) {
  const currency = String(params.currency || "cad").toLowerCase();
  const packageConfig =
    SCREENING_PACKAGES_V2[params.screeningPackage as keyof typeof SCREENING_PACKAGES_V2] ||
    SCREENING_PACKAGES_V2.basic;
  const items: any[] = [
    {
      price_data: {
        currency,
        product_data: { name: `${packageConfig.label} screening package` },
        unit_amount: params.pricing.baseAmountCents,
      },
      quantity: 1,
    },
  ];
  for (const addonKey of params.addons) {
    if (!isScreeningAddonKey(addonKey)) continue;
    const addon = SCREENING_ADDONS_V2[addonKey];
    items.push({
      price_data: {
        currency,
        product_data: { name: addon.label },
        unit_amount: addon.price,
      },
      quantity: 1,
    });
  }
  if (params.pricing.scoreAddOnCents) {
    items.push({
      price_data: {
        currency,
        product_data: { name: "Credit score add-on" },
        unit_amount: params.pricing.scoreAddOnCents,
      },
      quantity: 1,
    });
  }
  if (params.pricing.expeditedAddOnCents) {
    items.push({
      price_data: {
        currency,
        product_data: { name: "Expedited processing add-on" },
        unit_amount: params.pricing.expeditedAddOnCents,
      },
      quantity: 1,
    });
  }
  return items;
}

export function isTransUnionReferralMode() {
  const key = String(process.env.BUREAU_PROVIDER || process.env.SCREENING_PROVIDER || "")
    .trim()
    .toLowerCase();
  return key === "transunion_referral";
}

export function shouldUseMockScreeningCheckoutOverride(params: { role: string; seedKey: string }) {
  const allowMock = process.env.ALLOW_MOCK_PROVIDER_CHECKOUT === "true";
  if (!allowMock) return false;
  if (params.role !== "admin") return false;
  return isAllowlistedSeed(params.seedKey, parseAllowlist());
}

export function logMockProviderCheckout(params: { name: "checkout" | "run"; seedKey: string }) {
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

function logTuReferralEvent(params: {
  orderId: string;
  applicationId: string;
  landlordId: string;
  redirectUrl: string;
}) {
  let redirectDomain = "unknown";
  try {
    redirectDomain = new URL(params.redirectUrl).host;
  } catch {
    redirectDomain = "invalid_url";
  }
  console.info(
    "[tu_referral]",
    JSON.stringify({
      eventType: "tu_referral_redirect",
      orderHash: hashSeedKey(params.orderId),
      applicationHash: hashSeedKey(params.applicationId),
      landlordHash: hashSeedKey(params.landlordId),
      redirectDomain,
      ts: new Date().toISOString(),
    })
  );
}

function extractTuTrackingParams(redirectUrl: string): { source?: string; ts?: string } {
  try {
    const url = new URL(redirectUrl);
    const source = String(url.searchParams.get("source") || "").trim();
    const ts = String(url.searchParams.get("ts") || "").trim();
    return {
      ...(source ? { source } : {}),
      ...(ts ? { ts } : {}),
    };
  } catch {
    return {};
  }
}

function buildReferenceId(orderId: string) {
  const safe = String(orderId || "").replace(/[^a-z0-9]/gi, "");
  const suffix = safe.slice(-8).toUpperCase() || "UNKNOWN";
  return `RC-${suffix}`;
}

export async function loadScreeningApplicationForLandlord(params: {
  landlordId: string;
  applicationId: string;
}) {
  const landlordId = String(params.landlordId || "").trim();
  const applicationId = String(params.applicationId || "").trim();
  if (!landlordId || !applicationId) return { ok: false as const, error: "NOT_FOUND" as const };

  const snap = await db.collection("rentalApplications").doc(applicationId).get();
  if (!snap.exists) {
    return { ok: false as const, error: "NOT_FOUND" as const };
  }

  const application = { id: snap.id, ...(snap.data() || {}) };
  const ownerLandlordId = String((application as any)?.landlordId || "").trim();
  if (ownerLandlordId && ownerLandlordId !== landlordId) {
    return { ok: false as const, error: "FORBIDDEN" as const };
  }

  return { ok: true as const, application };
}

export async function loadLatestScreeningOrderForApplication(applicationId: string) {
  const snap = await db.collection("screeningOrders").where("applicationId", "==", applicationId).limit(25).get();
  const orders = snap.docs.map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
  orders.sort((a: any, b: any) => {
    const aUpdated = Number(a?.updatedAt || a?.createdAt || 0);
    const bUpdated = Number(b?.updatedAt || b?.createdAt || 0);
    return bUpdated - aUpdated;
  });
  return orders[0] || null;
}

export async function executeScreeningCheckout(params: {
  role: string;
  actorId: string | null;
  landlordId: string;
  applicationId: string;
  application: any;
  body: any;
  consent: { timestamp: string; version: string; textHash: string | null };
  providerHealth: { provider: string; configured: boolean; preflightOk: boolean; preflightDetail?: string | null };
  autopilotPolicy: any;
  frontendOrigin?: string | null;
  logBase: Record<string, unknown>;
}) {
  const {
    role,
    actorId,
    landlordId,
    applicationId,
    application,
    body,
    consent,
    providerHealth,
    autopilotPolicy,
    frontendOrigin,
    logBase,
  } = params;
  const {
    screeningTier,
    screeningPackage,
    addons,
    v2Addons,
    serviceLevel,
    scoreAddOn,
    expeditedAddOn,
    paymentResponsibility,
    pricing,
  } = resolvePricingInput(body);
  const resolvedFrontendOrigin = resolveFrontendOrigin(frontendOrigin);
  const rawReturnTo = String(body?.returnTo || "/dashboard");
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/dashboard";
  const successUrl = buildRedirectUrl({
    input: body?.successPath,
    fallbackPath: "/screening/success",
    frontendOrigin: resolvedFrontendOrigin,
    applicationId,
    returnTo,
  });
  const cancelUrl = buildRedirectUrl({
    input: body?.cancelPath,
    fallbackPath: "/screening/cancel",
    frontendOrigin: resolvedFrontendOrigin,
    applicationId,
    returnTo,
  });
  if (!successUrl || !cancelUrl) {
    console.warn("[screening_checkout] invalid redirect origin", logBase);
    return {
      status: 400,
      payload: { ok: false, error: "invalid_redirect_origin" },
    };
  }

  if (isTransUnionReferralMode()) {
    const now = Date.now();
    const orderRef = db.collection("screeningOrders").doc();
    const orderId = orderRef.id;
    const referralUrl = buildTransUnionReferralUrl({
      landlordId: String(landlordId),
      applicationId,
      orderId,
      returnTo,
      env: process.env.NODE_ENV || "development",
    });

    const orderPayload: any = {
      id: orderId,
      referenceId: buildReferenceId(orderId),
      landlordId,
      applicationId,
      propertyId: application?.propertyId || null,
      unitId: application?.unitId || null,
      createdAt: now,
      updatedAt: now,
      amountCents: 0,
      currency: "CAD",
      status: "external_pending",
      paymentStatus: "external_pending",
      finalized: false,
      finalizedAt: null,
      lastStripeEventId: null,
      amountTotalCents: 0,
      screeningPackage,
      screeningTier,
      addons: v2Addons,
      legacyAddons: addons.filter((value) => value === "credit_score" || value === "expedited"),
      paymentResponsibility,
      scoreAddOn: false,
      scoreAddOnCents: 0,
      expeditedAddOn: false,
      expeditedAddOnCents: 0,
      provider: "transunion_referral",
      inquiryType: "soft",
      providerRequestId: null,
      paidAt: null,
      error: null,
      serviceLevel,
      aiVerification: false,
      aiPriceCents: 0,
      totalAmountCents: 0,
      reviewerStatus: "EXTERNAL_PENDING",
      stripeSessionId: null,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      stripeChargeId: null,
      consentGiven: true,
      consentTimestamp: consent.timestamp,
      consentVersion: consent.version,
      consentTextHash: consent.textHash,
      externalRedirectUrl: referralUrl,
      externalProvider: "transunion",
    };
    await orderRef.set(orderPayload, { merge: true });
    await enqueueScreeningJob({
      orderId,
      applicationId,
      landlordId: application?.landlordId || landlordId,
      provider: "transunion_referral",
    });
    await db.collection("rentalApplications").doc(applicationId).set(
      {
        screeningStatus: "external_pending",
        screeningOrderId: orderId,
        screeningProvider: "transunion_referral",
        screeningLastUpdatedAt: now,
        screening: {
          ...(application?.screening || {}),
          status: "external_pending",
          provider: "transunion_referral",
          orderId,
        },
        screeningMonetization: buildScreeningMonetizationPatch({
          current: application?.screeningMonetization,
          eligibility: "eligible",
          paymentStatus: "checkout_created",
          fulfillmentStatus: "ordered",
          package: screeningPackage,
          addons: v2Addons,
          paymentResponsibility,
          checkoutSessionId: orderId,
          checkoutCreatedAt: now,
          amount: 0,
          currency: "CAD",
          lastErrorCode: null,
          lastErrorMessage: null,
        }),
        updatedAt: now,
      },
      { merge: true }
    );
    await writeReferralInitiated({
      referralId: orderId,
      landlordId: String(landlordId),
      applicationId,
      orderId,
      returnTo,
      tuTrackingParams: extractTuTrackingParams(referralUrl),
    });
    logTuReferralEvent({
      orderId,
      applicationId,
      landlordId: String(landlordId),
      redirectUrl: referralUrl,
    });
    await writeCanonicalEvent({
      domain: "screening",
      action: "checkout_created",
      actor: {
        type: role === "admin" ? "admin" : "landlord",
        role,
        id: actorId,
      },
      resource: {
        type: "screening_order",
        id: orderId,
        parentType: "rental_application",
        parentId: applicationId,
      },
      occurredAt: now,
      visibility: "internal",
      summary: "Screening checkout session created",
      metadata: {
        applicationId,
        landlordId,
        propertyId: application?.propertyId || null,
        unitId: application?.unitId || null,
        serviceLevel,
        totalAmountCents: 0,
      },
    });
    return {
      status: 200,
      payload: {
        ok: true,
        mode: "transunion_referral",
        orderId,
        applicationId,
        redirectUrl: referralUrl,
        checkoutUrl: referralUrl,
        autopilotPolicy,
        screeningMonetizationSummary: buildScreeningMonetizationSummary(
          normalizeScreeningMonetizationState({
            application: {
              ...application,
              screeningMonetization: buildScreeningMonetizationPatch({
                current: application?.screeningMonetization,
                eligibility: "eligible",
                paymentStatus: "checkout_created",
                fulfillmentStatus: "ordered",
                checkoutSessionId: orderId,
                checkoutCreatedAt: now,
                amount: 0,
                currency: "CAD",
              }),
            },
            latestOrder: { ...orderPayload, stripeCheckoutSessionId: orderId },
            eligibility: "eligible",
            amount: 0,
            currency: "CAD",
          })
        ),
      },
    };
  }

  let stripe: any;
  try {
    stripe = getStripeClient();
  } catch (err: any) {
    if (err?.code === "stripe_not_configured" || err?.message === "stripe_not_configured") {
      return {
        status: 400,
        payload: { ok: false, error: "stripe_not_configured" },
      };
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
    applicationId,
    propertyId: application?.propertyId || null,
    unitId: application?.unitId || null,
    createdAt: now,
    amountCents: pricing.baseAmountCents,
    currency: "CAD",
    status: "unpaid",
    paymentStatus: "unpaid",
    finalized: false,
    finalizedAt: null,
    lastStripeEventId: null,
    amountTotalCents: pricing.totalAmountCents,
    screeningPackage,
    screeningTier,
    addons: v2Addons,
    legacyAddons: addons.filter((value) => value === "credit_score" || value === "expedited"),
    paymentResponsibility,
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
  const lineItems = buildScreeningLineItems({
    currency,
    screeningPackage,
    addons: v2Addons,
    pricing,
  });

  const safeInt = (n: unknown) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0;
    return Math.round(x);
  };

  const normalizedLineItems = lineItems.map((item) => ({
    ...item,
    price_data: {
      ...item.price_data,
      unit_amount: Math.max(0, safeInt(item.price_data?.unit_amount)),
      currency: String(item.price_data?.currency || currency).toLowerCase(),
    },
  }));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: normalizedLineItems,
    client_reference_id: orderId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      orderId,
      applicationId,
      landlordId,
      serviceLevel,
      screeningPackage,
      paymentResponsibility,
      scoreAddOn: String(scoreAddOn),
      screeningTier,
      addons: v2Addons.join(","),
      totalAmountCents: String(pricing.totalAmountCents),
    },
    payment_intent_data: {
      metadata: {
        orderId,
        applicationId,
        landlordId,
        serviceLevel,
        screeningPackage,
        paymentResponsibility,
        scoreAddOn: String(scoreAddOn),
        screeningTier,
        addons: v2Addons.join(","),
        totalAmountCents: String(pricing.totalAmountCents),
      },
    },
  });

  await orderRef.set(
    { stripeSessionId: session.id, stripeCheckoutSessionId: session.id, updatedAt: Date.now() },
    { merge: true }
  );

  await db.collection("rentalApplications").doc(applicationId).set(
    {
      screening: {
        requested: true,
        requestedAt: now,
        status: "PENDING",
        provider: "STUB",
        orderId,
        amountCents: pricing.baseAmountCents,
        currency: "CAD",
        screeningPackage,
        paidAt: null,
        screeningTier,
        addons: v2Addons,
        paymentResponsibility,
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
      screeningMonetization: buildScreeningMonetizationPatch({
        current: application?.screeningMonetization,
        eligibility: "eligible",
        paymentStatus: "checkout_created",
        fulfillmentStatus: "ready",
        package: screeningPackage,
        addons: v2Addons,
        paymentResponsibility,
        checkoutSessionId: session.id,
        checkoutCreatedAt: now,
        amount: pricing.totalAmountCents,
        currency: "CAD",
        lastErrorCode: null,
        lastErrorMessage: null,
      }),
      updatedAt: now,
    },
    { merge: true }
  );

  await recordScreeningPaymentInitiated({
    landlordId,
    propertyId: application?.propertyId || null,
    unitId: application?.unitId || null,
    applicationId,
    screeningOrderId: orderId,
    amountCents: pricing.totalAmountCents,
    currency: "CAD",
    stripeCheckoutSessionId: session.id,
    serviceLevel,
    recordedAt: now,
  });
  await writeCanonicalEvent({
    domain: "screening",
    action: "checkout_created",
    actor: {
      type: role === "admin" ? "admin" : "landlord",
      role,
      id: actorId,
    },
    resource: {
      type: "screening_order",
      id: orderId,
      parentType: "rental_application",
      parentId: applicationId,
    },
    occurredAt: now,
    visibility: "internal",
    summary: "Screening checkout session created",
    metadata: {
      applicationId,
      landlordId,
      propertyId: application?.propertyId || null,
      unitId: application?.unitId || null,
      stripeCheckoutSessionId: session.id,
      serviceLevel,
      totalAmountCents: pricing.totalAmountCents,
    },
  });

  console.log("[screening_checkout] create_session_ok", {
    ...logBase,
    event: "create_session_ok",
  });
  return {
    status: 200,
    payload: {
      ok: true,
      checkoutUrl: session.url,
      autopilotPolicy,
      screeningMonetizationSummary: buildScreeningMonetizationSummary(
        normalizeScreeningMonetizationState({
          application: {
            ...application,
            screeningMonetization: buildScreeningMonetizationPatch({
              current: application?.screeningMonetization,
              eligibility: "eligible",
              paymentStatus: "checkout_created",
              fulfillmentStatus: "ready",
              checkoutSessionId: session.id,
              checkoutCreatedAt: now,
              amount: pricing.totalAmountCents,
              currency: "CAD",
            }),
          },
          latestOrder: { ...orderPayload, stripeCheckoutSessionId: session.id },
          eligibility: "eligible",
          amount: pricing.totalAmountCents,
          currency: "CAD",
        })
      ),
    },
  };
}
