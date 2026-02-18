import React, { useState } from "react";
import { createTenantInvite } from "../../api/tenantInvites";
import { setOnboardingStep } from "../../api/onboardingApi";
import { fetchProperties } from "../../api/propertiesApi";
import { fetchUnitsForProperty } from "../../api/unitsApi";
import { useCapabilities } from "../../hooks/useCapabilities";
import { dispatchUpgradePrompt } from "../../lib/upgradePrompt";
import { useAuth } from "../../context/useAuth";
import { Button } from "../ui/Ui";

interface Props {
  open: boolean;
  onClose: () => void;
  onInviteCreated?: (payload: any) => void;
  defaultPropertyId?: string;
  defaultUnitId?: string;
  defaultLeaseId?: string;
}

export const InviteTenantModal: React.FC<Props> = ({
  open,
  onClose,
  onInviteCreated,
  defaultPropertyId,
  defaultUnitId,
  defaultLeaseId,
}) => {
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [err, setErr] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [units, setUnits] = useState<Array<{ id: string; label: string }>>([]);
  const [propertyId, setPropertyId] = useState(defaultPropertyId || "");
  const [unitId, setUnitId] = useState(defaultUnitId || "");
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const { features } = useCapabilities();
  const { user } = useAuth();
  const role = String(user?.role || "").toLowerCase();
  const canInvite = role === "admin" || features?.tenant_invites !== false;

  React.useEffect(() => {
    if (!open) return;
    let mounted = true;
    (async () => {
      setLoadingProperties(true);
      try {
        const res: any = await fetchProperties();
        if (!mounted) return;
        const list = Array.isArray(res?.properties)
          ? res.properties
          : Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res)
          ? res
          : [];
        const normalized = list
          .map((p: any) => ({
            id: String(p?.id || p?.propertyId || "").trim(),
            name: String(p?.name || p?.addressLine1 || p?.id || "Property"),
          }))
          .filter((p: any) => Boolean(p.id));
        setProperties(normalized);
        if (!propertyId && normalized.length > 0) {
          setPropertyId(String(defaultPropertyId || normalized[0].id));
        }
      } catch {
        if (mounted) setProperties([]);
      } finally {
        if (mounted) setLoadingProperties(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, defaultPropertyId]);

  React.useEffect(() => {
    if (!open || !propertyId) {
      setUnits([]);
      setUnitId("");
      return;
    }
    let mounted = true;
    (async () => {
      setLoadingUnits(true);
      try {
        const res = await fetchUnitsForProperty(propertyId);
        if (!mounted) return;
        const mapped = (res || [])
          .map((u: any) => ({
            id: String(u?.id || u?.unitId || "").trim(),
            label: String(u?.unitNumber || u?.label || u?.name || "Unit"),
          }))
          .filter((u: any) => Boolean(u.id));
        setUnits(mapped);
        if (defaultUnitId && mapped.some((u: any) => u.id === defaultUnitId)) {
          setUnitId(defaultUnitId);
        } else {
          setUnitId((prev) => (mapped.some((u: any) => u.id === prev) ? prev : ""));
        }
      } catch {
        if (mounted) setUnits([]);
      } finally {
        if (mounted) setLoadingUnits(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open, propertyId, defaultUnitId]);

  if (!open) return null;

  async function sendInvite() {
    setErr("");
    setSuccessMsg("");
    setInfoMsg("");
    setInviteUrl("");
    setLoading(true);
    try {
      if (!canInvite) {
        dispatchUpgradePrompt({ featureKey: "tenant_invites", source: "tenants_invite_modal" });
        return;
      }
      if (!propertyId || !unitId) {
        setErr("Select a property and unit to send an invite.");
        return;
      }
      const data: any = await createTenantInvite({
        tenantEmail,
        tenantName: tenantName || undefined,
        propertyId,
        unitId,
        leaseId: defaultLeaseId || null,
      });

      if (!data?.ok) {
        throw new Error(data?.error || "Failed to send invite");
      }

      const url = data.inviteUrl || data.invite?.inviteUrl || "";
      setInviteUrl(url);
      const emailed = data.emailed === true;
      const emailError = data.emailError ? String(data.emailError) : "";
      if (emailed) {
        setSuccessMsg(`Invite emailed to ${tenantEmail}`);
      } else {
        setSuccessMsg("Invite link created (email failed)");
        setInfoMsg(emailError || "Email was not sent. You can copy or open the link below.");
      }
      await setOnboardingStep("tenantInvited", true).catch(() => {});
      onInviteCreated?.(data);
    } catch (e: any) {
      const respDetail =
        (e as any)?.response?.data?.detail || (e as any)?.response?.data?.error;
      const msg = String(respDetail || e?.message || "Failed to send invite");
      if (msg.includes("INVITE_EMAIL_SEND_FAILED") || msg.includes("SENDGRID")) {
        setErr("Invite could not be emailed. Please try again.");
      } else {
        setErr(msg);
      }
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
        className="rc-modal-shell"
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e5e7eb",
        }}
      >
        <div className="rc-modal-body" style={{ padding: 16, display: "grid", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Invite tenant</div>
          <Button style={{ padding: "6px 10px" }} onClick={onClose}>
            Close
          </Button>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13 }}>Property</label>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
            }}
            disabled={loadingProperties}
          >
            <option value="">{loadingProperties ? "Loading properties..." : "Select property"}</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13 }}>Unit</label>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #d1d5db",
              fontSize: 14,
            }}
            disabled={!propertyId || loadingUnits || units.length === 0}
          >
            <option value="">
              {!propertyId
                ? "Select property first"
                : loadingUnits
                ? "Loading units..."
                : "Select unit"}
            </option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
          {propertyId && !loadingUnits && units.length === 0 ? (
            <div style={{ fontSize: 12, color: "#6b7280" }}>
              No units found.{" "}
              <a href="/properties" style={{ color: "#2563eb", textDecoration: "underline" }}>
                Create a unit first
              </a>
            </div>
          ) : null}
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

        {successMsg && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #bbf7d0",
              background: "#ecfdf3",
              color: "#166534",
              fontSize: 13,
            }}
          >
            {successMsg}
          </div>
        )}
        {infoMsg && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              background: "#f8fafc",
              color: "#6b7280",
              fontSize: 12,
            }}
          >
            {infoMsg}
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
          <Button
            onClick={sendInvite}
            disabled={loading || !tenantEmail || !propertyId || !unitId}
            style={{ padding: "8px 12px" }}
          >
            {loading ? "Sending..." : "Send invite"}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
};
