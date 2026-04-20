import express from "express";
import { listRecordsForLandlord } from "../services/billingService";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { getStripeClient } from "../services/stripeService";
import { stripeNotConfiguredResponse, isStripeNotConfiguredError } from "../lib/stripeNotConfigured";
import { FRONTEND_URL } from "../config/screeningConfig";
import {
  getPlanMatrix,
  getStripeEnv,
  isCanonicalFreePlan,
  resolvePaidBillingPlan,
  resolvePlanPriceId,
  type BillingPlanKey,
} from "../config/planMatrix";
import { getScreeningPricing } from "../billing/screeningPricing";
import { resolveLandlordAndTier } from "../lib/landlordResolver";

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "billing", ts: Date.now() });
});

type SubscriptionStatusTier = "free" | "starter" | "pro" | "elite";
type SubscriptionStatusInterval = "month" | "year" | null;

function normalizeSubscriptionStatusTier(input: any): SubscriptionStatusTier {
  return resolvePaidBillingPlan(input) || "free";
}

async function sendSubscriptionStatus(req: any, res: any) {
  const resolved = await resolveLandlordAndTier(req.user);
  const tier = normalizeSubscriptionStatusTier(resolved?.tier || req.user?.plan);
  const interval: SubscriptionStatusInterval = null;
  const renewalDate: string | null = null;
  const isActive = tier !== "free";
  const status = isActive ? "active" : "canceled";

  return res.status(200).json({
    ok: true,
    tier,
    planId: tier,
    status,
    interval,
    renewalDate,
    isActive,
  });
}

router.get("/subscription-status", requireAuth, sendSubscriptionStatus);
// Compatibility alias in case any client still calls /api/billing/billing/subscription-status.
router.get("/billing/subscription-status", requireAuth, sendSubscriptionStatus);

router.get("/pricing", (_req, res) => {
  res.setHeader("x-route-source", "billingRoutes.ts");
  const plans = getPlanMatrix().map((plan) => ({
    key: plan.key,
    label: plan.label,
    currency: "cad",
    monthlyAmountCents: plan.monthlyAmountCents,
    yearlyAmountCents: plan.yearlyAmountCents,
  }));

  const screening = {
    basicCents: getScreeningPricing({ screeningTier: "basic" }).baseAmountCents,
    verifyCents: getScreeningPricing({ screeningTier: "verify" }).baseAmountCents,
    verifyAiCents: getScreeningPricing({ screeningTier: "verify_ai" }).baseAmountCents,
    creditScoreCents: getScreeningPricing({
      screeningTier: "basic",
      addons: ["credit_score"],
    }).scoreAddOnCents,
    expeditedCents: getScreeningPricing({
      screeningTier: "basic",
      addons: ["expedited"],
    }).expeditedAddOnCents,
    currency: "cad",
  };

  const registry = {
    filingWorkflow: {
      capability: "registry_filing_access",
      attemptsHistoryCapability: "registry_attempts_history",
      includedPlanKeys: ["pro", "elite"],
      freeIncludes: ["draft", "readiness", "export"],
      paidUnlocks: ["filing_workflow", "retry_safety", "attempt_history", "audit_tracking"],
      perFilingAmountCents: null,
      currency: "cad",
    },
  };

  res.json({ ok: true, plans, screening, registry, env: getStripeEnv() });
});

type BillingTier = BillingPlanKey;
type BillingInterval = "monthly" | "yearly";

function normalizeTier(input: any): BillingTier | "free" | null {
  const raw = String(input || "").trim();
  if (!raw) return null;
  if (isCanonicalFreePlan(raw)) return "free";
  return resolvePaidBillingPlan(raw);
}

function normalizeInterval(input: any): BillingInterval {
  const raw = String(input || "").trim().toLowerCase();
  if (raw === "year" || raw === "yearly" || raw === "annual" || raw === "annually") return "yearly";
  if (raw === "month" || raw === "monthly") return "monthly";
  return "monthly";
}

