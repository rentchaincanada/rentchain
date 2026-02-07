// Backend: rentchain-api/src/app.ts
import express, { Application, Request } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requestBreadcrumbs } from "./middleware/requestBreadcrumbs";
import { routeSource } from "./middleware/routeSource";
import { authenticateJwt } from "./middleware/authMiddleware";
import { corsOptions } from "./lib/cors";
import { getPricingHealth } from "./config/planMatrix";

import publicRoutes from "./routes/publicRoutes";
import authRoutes from "./routes/authRoutes";
import billingRoutes from "./routes/billingRoutes";
import stripeScreeningOrdersWebhookRoutes, {
  stripeWebhookHandler,
} from "./routes/stripeScreeningOrdersWebhookRoutes";
import { transunionWebhookHandler } from "./routes/transunionWebhookRoutes";
import { requestContext } from "./middleware/requestContext";
import "./types/auth";
import "./types/http";
import { resolveLandlordAndTier } from "./lib/landlordResolver";
import paymentsRoutes from "./routes/paymentsRoutes";
import applicationsRoutes from "./routes/applicationsRoutes";
import applicationsConversionRoutes from "./routes/applicationsConversionRoutes";
import leaseRoutes from "./routes/leaseRoutes";
import tenantOnboardRoutes from "./routes/tenantOnboardRoutes";
import eventsRoutes from "./routes/eventsRoutes";
import dashboardRoutes from "./routes/dashboardRoutes";
import healthRoutes from "./routes/healthRoutes";
import ledgerV2Routes from "./routes/ledgerV2Routes";
import landlordMicroLiveRoutes from "./routes/landlordMicroLiveRoutes";
import tenantHistoryShareRoutes, {
  publicRouter as tenantHistorySharePublicRouter,
} from "./routes/tenantHistoryShareRoutes";
import tenantSignalsRoutes from "./routes/tenantSignalsRoutes";
import reportingRoutes from "./routes/reportingRoutes";
import capabilitiesRoutes from "./routes/capabilitiesRoutes";
import tenantInvitesRoutes from "./routes/tenantInvitesRoutes";
import tenantPortalRoutes from "./routes/tenantPortalRoutes";
import tenantInviteAliasesRoutes from "./routes/tenantInviteAliasesRoutes";
import landlordInvitesAdminRoutes from "./routes/landlordInvitesAdminRoutes";
import landlordInvitesPublicRoutes from "./routes/landlordInvitesPublicRoutes";
import tenantEventsRoutes from "./routes/tenantEventsRoutes";
import tenantEventsWriteRoutes from "./routes/tenantEventsWriteRoutes";
import ledgerAttachmentsRoutes from "./routes/ledgerAttachmentsRoutes";
import tenantNoticesRoutes from "./routes/tenantNoticesRoutes";
import maintenanceRequestsRoutes from "./routes/maintenanceRequestsRoutes";
import stubsRoutes from "./routes/stubsRoutes";
import adminBootstrapRoutes from "./routes/adminBootstrapRoutes";
import usageBreakdownRoutes from "./routes/usageBreakdownRoutes";
import tenantReportRoutes from "./routes/tenantReportRoutes";
import impersonationRoutes from "./routes/impersonationRoutes";
import tenantReportPdfRoutes from "./routes/tenantReportPdfRoutes";
import adminDemoRoutes from "./routes/adminDemoRoutes";
import authzRoutes from "./routes/authzRoutes";
import reportsExportRoutes from "./routes/reportsExportRoutes";
import propertiesRoutes from "./routes/propertiesRoutes";
import accountRoutes from "./routes/accountRoutes";
import compatRoutes from "./routes/compatRoutes";
import unitsRoutes from "./routes/unitsRoutes";
import adminPropertiesRoutes from "./routes/adminPropertiesRoutes";
import ledgerRoutes from "./routes/ledgerRoutes";
import landlordApplicationLinksRoutes from "./routes/landlordApplicationLinksRoutes";
import publicApplicationLinksRoutes from "./routes/publicApplicationLinksRoutes";
import messagesRoutes from "./routes/messagesRoutes";
import tenantsRoutes from "./routes/tenantsRoutes";
import rentalApplicationsRoutes from "./routes/rentalApplicationsRoutes";
import verifiedScreeningRoutes from "./routes/verifiedScreeningRoutes";
import screeningJobsAdminRoutes from "./routes/screeningJobsAdminRoutes";
import adminRoutes from "./routes/adminRoutes";
import adminScreeningResultsRoutes from "./routes/adminScreeningResultsRoutes";
import screeningReportRoutes from "./routes/screeningReportRoutes";
import onboardingRoutes from "./routes/onboardingRoutes";

const app: Application = express();

const pricingHealth = getPricingHealth();
if (!pricingHealth.ok) {
  console.warn("[boot] pricing env missing/invalid", {
    missing: pricingHealth.missing,
    invalid: pricingHealth.invalid,
    env: pricingHealth.env,
  });
}
app.set("etag", false);

