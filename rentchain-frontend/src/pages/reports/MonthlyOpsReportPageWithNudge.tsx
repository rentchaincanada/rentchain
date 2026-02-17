import React from "react";
import { useNavigate } from "react-router-dom";
import MonthlyOpsReportPage from "./MonthlyOpsReportPage";
import { useAuth } from "../../context/useAuth";
import { useBillingStatus } from "@/hooks/useBillingStatus";
import {
  canShowNudge,
  hasMeaningfulAction,
  markNudgeDismissed,
  markNudgeShown,
} from "@/features/upgradeNudges/nudgeStore";
import { NUDGE_COPY } from "@/features/upgradeNudges/nudgeTypes";
import { UpgradeNudgeInlineCard } from "@/features/upgradeNudges/UpgradeNudgeInlineCard";
import { openUpgradeFlow } from "@/billing/openUpgradeFlow";
import { logTelemetryEvent } from "@/api/telemetryApi";

export default function MonthlyOpsReportPageWithNudge() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const billingStatus = useBillingStatus();
  const [showNudge, setShowNudge] = React.useState(false);

  React.useEffect(() => {
    const roleLower = String(user?.actorRole || user?.role || "").toLowerCase();
    const isAdmin = roleLower === "admin";
    const isStarter = billingStatus.tier === "starter";
    const userId = String(user?.id || "");
    if (!userId || isAdmin || !isStarter) return;
    if (!hasMeaningfulAction(userId)) return;
    if (!canShowNudge(userId, "FEATURE_EXPORT_CSV")) return;
    markNudgeShown(userId, "FEATURE_EXPORT_CSV");
    setShowNudge(true);
    void logTelemetryEvent("nudge_impression", {
      type: "FEATURE_EXPORT_CSV",
      page: "/reports/monthly-ops",
      plan: billingStatus.tier,
    });
  }, [billingStatus.tier, user?.actorRole, user?.id, user?.role]);

  return (
    <div>
      {showNudge ? (
        <div style={{ maxWidth: 980, margin: "14px auto 0", padding: "0 24px" }}>
          <UpgradeNudgeInlineCard
            type="FEATURE_EXPORT_CSV"
            title={NUDGE_COPY.FEATURE_EXPORT_CSV.title}
            body={NUDGE_COPY.FEATURE_EXPORT_CSV.body}
            primaryCtaLabel={NUDGE_COPY.FEATURE_EXPORT_CSV.primaryCtaLabel}
            secondaryCtaLabel={NUDGE_COPY.FEATURE_EXPORT_CSV.secondaryCtaLabel}
            onUpgrade={() => {
              void logTelemetryEvent("nudge_click_upgrade", { type: "FEATURE_EXPORT_CSV" });
              void openUpgradeFlow({ navigate });
            }}
            onDismiss={() => {
              if (user?.id) markNudgeDismissed(String(user.id), "FEATURE_EXPORT_CSV");
              void logTelemetryEvent("nudge_dismiss", { type: "FEATURE_EXPORT_CSV" });
              setShowNudge(false);
            }}
          />
        </div>
      ) : null}
      <MonthlyOpsReportPage />
    </div>
  );
}