function resolvePriceId(tier: BillingTier, interval: BillingInterval) {
  return resolvePlanPriceId({ plan: tier, interval });
}

function sanitizeRedirectTo(raw: any): string {
  const fallback = "/dashboard";
  if (!raw) return fallback;
  const value = String(raw || "").trim();
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("://")) return fallback;
  return value;
}

function resolveFrontendBase(): string {
  const fallback =
    process.env.NODE_ENV === "production"
      ? "https://www.rentchain.ai"
      : "http://localhost:5173";
  const base = String(process.env.FRONTEND_URL || FRONTEND_URL || fallback).trim();
  return base.replace(/\/$/, "");
}

function appendBillingCanceled(path: string): string {
  if (!path) return "/dashboard?billing=canceled=1";
  if (path.includes("?")) return `${path}&billing=canceled=1`;
  return `${path}?billing=canceled=1`;
}

function isStripeConnectionError(err: any): boolean {
  const name = String(err?.name || "").trim();
  const type = String(err?.type || "").trim();
  const code = String(err?.code || "").trim();
  const message = String(err?.message || "").trim();
  return (
    name === "StripeConnectionError" ||
    type === "StripeConnectionError" ||
    code === "StripeConnectionError" ||
    /connection to stripe/i.test(message)
  );
}

function resolveStripeKeyMode(): "live" | "test" | "unknown" {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("sk_test_")) return "test";
  return "unknown";
}

function logStripeFailure(scope: string, err: any, extra: Record<string, unknown> = {}) {
  console.error(`[billing/${scope}] Stripe request failed`, {
    route: extra.route || null,
    operation: extra.operation || null,
    message: err?.message,
    name: err?.name,
    type: err?.type,
    code: err?.code,
    statusCode: err?.statusCode,
    requestId: err?.requestId || err?.raw?.requestId || null,
    requestLogUrl: err?.request_log_url || err?.raw?.request_log_url || null,
    numRetries: err?.numRetries ?? err?.raw?.numRetries ?? null,
    headers: err?.headers || err?.raw?.headers || null,
    stripeEnv: getStripeEnv(),
    stripeKeyMode: resolveStripeKeyMode(),
    ...extra,
  });
}

function sendStripeRouteError(
  res: any,
  context: {
    scope: "checkout" | "portal";
    route: string;
    operation: string;
  },
  err: any
) {
  if (isStripeNotConfiguredError(err)) {
    return res.status(400).json(stripeNotConfiguredResponse());
  }

  if (isStripeConnectionError(err)) {
    logStripeFailure(context.scope, err, {
      route: context.route,
      operation: context.operation,
    });
    return res.status(503).json({
      ok: false,
      error: context.scope === "checkout" ? "checkout_temporarily_unavailable" : "billing_portal_temporarily_unavailable",
    });
  }

  logStripeFailure(context.scope, err, {
    route: context.route,
    operation: context.operation,
  });
  return res.status(500).json({
    ok: false,
    error: context.scope === "checkout" ? "checkout_failed" : "billing_portal_failed",
  });
}

router.use((req, res, next) => {
  res.setHeader("x-billing-routes", "present");
  next();
});

router.get(
  "/",
  requireAuth,
  async (req: any, res) => {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });
    const records = listRecordsForLandlord(landlordId).map((record) => ({
      ...record,
      type: record.kind,
    }));
    res.json({ ok: true, records, ts: Date.now() });
  }
);

router.get(
  "/receipts/:id",
  requireAuth,
  async (req: any, res) => {
    // NOTE: ensure the receipt belongs to this landlordId before exposing content
    res.type("html").send(`
      <h2>RentChain Receipt</h2>
      <p>Receipt ID: ${req.params.id}</p>
      <p>Status: Paid</p>
    `);
  }
);

