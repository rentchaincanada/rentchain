import React, { useEffect, useMemo, useRef, useState } from "react";
import { getUpgradeCopy } from "@/billing/upgradeCopy";
import { normalizePlanLabel } from "@/billing/planLabel";
import { startCheckout } from "@/billing/startCheckout";

export function UpgradePromptModal({
  open,
  onClose,
  featureKey,
  currentPlan,
  requiredPlan,
  source,
  redirectTo,
}: {
  open: boolean;
  onClose: () => void;
  featureKey: string;
  currentPlan?: string;
  requiredPlan?: string;
  source?: string;
  redirectTo?: string;
}) {
  if (!open) return null;

  const copy = useMemo(() => getUpgradeCopy(featureKey), [featureKey]);
  const requiredPlanKey = requiredPlan;
  const requiredLabel = copy.requiredPlanLabel || normalizePlanLabel(requiredPlan || "");
  const currentLabel = normalizePlanLabel(currentPlan || "");
  const primaryLabel =
    copy.primaryCta || (requiredLabel ? `Upgrade to ${requiredLabel}` : "Upgrade now");
  const secondaryLabel = copy.secondaryCta || "Not now";
  const title = copy.title;
  const subtitle = copy.subtitle;
  const bullets = copy.bullets?.slice(0, 3) || [];

  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  const resolveTier = (input?: string) => {
    const raw = String(input || "").trim().toLowerCase();
    if (raw === "starter" || raw === "core") return "starter";
    if (raw === "pro") return "pro";
    if (raw === "business" || raw === "elite" || raw === "enterprise") return "business";
    return "pro";
  };
  const requiredTier = resolveTier(requiredPlanKey);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => primaryRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = modalRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => {
        if (el.hasAttribute("disabled")) return false;
        if (el.getAttribute("aria-hidden") === "true") return false;
        if (el.offsetParent === null) return false;
        return true;
      });
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!root.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,6,23,0.45)",
          zIndex: 120,
        }}
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(560px, 92vw)",
          background: "white",
          borderRadius: 22,
          zIndex: 121,
          boxShadow: "0 30px 80px rgba(2,6,23,0.45)",
        }}
      >
        <div style={{ padding: 28, display: "grid", gap: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              aria-hidden
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(56,189,248,0.25))",
                border: "1px solid rgba(37,99,235,0.35)",
                display: "grid",
                placeItems: "center",
                color: "#1d4ed8",
              fontWeight: 900,
              fontSize: 18,
            }}
          >
              ^
            </div>
            <div>
              <div style={{ fontWeight: 900, fontSize: 20 }}>{title}</div>
              <div style={{ marginTop: 4, fontSize: 14, opacity: 0.82 }}>{subtitle}</div>
            </div>
          </div>

          {bullets.length ? (
            <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6, fontSize: 14 }}>
              {bullets.map((b) => (
                <li key={b} style={{ color: "#0f172a" }}>
                  {b}
                </li>
              ))}
            </ul>
          ) : null}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(148,163,184,0.08)",
              fontSize: 13,
              fontWeight: 700,
              color: "#1f2937",
            }}
          >
            <span>Current: {currentLabel}</span>
            <span style={{ opacity: 0.6 }}>-&gt;</span>
            <span>Needed: {requiredLabel}</span>
          </div>

          {copy.trustNote ? (
            <div style={{ fontSize: 12, color: "rgba(71,85,105,0.9)" }}>{copy.trustNote}</div>
          ) : null}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setInterval("monthly")}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border:
                  interval === "monthly"
                    ? "1px solid rgba(37,99,235,0.6)"
                    : "1px solid rgba(148,163,184,0.35)",
                background: interval === "monthly" ? "rgba(37,99,235,0.12)" : "transparent",
                color: "#0f172a",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setInterval("yearly")}
              style={{
                padding: "8px 12px",
                borderRadius: 10,
                border:
                  interval === "yearly"
                    ? "1px solid rgba(37,99,235,0.6)"
                    : "1px solid rgba(148,163,184,0.35)",
                background: interval === "yearly" ? "rgba(37,99,235,0.12)" : "transparent",
                color: "#0f172a",
                fontWeight: 800,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Yearly
            </button>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <button
              ref={primaryRef}
              onClick={() =>
                startCheckout({
                  tier: requiredTier,
                  interval,
                  requiredPlan: requiredPlanKey,
                  featureKey,
                  source,
                  redirectTo,
                })
              }
              style={{
                padding: "12px 16px",
                borderRadius: 14,
                border: "1px solid rgba(37,99,235,0.45)",
                background: "linear-gradient(135deg, rgba(37,99,235,0.95), rgba(14,165,233,0.95))",
                color: "white",
                cursor: "pointer",
                fontWeight: 900,
                fontSize: 14,
                boxShadow: "0 18px 40px rgba(37,99,235,0.28)",
              }}
            >
              {primaryLabel}
            </button>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <button
                onClick={onClose}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid rgba(148,163,184,0.35)",
                  background: "transparent",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                {secondaryLabel}
              </button>
              <a
                href="/pricing"
                style={{
                  alignSelf: "center",
                  color: "#2563eb",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                }}
              >
                Learn more
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
