import React, { useEffect, useMemo, useState } from "react";
import { fetchProperties, type Property } from "../../api/propertiesApi";
import {
  createTenantInvite,
  listTenantInvites,
  type TenantInvite,
} from "../../api/tenantInvites";
import { colors, spacing, text } from "../../styles/tokens";

function deriveInviteUrl(token: string) {
  const base =
    (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.replace(/\/$/, "") ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/tenant/invite/${token}`;
}

export default function InvitesPage() {
  const [invites, setInvites] = useState<TenantInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [properties, setProperties] = useState<Property[]>([]);
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [propertyId, setPropertyId] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const [propsRes, invitesRes] = await Promise.all([
          fetchProperties(),
          listTenantInvites(),
        ]);
        if (!mounted) return;
        setProperties(propsRes.properties || []);
        setInvites(invitesRes.items || []);
        if (!propertyId && (propsRes.properties || []).length) {
          setPropertyId(propsRes.properties[0].id);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || "Failed to load invites");
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const canCreate = useMemo(() => {
    return !creating && propertyId && tenantEmail;
  }, [creating, propertyId, tenantEmail]);

  async function handleCreate() {
    if (!canCreate) return;
    try {
      setCreating(true);
      setCreateError(null);
      const res = await createTenantInvite({
        propertyId,
        tenantEmail,
        tenantName: tenantName || undefined,
      });
      if (!res?.ok || !res?.token) throw new Error(res?.error || "Invite not created");
      const url = res.inviteUrl || deriveInviteUrl(res.token);
      setCreatedInviteUrl(url);
      // refresh list
      const listRes = await listTenantInvites();
      setInvites(listRes.items || []);
      setShowModal(false);
      setTenantName("");
      setTenantEmail("");
    } catch (e: any) {
      setCreateError(e?.message || "Failed to create invite");
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch (e) {
      console.warn("Clipboard copy failed", e);
    }
  }

  const empty = !loading && invites.length === 0;

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: text.primary }}>Tenant Invites</div>
          <div style={{ fontSize: 13, color: text.muted }}>
            Create invite links and share them with tenants. Redeeming links grants access to the tenant portal.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreatedInviteUrl(null);
            setShowModal(true);
          }}
          disabled={!properties.length}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #e5e7eb",
            background: properties.length ? "#111827" : "#9ca3af",
            color: "#fff",
            fontWeight: 700,
            cursor: properties.length ? "pointer" : "not-allowed",
          }}
          title={properties.length ? "Create invite" : "Add a property first"}
        >
          Create Invite
        </button>
      </div>

      {loading ? (
        <div style={{ marginTop: spacing.lg, color: text.muted }}>Loading invites…</div>
      ) : error ? (
        <div
          style={{
            marginTop: spacing.lg,
            padding: spacing.md,
            borderRadius: 12,
            border: "1px solid #fecdd3",
            background: "#fef2f2",
            color: colors.danger,
          }}
        >
          {error}
        </div>
      ) : empty ? (
        <div
          style={{
            marginTop: spacing.lg,
            padding: spacing.md,
            borderRadius: 12,
            border: "1px dashed #e5e7eb",
            color: text.muted,
          }}
        >
          No invites yet. Create your first invite to onboard a tenant.
        </div>
      ) : (
        <div style={{ marginTop: spacing.lg, borderRadius: 12, border: "1px solid #e5e7eb" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f9fafb", textAlign: "left" }}>
                <th style={{ padding: "10px 12px", fontSize: 13, color: text.muted }}>Created</th>
                <th style={{ padding: "10px 12px", fontSize: 13, color: text.muted }}>Property</th>
                <th style={{ padding: "10px 12px", fontSize: 13, color: text.muted }}>Tenant</th>
                <th style={{ padding: "10px 12px", fontSize: 13, color: text.muted }}>Status</th>
                <th style={{ padding: "10px 12px", fontSize: 13, color: text.muted }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const created = inv.createdAt
                  ? new Date(inv.createdAt).toLocaleString()
                  : "—";
                const propName =
                  properties.find((p) => p.id === inv.propertyId)?.name ||
                  inv.propertyId ||
                  "—";
                const tenantLabel =
                  inv.tenantName || inv.tenantEmail || "—";
                const status = inv.status || "pending";
                const url = inv.inviteUrl || deriveInviteUrl(inv.token);
                return (
                  <tr key={inv.token} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 12px", fontSize: 13 }}>{created}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13 }}>{propName}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13 }}>{tenantLabel}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, textTransform: "capitalize" }}>
                      {status}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => copyLink(url)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            background: "#fff",
                            cursor: "pointer",
                          }}
                        >
                          Copy
                        </button>
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: "1px solid #e5e7eb",
                            background: "#f9fafb",
                            color: text.primary,
                            textDecoration: "none",
                          }}
                        >
                          Open
                        </a>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 9999,
          }}
          onMouseDown={() => setShowModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              padding: 16,
              width: "100%",
              maxWidth: 460,
              boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
              display: "grid",
              gap: 12,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ fontWeight: 800, fontSize: 16 }}>Create Tenant Invite</div>
            {!properties.length ? (
              <div style={{ fontSize: 13, color: colors.danger }}>
                You need at least one property to create an invite.
              </div>
            ) : (
              <>
                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Property *
                  <select
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                    }}
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name || p.addressLine1 || p.id}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Tenant email *
                  <input
                    type="email"
                    value={tenantEmail}
                    onChange={(e) => setTenantEmail(e.target.value)}
                    placeholder="tenant@example.com"
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                    }}
                  />
                </label>
                <label style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  Tenant name (optional)
                  <input
                    type="text"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="Tenant name"
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                    }}
                  />
                </label>
                {createError ? (
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: "1px solid #fecdd3",
                      background: "#fef2f2",
                      color: colors.danger,
                      fontSize: 13,
                    }}
                  >
                    {createError}
                  </div>
                ) : null}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      background: "#fff",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!canCreate}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      background: "#111827",
                      color: "#fff",
                      fontWeight: 700,
                      opacity: canCreate ? 1 : 0.6,
                      cursor: canCreate ? "pointer" : "not-allowed",
                    }}
                  >
                    {creating ? "Creating…" : "Create invite"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {createdInviteUrl ? (
        <div
          style={{
            marginTop: spacing.lg,
            padding: spacing.md,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 15 }}>Invite created</div>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              value={createdInviteUrl}
              readOnly
              style={{
                flex: 1,
                minWidth: 240,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
              }}
            />
            <button
              type="button"
              onClick={() => copyLink(createdInviteUrl)}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Copy
            </button>
            <a
              href={createdInviteUrl}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#111827",
                color: "#fff",
                textDecoration: "none",
              }}
            >
              Open link
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
