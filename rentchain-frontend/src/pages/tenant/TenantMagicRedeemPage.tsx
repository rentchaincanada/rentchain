import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "../../api/apiFetch";
import { setTenantToken } from "../../lib/tenantAuth";
import { clearAuthToken } from "../../lib/authToken";
import {
  resolveTenantPostAuthDestination,
  TENANT_DEFAULT_DESTINATION,
} from "../../lib/authDestination";
import { fingerprintToken, trackAuthEvent } from "../../lib/authAnalytics";
import {
  tenantEntryBodyStyle,
  tenantEntryCardStyle,
  tenantEntryPalette,
  tenantEntryPrimaryLinkStyle,
  tenantEntryShellStyle,
} from "./tenantEntryStyles";

export default function TenantMagicRedeemPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"pending" | "ok" | "error">("pending");
  const [error, setError] = useState<string | null>(null);

  const token = useMemo(() => new URLSearchParams(location.search).get("token") || "", [location.search]);
  const next = useMemo(
    () =>
      resolveTenantPostAuthDestination({
        search: location.search,
        fallback: TENANT_DEFAULT_DESTINATION,
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
        const destination = resolveTenantPostAuthDestination({
          explicitDestination: res?.next || null,
          search: location.search,
          fallback: TENANT_DEFAULT_DESTINATION,
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
      <div style={tenantEntryShellStyle}>
        <div style={tenantEntryCardStyle()}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: tenantEntryPalette.ink }}>
            Signing you in...
          </h1>
          <p style={{ ...tenantEntryBodyStyle, marginTop: 8 }}>
            We are preparing your tenant workspace.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={tenantEntryShellStyle}>
      <div style={{ ...tenantEntryCardStyle(), textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: tenantEntryPalette.ink }}>
          Tenant magic link
        </h1>
        {status === "pending" ? (
          <p style={{ ...tenantEntryBodyStyle, marginTop: 12 }}>Verifying your magic link...</p>
        ) : (
          <>
            <p style={{ color: tenantEntryPalette.danger, fontWeight: 700 }}>
              {error || "This link is invalid or expired."}
            </p>
            <a
              href={`/tenant/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
              style={{
                ...tenantEntryPrimaryLinkStyle,
                marginTop: 12,
              }}
            >
              Request a new link
            </a>
          </>
        )}
      </div>
    </div>
  );
}
