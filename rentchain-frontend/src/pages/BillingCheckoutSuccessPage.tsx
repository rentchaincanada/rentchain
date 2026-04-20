import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Section, Button } from "@/components/ui/Ui";
import { spacing, text } from "@/styles/tokens";
import { refreshEntitlements } from "@/lib/entitlements";
import { useAuth } from "@/context/useAuth";
import { useUpgrade } from "@/context/UpgradeContext";
import { useToast } from "@/components/ui/ToastProvider";
import { fetchCheckoutSessionStatus, type CheckoutSessionStatus } from "@/api/billingApi";
import { planLabel } from "@/lib/plan";
import { getPostUpgradeContent, setPostUpgradeState } from "@/lib/postUpgrade";

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
  const sessionId = String(params.get("session_id") || "").trim();
  const { updateUser } = useAuth();
  const { clearUpgradePrompt } = useUpgrade();
  const { showToast } = useToast();
  const [result, setResult] = useState<CheckoutSessionStatus | null>(null);
  const [viewState, setViewState] = useState<"loading" | "success" | "pending" | "failed">(
    sessionId ? "loading" : "failed"
  );
  const hasHandledRef = useRef(false);

  useEffect(() => {
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;

    const run = async () => {
      if (!sessionId) {
        setViewState("failed");
        return;
      }

      try {
        setViewState("loading");
        const next = await fetchCheckoutSessionStatus(sessionId);
        setResult(next);

        const isSuccess =
          next?.status === "complete" &&
          (next?.payment_status === "paid" || next?.payment_status === "no_payment_required") &&
          Boolean(next?.plan);
        const isPending =
          next?.status === "open" ||
          next?.payment_status === "unpaid" ||
          next?.payment_status == null;

        if (isSuccess) {
          await refreshEntitlements(updateUser);
          if (next.plan) {
            setPostUpgradeState(next.plan);
          }
          clearUpgradePrompt();
          setViewState("success");
          showToast({
            message: `Upgrade confirmed${next.plan ? `: ${planLabel(next.plan)}` : ""}.`,
            variant: "success",
          });
          return;
        }

        setViewState(isPending ? "pending" : "failed");
      } catch {
        setViewState("failed");
      }
    };

    void run();
  }, [sessionId, updateUser, clearUpgradePrompt, showToast]);

  const primaryPlanLabel = result?.plan ? planLabel(result.plan) : null;
  const postUpgradeContent = result?.plan ? getPostUpgradeContent(result.plan) : null;
  const continuePath = redirectTo || "/properties";

  const message = (() => {
    if (viewState === "loading") return "We’re confirming your Stripe checkout and syncing your plan.";
    if (viewState === "success") {
      return primaryPlanLabel
        ? `Your ${primaryPlanLabel} plan is active. Premium features are now unlocked.`
        : "Your plan is active. Premium features are now unlocked.";
    }
    if (viewState === "pending") {
      return "We couldn't confirm your upgrade yet. Payment may still be processing.";
    }
    if (!sessionId) {
      return "We couldn't confirm your upgrade yet because the checkout session ID is missing.";
    }
    return "We couldn't confirm your upgrade yet. Please return to billing and try again.";
  })();

  return (
    <Section style={{ maxWidth: 560, margin: "0 auto" }}>
      <Card elevated>
        <div style={{ display: "grid", gap: spacing.sm }}>
          <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>
            {viewState === "loading"
              ? "Confirming upgrade"
              : viewState === "success"
                ? "Upgrade confirmed"
                : viewState === "pending"
                  ? "Upgrade pending"
                  : "Upgrade not confirmed"}
          </h1>
          <div style={{ color: text.muted, fontSize: "0.95rem" }}>{message}</div>
          {viewState === "success" && primaryPlanLabel ? (
            <div
              style={{
                border: "1px solid #dbeafe",
                background: "#eff6ff",
                borderRadius: 12,
                padding: spacing.md,
                display: "grid",
                gap: 6,
              }}
            >
              <div style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.06em", color: text.muted }}>
                Active plan
              </div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>{primaryPlanLabel}</div>
              <div style={{ color: text.muted, fontSize: "0.95rem" }}>
                {postUpgradeContent?.benefitSummary || "Your account capabilities have been refreshed for this workspace."}
              </div>
              {postUpgradeContent?.unlockedFeatures?.length ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                  {postUpgradeContent.unlockedFeatures.map((feature) => (
                    <div
                      key={feature}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 999,
                        border: "1px solid #bfdbfe",
                        background: "#ffffff",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                      }}
                    >
                      {feature}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {viewState !== "loading" ? (
            <div style={{ color: text.muted, fontSize: "0.9rem" }}>
              {viewState === "success"
                ? "Next steps: go back to the dashboard or move directly into the workflows your upgrade unlocked."
                : "If payment already went through, give it a moment and check billing again."}
            </div>
          ) : null}
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
            {viewState === "success" ? (
              <>
                {postUpgradeContent ? (
                  <Button type="button" onClick={() => navigate(postUpgradeContent.primaryAction.to)}>
                    {postUpgradeContent.primaryAction.label}
                  </Button>
                ) : null}
                <Button type="button" onClick={() => navigate("/dashboard")}>
                  Go to dashboard
                </Button>
                {postUpgradeContent ? (
                  <Button type="button" variant="secondary" onClick={() => navigate(postUpgradeContent.secondaryAction.to)}>
                    {postUpgradeContent.secondaryAction.label}
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" onClick={() => navigate(continuePath)}>
                    Continue setup
                  </Button>
                )}
                {redirectTo ? (
                  <Button type="button" variant="ghost" onClick={() => navigate(continuePath)}>
                    Continue where you left off
                  </Button>
                ) : null}
              </>
            ) : (
              <>
                <Button type="button" onClick={() => navigate("/billing")}>
                  Return to billing
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate("/billing")}>
                  Try again
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    </Section>
  );
};

export default BillingCheckoutSuccessPage;
