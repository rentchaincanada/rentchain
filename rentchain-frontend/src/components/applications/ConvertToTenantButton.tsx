import React from "react";
import { convertApplicationToTenant } from "../../api/applicationConversion";

const TENANT_PATH = (tenantId: string) => `/tenants?tenantId=${encodeURIComponent(tenantId)}`;

function backdrop(): React.CSSProperties {
  return {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 9999,
  };
}

function card(): React.CSSProperties {
  return {
    width: "100%",
    maxWidth: 520,
    background: "#fff",
    border: "1px solid #E5E7EB",
    borderRadius: 16,
    padding: 16,
    boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  };
}

export function ConvertToTenantButton({
  applicationId,
  applicationStatus,
  convertedTenantId,
  onConverted,
}: {
  applicationId: string;
  applicationStatus?: string | null;
  convertedTenantId?: string | null;
  onConverted?: (tenantId: string, alreadyConverted: boolean) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [runScreening, setRunScreening] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const status = (applicationStatus || "").toLowerCase();
  const canConvert = status === "approved" || status === "converted" || !!convertedTenantId;

  const label =
    convertedTenantId || status === "converted" ? "View tenant" : "Convert to tenant";

  function goToTenant(tenantId: string) {
    if (!tenantId) return;
    const url = new URL(window.location.origin + "/tenants");
    url.searchParams.set("tenantId", tenantId);
    window.location.assign(url.toString());
  }

  function handleClick() {
    if (convertedTenantId) {
      goToTenant(convertedTenantId);
      return;
    }
    setOpen(true);
  }

  async function confirmConvert() {
    setLoading(true);
    setErr(null);
    try {
      const resp = await convertApplicationToTenant(applicationId, {
        runScreening,
      });
      if (!resp?.ok || !resp?.tenantId) throw new Error("Conversion failed");

      setOpen(false);
      onConverted?.(resp.tenantId, !!resp.alreadyConverted);
      goToTenant(resp.tenantId);
    } catch (e: any) {
      setErr(e?.message || "Failed to convert application");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={!canConvert}
        style={{
          padding: "7px 14px",
          borderRadius: 999,
          border: "1px solid #E5E7EB",
          background: "#111827",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          cursor: !canConvert ? "not-allowed" : "pointer",
          opacity: !canConvert ? 0.6 : 1,
          whiteSpace: "nowrap",
          boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        }}
        title={!canConvert ? "Application must be approved before converting." : undefined}
      >
        {label}
      </button>

      {open ? (
        <div style={backdrop()} onMouseDown={() => setOpen(false)}>
          <div style={card()} onMouseDown={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Convert application to tenant?</div>
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              This will create a tenant record and mark the application as converted. Running it
              again is safe (idempotent).
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13,
              }}
            >
              <input
                type="checkbox"
                checked={runScreening}
                onChange={(e) => setRunScreening(e.target.checked)}
              />
              Run screening now (uses credits)
            </label>

            {err ? (
              <div
                style={{
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid #FCA5A5",
                  background: "#FEF2F2",
                }}
              >
                <div style={{ fontWeight: 900, marginBottom: 4 }}>Couldn’t convert</div>
                <div style={{ opacity: 0.9 }}>{err}</div>
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                style={{
                  padding: "9px 12px",
                  borderRadius: 12,
                  border: "1px solid #E5E7EB",
                  background: "#fff",
                  fontWeight: 900,
                  opacity: loading ? 0.7 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmConvert}
                disabled={loading}
                style={{
                  padding: "9px 12px",
                  borderRadius: 12,
                  border: "1px solid #E5E7EB",
                  background: "#111827",
                  color: "#fff",
                  fontWeight: 900,
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? "default" : "pointer",
                }}
              >
                {loading ? "Converting…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
