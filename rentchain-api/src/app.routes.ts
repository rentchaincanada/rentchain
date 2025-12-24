import { Application } from "express";

import authRoutes from "./routes/authRoutes";
import accountRoutes from "./routes/accountRoutes";
import onboardingRoutes from "./routes/onboardingRoutes";
import eventsRoutes from "./routes/eventsRoutes";
import meRoutes from "./routes/meRoutes";
import healthRoutes from "./routes/healthRoutes";
import billingRoutes from "./routes/billingRoutes";
import providerStatusRoutes from "./routes/providerStatusRoutes";
import adminFeatureFlagsRoutes from "./routes/adminFeatureFlagsRoutes";
import upgradeIntentRoutes from "./routes/upgradeIntentRoutes";
import aiRoutes from "./routes/ai";
import { attachPlan } from "./entitlements/planResolver.middleware";
import { requireCapability } from "./entitlements/entitlements.middleware";
import stubPlatformRoutes from "./routes/stubPlatformRoutes";
import { authenticateJwt } from "./middleware/authMiddleware";
import propertiesRoutes from "./routes/propertiesRoutes";
import authMeRoutes from "./routes/authMeRoutes";
import { routeSource } from "./middleware/routeSource";
import unitImportRoutes from "./routes/unitImportRoutes";
import importJobsRoutes from "./routes/importJobsRoutes";
import importDownloadRoutes from "./routes/importDownloadRoutes";
import tenantPortalRoutes from "./routes/tenantPortalRoutes";
import landlordRentChargeRoutes from "./routes/landlordRentChargeRoutes";
import landlordCreditHistoryRoutes from "./routes/landlordCreditHistoryRoutes";
import landlordReportingRoutes from "./routes/landlordReportingRoutes";
import tenantReportingRoutes from "./routes/tenantReportingRoutes";
import adminReportingRoutes from "./routes/adminReportingRoutes";
import internalReportingRoutes from "./routes/internalReportingRoutes";
import landlordReportingShadowRoutes from "./routes/landlordReportingShadowRoutes";
import tenantAuthRoutes from "./routes/tenantAuthRoutes";
import devMintRoutes from "./routes/devMintRoutes";
import devDiagRoutes from "./routes/devDiagRoutes";
import adminDiagRoutes from "./routes/adminDiagRoutes";
import adminTenantToolsRoutes from "./routes/adminTenantToolsRoutes";
import adminConsentDiagRoutes from "./routes/adminConsentDiagRoutes";
import publicWaitlistRoutes from "./routes/publicWaitlistRoutes";
import publicInviteRoutes from "./routes/publicInviteRoutes";
import adminInviteWaveRoutes from "./routes/adminInviteWaveRoutes";
import adminMicroLiveRoutes from "./routes/adminMicroLiveRoutes";

export function mountSafeRoutes(app: Application) {
  // ensure auth is decoded and plan is resolved before hitting guarded routes
  app.use(authenticateJwt);
  app.use(attachPlan());

  // Prevent tenant-role tokens from calling landlord routes. Only allow /api/tenant (and health/auth me).
  app.use((req, res, next) => {
    const user: any = (req as any).user;
    const path = req.path || req.originalUrl || "";
    if (user?.role === "tenant") {
      if (path.startsWith("/api/tenant") || path.startsWith("/health") || path.startsWith("/api/auth/me")) {
        return next();
      }
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  });
  app.use("/api/auth", routeSource("authRoutes.ts"), authRoutes);
  app.use("/api/auth", routeSource("authMeRoutes.ts"), authMeRoutes);
  app.use("/api/account", routeSource("accountRoutes.ts"), accountRoutes);
  app.use("/api/onboarding", routeSource("onboardingRoutes.ts"), onboardingRoutes);
  app.use("/api/events", routeSource("eventsRoutes.ts"), eventsRoutes);
  app.use("/api/me", routeSource("meRoutes.ts"), meRoutes);
  app.use("/api/landlord/rent-charges", routeSource("landlordRentChargeRoutes.ts"), landlordRentChargeRoutes);
  app.use("/api/landlord", routeSource("landlordCreditHistoryRoutes.ts"), landlordCreditHistoryRoutes);
  app.use("/api/landlord", routeSource("landlordReportingRoutes.ts"), landlordReportingRoutes);
  app.use("/api/landlord", routeSource("landlordReportingShadowRoutes.ts"), landlordReportingShadowRoutes);
  app.use("/api/tenant/auth", routeSource("tenantAuthRoutes.ts"), tenantAuthRoutes);
  app.use("/api/tenant", routeSource("tenantPortalRoutes.ts"), tenantPortalRoutes);
  app.use("/api/tenant/reporting", routeSource("tenantReportingRoutes.ts"), tenantReportingRoutes);
  app.use("/api/admin", routeSource("adminReportingRoutes.ts"), adminReportingRoutes);
  app.use("/api/admin/tenants", routeSource("adminTenantToolsRoutes.ts"), adminTenantToolsRoutes);
  app.use("/api/admin/diag", routeSource("adminDiagRoutes.ts"), adminDiagRoutes);
  app.use("/api/admin/diag", routeSource("adminConsentDiagRoutes.ts"), adminConsentDiagRoutes);
  app.use("/api/admin", routeSource("adminInviteWaveRoutes.ts"), adminInviteWaveRoutes);
  app.use("/api/admin", routeSource("adminMicroLiveRoutes.ts"), adminMicroLiveRoutes);
  app.use("/api/internal/reporting", routeSource("internalReportingRoutes.ts"), internalReportingRoutes);
  app.use("/api/dev", routeSource("devMintRoutes.ts"), devMintRoutes);
  app.use("/api/dev", routeSource("devDiagRoutes.ts"), devDiagRoutes);
  app.use("/api/public", routeSource("publicWaitlistRoutes.ts"), publicWaitlistRoutes);
  app.use("/api/public", routeSource("publicInviteRoutes.ts"), publicInviteRoutes);
  app.use("/api/properties", routeSource("propertiesRoutes.ts"), propertiesRoutes);
  app.use(
    "/api/properties/:propertyId/units",
    routeSource("unitImportRoutes.ts"),
    unitImportRoutes
  );
  app.use("/api/import-jobs", routeSource("importJobsRoutes.ts"), importJobsRoutes);
  app.use("/api/import-jobs", routeSource("importDownloadRoutes.ts"), importDownloadRoutes);
  app.use("/health", routeSource("healthRoutes.ts"), healthRoutes);

  // safe “platform” routes
  app.use("/api/providers", routeSource("providerStatusRoutes.ts"), providerStatusRoutes);
  app.use("/api/admin", routeSource("adminFeatureFlagsRoutes.ts"), adminFeatureFlagsRoutes);
  app.use("/api/billing", routeSource("billingRoutes.ts"), billingRoutes);
  app.use(
    "/api/billing/upgrade-intent",
    routeSource("upgradeIntentRoutes.ts"),
    upgradeIntentRoutes
  );

  // mount stubs last to backfill missing endpoints only
  app.use("/api", routeSource("stubPlatformRoutes.ts"), stubPlatformRoutes);

  // minimal ai placeholder router
  app.use("/api/ai", routeSource("aiRoutes.ts"), requireCapability("ai.insights"), aiRoutes);
}
