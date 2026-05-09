// src/App.tsx
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";

import DashboardPage from "./pages/DashboardPage";
import PropertiesPage from "./pages/PropertiesPage";
import { TenantsPage } from "./pages/TenantsPage";
import PaymentsPage from "./pages/PaymentsPage";
import ApplicationsPage from "./pages/ApplicationsPage";
import ApplicantApplyPage from "./pages/ApplicantApplyPage";
import CosignPage from "./pages/CosignPage";
import PricingPage from "./pages/PricingPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import AuthActionPage from "./pages/AuthActionPage";
import AuthOnboardPage from "./pages/AuthOnboardPage";
import TenantLoginPageV2 from "./pages/tenant/TenantLoginPage.v2";
import InviteRedeemPage from "./pages/InviteRedeemPage";
import NotFoundPage from "./pages/NotFoundPage";
import { TwoFactorPage } from "./pages/TwoFactorPage";
import { AccountSecurityPage } from "./pages/AccountSecurityPage";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RequireAdmin } from "./components/auth/RequireAdmin";
import { RequireRole } from "./components/auth/RequireRole";
import { RequireTenant } from "./components/auth/RequireTenant";
import { useAuth } from "./context/useAuth";
import ScreeningStartPage from "./pages/screening/ScreeningStartPage";
import ScreeningSuccessPage from "./pages/screening/ScreeningSuccessPage";
import ScreeningCancelPage from "./pages/screening/ScreeningCancelPage";
import ScreeningReportPage from "./pages/screening/ScreeningReportPage";
import ManualScreeningPage from "./pages/screening/ManualScreeningPage";
import VerifyScreeningPage from "./pages/VerifyScreeningPage";
import BillingPage from "./pages/BillingPage";
import BillingCheckoutSuccessPage from "./pages/BillingCheckoutSuccessPage";
import { DebugPanel } from "./components/DebugPanel";
import MicroLiveInvitePage from "./pages/MicroLiveInvitePage";
import TenantInviteRedeem from "./tenant/TenantInviteRedeem";
import { LandlordNav } from "./components/layout/LandlordNav";
import TenantPortalComingSoon from "./pages/tenant/TenantPortalComingSoon";
import TenantLayout from "./pages/tenant/TenantLayout";
import { buildTenantApplicationEntryPath } from "./pages/tenant/tenantApplicationFlow";
import MonthlyOpsReportPageWithNudge from "./pages/reports/MonthlyOpsReportPageWithNudge";
import PublicApplyPage from "./pages/PublicApplyPage";
import TenantMessagesCenterPage from "./pages/tenant/TenantMessagesCenterPage";
import TenantNoticeDetailPage from "./pages/tenant/TenantNoticeDetailPage";
import TenantLeaseNoticesPage from "./pages/tenant/TenantLeaseNoticesPage";
import TenantLeaseNoticeDetailPage from "./pages/tenant/TenantLeaseNoticeDetailPage";
import PdfSamplePage from "./pages/PdfSamplePage";
import ContractorDashboardPage from "./pages/contractor/ContractorDashboardPage";
import ContractorJobsPage from "./pages/contractor/ContractorJobsPage";
import ContractorProfilePage from "./pages/contractor/ContractorProfilePage";
import { ContractorNav } from "./components/layout/ContractorNav";
import {
  getRoleDefaultDestination,
  resolveTenantPostAuthDestination,
  TENANT_DEFAULT_DESTINATION,
} from "./lib/authDestination";
import { getTenantToken } from "./lib/tenantAuth";

const TENANT_PORTAL_ENABLED = import.meta.env.VITE_TENANT_PORTAL_ENABLED === "true";

function lazyWithRetry<T extends React.ComponentType<any>>(
  importer: () => Promise<{ default: T }>,
  retries = 1
) {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await importer();
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      }
    }
    throw lastError;
  });
}

