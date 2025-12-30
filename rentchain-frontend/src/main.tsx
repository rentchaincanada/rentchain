// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "./styles/print.css";
import { ToastProvider } from "./components/ui/ToastProvider";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { AuthProvider } from "./context/AuthContext";
import { DevAuthGate } from "./components/dev/DevAuthGate";
import { ErrorBoundary } from "./components/system/ErrorBoundary";
import { UpgradeProvider } from "./context/UpgradeContext";
import { API_BASE_URL } from "./api/config";

const originalFetch = window.fetch.bind(window);
// Legacy global (DO NOT REMOVE until all fetch() calls are migrated)
(window as any).API_BASE_URL = API_BASE_URL;

window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const initHeaders = new Headers(
    init?.headers ||
      (input instanceof Request ? input.headers : undefined) ||
      undefined
  );
  const marked =
    initHeaders.get("X-Rentchain-ApiClient") === "1" ||
    initHeaders.get("x-rentchain-apiclient") === "1";

  const token =
    sessionStorage.getItem("rentchain_token") ||
    localStorage.getItem("rentchain_token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("token") ||
    null;
  const url =
    typeof input === "string" || input instanceof URL ? input.toString() : input.url;
  const clientHeader = initHeaders.get("x-api-client");

  if (import.meta.env.DEV && !marked && clientHeader !== "apiFetch" && url.includes("/api/")) {
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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <SubscriptionProvider initialPlan="pro">
          <AuthProvider>
            <BrowserRouter>
              <DevAuthGate>
                <UpgradeProvider>
                  <App />
                </UpgradeProvider>
              </DevAuthGate>
            </BrowserRouter>
          </AuthProvider>
        </SubscriptionProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
