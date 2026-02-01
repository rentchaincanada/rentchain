import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authenticateJwt } from "./middleware/authMiddleware";
import { routeSource } from "./middleware/routeSource";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";

import publicRoutes from "./routes/publicRoutes";
import authRoutes from "./routes/authRoutes";

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
import capabilitiesRoutes from "./routes/capabilitiesRoutes";
import tenantHistoryShareRoutes, {
  publicRouter as tenantHistorySharePublicRouter,
} from "./routes/tenantHistoryShareRoutes";
import propertiesRoutes from "./routes/propertiesRoutes";
import accountRoutes from "./routes/accountRoutes";
import onboardingRoutes from "./routes/onboardingRoutes";
import billingRoutes from "./routes/billingRoutes";
import tenantSignalsRoutes from "./routes/tenantSignalsRoutes";
import reportingRoutes from "./routes/reportingRoutes";
import tenantInvitesRoutes from "./routes/tenantInvitesRoutes";
import tenantPortalRoutes from "./routes/tenantPortalRoutes";
import tenantInviteAliasesRoutes from "./routes/tenantInviteAliasesRoutes";
import tenantEventsRoutes from "./routes/tenantEventsRoutes";
import tenantEventsWriteRoutes from "./routes/tenantEventsWriteRoutes";
import ledgerAttachmentsRoutes from "./routes/ledgerAttachmentsRoutes";
import tenantNoticesRoutes from "./routes/tenantNoticesRoutes";
import maintenanceRequestsRoutes from "./routes/maintenanceRequestsRoutes";
import stubsRoutes from "./routes/stubsRoutes";
import adminBootstrapRoutes from "./routes/adminBootstrapRoutes";
import usageBreakdownRoutes from "./routes/usageBreakdownRoutes";
import tenantReportRoutes from "./routes/tenantReportRoutes";
import tenantReportPdfRoutes from "./routes/tenantReportPdfRoutes";
import impersonationRoutes from "./routes/impersonationRoutes";
import unitImportRoutes from "./routes/unitImportRoutes";
import actionRequestsRecomputeRoutes from "./routes/actionRequestsRecomputeRoutes";
import actionRequestsRoutes from "./routes/actionRequestsRoutes";
import adminDemoRoutes from "./routes/adminDemoRoutes";
import authzRoutes from "./routes/authzRoutes";
import reportsExportRoutes from "./routes/reportsExportRoutes";
import compatRoutes from "./routes/compatRoutes";
import unitsRoutes from "./routes/unitsRoutes";
import adminPropertiesRoutes from "./routes/adminPropertiesRoutes";
import ledgerRoutes from "./routes/ledgerRoutes";
import landlordApplicationLinksRoutes from "./routes/landlordApplicationLinksRoutes";
import publicApplicationLinksRoutes from "./routes/publicApplicationLinksRoutes";
import tenantsRoutes from "./routes/tenantsRoutes";
import messagesRoutes from "./routes/messagesRoutes";
import rentalApplicationsRoutes from "./routes/rentalApplicationsRoutes";
import verifiedScreeningRoutes from "./routes/verifiedScreeningRoutes";
import stripeScreeningOrdersWebhookRoutes, {
  stripeWebhookHandler,
} from "./routes/stripeScreeningOrdersWebhookRoutes";
import { db } from "./config/firebase";
import screeningJobsAdminRoutes from "./routes/screeningJobsAdminRoutes";
import adminRoutes from "./routes/adminRoutes";
import adminScreeningResultsRoutes from "./routes/adminScreeningResultsRoutes";
import screeningReportRoutes from "./routes/screeningReportRoutes";

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] unhandledRejection", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException", err);
});

export const app = express();
app.set("etag", false);

const corsOptions: cors.CorsOptions = {
  origin: [
    "https://www.rentchain.ai",
    "https://rentchain.ai",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-rc-auth",
    "x-api-client",
    "x-rentchain-apiclient",
    "x-requested-with",
  ],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  routeSource("stripeScreeningOrdersWebhookRoutes.ts"),
  stripeWebhookHandler
);
const jsonParser = express.json({
  limit: "10mb",
  verify: (req: any, _res, buf) => {
    if (req.originalUrl?.startsWith("/api/stripe/webhook")) {
      req.rawBody = Buffer.from(buf);
    }
  },
});
app.use(jsonParser);

app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
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

// Health
app.use("/health", healthRoutes);

// Direct billing probe before any /api mounts
app.get("/api/billing/_probe", (_req, res) =>
  res.json({ ok: true, via: "app.build direct probe" })
);
app.use("/api/billing", routeSource("billingRoutes.ts"), billingRoutes);
console.log("[boot] mounted billingRoutes at /api/billing");
app.get("/api/payments/_probe", (_req, res) =>
  res.json({ ok: true, via: "payments direct probe" })
);
app.use("/api", routeSource("paymentsRoutes.ts"), paymentsRoutes);

// Public + Auth (MUST be before authenticateJwt)
app.use("/api", routeSource("publicRoutes.ts"), publicRoutes);
app.use("/api/public", routeSource("publicRoutes.ts"), publicRoutes);
app.use("/api/public", tenantHistorySharePublicRouter);
app.use("/api/public", routeSource("publicApplicationLinksRoutes.ts"), publicApplicationLinksRoutes);
app.use("/api/auth", routeSource("authRoutes.ts"), authRoutes);
app.use("/api/capabilities", routeSource("capabilitiesRoutes.ts"), capabilitiesRoutes);

// Auth decode (non-blocking if header missing)
app.use(authenticateJwt);