const LedgerPage = lazy(() => import("./pages/LedgerPage"));
const LedgerV2Page = lazy(() => import("./pages/LedgerV2Page"));
const BlockchainPage = lazy(() => import("./pages/BlockchainPage"));
const AdminScreeningsPage = lazy(() => import("./pages/AdminScreeningsPage"));
const AdminVerifiedScreeningsPage = lazy(() => import("./pages/AdminVerifiedScreeningsPage"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const ControlTowerPage = lazy(() => import("./pages/admin/ControlTowerPage"));
const AdminLeadsPage = lazyWithRetry(() => import("./pages/admin/AdminLeadsPage"));
const AdminLeaseOverlapCleanupPage = lazy(() => import("./pages/admin/AdminLeaseOverlapCleanupPage"));
const AdminPropertiesPage = lazy(() => import("./pages/admin/AdminPropertiesPage"));
const AdminRegistrySourcesPage = lazy(() => import("./pages/admin/AdminRegistrySourcesPage"));
const AdminRegistryImportsPage = lazy(() => import("./pages/admin/AdminRegistryImportsPage"));
const AdminRegistryReviewPage = lazy(() => import("./pages/admin/AdminRegistryReviewPage"));
const AdminRegistryRecordDetailPage = lazy(() => import("./pages/admin/AdminRegistryRecordDetailPage"));
const AdminRegistryPropertyReviewPage = lazy(() => import("./pages/admin/AdminRegistryPropertyReviewPage"));
const AdminTenantsPage = lazy(() => import("./pages/admin/AdminTenantsPage"));
const AdminLeasesPage = lazy(() => import("./pages/admin/AdminLeasesPage"));
const AdminIntegrityPage = lazy(() => import("./pages/admin/AdminIntegrityPage"));
const AdminAuditPage = lazy(() => import("./pages/admin/AdminAuditPage"));
const AdminTransUnionUsagePage = lazy(() => import("./pages/admin/AdminTransUnionUsagePage"));
const AutomationTimelinePage = lazy(
  () => import("./features/automation/timeline/AutomationTimelinePage")
);
const AutomationTimelineV1Page = lazy(() => import("./pages/admin/AutomationTimelineV1Page"));
const SupportDebugConsolePage = lazy(() => import("./pages/admin/SupportDebugConsolePage"));
const SecurityReliabilityConsolePage = lazy(() => import("./pages/admin/SecurityReliabilityConsolePage"));
const AdminTriageQueuePage = lazy(() => import("./pages/admin/AdminTriageQueuePage"));
const AdminLeaseLifecycleReviewPage = lazy(() => import("./pages/admin/AdminLeaseLifecycleReviewPage"));
const AdminAlertingPage = lazy(() => import("./pages/admin/AdminAlertingPage"));
const AdminObservabilityPage = lazy(() => import("./pages/admin/AdminObservabilityPage"));
const AdminNotificationsPage = lazy(() => import("./pages/admin/AdminNotificationsPage"));
const ObservabilityIncidentReadinessPage = lazy(() => import("./pages/ObservabilityIncidentReadinessPage"));
const ReleaseGovernancePage = lazy(() => import("./pages/ReleaseGovernancePage"));
const PublicExposureHardeningPage = lazy(() => import("./pages/PublicExposureHardeningPage"));
const CommercialReadinessPage = lazy(() => import("./pages/CommercialReadinessPage"));
const ControlledIntegrationsPage = lazy(() => import("./pages/ControlledIntegrationsPage"));
const ProductionIntegrationsPage = lazy(() => import("./pages/ProductionIntegrationsPage"));
const EnterpriseMunicipalReadinessPage = lazy(() => import("./pages/EnterpriseMunicipalReadinessPage"));
const EcosystemCoordinationPage = lazy(() => import("./pages/EcosystemCoordinationPage"));
const PlatformCredentialingReadinessPage = lazy(() => import("./pages/PlatformCredentialingReadinessPage"));
const ConsumerReportingGovernancePage = lazy(() => import("./pages/ConsumerReportingGovernancePage"));
const PortfolioScorePage = lazy(() => import("./pages/admin/PortfolioScorePage"));
const PortfolioScoreHistoryPage = lazy(() => import("./pages/admin/PortfolioScoreHistoryPage"));
const PortfolioHealthSummaryPage = lazy(() => import("./pages/landlord/PortfolioHealthSummaryPage"));
const LandlordAnalyticsPage = lazy(() => import("./pages/landlord/LandlordAnalyticsPage"));
const LandlordInboxPage = lazy(() => import("./pages/landlord/LandlordInboxPage"));
const DecisionInboxPage = lazy(() => import("./pages/DecisionInboxPage"));
const AgentSupervisionPage = lazy(() => import("./pages/AgentSupervisionPage"));
const InstitutionExportsPage = lazy(() => import("./pages/InstitutionExportsPage"));
const RecipientTrustReviewPage = lazy(() => import("./pages/RecipientTrustReviewPage"));
const AuditCompliancePage = lazy(() => import("./pages/AuditCompliancePage"));
const EvidencePackPage = lazy(() => import("./pages/EvidencePackPage"));
const ReviewTimelinePage = lazy(() => import("./pages/ReviewTimelinePage"));
const IdentityLayerPage = lazy(() => import("./pages/IdentityLayerPage"));
const InstitutionalSharingRoomPage = lazy(() => import("./pages/InstitutionalSharingRoomPage"));
const VerifiedRentalHistoryPage = lazy(() => import("./pages/VerifiedRentalHistoryPage"));
const RentalDebtPage = lazy(() => import("./pages/RentalDebtPage"));
const CourtDisputeLineagePage = lazy(() => import("./pages/CourtDisputeLineagePage"));
const OnboardingHardeningPage = lazy(() => import("./pages/OnboardingHardeningPage"));
const SupportOperationsPage = lazy(() => import("./pages/SupportOperationsPage"));
const PdfExportObservabilityPage = lazy(() => import("./pages/PdfExportObservabilityPage"));
const SettlementReadinessPage = lazy(() => import("./pages/SettlementReadinessPage"));
const RegulatoryProfilePage = lazy(() => import("./pages/RegulatoryProfilePage"));
const AssetTokenizationReadinessPage = lazy(() => import("./pages/AssetTokenizationReadinessPage"));
const NetworkParticipantsPage = lazy(() => import("./pages/NetworkParticipantsPage"));
const CrossOrganizationTrustPage = lazy(() => import("./pages/CrossOrganizationTrustPage"));
const InstitutionOnboardingReadinessPage = lazy(() => import("./pages/InstitutionOnboardingReadinessPage"));
const OperationalRiskPage = lazy(() => import("./pages/OperationalRiskPage"));
const InteroperabilityAdapterPage = lazy(() => import("./pages/InteroperabilityAdapterPage"));
const LandlordPortfolioScorePage = lazy(() => import("./pages/landlord/PortfolioScorePage"));
const SharedPortfolioScorePage = lazy(() => import("./pages/public/SharedPortfolioScorePage"));
const TenantSharePackagePage = lazy(() => import("./pages/public/TenantSharePackagePage"));
const ActionRecommendationsPage = lazy(() => import("./pages/landlord/ActionRecommendationsPage"));
const InvitesPage = lazy(() => import("./pages/landlord/InvitesPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const MaintenanceRequestsPage = lazy(() => import("./pages/MaintenanceRequestsPage"));
const LeaseLedgerPage = lazy(() => import("./pages/LeaseLedgerPage"));
const LandlordActiveLeasesPage = lazy(() => import("./pages/LandlordActiveLeasesPage"));
const LandlordLeaseSummaryPage = lazy(() => import("./pages/LandlordLeaseSummaryPage"));
const ApplicationReviewSummaryPage = lazy(() => import("./pages/ApplicationReviewSummaryPage"));
const ReferralsPage = lazy(() => import("./pages/ReferralsPage"));
const AccountPage = lazy(() => import("./pages/AccountPage"));
const AccountProfilePage = lazy(() => import("./pages/account/AccountProfilePage"));
const AccountDataPage = lazy(() => import("./pages/account/AccountDataPage"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const WorkOrdersPage = lazy(() => import("./pages/landlord/WorkOrdersPage"));
const WorkOrderNewPage = lazy(() => import("./pages/landlord/WorkOrderNewPage"));
const ContractorsPage = lazy(() => import("./pages/landlord/ContractorsPage"));
const LandingPage = lazy(() => import("./pages/marketing/LandingPage"));
const AboutPage = lazy(() => import("./pages/marketing/AboutPage"));
const MarketingPricingPage = lazy(() => import("./pages/marketing/PricingPage"));
const RequestAccessPage = lazy(() => import("./pages/marketing/RequestAccessPage"));
const ScreeningDemoPage = lazy(() => import("./pages/marketing/ScreeningDemoPage"));
const LegalHelpPage = lazy(() => import("./pages/marketing/LegalHelpPage"));
const HelpIndexPage = lazy(() => import("./pages/help/HelpIndexPage"));
const HelpLandlordsPage = lazy(() => import("./pages/help/HelpLandlordsPage"));
const HelpTenantsPage = lazy(() => import("./pages/help/HelpTenantsPage"));
const TemplatesPage = lazy(() => import("./pages/help/TemplatesPage"));
const PrivacyPage = lazy(() => import("./pages/legal/PrivacyPage"));
const TermsPage = lazy(() => import("./pages/legal/TermsPage"));
const AcceptableUsePage = lazy(() => import("./pages/legal/AcceptableUsePage"));
const TrustPage = lazy(() => import("./pages/trust/TrustPage"));
const SecurityPage = lazy(() => import("./pages/security/SecurityPage"));
const SubprocessorsPage = lazy(() => import("./pages/subprocessors/SubprocessorsPage"));
const AccessibilityPage = lazy(() => import("./pages/accessibility/AccessibilityPage"));
const StatusPage = lazy(() => import("./pages/status/StatusPage"));
const ContactPage = lazy(() => import("./pages/contact/ContactPage"));
const TenantLandingPage = lazy(() => import("./pages/tenant/TenantLandingPage"));
const TenantWorkspacePage = lazy(() => import("./pages/tenant/TenantWorkspacePage"));
const TenantApplicationStatusPage = lazy(() => import("./pages/tenant/TenantApplicationStatusPage"));
const TenantLeasePage = lazy(() => import("./pages/tenant/TenantLeasePage"));
const TenantLedgerPage = lazy(() => import("./pages/tenant/TenantLedgerPage"));
const TenantActivityPage = lazy(() => import("./pages/tenant/TenantActivityPage"));
const TenantParticipationPage = lazy(() => import("./pages/TenantParticipationPage"));
const TenantAttachmentsPage = lazy(() => import("./pages/tenant/TenantAttachmentsPage"));
const TenantNoticesCenterPage = lazy(() => import("./pages/tenant/TenantNoticesCenterPage"));
const TenantProfilePage = lazy(() => import("./pages/tenant/TenantProfilePage"));
const TenantAccessPage = lazy(() => import("./pages/tenant/TenantAccessPage"));
const TenantAccountPage = lazy(() => import("./pages/tenant/TenantAccountPage"));
const TenantScreeningInboxPage = lazy(() => import("./pages/tenant/TenantScreeningInboxPage"));
const TenantMagicRedeemPage = lazy(() => import("./pages/tenant/TenantMagicRedeemPage"));
const TenantInviteRedeemPage = lazy(() => import("./pages/tenant/TenantInviteRedeemPage"));
const TenantMaintenanceRequestDetailPage = lazy(() => import("./pages/tenant/TenantMaintenanceRequestDetailPage"));
const TenantMaintenanceRequestsPage = lazy(() => import("./pages/tenant/TenantMaintenanceRequestsPage"));
const TenantMaintenanceRequestNewPage = lazy(() => import("./pages/tenant/TenantMaintenanceRequestNewPage"));
const FeedbackSubmissionPage = lazy(() => import("./pages/tenant/FeedbackSubmissionPage"));

const AuthLoadingScreen = () => (
  <div
    style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily:
        "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', sans-serif",
      fontSize: "0.95rem",
      color: "#0f172a",
      background:
        "radial-gradient(circle at top left, rgba(37,99,235,0.08) 0, rgba(14,165,233,0.06) 45%, rgba(255,255,255,0.9) 100%)",
      padding: "24px",
    }}
  >
    <div
      style={{
        width: "min(420px, 90vw)",
        background: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(15,23,42,0.08)",
        borderRadius: 16,
        padding: "20px 22px",
        boxShadow: "0 12px 30px rgba(15,23,42,0.12)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>
        Loading your workspace...
      </div>
      <div style={{ color: "#475569", marginBottom: 16 }}>
        Restoring your session and syncing data.
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        <div
          style={{
            height: 12,
            borderRadius: 999,
            background: "rgba(15,23,42,0.08)",
          }}
        />
        <div
          style={{
            height: 12,
            borderRadius: 999,
            background: "rgba(15,23,42,0.08)",
            width: "80%",
          }}
        />
        <div
          style={{
            height: 12,
            borderRadius: 999,
            background: "rgba(15,23,42,0.08)",
            width: "60%",
          }}
        />
      </div>
    </div>
  </div>
);

const PricingGate: React.FC = () => {
  const { user, isLoading, ready, authStatus } = useAuth();
  if (authStatus === "restoring" || isLoading || !ready) {
    return <AuthLoadingScreen />;
  }
  if (!user) {
    return <Navigate to="/site/pricing" replace />;
  }
  return (
    <LandlordNav>
      <PricingPage />
    </LandlordNav>
  );
};

function onboardPath(token: string, source?: string) {
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  if (source) params.set("source", source);
  const query = params.toString();
  return query ? `/auth/onboard?${query}` : "/auth/onboard";
}

const LegacyTokenInviteRedirect: React.FC<{ source?: string }> = ({ source }) => {
  const { token } = useParams();
  return <Navigate to={onboardPath(String(token || "").trim(), source)} replace />;
};

const LegacyQueryInviteRedirect: React.FC<{ source?: string }> = ({ source }) => {
  const location = useLocation();
  const token = String(new URLSearchParams(location.search).get("invite") || "").trim();
  return <Navigate to={onboardPath(token, source)} replace />;
};

const LegacyTenantMagicRedirect: React.FC = () => {
  const location = useLocation();
  const query = String(location.search || "");
  return <Navigate to={`/auth/magic${query}`} replace />;
};

const TenantApplicationEntryRedirect: React.FC<{ entry: "invite" | "application" }> = ({ entry }) => {
  const { token } = useParams();
  return <Navigate to={buildTenantApplicationEntryPath({ entry, token })} replace />;
};

const TenantInviteRedeemRedirect: React.FC = () => {
  const { token } = useParams();
  const params = new URLSearchParams();
  if (token) params.set("token", token);
  const query = params.toString();
  return <Navigate to={query ? `/tenant/invite/redeem?${query}` : "/tenant/invite/redeem"} replace />;
};

const AccountRouteGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const role = String(user?.actorRole || user?.role || "").trim().toLowerCase();
  const isAllowed = role === "landlord" || role === "admin";
  if (isAllowed) return <>{children}</>;
  if (role === "contractor") return <Navigate to="/contractor/profile" replace />;
  return <Navigate to={getRoleDefaultDestination(role as any)} replace />;
};

const TenantEntryRouteGate: React.FC = () => {
  const location = useLocation();
  const tenantToken = typeof window === "undefined" ? null : getTenantToken();
  if (!tenantToken) {
    return (
      <Suspense fallback={null}>
        <TenantLandingPage />
      </Suspense>
    );
  }

  const destination = resolveTenantPostAuthDestination({
    search: location.search,
    fallback: TENANT_DEFAULT_DESTINATION,
  }).destination;
  return <Navigate to={destination} replace />;
};

function App() {
  const applicantApplyRedirects = [
    "/applicant/apply",
    "/application/new",
    "/applypage",
  ];
  const renderTenantShell = (page: React.ReactNode) =>
    TENANT_PORTAL_ENABLED ? (
      <RequireTenant>
        <TenantLayout>{page}</TenantLayout>
      </RequireTenant>
    ) : (
      <TenantPortalComingSoon />
    );
  const suspensePage = (page: React.ReactNode) => <Suspense fallback={null}>{page}</Suspense>;

  return (
    <>
      <Routes>
        <Route path="/" element={suspensePage(<LandingPage />)} />
        <Route path="/site" element={suspensePage(<LandingPage />)} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/register" element={<SignupPage />} />
        <Route path="/app/login" element={<LoginPage />} />
        <Route path="/invite" element={<InviteRedeemPage />} />
        <Route path="/invite/:token" element={<InviteRedeemPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/action" element={<AuthActionPage />} />
        <Route path="/auth/onboard" element={<AuthOnboardPage />} />
        <Route
          path="/tenant/login"
          element={TENANT_PORTAL_ENABLED ? <TenantLoginPageV2 /> : <TenantPortalComingSoon />}
        />
        <Route
          path="/tenant/magic"
          element={TENANT_PORTAL_ENABLED ? <LegacyTenantMagicRedirect /> : <TenantPortalComingSoon />}
        />
        <Route
          path="/auth/magic"
          element={TENANT_PORTAL_ENABLED ? suspensePage(<TenantMagicRedeemPage />) : <TenantPortalComingSoon />}
        />
        <Route path="/2fa" element={<TwoFactorPage />} />
        <Route path="/pricing" element={<PricingGate />} />
        <Route path="/site/pricing" element={suspensePage(<MarketingPricingPage />)} />
        <Route path="/screening/demo" element={suspensePage(<ScreeningDemoPage />)} />
        <Route path="/site/screening/demo" element={suspensePage(<ScreeningDemoPage />)} />
        <Route path="/site/request-access" element={suspensePage(<RequestAccessPage />)} />
        <Route path="/request-access" element={suspensePage(<RequestAccessPage />)} />
        <Route path="/about" element={suspensePage(<AboutPage />)} />
        <Route path="/site/about" element={suspensePage(<AboutPage />)} />
        <Route path="/legal" element={suspensePage(<LegalHelpPage />)} />
        <Route path="/site/legal" element={suspensePage(<LegalHelpPage />)} />
        <Route path="/help" element={suspensePage(<HelpIndexPage />)} />
        <Route path="/help/landlords" element={suspensePage(<HelpLandlordsPage />)} />
        <Route path="/help/tenants" element={suspensePage(<HelpTenantsPage />)} />
        <Route path="/help/templates" element={suspensePage(<TemplatesPage />)} />
        <Route path="/privacy" element={suspensePage(<PrivacyPage />)} />
        <Route path="/terms" element={suspensePage(<TermsPage />)} />
        <Route path="/acceptable-use" element={suspensePage(<AcceptableUsePage />)} />
        <Route path="/subprocessors" element={suspensePage(<SubprocessorsPage />)} />
        <Route path="/trust" element={suspensePage(<TrustPage />)} />
        <Route path="/security" element={suspensePage(<SecurityPage />)} />
        <Route path="/accessibility" element={suspensePage(<AccessibilityPage />)} />
        <Route path="/status" element={suspensePage(<StatusPage />)} />
        <Route path="/contact" element={suspensePage(<ContactPage />)} />
        <Route path="/micro-live" element={<MicroLiveInvitePage />} />
        <Route
          path="/tenant/invite/:token"
          element={
            TENANT_PORTAL_ENABLED ? <LegacyTokenInviteRedirect source="tenant" /> : <TenantInviteRedeem />
          }
        />
        <Route
          path="/tenant/apply"
          element={TENANT_PORTAL_ENABLED ? <TenantApplicationEntryRedirect entry="application" /> : <TenantPortalComingSoon />}
        />
        <Route
          path="/tenant/apply/:token"
          element={TENANT_PORTAL_ENABLED ? <TenantApplicationEntryRedirect entry="application" /> : <TenantPortalComingSoon />}
        />
        <Route
          path="/tenant/invite/redeem/:token"
          element={TENANT_PORTAL_ENABLED ? <TenantInviteRedeemRedirect /> : <TenantPortalComingSoon />}
        />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <LandlordNav>
                <DashboardPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/reports/monthly-ops"
          element={
            <RequireAuth>
              <MonthlyOpsReportPageWithNudge />
            </RequireAuth>
          }
        />
        <Route
          path="/billing"
          element={
            <RequireAuth>
              <LandlordNav>
                <BillingPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/billing/checkout-success"
          element={
            <RequireAuth>
              <LandlordNav>
                <BillingCheckoutSuccessPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/properties"
          element={
            <RequireAuth>
              <LandlordNav>
                <PropertiesPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/tenants"
          element={
            <RequireAuth>
              <LandlordNav>
                <TenantsPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/applications"
          element={
            <RequireAuth>
              <LandlordNav>
                <ApplicationsPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/applications/:id/review-summary"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <ApplicationReviewSummaryPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/analytics"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <LandlordAnalyticsPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/landlord/inbox"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <LandlordInboxPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/decision-inbox"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <DecisionInboxPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/agent-supervision"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <AgentSupervisionPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/institution-exports"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <InstitutionExportsPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/audit-compliance"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <AuditCompliancePage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/evidence-packs"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <EvidencePackPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/review-timeline"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <ReviewTimelinePage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/identity-layer"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <IdentityLayerPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/institutional-sharing-rooms"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <InstitutionalSharingRoomPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/verified-rental-history"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <VerifiedRentalHistoryPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/rental-debt"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <RentalDebtPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/court-dispute-lineage"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <CourtDisputeLineagePage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/onboarding-hardening"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <OnboardingHardeningPage participantType="landlord" />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/support-operations"
          element={
            <RequireAdmin>
              <LandlordNav>
                <Suspense fallback={null}>
                  <SupportOperationsPage />
                </Suspense>
              </LandlordNav>
            </RequireAdmin>
          }
        />
        <Route
          path="/settlement-readiness"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <SettlementReadinessPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/regulatory-profiles"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <RegulatoryProfilePage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/asset-tokenization-readiness"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <AssetTokenizationReadinessPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/network-participants"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <NetworkParticipantsPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/cross-organization-trust"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <CrossOrganizationTrustPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/institution-onboarding-readiness"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <InstitutionOnboardingReadinessPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/operational-risk"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <OperationalRiskPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/interoperability-adapters"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <InteroperabilityAdapterPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/portfolio-health"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <PortfolioHealthSummaryPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/portfolio-score"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <LandlordPortfolioScorePage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/portfolio-score/shared/:token"
          element={
            <Suspense fallback={null}>
              <SharedPortfolioScorePage />
            </Suspense>
          }
        />
        <Route
          path="/recommended-actions"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <ActionRecommendationsPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/referrals"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <ReferralsPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/verified-screenings"
          element={
            <RequireAuth>
              <Suspense fallback={null}>
                <AdminVerifiedScreeningsPage />
              </Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="/pdf/sample"
          element={<Navigate to="/sample/screening_report_sample.pdf" replace />}
        />
        {import.meta.env.DEV ? (
          <Route
            path="/admin/screenings"
            element={
              <RequireAuth>
                <Suspense fallback={null}>
                  <AdminScreeningsPage />
                </Suspense>
              </RequireAuth>
            }
          />
        ) : null}
        <Route
          path="/admin/verified-screenings"
          element={
            <RequireAuth>
              <Suspense fallback={null}>
                <AdminVerifiedScreeningsPage />
              </Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <Suspense fallback={null}>
                <AdminDashboardPage />
              </Suspense>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/control-tower"
          element={
            <RequireAdmin>
              <Suspense fallback={null}>
                <ControlTowerPage />
              </Suspense>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/leads"
          element={
            <RequireAuth>
              <LandlordNav>
                <RequireAdmin>
                  <Suspense fallback={null}>
                    <AdminLeadsPage />
                  </Suspense>
                </RequireAdmin>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/properties"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Suspense fallback={null}>
                  <AdminPropertiesPage />
                </Suspense>
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/registry/sources"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Suspense fallback={null}>
                  <AdminRegistrySourcesPage />
                </Suspense>
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/registry/imports"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Suspense fallback={null}>
                  <AdminRegistryImportsPage />
                </Suspense>
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/registry/review"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Suspense fallback={null}>
                  <AdminRegistryReviewPage />
                </Suspense>
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/registry/records/:normalizedRecordId"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Suspense fallback={null}>
                  <AdminRegistryRecordDetailPage />
                </Suspense>
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/registry/properties/:propertyId"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Suspense fallback={null}>
                  <AdminRegistryPropertyReviewPage />
                </Suspense>
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/tenants"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Suspense fallback={null}>
                  <AdminTenantsPage />
                </Suspense>
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/leases"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Suspense fallback={null}>
                  <AdminLeasesPage />
                </Suspense>
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/integrity"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Suspense fallback={null}>
                  <AdminIntegrityPage />
                </Suspense>
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Suspense fallback={null}>
                  <AdminAuditPage />
                </Suspense>
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/screening/transunion-usage"
          element={
            <RequireAdmin>
              <Suspense fallback={null}>
                <AdminTransUnionUsagePage />
              </Suspense>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/lease-overlap-cleanup"
          element={
            <RequireAuth>
              <RequireAdmin>
                <Suspense fallback={null}>
                  <AdminLeaseOverlapCleanupPage />
                </Suspense>
              </RequireAdmin>
            </RequireAuth>
          }
        />
        <Route path="/admin/lease-overlaps" element={<Navigate to="/admin/lease-overlap-cleanup" replace />} />
        <Route
          path="/screening"
          element={
            <RequireAuth>
              <LandlordNav>
                <ScreeningStartPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/screening/manual"
          element={
            <RequireAuth>
              <LandlordNav>
                <ManualScreeningPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/screening/success"
          element={
            <RequireAuth>
              <LandlordNav>
                <ScreeningSuccessPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/screening/cancel"
          element={
            <RequireAuth>
              <LandlordNav>
                <ScreeningCancelPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route path="/screening/report" element={<ScreeningReportPage />} />
        <Route
          path="/payments"
          element={
            <RequireAuth>
              <LandlordNav>
                <PaymentsPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/expenses"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <ExpensesPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/work-orders"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <WorkOrdersPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/work-orders/new"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <WorkOrderNewPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/contractors"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <ContractorsPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/contractor"
          element={
            <RequireAuth>
              <RequireRole allowed={["contractor", "admin"]} fallbackTo="/dashboard">
                <ContractorNav>
                  <ContractorDashboardPage />
                </ContractorNav>
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route path="/contractor/signup" element={<LegacyQueryInviteRedirect source="contractor" />} />
        <Route path="/contractor/invite/:token" element={<LegacyTokenInviteRedirect source="contractor" />} />
        <Route path="/contractor/invite" element={<LegacyQueryInviteRedirect source="contractor" />} />
        <Route
          path="/contractor/jobs"
          element={
            <RequireAuth>
              <RequireRole allowed={["contractor", "admin"]} fallbackTo="/dashboard">
                <ContractorNav>
                  <ContractorJobsPage />
                </ContractorNav>
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/contractor/jobs/:id"
          element={
            <RequireAuth>
              <RequireRole allowed={["contractor", "admin"]} fallbackTo="/dashboard">
                <ContractorNav>
                  <ContractorJobsPage />
                </ContractorNav>
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/contractor/profile"
          element={
            <RequireAuth>
              <RequireRole allowed={["contractor", "admin"]} fallbackTo="/dashboard">
                <ContractorNav>
                  <ContractorProfilePage />
                </ContractorNav>
              </RequireRole>
            </RequireAuth>
          }
        />
        {import.meta.env.DEV ? (
          <Route
            path="/ledger"
            element={
              <RequireAuth>
                <LandlordNav>
                  <Suspense fallback={null}>
                    <LedgerPage />
                  </Suspense>
                </LandlordNav>
              </RequireAuth>
            }
          />
        ) : null}
        <Route
          path="/ledger-v2"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <LedgerV2Page />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/messages"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <MessagesPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/maintenance"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <MaintenanceRequestsPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/maintenance/:id"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <MaintenanceRequestsPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/timeline"
          element={
            <RequireAdmin>
              <Suspense fallback={null}>
                <AutomationTimelineV1Page />
              </Suspense>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/ops"
          element={
            <RequireAdmin>
              <Suspense fallback={null}>
                <SecurityReliabilityConsolePage />
              </Suspense>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/support-console"
          element={
            <RequireAdmin>
              <Suspense fallback={null}>
                <SupportDebugConsolePage />
              </Suspense>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/triage"
          element={
            <RequireAdmin>
              <Suspense fallback={null}>
                <AdminTriageQueuePage />
              </Suspense>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/lease-lifecycle-review"
          element={
            <RequireAdmin>
              <Suspense fallback={null}>
                <AdminLeaseLifecycleReviewPage />
              </Suspense>
            </RequireAdmin>
          }
        />
            <Route
              path="/admin/alerts"
              element={
                <RequireAdmin>
                  <AdminAlertingPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/observability"
              element={
                <RequireAdmin>
                  <AdminObservabilityPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/pdf-export-observability"
              element={
                <RequireAdmin>
                  <PdfExportObservabilityPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/observability-incident-readiness"
              element={
                <RequireAdmin>
                  <ObservabilityIncidentReadinessPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/notifications"
              element={
                <RequireAdmin>
                  <AdminNotificationsPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/release-governance"
              element={
                <RequireAdmin>
                  <ReleaseGovernancePage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/public-exposure-hardening"
              element={
                <RequireAdmin>
                  <PublicExposureHardeningPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/commercial-readiness"
              element={
                <RequireAdmin>
                  <CommercialReadinessPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/controlled-integrations"
              element={
                <RequireAdmin>
                  <ControlledIntegrationsPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/production-integrations"
              element={
                <RequireAdmin>
                  <ProductionIntegrationsPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/enterprise-municipal-readiness"
              element={
                <RequireAdmin>
                  <EnterpriseMunicipalReadinessPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/ecosystem-coordination"
              element={
                <RequireAdmin>
                  <EcosystemCoordinationPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/platform-credentialing-readiness"
              element={
                <RequireAdmin>
                  <PlatformCredentialingReadinessPage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/consumer-reporting-governance"
              element={
                <RequireAdmin>
                  <ConsumerReportingGovernancePage />
                </RequireAdmin>
              }
            />
            <Route
              path="/admin/portfolio-score"
              element={
                <RequireAdmin>
              <Suspense fallback={null}>
                <PortfolioScorePage />
              </Suspense>
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/portfolio-score/history"
          element={
            <RequireAdmin>
              <Suspense fallback={null}>
                <PortfolioScoreHistoryPage />
              </Suspense>
            </RequireAdmin>
          }
        />
        <Route
          path="/automation/timeline"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={<div style={{ padding: 20 }}>Loading timeline...</div>}>
                  <AutomationTimelinePage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/leases"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <LandlordActiveLeasesPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/leases/:leaseId/summary"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <LandlordLeaseSummaryPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/leases/:leaseId/ledger"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <LeaseLedgerPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/landlord/invites"
          element={
            <RequireAuth>
              <LandlordNav>
                <Suspense fallback={null}>
                  <InvitesPage />
                </Suspense>
              </LandlordNav>
            </RequireAuth>
          }
        />
        {import.meta.env.DEV ? (
          <Route
            path="/blockchain"
            element={
              <RequireAuth>
                <LandlordNav>
                  <Suspense fallback={null}>
                    <BlockchainPage />
                  </Suspense>
                </LandlordNav>
              </RequireAuth>
            }
          />
        ) : null}
        <Route
          path="/account"
          element={
            <RequireAuth>
              <AccountRouteGate>
                <LandlordNav>
                  <Suspense fallback={null}>
                    <AccountPage />
                  </Suspense>
                </LandlordNav>
              </AccountRouteGate>
            </RequireAuth>
          }
        />
        <Route
          path="/account/security"
          element={
            <RequireAuth>
              <AccountRouteGate>
                <LandlordNav>
                  <AccountSecurityPage />
                </LandlordNav>
              </AccountRouteGate>
            </RequireAuth>
          }
        />
        <Route
          path="/account/profile"
          element={
            <RequireAuth>
              <AccountRouteGate>
                <LandlordNav>
                  <Suspense fallback={null}>
                    <AccountProfilePage />
                  </Suspense>
                </LandlordNav>
              </AccountRouteGate>
            </RequireAuth>
          }
        />
        <Route
          path="/account/data"
          element={
            <RequireAuth>
              <AccountRouteGate>
                <LandlordNav>
                  <Suspense fallback={null}>
                    <AccountDataPage />
                  </Suspense>
                </LandlordNav>
              </AccountRouteGate>
            </RequireAuth>
          }
        />
        <Route path="/contractor/account" element={<Navigate to="/contractor/profile" replace />} />
        <Route path="/cosign/:applicationId" element={<CosignPage />} />
        <Route path="/apply" element={<ApplicantApplyPage />} />
        <Route
          path="/tenant"
          element={TENANT_PORTAL_ENABLED ? <TenantEntryRouteGate /> : <TenantPortalComingSoon />}
        />
        <Route
          path="/tenant/dashboard"
          element={renderTenantShell(suspensePage(<TenantWorkspacePage />))}
        />
        <Route
          path="/recipient/trust-review/:grantId"
          element={
            <RequireAuth>
              {suspensePage(<RecipientTrustReviewPage />)}
            </RequireAuth>
          }
        />
        <Route
          path="/tenant/application"
          element={renderTenantShell(suspensePage(<TenantApplicationStatusPage />))}
        />
        <Route
          path="/tenant/lease"
          element={renderTenantShell(suspensePage(<TenantLeasePage />))}
        />
        <Route
          path="/tenant/activity"
          element={renderTenantShell(suspensePage(<TenantActivityPage />))}
        />
        <Route
          path="/tenant/ledger"
          element={renderTenantShell(suspensePage(<TenantLedgerPage />))}
        />
        <Route
          path="/tenant/participation"
          element={renderTenantShell(suspensePage(<TenantParticipationPage />))}
        />
        <Route
          path="/tenant/onboarding-hardening"
          element={renderTenantShell(suspensePage(<OnboardingHardeningPage participantType="tenant" />))}
        />
        <Route
          path="/tenant/attachments"
          element={renderTenantShell(suspensePage(<TenantAttachmentsPage />))}
        />
        <Route
          path="/tenant/notices"
          element={renderTenantShell(suspensePage(<TenantNoticesCenterPage />))}
        />
        <Route
          path="/tenant/profile"
          element={renderTenantShell(suspensePage(<TenantProfilePage />))}
        />
        <Route
          path="/tenant/screening"
          element={renderTenantShell(suspensePage(<TenantScreeningInboxPage />))}
        />
        <Route
          path="/tenant/access"
          element={renderTenantShell(suspensePage(<TenantAccessPage />))}
        />
        <Route
          path="/tenant/account"
          element={renderTenantShell(suspensePage(<TenantAccountPage />))}
        />
        <Route
          path="/tenant/notices/:noticeId"
          element={
            TENANT_PORTAL_ENABLED ? <TenantNoticeDetailPage /> : <TenantPortalComingSoon />
          }
        />
        <Route
          path="/tenant/lease-notices"
          element={renderTenantShell(<TenantLeaseNoticesPage />)}
        />
        <Route
          path="/tenant/lease-notices/:id"
          element={renderTenantShell(<TenantLeaseNoticeDetailPage />)}
        />
        <Route
          path="/tenant/messages"
          element={renderTenantShell(<TenantMessagesCenterPage />)}
        />
        <Route
          path="/tenant/maintenance"
          element={renderTenantShell(suspensePage(<TenantMaintenanceRequestsPage />))}
        />
        <Route
          path="/tenant/maintenance/new"
          element={renderTenantShell(suspensePage(<TenantMaintenanceRequestNewPage />))}
        />
        <Route
          path="/tenant/maintenance/:id"
          element={renderTenantShell(suspensePage(<TenantMaintenanceRequestDetailPage />))}
        />
        <Route
          path="/tenant/feedback"
          element={renderTenantShell(suspensePage(<FeedbackSubmissionPage />))}
        />
        <Route
          path="/tenant/invite/redeem"
          element={renderTenantShell(suspensePage(<TenantInviteRedeemPage />))}
        />
        {applicantApplyRedirects.map((path) => (
          <Route
            key={path}
            path={path}
            element={<Navigate to="/apply" replace />}
          />
        ))}
        <Route path="/apply/:token" element={<PublicApplyPage />} />
        <Route path="/verify/:token" element={<VerifyScreeningPage />} />
        <Route path="/share/:token" element={suspensePage(<TenantSharePackagePage />)} />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {import.meta.env.DEV ? <DebugPanel /> : null}
    </>
  );
}

export default App;