/**
 * Middleware
 */

app.use(requestBreadcrumbs);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
// ---- Stripe webhook (raw body) must come before JSON parsing ----
app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  routeSource("stripeScreeningOrdersWebhookRoutes.ts"),
  stripeWebhookHandler
);
app.post(
  "/api/webhooks/transunion",
  express.raw({ type: "application/json" }),
  routeSource("transunionWebhookRoutes.ts"),
  transunionWebhookHandler
);

// ---- Body parsing (JSON/urlencoded) ----
const jsonParser = express.json({
  limit: "10mb",
  verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
    // Keep this if you still use /api/stripe/webhook elsewhere
    if (req.originalUrl?.startsWith("/api/stripe/webhook")) {
      req.rawBody = Buffer.from(buf);
    }
  },
});
app.use(jsonParser);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  if (req.originalUrl.startsWith("/api/webhooks/stripe")) {
    return next();
  }
  return jsonParser(req, res, next);
});
app.use(express.urlencoded({ extended: true }));
// ---- Auth  ----
app.use(requestContext);
app.use((err: any, req: any, res: any, next: any) => {
  if (err && err.type === "entity.parse.failed") {
    console.error("[json] parse failed", { path: req?.originalUrl, message: err?.message });
    return res.status(400).json({ ok: false, error: "INVALID_JSON_BODY" });
  }
  return next(err);
});

// Redirect accidental double /api/api/... to /api/...
app.use("/api/api", (req, res) => {
  const fixed = "/api" + req.url;
  return res.redirect(307, fixed);
});

// Billing routes
app.use("/api/billing", routeSource("billingRoutes.ts"), billingRoutes);
console.log("[boot] mounted billingRoutes at /api/billing");
app.use("/api", routeSource("paymentsRoutes.ts"), paymentsRoutes);

// Dev tooling routes should not be blocked by auth
/**
 * Route registration
 */
// Backwards-compatible alias: /api/public/waitlist -> /api/waitlist
app.post("/api/public/waitlist", (req, res, next) => {
  req.url = "/waitlist";
  next();
});
app.use("/api/public", routeSource("landlordInvitesPublicRoutes.ts"), landlordInvitesPublicRoutes);
// Mount public routes under both /api and /api/public for compatibility
app.use("/api/public", routeSource("publicRoutes.ts"), publicRoutes);
app.use("/api", routeSource("publicRoutes.ts"), publicRoutes);
app.use("/api/public", tenantHistorySharePublicRouter);
app.use("/api/auth", authRoutes);
app.use("/api/capabilities", routeSource("capabilitiesRoutes.ts"), capabilitiesRoutes);
app.use("/api/public", routeSource("publicApplicationLinksRoutes.ts"), publicApplicationLinksRoutes);

