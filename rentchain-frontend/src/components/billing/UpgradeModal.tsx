import React from "react";
import { NotifyMeModal } from "./NotifyMeModal";
import { useAuth } from "../../context/useAuth";

export type UpgradeReason =
  | "propertiesMax"
  | "unitsMax"
  | "screening"
  | "exports"
  | "automation";

export function UpgradeModal({
  open,
  onClose,
  reason,
  currentPlan = "Starter",
  copy: propCopy,
}: {
  open: boolean;
  onClose: () => void;
  reason: UpgradeReason;
  currentPlan?: string;
  copy?: { title?: string; body?: string };
}) {
  if (!open) return null;

  const { user } = useAuth();
  const [notifyOpen, setNotifyOpen] = React.useState(false);
  const [notifyPlan, setNotifyPlan] = React.useState<"core" | "pro" | "elite">("core");

  const safeReason = reason ?? ("propertiesMax" as UpgradeReason);

  const reasonCopy: Record<UpgradeReason, { title: string; body: string }> = {
    propertiesMax: {
      title: "Property limit reached",
      body: "Your Starter plan allows up to a limited number of properties. Upgrade to unlock more.",
    },
    unitsMax: {
      title: "Unit limit reached",
      body: "You’ve reached the unit limit on Starter. Core and above support larger portfolios.",
    },
    screening: {
      title: "Screening upgrade required",
      body: "Tenant screening is available on Starter with limits. Upgrade to unlock automation and higher volumes.",
    },
    exports: {
      title: "Export upgrade required",
      body: "Advanced exports are available on higher plans.",
    },
    automation: {
      title: "Automation upgrade required",
      body: "Automated workflows unlock in Core and above.",
    },
  };

  const rawCopy = propCopy ?? reasonCopy[safeReason];

  const copy = {
    title: rawCopy?.title ?? "Upgrade required",
    body: rawCopy?.body ?? "You’ve reached your plan limit. Upgrade to continue.",
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(2,6,23,0.45)",
          zIndex: 100,
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
          zIndex: 101,
          boxShadow: "0 30px 80px rgba(2,6,23,0.45)",
        }}
      >
        <div style={{ padding: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            {copy?.title ?? "Upgrade required"}
          </div>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.85 }}>
            {copy?.body ?? "You’ve reached your plan limit. Upgrade to continue."}
          </div>

          <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
            <PlanRow name={currentPlan} active description="Great for small portfolios" />
            <PlanRow name="Core" highlight description="Automation, analytics, higher limits" />
            <PlanRow name="Pro" description="Team workflows and scale" />
            <PlanRow name="Elite" description="Institutional-grade operations" />
          </div>

          <div
            style={{
              marginTop: 24,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
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
              Maybe later
            </button>

            <button
              onClick={() => {
                setNotifyPlan("core");
                setNotifyOpen(true);
              }}
              style={{
                padding: "10px 14px",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.35)",
                background: "transparent",
                cursor: "pointer",
                fontWeight: 900,
              }}
              title="Get early access updates"
            >
              Notify me
            </button>

            <button
              onClick={() => {
                window.location.href = "/pricing";
              }}
              style={{
                padding: "10px 16px",
                borderRadius: 12,
                border: "1px solid rgba(59,130,246,0.45)",
                background: "rgba(59,130,246,0.12)",
                color: "#2563eb",
                cursor: "pointer",
                fontWeight: 900,
              }}
            >
              View plans
            </button>
          </div>
        </div>
      </div>

      <NotifyMeModal
        open={notifyOpen}
        onClose={() => setNotifyOpen(false)}
        desiredPlan={notifyPlan}
        context="upgrade_modal"
        defaultEmail={user?.email}
      />
    </>
  );
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
