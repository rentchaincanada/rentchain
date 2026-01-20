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
import LoginPage from "./pages/LoginPage";
import TenantLoginPageV2 from "./pages/tenant/TenantLoginPage.v2";
import LandingPage from "./pages/marketing/LandingPage";
import AboutPage from "./pages/marketing/AboutPage";
import MarketingPricingPage from "./pages/marketing/PricingPage";
import LegalHelpPage from "./pages/marketing/LegalHelpPage";
import { InfoPage } from "./pages/marketing/InfoPage";
import { TwoFactorPage } from "./pages/TwoFactorPage";
import { AccountSecurityPage } from "./pages/AccountSecurityPage";
import { RequireAuth } from "./components/auth/RequireAuth";
import { RequireAdmin } from "./components/auth/RequireAdmin";
import ScreeningPage from "./pages/ScreeningPage";
import ScreeningSuccessPage from "./pages/ScreeningSuccessPage";
import ScreeningCancelPage from "./pages/ScreeningCancelPage";
import BillingPage from "./pages/BillingPage";
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

const TENANT_PORTAL_ENABLED = import.meta.env.VITE_TENANT_PORTAL_ENABLED === "true";

const LedgerPage = lazy(() => import("./pages/LedgerPage"));
const LedgerV2Page = lazy(() => import("./pages/LedgerV2Page"));
const BlockchainPage = lazy(() => import("./pages/BlockchainPage"));
const AdminScreeningsPage = lazy(() => import("./pages/AdminScreeningsPage"));
const AdminVerifiedScreeningsPage = lazy(() => import("./pages/AdminVerifiedScreeningsPage"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));

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
        <Route
          path="/tenant/login"
          element={TENANT_PORTAL_ENABLED ? <TenantLoginPageV2 /> : <TenantPortalComingSoon />}
        />
        <Route
          path="/tenant/magic"
          element={TENANT_PORTAL_ENABLED ? <TenantMagicRedeemPage /> : <TenantPortalComingSoon />}
        />
        <Route path="/2fa" element={<TwoFactorPage />} />
        <Route path="/pricing" element={<MarketingPricingPage />} />
        <Route path="/site/pricing" element={<MarketingPricingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/site/about" element={<AboutPage />} />
        <Route path="/legal" element={<LegalHelpPage />} />
        <Route path="/site/legal" element={<LegalHelpPage />} />
        <Route
          path="/help"
          element={<InfoPage title="Help Center" description="Help resources are being prepared." />}
        />
        <Route
          path="/help/landlords"
          element={<InfoPage title="Help for Landlords" description="Landlord guides are being prepared." />}
        />
        <Route
          path="/help/tenants"
          element={<InfoPage title="Help for Tenants" description="Tenant guides are being prepared." />}
        />
        <Route
          path="/privacy"
          element={<InfoPage title="Privacy Policy" description="Privacy policy content is being prepared." />}
        />
        <Route
          path="/terms"
          element={<InfoPage title="Terms of Service" description="Terms of service content is being prepared." />}
        />
        <Route
          path="/acceptable-use"
          element={<InfoPage title="Acceptable Use" description="Acceptable use policy content is being prepared." />}
        />
        <Route
          path="/subprocessors"
          element={<InfoPage title="Subprocessors" description="Subprocessor disclosures are being prepared." />}
        />
        <Route
          path="/trust"
          element={<InfoPage title="Trust" description="Trust and compliance resources are being prepared." />}
        />
        <Route
          path="/security"
          element={<InfoPage title="Security" description="Security information is being prepared." />}
        />
        <Route
          path="/accessibility"
          element={<InfoPage title="Accessibility" description="Accessibility information is being prepared." />}
        />
        <Route
          path="/status"
          element={<InfoPage title="Status" description="Service status information is being prepared." />}
        />
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
          path="/screening"
          element={
            <RequireAuth>
              <LandlordNav>
                <ScreeningPage />
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

        <Route
          path="*"
          element={<InfoPage title="Page not found" description="The page you are looking for does not exist." />}
        />
      </Routes>
      {import.meta.env.DEV ? <DebugPanel /> : null}
    </>
  );
}

export default App;
