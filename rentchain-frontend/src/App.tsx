// src/App.tsx
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import DashboardPage from "./pages/DashboardPage";
import PropertiesPage from "./pages/PropertiesPage";
import { TenantsPage } from "./pages/TenantsPage";
import PaymentsPage from "./pages/PaymentsPage";
import ApplicationsPage from "./pages/ApplicationsPage";
import ApplicantApplyPage from "./pages/ApplicantApplyPage";
import CosignPage from "./pages/CosignPage";
import PricingPage from "./pages/PricingPage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import TenantLoginPageV2 from "./pages/tenant/TenantLoginPage.v2";
import LandingPage from "./pages/marketing/LandingPage";
import AboutPage from "./pages/marketing/AboutPage";
import MarketingPricingPage from "./pages/marketing/PricingPage";
import RequestAccessPage from "./pages/marketing/RequestAccessPage";
import ScreeningDemoPage from "./pages/marketing/ScreeningDemoPage";
import InvitePage from "./pages/InvitePage";
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
import { useAuth } from "./context/useAuth";
import ScreeningStartPage from "./pages/screening/ScreeningStartPage";
import ScreeningSuccessPage from "./pages/screening/ScreeningSuccessPage";
import ScreeningCancelPage from "./pages/screening/ScreeningCancelPage";
import ScreeningReportPage from "./pages/screening/ScreeningReportPage";
import VerifyScreeningPage from "./pages/VerifyScreeningPage";
import BillingPage from "./pages/BillingPage";
import BillingCheckoutSuccessPage from "./pages/BillingCheckoutSuccessPage";
import { DebugPanel } from "./components/DebugPanel";
import MicroLiveInvitePage from "./pages/MicroLiveInvitePage";
import TenantInviteRedeem from "./tenant/TenantInviteRedeem";
import TenantInviteAcceptPage from "./pages/tenant/TenantInviteAcceptPage";
import { LandlordNav } from "./components/layout/LandlordNav";
import TenantPortalComingSoon from "./pages/tenant/TenantPortalComingSoon";
import TenantDashboardPage from "./pages/tenant/TenantDashboardPage";
import TenantLedgerPage from "./pages/tenant/TenantLedgerPage";
import TenantMagicRedeemPage from "./pages/tenant/TenantMagicRedeemPage";
import TenantMaintenanceRequestDetailPage from "./pages/tenant/TenantMaintenanceRequestDetailPage";
import MonthlyOpsReportPage from "./pages/reports/MonthlyOpsReportPage";
import InvitesPage from "./pages/landlord/InvitesPage";
import PublicApplyPage from "./pages/PublicApplyPage";
import MessagesPage from "./pages/MessagesPage";
import TenantMessagesPage from "./pages/tenant/TenantMessagesPage";
import TenantNoticeDetailPage from "./pages/tenant/TenantNoticeDetailPage";
import MaintenanceRequestsPage from "./pages/MaintenanceRequestsPage";
import PdfSamplePage from "./pages/PdfSamplePage";
import LeaseLedgerPage from "./pages/LeaseLedgerPage";
import ApplicationReviewSummaryPage from "./pages/ApplicationReviewSummaryPage";
import ReferralsPage from "./pages/ReferralsPage";

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
const AdminLeadsPage = lazyWithRetry(() => import("./pages/admin/AdminLeadsPage"));

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

function App() {
  const applicantApplyRedirects = [
    "/applicant/apply",
    "/application/new",
    "/applypage",
  ];

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/site" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app/login" element={<LoginPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route
          path="/tenant/login"
          element={TENANT_PORTAL_ENABLED ? <TenantLoginPageV2 /> : <TenantPortalComingSoon />}
        />
        <Route
          path="/tenant/magic"
          element={TENANT_PORTAL_ENABLED ? <TenantMagicRedeemPage /> : <TenantPortalComingSoon />}
        />
        <Route path="/2fa" element={<TwoFactorPage />} />
        <Route path="/pricing" element={<PricingGate />} />
        <Route path="/site/pricing" element={<MarketingPricingPage />} />
        <Route path="/site/screening-demo" element={<ScreeningDemoPage />} />
        <Route path="/site/request-access" element={<RequestAccessPage />} />
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
            TENANT_PORTAL_ENABLED ? <TenantInviteAcceptPage /> : <TenantInviteRedeem />
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
              <MonthlyOpsReportPage />
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
          path="/account/security"
          element={
            <RequireAuth>
              <LandlordNav>
                <AccountSecurityPage />
              </LandlordNav>
            </RequireAuth>
          }
        />
        <Route path="/cosign/:applicationId" element={<CosignPage />} />
        <Route path="/apply" element={<ApplicantApplyPage />} />
        <Route
          path="/tenant"
          element={
            TENANT_PORTAL_ENABLED ? (
              <TenantDashboardPage />
            ) : (
              <TenantPortalComingSoon />
            )
          }
        />
        <Route
          path="/tenant/ledger"
          element={
            TENANT_PORTAL_ENABLED ? <TenantLedgerPage /> : <TenantPortalComingSoon />
          }
        />
        <Route
          path="/tenant/notices/:noticeId"
          element={
            TENANT_PORTAL_ENABLED ? <TenantNoticeDetailPage /> : <TenantPortalComingSoon />
          }
        />
        <Route
          path="/tenant/messages"
          element={
            TENANT_PORTAL_ENABLED ? <TenantMessagesPage /> : <TenantPortalComingSoon />
          }
        />
        <Route
          path="/tenant/maintenance/:id"
          element={
            TENANT_PORTAL_ENABLED ? <TenantMaintenanceRequestDetailPage /> : <TenantPortalComingSoon />
          }
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
