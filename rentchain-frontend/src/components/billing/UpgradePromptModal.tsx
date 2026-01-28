import React from "react";
import { useNavigate } from "react-router-dom";

export function UpgradePromptModal({
  open,
  onClose,
  featureKey,
  currentPlan,
  requiredPlan,
}: {
  open: boolean;
  onClose: () => void;
  featureKey: string;
  currentPlan?: string;
  requiredPlan?: string;
}) {
  const navigate = useNavigate();
  if (!open) return null;

  const normalizedFeature = String(featureKey || "").trim();
  const featureLabel = labelForFeature(normalizedFeature);
  const currentLabel = planLabel(currentPlan);
  const requiredLabel = planLabel(requiredPlan);

  const featureText = featureLabel || "this feature";
  const title = featureLabel ? `Upgrade to unlock ${featureLabel}` : "Upgrade required";
  const body =
    requiredLabel && currentLabel
      ? `Your ${currentLabel} plan does not include ${featureText}. Upgrade to ${requiredLabel} to continue.`
      : requiredLabel
      ? `Upgrade to ${requiredLabel} to continue.`
      : "Upgrade to continue.";

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
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(520px, 92vw)",
          background: "white",
          borderRadius: 20,
          zIndex: 121,
          boxShadow: "0 30px 80px rgba(2,6,23,0.45)",
        }}
      >
        <div style={{ padding: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.85 }}>{body}</div>

          <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
            {currentLabel ? (
              <PlanRow name={currentLabel} active description="Current plan" />
            ) : null}
            {requiredLabel ? (
              <PlanRow name={requiredLabel} highlight description="Required plan" />
            ) : null}
          </div>

          <div
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 10,
            }}
          >
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
              Not now
            </button>

            <button
              onClick={() => navigate("/pricing")}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: "1px solid rgba(59,130,246,0.45)",
                background: "rgba(59,130,246,0.12)",
                color: "#2563eb",
                cursor: "pointer",
                fontWeight: 900,
                boxShadow: "0 10px 30px rgba(37,99,235,0.2)",
              }}
            >
              View plans
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function planLabel(plan?: string) {
  const raw = String(plan || "").trim().toLowerCase();
  if (!raw) return undefined;
  if (raw === "screening") return "Screening";
  if (raw === "starter") return "Starter";
  if (raw === "core") return "Core";
  if (raw === "pro") return "Pro";
  if (raw === "elite") return "Elite";
  return raw[0].toUpperCase() + raw.slice(1);
}

function labelForFeature(featureKey: string) {
  const key = String(featureKey || "").trim();
  if (!key) return undefined;
  const normalized = key.toLowerCase();
  const map: Record<string, string> = {
    unitstable: "Units",
    units: "Units",
    properties: "Properties",
    leases: "Leases",
    maintenance: "Maintenance",
    notices: "Notices",
    tenantportal: "Tenant portal",
    messaging: "Messaging",
    ledger: "Ledger",
    exports: "Exports",
    screening: "Screening",
    "ai.insights": "AI insights",
    "ai.summary": "AI summary",
    "portfolio.ai": "Portfolio AI",
  };
  if (map[normalized]) return map[normalized];
  return key
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function PlanRow({
  name,
  description,
  active,
  highlight,
}: {
  name: string;
  description: string;
  active?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 14,
        border: active
          ? "1px solid rgba(34,197,94,0.45)"
          : highlight
          ? "1px solid rgba(59,130,246,0.45)"
          : "1px solid rgba(148,163,184,0.25)",
        background: active
          ? "rgba(34,197,94,0.10)"
          : highlight
          ? "rgba(59,130,246,0.10)"
          : "rgba(148,163,184,0.06)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div>
        <div style={{ fontWeight: 900 }}>{name}</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{description}</div>
      </div>
      {active ? (
        <span style={{ fontSize: 12, fontWeight: 900, color: "#16a34a" }}>
          Current
        </span>
      ) : null}
    </div>
  );
}
