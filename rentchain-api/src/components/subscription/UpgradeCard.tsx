import React from "react";
import { useSubscription } from "../../context/SubscriptionContext";

interface UpgradeCardProps {
  title: string;
  description: string;
  requiredPlan: "starter" | "core" | "pro" | "elite";
}

export const UpgradeCard: React.FC<UpgradeCardProps> = ({
  title,
  description,
  requiredPlan,
}) => {
  const { plan } = useSubscription();

  const planLabel = (p: string) => {
    if (p === "starter") return "Starter";
    if (p === "core") return "Core";
    if (p === "pro") return "Pro";
    if (p === "elite") return "Elite";
    return p;
  };

  return (
    <div
      style={{
        borderRadius: 16,
        padding: 12,
        background:
          "radial-gradient(circle at top left, rgba(56,189,248,0.15) 0, rgba(15,23,42,1) 40%, rgba(15,23,42,1) 100%)",
        border: "1px dashed rgba(59,130,246,0.7)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#e5e7eb",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#9ca3af",
        }}
      >
        {description}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#93c5fd",
          marginTop: 4,
        }}
      >
        Available on <strong>{planLabel(requiredPlan)}</strong> and above. You
        are currently on <strong>{planLabel(plan)}</strong>.
      </div>
      <div
        style={{
          marginTop: 4,
          display: "flex",
          justifyContent: "flex-start",
        }}
      >
        <button
          type="button"
          style={{
            borderRadius: 999,
            border: "none",
            padding: "4px 10px",
            background:
              "linear-gradient(90deg, rgba(59,130,246,0.9), rgba(56,189,248,0.9))",
            color: "#f9fafb",
            fontSize: 11,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          View plans
        </button>
      </div>
    </div>
  );
};
