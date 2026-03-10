import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../../api/apiFetch";
import { setTenantToken } from "../../lib/tenantAuth";
import { clearAuthToken } from "../../lib/authToken";
import { resolvePostAuthDestination } from "../../lib/authDestination";
import { fingerprintToken, trackAuthEvent } from "../../lib/authAnalytics";

export default function TenantMagicRedeemPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending");
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => new URLSearchParams(location.search).get("token") || "", [location.search]);
  const next = useMemo(
    () =>
      resolvePostAuthDestination({
        search: location.search,
        role: "tenant",
        fallback: "/tenant",
      }).destination,
    [location.search]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) {
        setStatus("error");
        setError("Missing magic link token.");
        return;
      }
      try {
        const res: any = await apiFetch("/tenant/auth/magic-redeem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res?.ok || !res?.tenantToken) {
          throw new Error(res?.error || "MAGIC_LINK_INVALID");
        }
        setTenantToken(res.tenantToken);
        try {
          clearAuthToken();
        } catch {
          // ignore
        }
        if (!mounted) return;
        setStatus("ok");
        const destination = resolvePostAuthDestination({
          explicitDestination: res?.next || null,
          search: location.search,
          role: "tenant",
          fallback: "/tenant",
        }).destination;
        trackAuthEvent("auth.onboard.magic_link_completed", {
          tokenFingerprint: fingerprintToken(token),
          destination,
        });
        navigate(destination, { replace: true });
      } catch (e: any) {
        if (!mounted) return;
        setStatus("error");
        setError(String(e?.message || "This link is invalid or expired."));
        trackAuthEvent("auth.onboard.failed", {
          phase: "magic_redeem",
          tokenFingerprint: fingerprintToken(token),
        });
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token, next, navigate, location.search]);

  if (status === "ok") {
    return (
      <div style={{ padding: 24 }}>
        <h2>Signing you inƒ?İ</h2>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 520, margin: "48px auto", textAlign: "center" }}>
      <h2 style={{ marginBottom: 12 }}>Tenant Magic Link</h2>
      {status === "pending" ? (
        <p style={{ color: "#6b7280" }}>Verifying your magic linkƒ?İ</p>
      ) : (
        <>
          <p style={{ color: "#b91c1c" }}>{error || "This link is invalid or expired."}</p>
          <a
            href={`/tenant/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            style={{
              display: "inline-block",
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              background: "#2563eb",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            Request a new link
          </a>
        </>
      )}
    </div>
  );
}
