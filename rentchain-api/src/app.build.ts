import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authenticateJwt } from "./middleware/authMiddleware";
import { routeSource } from "./middleware/routeSource";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler";
import { corsOptions } from "./lib/cors";
import { getPricingHealth } from "./config/planMatrix";
import { resolveCanonicalPlan } from "./services/entitlements/planCapabilities";

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
import landlordActivationRoutes from "./routes/landlordActivationRoutes";
import capabilitiesRoutes from "./routes/capabilitiesRoutes";
import tenantHistoryShareRoutes, {
  publicRouter as tenantHistorySharePublicRouter,
} from "./routes/tenantHistoryShareRoutes";
import propertiesRoutes from "./routes/propertiesRoutes";
import accountRoutes from "./routes/accountRoutes";
import onboardingRoutes from "./routes/onboardingRoutes";
import referralsRoutes from "./routes/referralsRoutes";
import billingRoutes from "./routes/billingRoutes";
import tenantSignalsRoutes from "./routes/tenantSignalsRoutes";
import reportingRoutes from "./routes/reportingRoutes";
import tenantInvitesRoutes from "./routes/tenantInvitesRoutes";
import tenantPortalRoutes from "./routes/tenantPortalRoutes";
import tenantInviteAliasesRoutes from "./routes/tenantInviteAliasesRoutes";
import landlordInvitesAdminRoutes from "./routes/landlordInvitesAdminRoutes";
import landlordInvitesPublicRoutes from "./routes/landlordInvitesPublicRoutes";
import {
  publicRouter as landlordInquiryPublicRoutes,
  adminRouter as landlordInquiryAdminRoutes,
} from "./routes/landlordInquiryRoutes";
import tenantEventsRoutes from "./routes/tenantEventsRoutes";
import tenantEventsWriteRoutes from "./routes/tenantEventsWriteRoutes";
import ledgerAttachmentsRoutes from "./routes/ledgerAttachmentsRoutes";
import tenantNoticesRoutes from "./routes/tenantNoticesRoutes";
import maintenanceRequestsRoutes from "./routes/maintenanceRequestsRoutes";
import leaseNoticeLandlordRoutes from "./routes/leaseNoticeLandlordRoutes";
import tenantLeaseNoticeRoutes from "./routes/tenantLeaseNoticeRoutes";
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
import adminTenantsRoutes from "./routes/adminTenantsRoutes";
import adminLeasesRoutes from "./routes/adminLeasesRoutes";
import adminOverviewRoutes from "./routes/adminOverviewRoutes";
import adminIntegrityRoutes from "./routes/adminIntegrityRoutes";
import adminSavedFiltersRoutes from "./routes/adminSavedFiltersRoutes";
import adminAuditRoutes from "./routes/adminAuditRoutes";
import ledgerRoutes from "./routes/ledgerRoutes";
import landlordApplicationLinksRoutes from "./routes/landlordApplicationLinksRoutes";
import publicApplicationLinksRoutes from "./routes/publicApplicationLinksRoutes";
import tenantsRoutes from "./routes/tenantsRoutes";
import tenanciesRoutes from "./routes/tenanciesRoutes";
import messagesRoutes from "./routes/messagesRoutes";
import rentalApplicationsRoutes from "./routes/rentalApplicationsRoutes";
import verifiedScreeningRoutes from "./routes/verifiedScreeningRoutes";
import stripeScreeningOrdersWebhookRoutes, {
  stripeWebhookHandler,
} from "./routes/stripeScreeningOrdersWebhookRoutes";
import { transunionWebhookHandler } from "./routes/transunionWebhookRoutes";
import { requireAuth } from "./middleware/requireAuth";
import screeningJobsAdminRoutes from "./routes/screeningJobsAdminRoutes";
import adminRoutes from "./routes/adminRoutes";
import adminRegistryRoutes from "./routes/adminRegistryRoutes";
import adminScreeningResultsRoutes from "./routes/adminScreeningResultsRoutes";
import adminScreeningUsageRoutes from "./routes/adminScreeningUsageRoutes";
import screeningReportRoutes from "./routes/screeningReportRoutes";
import telemetryRoutes from "./routes/telemetryRoutes";
import invitesRoutes from "./routes/invitesRoutes";
import accessRoutes from "./routes/accessRoutes";
import complianceRoutes from "./routes/complianceRoutes";
import internalReportsRoutes from "./routes/internalReportsRoutes";
import identityOracleInternalRoutes from "./routes/identityOracleInternalRoutes";
import applicationReminderInternalRoutes from "./routes/applicationReminderInternalRoutes";
import statusRoutes from "./routes/statusRoutes";
import expensesRoutes from "./routes/expensesRoutes";
import financialTransactionsRoutes from "./routes/financialTransactionsRoutes";
import workOrdersRoutes from "./routes/workOrdersRoutes";
import timelineRoutes from "./routes/timelineRoutes";
import insightRoutes from "./routes/insightRoutes";
import screeningReconciliationRoutes from "./routes/screeningReconciliationRoutes";
import supportConsoleRoutes from "./routes/supportConsoleRoutes";
import adminTriageRoutes from "./routes/adminTriageRoutes";
import adminResolutionRoutes from "./routes/adminResolutionRoutes";
import adminSlaRoutes from "./routes/adminSlaRoutes";
import adminAlertingRoutes from "./routes/adminAlertingRoutes";
import adminAssignmentRoutes from "./routes/adminAssignmentRoutes";
import adminNotificationRoutes from "./routes/adminNotificationRoutes";
import adminObservabilityRoutes from "./routes/adminObservabilityRoutes";
import portfolioScoreRoutes from "./routes/portfolioScoreRoutes";
import portfolioScoreHistoryRoutes from "./routes/portfolioScoreHistoryRoutes";
import landlordPortfolioHealthRoutes from "./routes/landlordPortfolioHealthRoutes";
import landlordAnalyticsRoutes from "./routes/landlordAnalyticsRoutes";
import landlordAnalyticsAlertsRoutes from "./routes/landlordAnalyticsAlertsRoutes";
import landlordAnalyticsBenchmarkingRoutes from "./routes/landlordAnalyticsBenchmarkingRoutes";
import landlordPortfolioScoreRoutes from "./routes/landlordPortfolioScoreRoutes";
import landlordPortfolioScoreSharingRoutes from "./routes/landlordPortfolioScoreSharingRoutes";
import landlordDecisionInboxRoutes from "./routes/landlordDecisionInboxRoutes";
import landlordInstitutionExportsRoutes from "./routes/landlordInstitutionExportsRoutes";
import landlordAuditComplianceRoutes from "./routes/landlordAuditComplianceRoutes";
import landlordOperatorReviewRoutes from "./routes/landlordOperatorReviewRoutes";
import landlordEvidencePackRoutes from "./routes/landlordEvidencePackRoutes";
import landlordReviewTimelineRoutes from "./routes/landlordReviewTimelineRoutes";
import landlordIdentityLayerRoutes from "./routes/landlordIdentityLayerRoutes";
import landlordSharingRoomRoutes from "./routes/landlordSharingRoomRoutes";
import landlordRentalHistoryLedgerRoutes from "./routes/landlordRentalHistoryLedgerRoutes";
import publicPortfolioScoreRoutes from "./routes/publicPortfolioScoreRoutes";
import publicTenantShareRoutes from "./routes/publicTenantShareRoutes";
import landlordActionRecommendationRoutes from "./routes/landlordActionRecommendationRoutes";
import tenantFeedbackRoutes from "./routes/tenantFeedbackRoutes";
import marketplaceContractorRoutes from "./routes/marketplaceContractorRoutes";
import transunionRoutes from "./services/integrations/transunion/transunionRoutes";
import viewingRoutes from "./routes/viewingRoutes";
import screeningOpsRoutes from "./routes/screeningOpsRoutes";
import leaseOverlapCleanupRoutes from "./routes/leaseOverlapCleanupRoutes";
import riskAgentRoutes from "./routes/riskAgentRoutes";
import decisionRoutes from "./routes/decisionRoutes";

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] unhandledRejection", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[FATAL] uncaughtException", err);
});

