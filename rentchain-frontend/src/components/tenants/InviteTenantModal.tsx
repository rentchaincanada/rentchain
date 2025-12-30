import React, { useState } from "react";
import { Button } from "../ui/Ui";
import { apiFetch } from "../../lib/apiClient";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultPropertyId?: string;
  defaultUnitId?: string;
  defaultLeaseId?: string;
}

export const InviteTenantModal: React.FC<Props> = ({
  open,
  onClose,
  defaultPropertyId,
  defaultUnitId,
  defaultLeaseId,
}) => {
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function generate() {
    setErr("");
    setInviteUrl("");
    setLoading(true);
    try {
      const res: any = await apiFetch("/api/tenant-invites", {
        method: "POST",
        body: JSON.stringify({
          tenantEmail,
          tenantName,
          propertyId: defaultPropertyId,
          unitId: defaultUnitId,
          leaseId: defaultLeaseId,
        }),
      });
      setInviteUrl(res.inviteUrl);
    } catch (e: any) {
      setErr(e?.message || "Failed to generate invite");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 3000,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Invite tenant (read-only)</div>
          <Button style={{ padding: "6px 10px" }} onClick={onClose}>
            Close
          </Button>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13 }}>Tenant email</label>
          <input
            value={tenantEmail}
            onChange={(e) => setTenantEmail(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
            }}
            placeholder="name@example.com"
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13 }}>Tenant name (optional)</label>
          <input
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
            }}
          />
        </div>

        {err && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #fecdd3",
              background: "#fef2f2",
              color: "#b91c1c",
              fontSize: 13,
            }}
          >
            {err}
          </div>
        )}

        {inviteUrl && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#f8fafc",
              display: "grid",
              gap: 6,
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 700 }}>Invite link</div>
            <div style={{ wordBreak: "break-all", color: "#6b7280" }}>{inviteUrl}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button onClick={copy} style={{ padding: "6px 10px" }}>
                Copy
              </Button>
              <Button
                onClick={() => window.open(inviteUrl, "_blank")}
                style={{ padding: "6px 10px" }}
              >
                Open
              </Button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={onClose} style={{ padding: "8px 12px" }}>
            Cancel
          </Button>
          <Button onClick={generate} disabled={loading || !tenantEmail} style={{ padding: "8px 12px" }}>
            {loading ? "Generating…" : "Generate link"}
          </Button>
        </div>

        <div style={{ fontSize: 12, color: "#6b7280" }}>
          Send this link to the tenant. Email automation will come later.
        </div>
      </div>
    </div>
  );
};