// Current user info
app.get("/api/me", async (req: any, res) => {
  res.setHeader("x-route-source", "app.build.ts:/api/me");
  const hasAuthHeader = Boolean(req.get("authorization"));
  if (!hasAuthHeader) {
    return res.json({ ok: true, user: null });
  }
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  let user = req.user;
  try {
    const landlordId = user.landlordId || (user.role === "landlord" ? user.id : null);
    if (landlordId) {
      const snap = await db.collection("landlords").doc(String(landlordId)).get();
      if (snap.exists) {
        const data = snap.data() as any;
        if (data?.plan) {
          user = { ...user, plan: data.plan };
        }
      }
    }
  } catch {
    // ignore lookup errors
  }
  return res.json({ ok: true, user });
});

// Ledger V2 (after auth decode)
app.use("/api/ledger-v2", routeSource("ledgerV2Routes.ts"), ledgerV2Routes);
app.use("/api/tenant-history", tenantHistoryShareRoutes);
app.use("/api", tenantSignalsRoutes);
app.use("/api/reporting", reportingRoutes);
app.use("/api", compatRoutes);
app.use("/api", routeSource("unitsRoutes.ts"), unitsRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/dashboard", routeSource("dashboardRoutes.ts"), dashboardRoutes);
app.use("/api/application-links", routeSource("landlordApplicationLinksRoutes.ts"), landlordApplicationLinksRoutes);
app.use(
  "/api/landlord/application-links",
  routeSource("landlordApplicationLinksRoutes.ts"),
  landlordApplicationLinksRoutes
);
app.use("/api/tenant-invites", tenantInvitesRoutes);
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
app.use("/api/tenant-report", routeSource("tenantReportRoutes.ts"), tenantReportRoutes);
app.use("/api/tenant-report-pdf", routeSource("tenantReportPdfRoutes.ts"), tenantReportPdfRoutes);
app.use("/api", applicationsRoutes);
app.use("/api/applications", routeSource("applicationsConversionRoutes.ts"), applicationsConversionRoutes);
app.use("/api/impersonation", routeSource("impersonationRoutes.ts"), impersonationRoutes);
app.use("/api/properties/:propertyId/units", routeSource("unitImportRoutes.ts"), unitImportRoutes);
app.use("/api/action-requests", routeSource("actionRequestsRoutes.ts"), actionRequestsRoutes);
app.use("/api/action-requests", routeSource("actionRequestsRecomputeRoutes.ts"), actionRequestsRecomputeRoutes);
app.use("/api", authzRoutes);
app.use("/api", reportsExportRoutes);
app.use("/api/admin", routeSource("adminRoutes.ts"), adminRoutes);
app.use("/api/admin", routeSource("adminBootstrapRoutes"), adminBootstrapRoutes);
app.use("/api/admin", routeSource("screeningJobsAdminRoutes.ts"), screeningJobsAdminRoutes);
app.use("/api/admin", routeSource("adminPropertiesRoutes.ts"), adminPropertiesRoutes);
app.use("/api/admin", routeSource("adminScreeningResultsRoutes.ts"), adminScreeningResultsRoutes);
app.use("/api/admin/demo", routeSource("adminDemoRoutes.ts"), adminDemoRoutes);
app.use("/api", stubsRoutes);
app.use("/api", routeSource("screeningReportRoutes.ts"), screeningReportRoutes);

// Core APIs
app.use("/api/leases", leaseRoutes);
app.use("/api", tenantOnboardRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/landlord", landlordMicroLiveRoutes);
app.get("/api/__probe/tenants-mount", (_req, res) =>
  res.json({ ok: true, probe: "tenants-mount", ts: Date.now() })
);
app.get("/api/__probe/version", (_req, res) =>
  res.json({ ok: true, ts: Date.now(), marker: "probe-v1" })
);
app.use("/api/tenants", routeSource("tenantsRoutes.ts"), tenantsRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api", routeSource("messagesRoutes.ts"), messagesRoutes);
console.log(
  "[routes] /api/properties, /api/properties/:propertyId/units, /api/action-requests, /api/applications"
);
app.post("/api/_echo", (req, res) => {
  res.setHeader("x-route-source", "app.build.ts:/api/_echo");
  return res.json({ ok: true, method: "POST", body: req.body ?? null });
});

app.get("/api/__probe/routes", (_req, res) => {
  const appAny: any = app;
  const stack = appAny?._router?.stack || [];
  const mounts = stack
    .filter((l: any) => l && l.name === "router" && l.regexp)
    .map((l: any) => String(l.regexp));
  const routes = stack
    .filter((l: any) => l && l.route && l.route.path)
    .map((l: any) => ({
      path: l.route.path,
      methods: l.route.methods,
    }));

  res.json({
    ok: true,
    mountsCount: mounts.length,
    mounts,
    routesCount: routes.length,
    routes,
    hasTenantsMount: mounts.some((s: string) => s.includes("tenants")),
  });
});

// Build stamp
app.get("/api/_build", (_req, res) => {
  res.setHeader("x-route-source", "app.build.ts:/api/_build");
  return res.json({
    ok: true,
    service: process.env.K_SERVICE || null,
    revision: process.env.K_REVISION || null,
    time: new Date().toISOString(),
  });
});

// Echo for POST reachability
app.post("/api/_echo", (req, res) => {
  res.setHeader("x-route-source", "app.build.ts:/api/_echo");
  return res.json({
    ok: true,
    method: req.method,
    path: req.path,
    body: req.body ?? null,
  });
});

app.get("/api/__debug/build", (_req, res) => {
  res.setHeader("x-route-source", "app.build.ts:/api/__debug/build");
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

// JSON 404 + error
app.use(notFoundHandler);
app.use(errorHandler);
