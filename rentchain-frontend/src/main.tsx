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
import { AuthDebugOverlay } from "./components/debug/AuthDebugOverlay";
import { getAuthToken } from "./lib/authToken";

// Enforce canonical host (www) to keep storage/sessions consistent
if (typeof window !== "undefined" && window.location.hostname === "rentchain.ai") {
  const target = new URL(window.location.href);
  target.hostname = "www.rentchain.ai";
  window.location.replace(target.toString());
}

function showReloadBanner(message: string, onClick?: () => void) {
  if (typeof document === "undefined") return;
  const existing = document.getElementById("rc-reload-banner");
  if (existing) return;
  const banner = document.createElement("div");
  banner.id = "rc-reload-banner";
  banner.textContent = message;
  banner.style.position = "fixed";
  banner.style.top = "16px";
  banner.style.left = "50%";
  banner.style.transform = "translateX(-50%)";
  banner.style.background = "rgba(15,23,42,0.95)";
  banner.style.color = "#f8fafc";
  banner.style.padding = "10px 14px";
  banner.style.borderRadius = "999px";
  banner.style.fontSize = "13px";
  banner.style.fontWeight = "600";
  banner.style.zIndex = "9999";
  banner.style.boxShadow = "0 10px 30px rgba(15,23,42,0.4)";
  banner.style.cursor = onClick ? "pointer" : "default";
  if (onClick) {
    banner.addEventListener("click", onClick);
  }
  document.body.appendChild(banner);
}

if (typeof window !== "undefined") {
  const shouldReloadForChunkError = (msg: string) =>
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Importing a module script failed") ||
    msg.includes("ChunkLoadError");

  const reloadOnce = () => {
    const key = "chunkReloaded";
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      const sep = window.location.search ? "&" : "?";
      window.location.replace(`${window.location.pathname}${window.location.search}${sep}v=${Date.now()}`);
      return;
    }
    showReloadBanner("Update available — tap to reload", () => window.location.reload());
  };

  window.addEventListener("unhandledrejection", (event) => {
    const msg = String((event as any)?.reason?.message || (event as any)?.reason || "");
    if (shouldReloadForChunkError(msg)) {
      showReloadBanner("Update available — reloading…");
      window.setTimeout(reloadOnce, 500);
    }
  });

  window.addEventListener("error", (event) => {
    const msg = String((event as any)?.message || "");
    if (shouldReloadForChunkError(msg)) {
      showReloadBanner("Update available — reloading…");
      window.setTimeout(reloadOnce, 500);
    }
  });
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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <SubscriptionProvider initialPlan="pro">
          <AuthProvider>
            <BrowserRouter>
              <DevAuthGate>
                <UpgradeProvider>
                  <AuthDebugOverlay />
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