// Decode auth for protected routes
app.use(authenticateJwt);
console.log("[BOOT] mounting /api/ledger-v2 (after auth)");
app.use("/api/ledger-v2", routeSource("ledgerV2Routes.ts"), ledgerV2Routes);
app.use("/api/tenant-history", tenantHistoryShareRoutes);
app.use("/api", tenantSignalsRoutes);
app.use("/api/reporting", reportingRoutes);
app.use("/api", compatRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/dashboard", routeSource("dashboardRoutes.ts"), dashboardRoutes);
app.use("/api/application-links", routeSource("landlordApplicationLinksRoutes.ts"), landlordApplicationLinksRoutes);
app.use(
  "/api/landlord/application-links",
  routeSource("landlordApplicationLinksRoutes.ts"),
  landlordApplicationLinksRoutes
);
app.use("/api/tenant-invites", tenantInvitesRoutes);
app.use("/api", routeSource("unitsRoutes.ts"), unitsRoutes);
app.use("/api/tenant", tenantPortalRoutes);
app.use("/api", routeSource("tenantInviteAliasesRoutes"), tenantInviteAliasesRoutes);
app.use("/api", routeSource("tenantEventsRoutes"), tenantEventsRoutes);
app.use("/api", routeSource("tenantEventsWriteRoutes"), tenantEventsWriteRoutes);
app.use("/api", routeSource("ledgerAttachmentsRoutes"), ledgerAttachmentsRoutes);
app.use("/api", routeSource("tenantNoticesRoutes"), tenantNoticesRoutes);
app.use("/api", routeSource("maintenanceRequestsRoutes"), maintenanceRequestsRoutes);
app.use("/api", routeSource("usageBreakdownRoutes.ts"), usageBreakdownRoutes);
app.use("/api/properties", propertiesRoutes);
app.use("/api", routeSource("rentalApplicationsRoutes.ts"), rentalApplicationsRoutes);
app.use("/api", routeSource("verifiedScreeningRoutes.ts"), verifiedScreeningRoutes);
app.use("/api", routeSource("tenantReportRoutes.ts"), tenantReportRoutes);
app.use("/api", applicationsRoutes);
app.use("/api/applications", routeSource("applicationsConversionRoutes.ts"), applicationsConversionRoutes);
app.use("/api/impersonation", routeSource("impersonationRoutes.ts"), impersonationRoutes);
app.use("/api/tenant-report-pdf", routeSource("tenantReportPdfRoutes.ts"), tenantReportPdfRoutes);
app.use("/api", stubsRoutes);
app.use("/api/admin", routeSource("adminBootstrapRoutes"), adminBootstrapRoutes);
app.use("/api/admin", routeSource("screeningJobsAdminRoutes.ts"), screeningJobsAdminRoutes);
app.use("/api/admin", routeSource("adminRoutes.ts"), adminRoutes);
app.use("/api/admin", routeSource("landlordInvitesAdminRoutes.ts"), landlordInvitesAdminRoutes);
app.use("/api/admin/demo", routeSource("adminDemoRoutes.ts"), adminDemoRoutes);
app.use("/api/admin", routeSource("adminPropertiesRoutes.ts"), adminPropertiesRoutes);
app.use("/api/admin", routeSource("adminScreeningResultsRoutes.ts"), adminScreeningResultsRoutes);
app.use("/api", authzRoutes);
app.use("/api", reportsExportRoutes);
app.use("/api", routeSource("screeningReportRoutes.ts"), screeningReportRoutes);

// Core API mounts
app.use("/health", routeSource("healthRoutes.ts"), healthRoutes);
app.get("/api/me", async (req, res) => {
  res.setHeader("x-route-source", "app.ts:/api/me");
  const hasAuthHeader = Boolean(req.get("authorization"));
  if (!hasAuthHeader) {
    return res.json({ ok: true, user: null });
  }
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  const resolved = await resolveLandlordAndTier(req.user);
  const user = { ...req.user, plan: resolved.tier };
  return res.json({ ok: true, user });
});
app.get("/api/_build", (req, res) => {
  res.setHeader("x-route-source", "app.ts:/api/_build");
  return res.json({
    ok: true,
    service: process.env.K_SERVICE || null,
    revision: process.env.K_REVISION || null,
    time: new Date().toISOString(),
  });
});

app.get("/api/__debug/build", (_req, res) => {
  res.setHeader("x-route-source", "app.ts:/api/__debug/build");
  return res.json({
    ok: true,
    vercel: {
      gitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID || null,
      env: process.env.VERCEL_ENV || null,
    },
    routeCheck: {
      landlordApplicationLinksMounted: true,
      mountPath: "/api/landlord/application-links",
    },
  });
});

app.get("/api/__debug/ping-application-links", (_req, res) => {
  res.setHeader("x-route-source", "debugPingApplicationLinks");
  return res.json({ ok: true });
});
app.get("/api/__probe/revision", (_req, res) => {
  res.setHeader("x-route-source", "app.ts:/api/__probe/revision");
  return res.json({
    ok: true,
    service: "rentchain-landlord-api",
    revision: process.env.K_REVISION || null,
    commit: process.env.GIT_SHA || process.env.COMMIT_SHA || null,
    ts: Date.now(),
  });
});

app.use("/api/leases", leaseRoutes);
app.use("/api", tenantOnboardRoutes);
app.use("/api/events", eventsRoutes);
app.use(
  "/api/landlord/application-links",
  routeSource("landlordApplicationLinksRoutes.ts"),
  landlordApplicationLinksRoutes
);
app.use("/api/landlord", landlordMicroLiveRoutes);
app.get("/api/__probe/tenants-mount", (_req, res) =>
  res.json({ ok: true, probe: "tenants-mount", ts: Date.now() })
);
app.get("/api/__probe/version", (_req, res) =>
  res.json({ ok: true, ts: Date.now(), marker: "probe-v1" })
);
app.use("/api/tenants", routeSource("tenantsRoutes.ts"), tenantsRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/onboarding", routeSource("onboardingRoutes.ts"), onboardingRoutes);
app.use("/api", routeSource("onboardingRoutes.ts"), onboardingRoutes);
app.use("/api", routeSource("messagesRoutes.ts"), messagesRoutes);

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] unhandledRejection", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException", err);
});

app.all("/api/__debug/routes", (req, res) => {
  res.json({ ok: true, msg: "debug live" });
});

// API 404 handler
app.use("/api", (_req, res) => {
  res.setHeader("x-route-source", "not-found");
  return res.status(404).json({ ok: false, code: "NOT_FOUND", error: "Not Found" });
});

app.use((err: any, req: any, res: any, next: any) => {
  console.error("[express] unhandled error", {
    path: req?.originalUrl,
    message: err?.message,
    code: err?.code,
    stack: err?.stack,
  });
  if (res.headersSent) return next(err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

/**
 * Simple 404 handler
 */
app.use(notFoundHandler);

/**
 * Generic error handler
 */
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
export { app };
// src/app.build.ts
