import React, { useEffect, useMemo, useState } from "react";
import { Button } from "../ui/Ui";
import { spacing, text, colors, radius } from "../../styles/tokens";
import { fetchProperties } from "../../api/propertiesApi";
import { fetchUnitsForProperty } from "../../api/unitsApi";
import { createScreeningOrder } from "../../api/rentalApplicationsApi";
import { useToast } from "../ui/ToastProvider";
import { useEntitlements } from "@/hooks/useEntitlements";
import { useUpgrade } from "../../context/UpgradeContext";
import { track } from "../../lib/analytics";
import {
  calculateScreeningDisplayPrice,
  formatPriceCents,
  getScreeningPackageOption,
  SCREENING_ADDON_OPTIONS,
  SCREENING_PACKAGE_OPTIONS,
} from "./screeningMonetizationOptions";

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
  const entitlements = useEntitlements();
  const { openUpgrade } = useUpgrade();
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [unitId, setUnitId] = useState("");
  const [loadingProps, setLoadingProps] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [screeningPackage, setScreeningPackage] = useState<"basic" | "standard" | "premium">("basic");
  const [addons, setAddons] = useState<Array<"income_verification" | "fraud_detection" | "enhanced_background">>(
    []
  );
  const [paymentResponsibility, setPaymentResponsibility] = useState<"landlord" | "tenant">("landlord");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canScreen = entitlements.canScreen;
  const selectedPackage = useMemo(() => getScreeningPackageOption(screeningPackage), [screeningPackage]);
  const totalPriceCents = useMemo(
    () => calculateScreeningDisplayPrice({ packageKey: screeningPackage, addons }),
    [screeningPackage, addons]
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
      setScreeningPackage("basic");
      setAddons([]);
      setPaymentResponsibility("landlord");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    setError(null);
    if (!canScreen) {
      track("gating_blocked", {
        featureName: "screening",
        requiredTier: entitlements.requiredPlanFor("screening"),
        userTier: entitlements.plan,
      });
      openUpgrade({
        reason: "screening",
        plan: entitlements.plan,
        ctaLabel: "Upgrade to continue",
        copy: {
          title: "Upgrade to continue screening inside RentChain",
          body: "This workflow is not active on your current plan. Upgrade when you're ready to run screening from the applicant workflow.",
        },
      });
      return;
    }
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
        screeningTier: selectedPackage.legacyTier,
        screeningPackage,
        addons,
        totalAmount: undefined,
        scoreAddOn: false,
        serviceLevel:
          selectedPackage.legacyTier === "basic"
            ? "SELF_SERVE"
            : selectedPackage.legacyTier === "verify"
            ? "VERIFIED"
            : "VERIFIED_AI",
        paymentResponsibility,
        returnTo,
      });
      if (!res.ok || !res.checkoutUrl) {
        const normalized = String(
          res.errorCode || res.screeningMonetizationSummary?.blockingReason || res.error || ""
        ).toLowerCase();
        if (normalized === "screening_checkout_already_exists") {
          throw new Error("A screening checkout already exists for this tenant. Review the existing order before retrying.");
        }
        if (normalized === "screening_already_paid" || normalized === "screening_order_already_created") {
          throw new Error("Screening is already paid or in progress for this tenant.");
        }
        if (normalized === "screening_provider_unavailable") {
          throw new Error("Screening is temporarily unavailable. Please try again shortly.");
        }
        if (normalized === "screening_quote_expired") {
          throw new Error("The screening quote expired. Re-open the flow and try again.");
        }
        throw new Error(res.detail || res.error || "Unable to start checkout");
      }
      if (res.tenantInviteUrl) {
        showToast({
          message: paymentResponsibility === "tenant" ? "Tenant payment link ready" : "Invite queued",
          description:
            paymentResponsibility === "tenant"
              ? "The order is set to tenant-pay and the invite link is ready to share."
              : "We’ll email the tenant after payment.",
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
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 10px",
            borderRadius: 999,
            background: "rgba(15, 118, 110, 0.08)",
            color: "#0f766e",
            fontSize: 12,
            fontWeight: 600,
            width: "fit-content",
          }}
        >
          Powered by RentChain screening workflow
          <span style={{ fontWeight: 400, color: text.subtle }}>Soft inquiry (no score impact)</span>
        </div>
        <div style={{ fontSize: 12, color: text.subtle }}>
          Tenant authorizes screening and receives the consent flow. You receive a verified screening report and
          audit-ready record.
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
            {SCREENING_PACKAGE_OPTIONS.map((opt) => (
              <label
                key={opt.key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderRadius: radius.md,
                  border: `1px solid ${screeningPackage === opt.key ? colors.accent : colors.border}`,
                  background: screeningPackage === opt.key ? "rgba(37,99,235,0.08)" : "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <input
                    type="radio"
                    checked={screeningPackage === opt.key}
                    onChange={() => setScreeningPackage(opt.key)}
                  />
                  <div style={{ display: "grid", gap: 4 }}>
                    <span style={{ fontWeight: 700 }}>{opt.label}</span>
                    <span style={{ color: text.subtle, fontSize: 12 }}>{opt.description}</span>
                  </div>
                </div>
                <span style={{ color: text.muted }}>{formatPriceCents(opt.priceCents)}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, color: text.muted }}>Add-ons</div>
          <div style={{ display: "grid", gap: 8 }}>
            {SCREENING_ADDON_OPTIONS.map((addon) => {
              const checked = addons.includes(addon.key);
              return (
                <label
                  key={addon.key}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: radius.md,
                    border: `1px solid ${checked ? colors.accent : colors.border}`,
                    background: checked ? "rgba(37,99,235,0.06)" : "#fff",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setAddons((current) =>
                          checked ? current.filter((item) => item !== addon.key) : [...current, addon.key]
                        )
                      }
                    />
                    <div style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontWeight: 700 }}>{addon.label}</span>
                      <span style={{ color: text.subtle, fontSize: 12 }}>{addon.description}</span>
                    </div>
                  </div>
                  <span style={{ color: text.muted }}>{formatPriceCents(addon.priceCents)}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, color: text.muted }}>Who pays</div>
          <div style={{ display: "grid", gap: 8 }}>
            {[
              { key: "landlord", label: "Landlord pays", summary: "You complete checkout now." },
              { key: "tenant", label: "Tenant pays", summary: "Store the payer model for this screening order." },
            ].map((option) => (
              <label
                key={option.key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: radius.md,
                  border: `1px solid ${paymentResponsibility === option.key ? colors.accent : colors.border}`,
                  background: paymentResponsibility === option.key ? "rgba(37,99,235,0.06)" : "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                <input
                  type="radio"
                  checked={paymentResponsibility === option.key}
                  onChange={() => setPaymentResponsibility(option.key as "landlord" | "tenant")}
                />
                <div style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontWeight: 700 }}>{option.label}</span>
                  <span style={{ color: text.subtle, fontSize: 12 }}>{option.summary}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 12px",
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: "rgba(15,23,42,0.02)",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontWeight: 700 }}>Total</div>
            <div style={{ color: text.subtle, fontSize: 12 }}>
              {selectedPackage.label} package
              {addons.length > 0 ? ` + ${addons.length} add-on${addons.length > 1 ? "s" : ""}` : ""}
            </div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{formatPriceCents(totalPriceCents)}</div>
        </div>

        {error ? <div style={{ color: "#b91c1c", fontSize: 13 }}>{error}</div> : null}
        {!canScreen ? (
          <div style={{ color: text.muted, fontSize: 13 }}>
            Screening is not active on your current plan. Upgrade when you're ready to continue from the applicant workflow.
          </div>
        ) : null}

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