export const app = express();

const pricingHealth = getPricingHealth();
if (!pricingHealth.ok) {
  console.warn("[boot] pricing env missing/invalid", {
    missing: pricingHealth.missing,
    invalid: pricingHealth.invalid,
    env: pricingHealth.env,
  });
}
app.set("etag", false);
app.set("trust proxy", 1);

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.post(
  "/api/webhooks/stripe",
  express.raw({ type: "application/json" }),
  routeSource("stripeScreeningOrdersWebhookRoutes.ts"),
  stripeWebhookHandler
);
app.post(
  "/api/stripe/webhook",
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
app.get("/api/__routes", (_req, res) => {
  res.setHeader("x-route-source", "app.build.ts:/api/__routes");
  return res.json({
    ok: true,
    runtime: "app.build.ts",
    mounted: ["/api/auth", "/api/access", "/api/invites"],
  });
});

// Billing routes
app.use("/api/billing", routeSource("billingRoutes.ts"), billingRoutes);
console.log("[boot] mounted billingRoutes at /api/billing");
app.use("/api", routeSource("paymentsRoutes.ts"), paymentsRoutes);

// Public + Auth (MUST be before authenticateJwt)
app.use("/api", routeSource("publicRoutes.ts"), publicRoutes);
app.use("/api/public", routeSource("publicRoutes.ts"), publicRoutes);
app.use("/api", routeSource("publicPortfolioScoreRoutes.ts"), publicPortfolioScoreRoutes);
app.use("/api/public", routeSource("publicTenantShareRoutes.ts"), publicTenantShareRoutes);
app.use("/api/public", routeSource("landlordInvitesPublicRoutes.ts"), landlordInvitesPublicRoutes);
app.use("/api/public", routeSource("landlordInquiryRoutes.ts"), landlordInquiryPublicRoutes);
app.use("/api/public", tenantHistorySharePublicRouter);
app.use("/api/public", routeSource("publicApplicationLinksRoutes.ts"), publicApplicationLinksRoutes);
app.use("/api", routeSource("viewingRoutes.ts"), viewingRoutes);
app.use("/api/auth", routeSource("authRoutes.ts"), authRoutes);
app.use("/api/invites", routeSource("invitesRoutes.ts"), invitesRoutes);
app.use("/api/access", routeSource("accessRoutes.ts"), accessRoutes);
app.use("/api/capabilities", routeSource("capabilitiesRoutes.ts"), capabilitiesRoutes);
app.use("/api/internal", routeSource("internalReportsRoutes.ts"), internalReportsRoutes);
app.use("/api/internal", routeSource("identityOracleInternalRoutes.ts"), identityOracleInternalRoutes);
app.use("/api/internal", routeSource("applicationReminderInternalRoutes.ts"), applicationReminderInternalRoutes);
app.use("/api/status", routeSource("statusRoutes.ts"), statusRoutes);

// Auth decode (non-blocking if header missing)
app.use(authenticateJwt);
app.use("/api/events", routeSource("eventsRoutes.ts"), eventsRoutes);
app.use("/api", routeSource("expensesRoutes.ts"), expensesRoutes);
console.log("[route-mount] expensesRoutes mounted at /api");
app.use("/api", routeSource("financialTransactionsRoutes.ts"), financialTransactionsRoutes);
console.log("[route-mount] financialTransactionsRoutes mounted at /api");
app.use("/api", routeSource("workOrdersRoutes.ts"), workOrdersRoutes);
console.log("[route-mount] workOrdersRoutes mounted at /api");
app.use("/api", routeSource("timelineRoutes.ts"), timelineRoutes);
console.log("[route-mount] timelineRoutes mounted at /api");
app.use("/api", routeSource("insightRoutes.ts"), insightRoutes);
console.log("[route-mount] insightRoutes mounted at /api");
app.use("/api", routeSource("screeningReconciliationRoutes.ts"), screeningReconciliationRoutes);
console.log("[route-mount] screeningReconciliationRoutes mounted at /api");
app.use("/api/admin", routeSource("supportConsoleRoutes.ts"), supportConsoleRoutes);
console.log("[route-mount] supportConsoleRoutes mounted at /api/admin");
app.use("/api/admin", routeSource("adminTriageRoutes.ts"), adminTriageRoutes);
console.log("[route-mount] adminTriageRoutes mounted at /api/admin");
app.use("/api/admin", routeSource("adminResolutionRoutes.ts"), adminResolutionRoutes);
console.log("[route-mount] adminResolutionRoutes mounted at /api/admin");
app.use("/api/admin", routeSource("adminSlaRoutes.ts"), adminSlaRoutes);
console.log("[route-mount] adminSlaRoutes mounted at /api/admin");
app.use("/api/admin", routeSource("adminAlertingRoutes.ts"), adminAlertingRoutes);
console.log("[route-mount] adminAlertingRoutes mounted at /api/admin");
app.use("/api/admin", routeSource("adminAssignmentRoutes.ts"), adminAssignmentRoutes);
console.log("[route-mount] adminAssignmentRoutes mounted at /api/admin");
app.use("/api/admin", routeSource("adminNotificationRoutes.ts"), adminNotificationRoutes);
console.log("[route-mount] adminNotificationRoutes mounted at /api/admin");
app.use("/api/admin", routeSource("adminObservabilityRoutes.ts"), adminObservabilityRoutes);
console.log("[route-mount] adminObservabilityRoutes mounted at /api/admin");
app.use("/api/admin", routeSource("portfolioScoreRoutes.ts"), portfolioScoreRoutes);
console.log("[route-mount] portfolioScoreRoutes mounted at /api/admin");
app.use("/api/admin", routeSource("portfolioScoreHistoryRoutes.ts"), portfolioScoreHistoryRoutes);
console.log("[route-mount] portfolioScoreHistoryRoutes mounted at /api/admin");
app.use("/api", routeSource("landlordPortfolioHealthRoutes.ts"), landlordPortfolioHealthRoutes);
console.log("[route-mount] landlordPortfolioHealthRoutes mounted at /api");
app.use("/api", routeSource("landlordAnalyticsRoutes.ts"), landlordAnalyticsRoutes);
console.log("[route-mount] landlordAnalyticsRoutes mounted at /api");
app.use("/api", routeSource("landlordAnalyticsAlertsRoutes.ts"), landlordAnalyticsAlertsRoutes);
console.log("[route-mount] landlordAnalyticsAlertsRoutes mounted at /api");
app.use("/api", routeSource("landlordAnalyticsBenchmarkingRoutes.ts"), landlordAnalyticsBenchmarkingRoutes);
console.log("[route-mount] landlordAnalyticsBenchmarkingRoutes mounted at /api");
app.use("/api", routeSource("landlordPortfolioScoreRoutes.ts"), landlordPortfolioScoreRoutes);
console.log("[route-mount] landlordPortfolioScoreRoutes mounted at /api");
app.use("/api", routeSource("landlordPortfolioScoreSharingRoutes.ts"), landlordPortfolioScoreSharingRoutes);
console.log("[route-mount] landlordPortfolioScoreSharingRoutes mounted at /api");
app.use("/api/landlord", routeSource("landlordDecisionInboxRoutes.ts"), landlordDecisionInboxRoutes);
console.log("[route-mount] landlordDecisionInboxRoutes mounted at /api/landlord");
app.use("/api/landlord", routeSource("landlordInstitutionExportsRoutes.ts"), landlordInstitutionExportsRoutes);
console.log("[route-mount] landlordInstitutionExportsRoutes mounted at /api/landlord");
app.use("/api/landlord", routeSource("landlordAuditComplianceRoutes.ts"), landlordAuditComplianceRoutes);
console.log("[route-mount] landlordAuditComplianceRoutes mounted at /api/landlord");
app.use("/api/landlord", routeSource("landlordOperatorReviewRoutes.ts"), landlordOperatorReviewRoutes);
console.log("[route-mount] landlordOperatorReviewRoutes mounted at /api/landlord");
app.use("/api/landlord", routeSource("landlordEvidencePackRoutes.ts"), landlordEvidencePackRoutes);
console.log("[route-mount] landlordEvidencePackRoutes mounted at /api/landlord");
app.use("/api/landlord", routeSource("landlordReviewTimelineRoutes.ts"), landlordReviewTimelineRoutes);
console.log("[route-mount] landlordReviewTimelineRoutes mounted at /api/landlord");
app.use("/api/landlord", routeSource("landlordIdentityLayerRoutes.ts"), landlordIdentityLayerRoutes);
console.log("[route-mount] landlordIdentityLayerRoutes mounted at /api/landlord");
app.use("/api/landlord", routeSource("landlordSharingRoomRoutes.ts"), landlordSharingRoomRoutes);
console.log("[route-mount] landlordSharingRoomRoutes mounted at /api/landlord");
app.use("/api/landlord", routeSource("landlordRentalHistoryLedgerRoutes.ts"), landlordRentalHistoryLedgerRoutes);
console.log("[route-mount] landlordRentalHistoryLedgerRoutes mounted at /api/landlord");
app.use("/api", routeSource("landlordActionRecommendationRoutes.ts"), landlordActionRecommendationRoutes);
console.log("[route-mount] landlordActionRecommendationRoutes mounted at /api");
app.use("/api", routeSource("tenantFeedbackRoutes.ts"), tenantFeedbackRoutes);
console.log("[route-mount] tenantFeedbackRoutes mounted at /api");
app.use("/api", routeSource("marketplaceContractorRoutes.ts"), marketplaceContractorRoutes);
console.log("[route-mount] marketplaceContractorRoutes mounted at /api");

// Current user info
app.get("/api/me", async (req: any, res: any, next: any) => {
  res.setHeader("x-route-source", "app.build.ts:/api/me");
  if (!req.get("authorization")) {
    return res.status(401).json({ ok: false, error: "unauthenticated" });
  }
  return requireAuth(req, res, next);
}, (req: any, res: any) => {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "unauthenticated" });
  }
  const user =
    req.user && typeof req.user === "object"
      ? {
          ...req.user,
          ...(req.user.plan != null ? { plan: resolveCanonicalPlan(req.user.plan) } : {}),
        }
      : req.user;
  return res.json({ ok: true, user });
});

