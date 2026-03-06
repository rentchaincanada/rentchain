// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./styles/print.css";
import "./runtime/chunkRecovery";
import { ToastProvider } from "./components/ui/ToastProvider";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { AuthProvider } from "./context/AuthContext";
import { DevAuthGate } from "./components/dev/DevAuthGate";
import { ErrorBoundary } from "./components/system/ErrorBoundary";
import { UpgradeProvider } from "./context/UpgradeContext";
import { LanguageProvider } from "./context/LanguageContext";
import { API_BASE_URL } from "./api/config";
import { AuthDebugOverlay } from "./components/debug/AuthDebugOverlay";
import { getAuthToken } from "./lib/authToken";
import MaintenancePage from "./pages/MaintenancePage";

const App = React.lazy(() => import("./App"));

if (import.meta.env.MODE === "tdzdebug" && typeof window !== "undefined") {
  console.info("[tdzdebug] build", (import.meta.env as any).VITE_BUILD_ID || "no_build_id");
}

// Enforce canonical host (www) to keep storage/sessions consistent
if (typeof window !== "undefined" && window.location.hostname === "rentchain.ai") {
  const target = new URL(window.location.href);
  target.hostname = "www.rentchain.ai";
  window.location.replace(target.toString());
}

const originalFetch = window.fetch.bind(window);
// Legacy global (DO NOT REMOVE until all fetch() calls are migrated)
(window as any).API_BASE_URL = API_BASE_URL;
(window as any).__tenantFlag = import.meta.env.VITE_TENANT_PORTAL_ENABLED;

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const initHeaders = new Headers(
    init?.headers ||
      (input instanceof Request ? input.headers : undefined) ||
      undefined
  );
  const clientHeader = initHeaders.get("x-api-client");
  const marked = clientHeader === "web";

  const token = getAuthToken();
  const url =
    typeof input === "string" || input instanceof URL ? input.toString() : input.url;

  if (import.meta.env.DEV && !marked && url.includes("/api/")) {
    console.error("🚫 Direct fetch() forbidden for /api. Use apiFetch/apiJson.", url);
  }

  const shouldAttachAuth =
    !!token &&
    (url.startsWith("http") ? url.startsWith(API_BASE_URL) : true);

  if (!shouldAttachAuth) {
    return originalFetch(input, init);
  }

  const headers = initHeaders;

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return originalFetch(input, {
    ...init,
    headers,
  });
};

const MAINTENANCE_MODE = String(import.meta.env.VITE_MAINTENANCE_MODE || "false").trim().toLowerCase() === "true";
const MAINTENANCE_ADMIN_BYPASS =
  String(import.meta.env.VITE_MAINTENANCE_ADMIN_BYPASS || "false").trim().toLowerCase() === "true";

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = atob(b64);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isAdminBypassAllowed() {
  if (!MAINTENANCE_MODE || !MAINTENANCE_ADMIN_BYPASS) return false;
  const token = getAuthToken();
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload !== "object") return false;
  const exp = Number((payload as any).exp || 0);
  if (Number.isFinite(exp) && exp > 0 && Date.now() >= exp * 1000) return false;

  const role = String((payload as any).role || "").trim().toLowerCase();
  const actorRole = String((payload as any).actorRole || "").trim().toLowerCase();
  if (role === "admin" || actorRole === "admin") return true;

  const permissions = Array.isArray((payload as any).permissions)
    ? (payload as any).permissions.map((p: unknown) => String(p || "").trim().toLowerCase())
    : [];
  return permissions.some(
    (p: string) =>
      p === "admin" ||
      p === "admin.all" ||
      p.startsWith("admin:") ||
      p.startsWith("admin.")
  );
}

const SHOW_MAINTENANCE_PAGE = MAINTENANCE_MODE && !isAdminBypassAllowed();
if (import.meta.env.DEV && SHOW_MAINTENANCE_PAGE) {
  console.info("[maintenance] maintenance mode enabled");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {SHOW_MAINTENANCE_PAGE ? (
      <MaintenancePage />
    ) : (
      <ErrorBoundary>
        <ToastProvider>
          <SubscriptionProvider initialPlan="pro">
            <AuthProvider>
              <LanguageProvider>
                <BrowserRouter>
                  <DevAuthGate>
                    <UpgradeProvider>
                      <AuthDebugOverlay />
                      <React.Suspense fallback={null}>
                        <App />
                      </React.Suspense>
                    </UpgradeProvider>
                  </DevAuthGate>
                </BrowserRouter>
              </LanguageProvider>
            </AuthProvider>
          </SubscriptionProvider>
        </ToastProvider>
      </ErrorBoundary>
    )}
  </React.StrictMode>
);
