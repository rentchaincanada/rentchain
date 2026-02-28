import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Section, Button } from "@/components/ui/Ui";
import { spacing, text } from "@/styles/tokens";
import { refreshEntitlements } from "@/lib/entitlements";
import { useAuth } from "@/context/useAuth";
import { useUpgrade } from "@/context/UpgradeContext";
import { useToast } from "@/components/ui/ToastProvider";
import { fetchMe } from "@/api/meApi";
import { canUseTimeline } from "@/features/automation/timeline/timelineEntitlements";

function sanitizeRedirectTo(raw: string | null): string | null {
  if (!raw) return null;
  const value = String(raw || "").trim();
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("://")) return null;
  return value;
}

const BillingCheckoutSuccessPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const redirectTo = useMemo(() => sanitizeRedirectTo(params.get("redirectTo")), [params]);
  const { user, updateUser } = useAuth();
  const { clearUpgradePrompt } = useUpgrade();
  const { showToast } = useToast();
  const [unlockedTimeline, setUnlockedTimeline] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(Boolean(redirectTo));
  const hasHandledRef = useRef(false);

  useEffect(() => {
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;

    let alive = true;
    const previousEntitled = canUseTimeline(user?.plan);

    const run = async () => {
      try {
        setIsRefreshing(true);
        await Promise.race([
          refreshEntitlements(updateUser),
          new Promise((resolve) => setTimeout(resolve, 1200)),
        ]);
        const me = await fetchMe().catch(() => null);
        const nextPlan = String((me as any)?.user?.plan || (me as any)?.plan || user?.plan || "");
        const nowEntitled = canUseTimeline(nextPlan);

        if (!previousEntitled && nowEntitled) {
          setUnlockedTimeline(true);
          showToast({
            message: "Upgrade successful — Timeline unlocked.",
            variant: "success",
          });
        }

        if (redirectTo && !nowEntitled) {
          clearUpgradePrompt();
          navigate(redirectTo);
        }
      } catch {
        // ignore refresh errors
      } finally {
        if (alive) setIsRefreshing(false);
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [navigate, redirectTo, updateUser, clearUpgradePrompt, showToast, user?.plan]);

  return (
    <Section style={{ maxWidth: 560, margin: "0 auto" }}>
      <Card elevated>
        <div style={{ display: "grid", gap: spacing.sm }}>
          <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>
            Upgrade complete
          </h1>
          <div style={{ color: text.muted, fontSize: "0.95rem" }}>
            {isRefreshing
              ? "Refreshing your plan access..."
              : unlockedTimeline
                ? "Your new plan is active. Timeline is now unlocked."
                : redirectTo
                  ? "You're all set. Return to where you left off."
                  : "You're all set. Return to your dashboard to continue."}
          </div>
          <div style={{ display: "flex", gap: spacing.sm }}>
            <Button type="button" onClick={() => navigate(redirectTo || "/dashboard")} disabled={isRefreshing}>
              Continue
            </Button>
            {unlockedTimeline ? (
              <Button type="button" onClick={() => navigate("/automation/timeline")} disabled={isRefreshing}>
                Go to Timeline
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={() => navigate("/billing")}>
              View billing
            </Button>
          </div>
        </div>
      </Card>
    </Section>
  );
};

export default BillingCheckoutSuccessPage;
