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
import LandingPage from "./pages/marketing/LandingPage";
import AboutPage from "./pages/marketing/AboutPage";
import MarketingPricingPage from "./pages/marketing/PricingPage";
import RequestAccessPage from "./pages/marketing/RequestAccessPage";
import ScreeningDemoPage from "./pages/marketing/ScreeningDemoPage";
import InviteRedeemPage from "./pages/InviteRedeemPage";
import LegalHelpPage from "./pages/marketing/LegalHelpPage";
import HelpIndexPage from "./pages/help/HelpIndexPage";
import HelpLandlordsPage from "./pages/help/HelpLandlordsPage";
import HelpTenantsPage from "./pages/help/HelpTenantsPage";
import TemplatesPage from "./pages/help/TemplatesPage";
import PrivacyPage from "./pages/legal/PrivacyPage";
import TermsPage from "./pages/legal/TermsPage";
import AcceptableUsePage from "./pages/legal/AcceptableUsePage";
import TrustPage from "./pages/trust/TrustPage";
import SecurityPage from "./pages/security/SecurityPage";
import SubprocessorsPage from "./pages/subprocessors/SubprocessorsPage";
import AccessibilityPage from "./pages/accessibility/AccessibilityPage";
import StatusPage from "./pages/status/StatusPage";
import ContactPage from "./pages/contact/ContactPage";
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
import TenantDashboardPage from "./pages/tenant/TenantDashboardPage";
import TenantLedgerPage from "./pages/tenant/TenantLedgerPage";
import TenantActivityPage from "./pages/tenant/TenantActivityPage";
import TenantAttachmentsPage from "./pages/tenant/TenantAttachmentsPage";
import TenantNoticesCenterPage from "./pages/tenant/TenantNoticesCenterPage";
import TenantProfilePage from "./pages/tenant/TenantProfilePage";
import TenantAccountPage from "./pages/tenant/TenantAccountPage";
import TenantMagicRedeemPage from "./pages/tenant/TenantMagicRedeemPage";
import TenantMaintenanceRequestDetailPage from "./pages/tenant/TenantMaintenanceRequestDetailPage";
import TenantMaintenanceRequestsPage from "./pages/tenant/TenantMaintenanceRequestsPage";
import TenantMaintenanceRequestNewPage from "./pages/tenant/TenantMaintenanceRequestNewPage";
import MonthlyOpsReportPageWithNudge from "./pages/reports/MonthlyOpsReportPageWithNudge";
import InvitesPage from "./pages/landlord/InvitesPage";
import PublicApplyPage from "./pages/PublicApplyPage";
import MessagesPage from "./pages/MessagesPage";
import TenantMessagesCenterPage from "./pages/tenant/TenantMessagesCenterPage";
import TenantNoticeDetailPage from "./pages/tenant/TenantNoticeDetailPage";
import MaintenanceRequestsPage from "./pages/MaintenanceRequestsPage";
import PdfSamplePage from "./pages/PdfSamplePage";
import LeaseLedgerPage from "./pages/LeaseLedgerPage";
import ApplicationReviewSummaryPage from "./pages/ApplicationReviewSummaryPage";
import ReferralsPage from "./pages/ReferralsPage";
import AccountPage from "./pages/AccountPage";
import AccountProfilePage from "./pages/account/AccountProfilePage";
import AccountDataPage from "./pages/account/AccountDataPage";
import ExpensesPage from "./pages/ExpensesPage";
import WorkOrdersPage from "./pages/landlord/WorkOrdersPage";
import WorkOrderNewPage from "./pages/landlord/WorkOrderNewPage";
import ContractorsPage from "./pages/landlord/ContractorsPage";
import ContractorDashboardPage from "./pages/contractor/ContractorDashboardPage";
import ContractorJobsPage from "./pages/contractor/ContractorJobsPage";
import ContractorProfilePage from "./pages/contractor/ContractorProfilePage";
import { ContractorNav } from "./components/layout/ContractorNav";
import { TenantNav } from "./components/layout/TenantNav";
import { getRoleDefaultDestination } from "./lib/authDestination";

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
const AutomationTimelinePage = lazy(
  () => import("./features/automation/timeline/AutomationTimelinePage")
);

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

const AccountRouteGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const role = String(user?.actorRole || user?.role || "").trim().toLowerCase();
  const isAllowed = role === "landlord" || role === "admin";
  if (isAllowed) return <>{children}</>;
  if (role === "contractor") return <Navigate to="/contractor/profile" replace />;
  return <Navigate to={getRoleDefaultDestination(role as any)} replace />;
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
        <TenantNav>{page}</TenantNav>
      </RequireTenant>
    ) : (
      <TenantPortalComingSoon />
    );

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/site" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
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
          element={TENANT_PORTAL_ENABLED ? <TenantMagicRedeemPage /> : <TenantPortalComingSoon />}
        />
        <Route path="/2fa" element={<TwoFactorPage />} />
        <Route path="/pricing" element={<PricingGate />} />
        <Route path="/site/pricing" element={<MarketingPricingPage />} />
        <Route path="/screening/demo" element={<ScreeningDemoPage />} />
        <Route path="/site/screening/demo" element={<ScreeningDemoPage />} />
        <Route path="/site/request-access" element={<RequestAccessPage />} />
        <Route path="/request-access" element={<RequestAccessPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/site/about" element={<AboutPage />} />
        <Route path="/legal" element={<LegalHelpPage />} />
        <Route path="/site/legal" element={<LegalHelpPage />} />
        <Route path="/help" element={<HelpIndexPage />} />
        <Route path="/help/landlords" element={<HelpLandlordsPage />} />
        <Route path="/help/tenants" element={<HelpTenantsPage />} />
        <Route path="/help/templates" element={<TemplatesPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/acceptable-use" element={<AcceptableUsePage />} />
        <Route path="/subprocessors" element={<SubprocessorsPage />} />
        <Route path="/trust" element={<TrustPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/accessibility" element={<AccessibilityPage />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/micro-live" element={<MicroLiveInvitePage />} />
        <Route
          path="/tenant/invite/:token"
          element={
            TENANT_PORTAL_ENABLED ? <LegacyTokenInviteRedirect source="tenant" /> : <TenantInviteRedeem />
          }
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
                <ApplicationReviewSummaryPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/referrals"
          element={
            <RequireAuth>
              <LandlordNav>
                <ReferralsPage />
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
                <ExpensesPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/work-orders"
          element={
            <RequireAuth>
              <LandlordNav>
                <WorkOrdersPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/work-orders/new"
          element={
            <RequireAuth>
              <LandlordNav>
                <WorkOrderNewPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/contractors"
          element={
            <RequireAuth>
              <LandlordNav>
                <ContractorsPage />
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
                <MessagesPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/maintenance"
          element={
            <RequireAuth>
              <LandlordNav>
                <MaintenanceRequestsPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/maintenance/:id"
          element={
            <RequireAuth>
              <LandlordNav>
                <MaintenanceRequestsPage />
              </LandlordNav>
            </RequireAuth>
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
          path="/leases/:leaseId/ledger"
          element={
            <RequireAuth>
              <LandlordNav>
                <LeaseLedgerPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route
          path="/landlord/invites"
          element={
            <RequireAuth>
              <LandlordNav>
                <InvitesPage />
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
                  <AccountPage />
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
                  <AccountProfilePage />
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
                  <AccountDataPage />
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
          element={renderTenantShell(<TenantDashboardPage />)}
        />
        <Route
          path="/tenant/activity"
          element={renderTenantShell(<TenantActivityPage />)}
        />
        <Route
          path="/tenant/ledger"
          element={renderTenantShell(<TenantLedgerPage />)}
        />
        <Route
          path="/tenant/attachments"
          element={renderTenantShell(<TenantAttachmentsPage />)}
        />
        <Route
          path="/tenant/notices"
          element={renderTenantShell(<TenantNoticesCenterPage />)}
        />
        <Route
          path="/tenant/profile"
          element={renderTenantShell(<TenantProfilePage />)}
        />
        <Route
          path="/tenant/account"
          element={renderTenantShell(<TenantAccountPage />)}
        />
        <Route
          path="/tenant/notices/:noticeId"
          element={
            TENANT_PORTAL_ENABLED ? <TenantNoticeDetailPage /> : <TenantPortalComingSoon />
          }
        />
        <Route
          path="/tenant/messages"
          element={renderTenantShell(<TenantMessagesCenterPage />)}
        />
        <Route
          path="/tenant/maintenance"
          element={renderTenantShell(<TenantMaintenanceRequestsPage />)}
        />
        <Route
          path="/tenant/maintenance/new"
          element={renderTenantShell(<TenantMaintenanceRequestNewPage />)}
        />
        <Route
          path="/tenant/maintenance/:id"
          element={renderTenantShell(<TenantMaintenanceRequestDetailPage />)}
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

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {import.meta.env.DEV ? <DebugPanel /> : null}
    </>
  );
}

export default App;
