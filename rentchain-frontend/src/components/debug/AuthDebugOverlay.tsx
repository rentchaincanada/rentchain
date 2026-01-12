import React, { useMemo, useState } from "react";
import { DEBUG_AUTH_KEY, TENANT_TOKEN_KEY, TOKEN_KEY } from "../../lib/authKeys";

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

function previewToken(tok: string | null) {
  if (!tok) return { present: false, len: 0, preview: "", whitespace: false };
  const t = String(tok);
  const len = t.length;
  const whitespace = /\s/.test(t);
  const preview =
    len >= 25 ? `${t.slice(0, 10)}…${t.slice(-10)}` : `${t.slice(0, 10)}…`;
  return { present: true, len, preview, whitespace };
}

export const AuthDebugOverlay: React.FC = () => {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const paramEnabled = params.get("debugAuth") === "1";
  if (paramEnabled) {
    localStorage.setItem(DEBUG_AUTH_KEY, "1");
  }
  const enabledFlag = localStorage.getItem(DEBUG_AUTH_KEY) === "1";
  const closed = sessionStorage.getItem("debugAuthClosed") === "1";
  const [dismissed, setDismissed] = useState(closed);
  const shouldShow = enabledFlag && !dismissed;

  const data = useMemo(() => {
    if (!shouldShow) return null;
    const sTok = sessionStorage.getItem(TOKEN_KEY);
    const lTok = localStorage.getItem(TOKEN_KEY);
    const tenantS = sessionStorage.getItem(TENANT_TOKEN_KEY);
    const tenantL = localStorage.getItem(TENANT_TOKEN_KEY);
    const active = sTok || lTok || tenantS || tenantL || null;
    const payload = active ? decodeJwtPayload(active) : null;
    const expMs = payload?.exp ? payload.exp * 1000 : null;
    const remainingSec = expMs ? Math.round((expMs - Date.now()) / 1000) : null;
    const storedAt = sessionStorage.getItem("debugAuthStoredAt");

    return {
      hostname: window.location.hostname,
      path: window.location.pathname + window.location.search,
      session: previewToken(sTok),
      local: previewToken(lTok),
      tenantSession: previewToken(tenantS),
      tenantLocal: previewToken(tenantL),
      decodeStatus: payload ? "ok" : "failed",
      expMs,
      remainingSec,
      storedAt,
      activeSource: sTok ? "session" : lTok ? "local" : tenantS ? "tenantSession" : tenantL ? "tenantLocal" : "none",
    };
  }, [shouldShow]);

  if (!shouldShow || !data) return null;

    return (
      <div
        style={{
          position: "fixed",
          top: 10,
          left: 10,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        color: "#fff",
        padding: "10px 12px",
        borderRadius: 8,
        fontSize: 12,
        maxWidth: 340,
        lineHeight: 1.4,
        boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
      }}
    >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <strong>debugAuth</strong>
            <button
              type="button"
              onClick={() => {
                sessionStorage.setItem("debugAuthClosed", "1");
                setDismissed(true);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(DEBUG_AUTH_KEY);
                sessionStorage.removeItem("debugAuthClosed");
                const url = new URL(window.location.href);
                url.searchParams.delete("debugAuth");
                window.location.replace(url.toString());
              }}
              style={{
                background: "#dc2626",
                border: "none",
                color: "#fff",
                padding: "4px 6px",
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Clear
            </button>
          </div>
          <div>host: {data.hostname}</div>
          <div>path: {data.path}</div>
          <div>active: {data.activeSource}</div>
      <div>session: {data.session.present ? `yes len=${data.session.len} ${data.session.preview}` : "no"}</div>
      <div>session ws?: {data.session.whitespace ? "yes" : "no"}</div>
      <div>local: {data.local.present ? `yes len=${data.local.len} ${data.local.preview}` : "no"}</div>
      <div>local ws?: {data.local.whitespace ? "yes" : "no"}</div>
      <div>tenant session: {data.tenantSession.present ? `yes ${data.tenantSession.preview}` : "no"}</div>
      <div>tenant local: {data.tenantLocal.present ? `yes ${data.tenantLocal.preview}` : "no"}</div>
      <div>decode: {data.decodeStatus}</div>
      <div>expMs: {data.expMs ?? "n/a"}</div>
      <div>remaining(s): {data.remainingSec ?? "n/a"}</div>
      <div>storedAt: {data.storedAt ?? "n/a"}</div>
      <div>now: {Date.now()}</div>
    </div>
  );
};