// Core prefixed APIs must mount before broad /api routers.
app.use("/api/compliance", routeSource("complianceRoutes.ts"), complianceRoutes);
app.use("/api/decisions", routeSource("decisionRoutes.ts"), decisionRoutes);
app.use("/api/leases", routeSource("leaseRoutes.ts"), leaseRoutes);
app.use("/api/tenants", routeSource("tenantsRoutes.ts"), tenantsRoutes);
app.use("/api", routeSource("tenanciesRoutes.ts"), tenanciesRoutes);

// Ledger V2 (after auth decode)
app.use("/api/ledger-v2", routeSource("ledgerV2Routes.ts"), ledgerV2Routes);
app.use("/api/tenant-history", tenantHistoryShareRoutes);
app.use("/api", tenantSignalsRoutes);
app.use("/api/reporting", reportingRoutes);
app.use("/api", compatRoutes);
app.use("/api", routeSource("unitsRoutes.ts"), unitsRoutes);
app.use("/api/ledger", ledgerRoutes);
app.use("/api/dashboard", routeSource("dashboardRoutes.ts"), dashboardRoutes);
app.use("/api/landlord", routeSource("landlordActivationRoutes.ts"), landlordActivationRoutes);
app.use("/api/application-links", routeSource("landlordApplicationLinksRoutes.ts"), landlordApplicationLinksRoutes);
app.use("/api", routeSource("referralsRoutes.ts"), referralsRoutes);
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
app.use("/api/landlord/leases", routeSource("leaseNoticeLandlordRoutes.ts"), leaseNoticeLandlordRoutes);
app.use("/api/tenant/lease-notices", routeSource("tenantLeaseNoticeRoutes.ts"), tenantLeaseNoticeRoutes);
app.use("/api", routeSource("maintenanceRequestsRoutes"), maintenanceRequestsRoutes);
app.use("/api", routeSource("usageBreakdownRoutes.ts"), usageBreakdownRoutes);
app.use("/api/properties", propertiesRoutes);
app.use("/api/integrations", routeSource("transunionRoutes.ts"), transunionRoutes);
app.use("/api", routeSource("screeningOpsRoutes.ts"), screeningOpsRoutes);
app.use("/api", routeSource("riskAgentRoutes.ts"), riskAgentRoutes);
app.use("/api", routeSource("leaseOverlapCleanupRoutes.ts"), leaseOverlapCleanupRoutes);
app.use("/api", routeSource("rentalApplicationsRoutes.ts"), rentalApplicationsRoutes);
if (process.env.NODE_ENV !== "production") {
  console.log("[boot] mounted rentalApplicationsRoutes at /api (review-summary endpoints enabled)");
}
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
app.use("/api/admin", routeSource("adminRegistryRoutes.ts"), adminRegistryRoutes);
app.use("/api/admin", routeSource("landlordInvitesAdminRoutes.ts"), landlordInvitesAdminRoutes);
app.use("/api/admin", routeSource("landlordInquiryRoutes.ts"), landlordInquiryAdminRoutes);
app.use("/api/admin", routeSource("adminBootstrapRoutes"), adminBootstrapRoutes);
app.use("/api", routeSource("screeningJobsAdminRoutes.ts"), screeningJobsAdminRoutes);
app.use("/api/admin", routeSource("adminPropertiesRoutes.ts"), adminPropertiesRoutes);
app.use("/api/admin", routeSource("adminTenantsRoutes.ts"), adminTenantsRoutes);
app.use("/api/admin", routeSource("adminLeasesRoutes.ts"), adminLeasesRoutes);
app.use("/api/admin", routeSource("adminOverviewRoutes.ts"), adminOverviewRoutes);
app.use("/api/admin", routeSource("adminIntegrityRoutes.ts"), adminIntegrityRoutes);
app.use("/api/admin", routeSource("adminSavedFiltersRoutes.ts"), adminSavedFiltersRoutes);
app.use("/api/admin", routeSource("adminAuditRoutes.ts"), adminAuditRoutes);
app.use("/api/admin", routeSource("adminScreeningResultsRoutes.ts"), adminScreeningResultsRoutes);
app.use("/api/admin", routeSource("adminScreeningUsageRoutes.ts"), adminScreeningUsageRoutes);
app.use("/api/admin/demo", routeSource("adminDemoRoutes.ts"), adminDemoRoutes);
app.use("/api", stubsRoutes);
app.use("/api", routeSource("screeningReportRoutes.ts"), screeningReportRoutes);

// Core APIs
app.use("/api", tenantOnboardRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/landlord", landlordMicroLiveRoutes);
app.get("/api/__probe/tenants-mount", (_req, res) =>
  res.json({ ok: true, probe: "tenants-mount", ts: Date.now() })
);
app.get("/api/__probe/version", (_req, res) =>
  res.json({ ok: true, ts: Date.now(), marker: "probe-v1" })
);
app.get("/api/__probe/revision", (_req, res) => {
  res.setHeader("x-route-source", "app.build.ts:/api/__probe/revision");
  return res.json({
    ok: true,
    service: "rentchain-landlord-api",
    revision: process.env.K_REVISION || null,
    commit: process.env.GIT_SHA || process.env.COMMIT_SHA || null,
    ts: Date.now(),
  });
});
app.use("/api/account", accountRoutes);
app.use("/api/onboarding", routeSource("onboardingRoutes.ts"), onboardingRoutes);
app.use("/api", routeSource("onboardingRoutes.ts"), onboardingRoutes);
app.use("/api", routeSource("messagesRoutes.ts"), messagesRoutes);
app.use("/api", routeSource("telemetryRoutes.ts"), telemetryRoutes);
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
