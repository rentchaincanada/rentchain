// src/App.tsx
import React, { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import DashboardPage from "./pages/DashboardPage";
import PropertiesPage from "./pages/PropertiesPage";
import { TenantsPage } from "./pages/TenantsPage";
import PaymentsPage from "./pages/PaymentsPage";
import ApplicationsPage from "./pages/ApplicationsPage";
import ApplyPage from "./pages/ApplyPage";
import ApplicantApplyPage from "./pages/ApplicantApplyPage";
import CosignPage from "./pages/CosignPage";
import LoginPage from "./pages/LoginPage";
import TenantLoginPage from "./pages/TenantLoginPage";
import ComingSoonPage from "./pages/ComingSoonPage";
import { TwoFactorPage } from "./pages/TwoFactorPage";
import { AccountSecurityPage } from "./pages/AccountSecurityPage";
import { RequireAuth } from "./components/auth/RequireAuth";
import ScreeningPage from "./pages/ScreeningPage";
import ScreeningSuccessPage from "./pages/ScreeningSuccessPage";
import ScreeningCancelPage from "./pages/ScreeningCancelPage";
import PricingPage from "./pages/PricingPage";
import BillingPage from "./pages/BillingPage";
import { DebugPanel } from "./components/DebugPanel";
import { TenantLayout } from "./pages/tenant/TenantLayout.clean";
import TenantDashboardPage from "./pages/tenant/TenantDashboardPage";
import TenantPaymentsPage from "./pages/tenant/TenantPaymentsPage";
import TenantLedgerPage from "./pages/tenant/TenantLedgerPage";
import TenantDocumentsPage from "./pages/tenant/TenantDocumentsPage";
import ReportingConsentPage from "./pages/tenant/ReportingConsentPage";
import { RequireTenant } from "./components/auth/RequireTenant";
import MicroLiveInvitePage from "./pages/MicroLiveInvitePage";
import TenantInviteRedeem from "./tenant/TenantInviteRedeem";

const LedgerPage = lazy(() => import("./pages/LedgerPage"));
const LedgerV2Page = lazy(() => import("./pages/LedgerV2Page"));
const BlockchainPage = lazy(() => import("./pages/BlockchainPage"));
const AdminScreeningsPage = lazy(() => import("./pages/AdminScreeningsPage"));

function App() {
  const applicantApplyRedirects = [
    "/applicant/apply",
    "/application/new",
    "/applypage",
  ];

  return (
    <>
      <Routes>
        <Route path="/" element={<ComingSoonPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/app/login" element={<LoginPage />} />
        <Route path="/tenant/login" element={<TenantLoginPage />} />
        <Route path="/2fa" element={<TwoFactorPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/micro-live" element={<MicroLiveInvitePage />} />
        <Route path="/tenant/invite/:token" element={<TenantInviteRedeem />} />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/billing"
          element={
            <RequireAuth>
              <BillingPage />
            </RequireAuth>
          }
        />
        <Route
          path="/properties"
          element={
            <RequireAuth>
              <PropertiesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/tenants"
          element={
            <RequireAuth>
              <TenantsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/applications"
          element={
            <RequireAuth>
              <ApplicationsPage />
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
          path="/screening"
          element={
            <RequireAuth>
              <ScreeningPage />
            </RequireAuth>
          }
        />
        <Route
          path="/screening/success"
          element={
            <RequireAuth>
              <ScreeningSuccessPage />
            </RequireAuth>
          }
        />
        <Route
          path="/screening/cancel"
          element={
            <RequireAuth>
              <ScreeningCancelPage />
            </RequireAuth>
          }
        />
        <Route
          path="/payments"
          element={
            <RequireAuth>
              <PaymentsPage />
            </RequireAuth>
          }
        />
        {import.meta.env.DEV ? (
          <Route
            path="/ledger"
            element={
              <RequireAuth>
                <Suspense fallback={null}>
                  <LedgerPage />
                </Suspense>
              </RequireAuth>
            }
          />
        ) : null}
        <Route
          path="/ledger-v2"
          element={
            <RequireAuth>
              <Suspense fallback={null}>
                <LedgerV2Page />
              </Suspense>
            </RequireAuth>
          }
        />
        {import.meta.env.DEV ? (
          <Route
            path="/blockchain"
            element={
              <RequireAuth>
                <Suspense fallback={null}>
                  <BlockchainPage />
                </Suspense>
              </RequireAuth>
            }
          />
        ) : null}
        <Route
          path="/account/security"
          element={
            <RequireAuth>
              <AccountSecurityPage />
            </RequireAuth>
          }
        />
        <Route path="/cosign/:applicationId" element={<CosignPage />} />
        <Route path="/apply" element={<ApplicantApplyPage />} />
        <Route
          path="/tenant"
          element={
            <RequireTenant>
              <TenantLayout />
            </RequireTenant>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<TenantDashboardPage />} />
          <Route path="payments" element={<TenantPaymentsPage />} />
          <Route path="ledger" element={<TenantLedgerPage />} />
          <Route path="documents" element={<TenantDocumentsPage />} />
          <Route path="reporting-consent" element={<ReportingConsentPage />} />
        </Route>
        {applicantApplyRedirects.map((path) => (
          <Route
            key={path}
            path={path}
            element={<Navigate to="/apply" replace />}
          />
        ))}
        <Route path="/apply/:propertyId/:unit" element={<ApplyPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {import.meta.env.DEV ? <DebugPanel /> : null}
    </>
  );
}

export default App;
