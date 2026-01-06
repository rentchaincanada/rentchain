import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authenticateJwt } from "./middleware/authMiddleware";
import { routeSource } from "./middleware/routeSource";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";

import publicRoutes from "./routes/publicRoutes";
import authRoutes from "./routes/authRoutes";

import tenantDetailsRoutes from "./routes/tenantDetailsRoutes";
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

export const app = express();
app.set("etag", false);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Redirect accidental double /api/api/... to /api/...
app.use("/api/api", (req, res) => {
  const fixed = "/api" + req.url;
  return res.redirect(307, fixed);
});

// Health
app.use("/health", healthRoutes);

// Public + Auth (MUST be before authenticateJwt)
app.use("/api", routeSource("publicRoutes.ts"), publicRoutes);
app.use("/api/public", routeSource("publicRoutes.ts"), publicRoutes);
app.use("/api/public", tenantHistorySharePublicRouter);
app.use("/api/auth", routeSource("authRoutes.ts"), authRoutes);
app.use("/api/capabilities", routeSource("capabilitiesRoutes.ts"), capabilitiesRoutes);

// Auth decode (non-blocking if header missing)
app.use(authenticateJwt);

// Current user info
app.get("/api/me", (req: any, res) => {
  res.setHeader("x-route-source", "app.build.ts:/api/me");
  const hasAuthHeader = Boolean(req.get("authorization"));
  if (!hasAuthHeader) {
    return res.json({ ok: true, user: null });
  }
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  return res.json({ ok: true, user: req.user });
});

// Ledger V2 (after auth decode)
app.use("/api/ledger-v2", routeSource("ledgerV2Routes.ts"), ledgerV2Routes);
app.use("/api/tenant-history", tenantHistoryShareRoutes);
app.use("/api", tenantSignalsRoutes);
app.use("/api/reporting", reportingRoutes);
app.use("/api/tenant-invites", tenantInvitesRoutes);
app.use("/api/tenant", tenantPortalRoutes);
app.use("/api", routeSource("tenantInviteAliasesRoutes"), tenantInviteAliasesRoutes);
app.use("/api", routeSource("tenantEventsRoutes"), tenantEventsRoutes);
app.use("/api", routeSource("tenantEventsWriteRoutes"), tenantEventsWriteRoutes);
app.use("/api", routeSource("usageBreakdownRoutes.ts"), usageBreakdownRoutes);
app.use("/api", routeSource("tenantReportRoutes.ts"), tenantReportRoutes);
app.use("/api", routeSource("tenantReportPdfRoutes.ts"), tenantReportPdfRoutes);
app.use("/api", applicationsRoutes);
app.use("/api/applications", routeSource("applicationsConversionRoutes.ts"), applicationsConversionRoutes);
app.use("/api/impersonation", routeSource("impersonationRoutes.ts"), impersonationRoutes);
app.use("/api/properties/:propertyId/units", routeSource("unitImportRoutes.ts"), unitImportRoutes);
app.use("/api/action-requests", routeSource("actionRequestsRoutes.ts"), actionRequestsRoutes);
app.use("/api/action-requests", routeSource("actionRequestsRecomputeRoutes.ts"), actionRequestsRecomputeRoutes);
app.use("/api/admin/demo", routeSource("adminDemoRoutes.ts"), adminDemoRoutes);
app.use("/api", authzRoutes);
app.use("/api", reportsExportRoutes);
app.use("/api", stubsRoutes);
app.use("/api/admin", routeSource("adminBootstrapRoutes"), adminBootstrapRoutes);

// Core APIs
app.use("/api", tenantDetailsRoutes);
app.use("/api", paymentsRoutes);
app.use("/api/leases", leaseRoutes);
app.use("/api", tenantOnboardRoutes);
app.use("/api/events", eventsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/landlord", landlordMicroLiveRoutes);
app.use("/api/properties", propertiesRoutes);
app.use("/api/account", accountRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/billing", billingRoutes);
console.log(
  "[routes] /api/properties, /api/properties/:propertyId/units, /api/action-requests, /api/applications"
);
app.post("/api/_echo", (req, res) => {
  res.setHeader("x-route-source", "app.build.ts:/api/_echo");
  return res.json({ ok: true, method: "POST", body: req.body ?? null });
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

// JSON 404 + error
app.use(notFoundHandler);
app.use(errorHandler);