async function handleCheckout(req: any, res: any) {
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    const userId = req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const { tier, interval, plan, requiredPlan, planKey, featureKey, source, redirectTo } =
      req.body || {};
    const resolvedTier = normalizeTier(tier || plan || requiredPlan || planKey);
    if (!resolvedTier) {
      return res.status(400).json({ ok: false, error: "missing_tier" });
    }
    if (resolvedTier === "free") {
      return res.status(400).json({ ok: false, error: "invalid_tier" });
    }
    const resolvedInterval = normalizeInterval(interval);

    const resolved = resolvePriceId(resolvedTier, resolvedInterval);
    if (!resolved.priceId) {
      console.error("[billing/checkout] price not configured or invalid", { envKey: resolved.envKey });
      const statusCode = process.env.NODE_ENV === "production" ? 503 : 400;
      return res.status(statusCode).json({
        ok: false,
        error: "price_not_configured",
        detail: `${resolved.envKey} must be Stripe price id price_...`,
      });
    }

    const stripe = getStripeClient();
    const featureKeyValue = String(featureKey || "unknown").trim().slice(0, 80);
    const sourceValue = String(source || "unknown").trim().slice(0, 80);
    const redirectToValue = sanitizeRedirectTo(redirectTo);
    const frontendUrl = resolveFrontendBase();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: resolved.priceId, quantity: 1 }],
      metadata: {
        landlordId: String(landlordId),
        userId: String(userId || ""),
        tier: resolvedTier,
        interval: resolvedInterval,
        featureKey: featureKeyValue,
        source: sourceValue,
      },
      subscription_data: {
        metadata: {
          landlordId: String(landlordId),
          userId: String(userId || ""),
          tier: resolvedTier,
          interval: resolvedInterval,
          featureKey: featureKeyValue,
          source: sourceValue,
        },
      },
      success_url: `${frontendUrl}/billing/checkout-success?session_id={CHECKOUT_SESSION_ID}&redirectTo=${encodeURIComponent(
        redirectToValue
      )}`,
      cancel_url: `${frontendUrl}${appendBillingCanceled(redirectToValue)}`,
    });

    return res.status(200).json({ ok: true, url: session.url });
  } catch (err: any) {
    return sendStripeRouteError(
      res,
      {
        scope: "checkout",
        route: String(req.originalUrl || req.path || "/api/billing/checkout"),
        operation: "checkout.sessions.create",
      },
      err
    );
  }
}

router.post("/checkout", requireAuth, handleCheckout);
router.post("/subscribe", requireAuth, handleCheckout);
router.post("/upgrade", requireAuth, handleCheckout);

router.post("/portal", requireAuth, async (req: any, res) => {
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const stripe = getStripeClient();
    const landlordRef = db.collection("landlords").doc(String(landlordId));
    const landlordSnap = await landlordRef.get();
    if (!landlordSnap.exists) {
      return res.status(404).json({ ok: false, error: "landlord_not_found" });
    }
    const landlord = landlordSnap.data() as any;

    let stripeCustomerId = String(landlord?.stripeCustomerId || "").trim();
    if (!stripeCustomerId) {
      const email = String(landlord?.email || req.user?.email || "").trim() || undefined;
      const name = String(landlord?.name || landlord?.companyName || "").trim() || undefined;
      const customer = await stripe.customers.create({
        email,
        name,
        metadata: { landlordId: String(landlordId) },
      });
      stripeCustomerId = customer.id;
      await landlordRef.set({ stripeCustomerId }, { merge: true });
    }

    const frontendUrl = resolveFrontendBase();
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${frontendUrl}/billing`,
    });

    return res.status(200).json({ ok: true, url: session.url });
  } catch (err: any) {
    return sendStripeRouteError(
      res,
      {
        scope: "portal",
        route: String(req.originalUrl || req.path || "/api/billing/portal"),
        operation: "billingPortal.sessions.create",
      },
      err
    );
  }
});

export default router;
