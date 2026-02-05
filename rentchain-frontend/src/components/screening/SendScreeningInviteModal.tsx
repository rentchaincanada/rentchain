import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Ui";
import { spacing, text, colors, radius } from "../../styles/tokens";
import { fetchProperties } from "../../api/propertiesApi";
import { fetchUnitsForProperty } from "../../api/unitsApi";
import { createScreeningOrder } from "../../api/rentalApplicationsApi";
import { useToast } from "../ui/ToastProvider";

type PropertyOption = { id: string; name: string };
type UnitOption = { id: string; label: string };

export function SendScreeningInviteModal({
  open,
  onClose,
  returnTo,
}: {
  open: boolean;
  onClose: () => void;
  returnTo?: string;
}) {
  const { showToast } = useToast();
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitId, setUnitId] = useState("");
  const [loadingProps, setLoadingProps] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tier, setTier] = useState<"basic" | "verify" | "verify_ai">("basic");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const packageOptions = useMemo(
    () => [
      { value: "basic", label: "Basic Screening", price: "$19.99" },
      { value: "verify", label: "Verify", price: "$29.99" },
      { value: "verify_ai", label: "Verify + AI", price: "$39.99" },
    ],
    []
  );

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const load = async () => {
      setLoadingProps(true);
      try {
        const res: any = await fetchProperties();
        const list = Array.isArray(res?.items)
          ? res.items
          : Array.isArray(res?.properties)
          ? res.properties
          : Array.isArray(res)
          ? res
          : [];
        if (!alive) return;
        setProperties(
          list
            .map((p: any) => ({
              id: String(p.id || p.propertyId || ""),
              name: p.name || p.addressLine1 || "Property",
            }))
            .filter((p: PropertyOption) => Boolean(p.id))
        );
      } catch {
        if (alive) setProperties([]);
      } finally {
        if (alive) setLoadingProps(false);
      }
    };
    void load();
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !propertyId) {
      setUnits([]);
      setUnitId("");
      return;
    }
    let alive = true;
    const loadUnits = async () => {
      setLoadingUnits(true);
      try {
        const res = await fetchUnitsForProperty(propertyId);
        if (!alive) return;
        const mapped = (res || [])
          .map((u: any) => ({
            id: String(u.id || u.unitId || ""),
            label: String(u.unitNumber || u.label || u.name || "Unit"),
          }))
          .filter((u: UnitOption) => Boolean(u.id));
        setUnits(mapped);
      } catch {
        if (alive) setUnits([]);
      } finally {
        if (alive) setLoadingUnits(false);
      }
    };
    void loadUnits();
    return () => {
      alive = false;
    };
  }, [open, propertyId]);

  useEffect(() => {
    if (!open) {
      setPropertyId("");
      setUnitId("");
      setTenantEmail("");
      setTenantName("");
      setTier("basic");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    setError(null);
    if (!propertyId) {
      setError("Select a property to continue.");
      return;
    }
    if (!tenantEmail.trim()) {
      setError("Tenant email is required.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await createScreeningOrder({
        propertyId,
        unitId: unitId || null,
        tenantEmail: tenantEmail.trim(),
        tenantName: tenantName.trim() || null,
        screeningTier: tier,
        addons: [],
        totalAmount: undefined,
        scoreAddOn: false,
        serviceLevel: tier === "basic" ? "SELF_SERVE" : tier === "verify" ? "VERIFIED" : "VERIFIED_AI",
        returnTo,
      });
      if (!res.ok || !res.checkoutUrl) {
        throw new Error(res.detail || res.error || "Unable to start checkout");
      }
      if (res.tenantInviteUrl) {
        showToast({
          message: "Invite queued",
          description: "We’ll email the tenant after payment.",
          variant: "success",
        });
      }
      window.location.href = res.checkoutUrl;
    } catch (err: any) {
      const msg = err?.message || "Unable to start checkout";
      setError(msg);
      showToast({ message: "Screening invite failed", description: msg, variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,23,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 1200,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 96vw)",
          background: "#fff",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 24px 80px rgba(2,6,23,0.35)",
          display: "grid",
          gap: spacing.sm,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Send screening invite</div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18 }}
          >
            ×
          </button>
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: 13, color: text.muted }}>
          Tenant email
          <input
            value={tenantEmail}
            onChange={(e) => setTenantEmail(e.target.value)}
            placeholder="tenant@email.com"
            style={{
              padding: "10px 12px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              fontSize: 14,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, color: text.muted }}>
          Tenant name (optional)
          <input
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            placeholder="Jane Doe"
            style={{
              padding: "10px 12px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              fontSize: 14,
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: 13, color: text.muted }}>
          Property
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            style={{
              padding: "10px 12px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              fontSize: 14,
            }}
          >
            <option value="">{loadingProps ? "Loading properties..." : "Select property"}</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        {units.length > 0 ? (
          <label style={{ display: "grid", gap: 6, fontSize: 13, color: text.muted }}>
            Unit (optional)
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              style={{
                padding: "10px 12px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                fontSize: 14,
              }}
              disabled={loadingUnits}
            >
              <option value="">{loadingUnits ? "Loading units..." : "Select unit"}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, color: text.muted }}>Package</div>
          <div style={{ display: "grid", gap: 8 }}>
            {packageOptions.map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: radius.md,
                  border: `1px solid ${tier === opt.value ? colors.accent : colors.border}`,
                  background: tier === opt.value ? "rgba(37,99,235,0.08)" : "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="radio"
                    checked={tier === opt.value}
                    onChange={() => setTier(opt.value as any)}
                  />
                  <span style={{ fontWeight: 700 }}>{opt.label}</span>
                </div>
                <span style={{ color: text.muted }}>{opt.price}</span>
              </label>
            ))}
          </div>
        </div>

        {error ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: spacing.sm }}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Starting..." : "Send invite"}
          </Button>
        </div>
      </div>
    </div>
  );
}
