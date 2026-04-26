import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Section, Button } from "../../components/ui/Ui";
import { apiFetch } from "../../api/apiFetch";
import { spacing, text } from "../../styles/tokens";
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
import {
  calculateScreeningDisplayPrice,
  formatPriceCents,
  getScreeningPackageOption,
  SCREENING_ADDON_OPTIONS,
  SCREENING_PACKAGE_OPTIONS,
} from "../../components/screening/screeningMonetizationOptions";

type CheckoutResponse = {
  ok: boolean;
  checkoutUrl?: string;
  error?: string;
  errorCode?: string;
  detail?: string;
  reasonCode?: string;
  screeningMonetizationSummary?: {
    blockingReason?: string | null;
  };
};

const reasonCopy: Record<string, string> = {
  MISSING_TENANT_PROFILE: "Tenant profile details are incomplete.",
  APPLICATION_STATUS_NOT_READY: "The application must be submitted before screening.",
  MISSING_CONSENT: "Applicant consent is required before screening.",
  SCREENING_ALREADY_PAID: "Screening has already been paid for.",
  LANDLORD_NOT_AUTHORIZED: "You don’t have access to start screening for this application.",
};

const mapReasonCopy = (code?: string | null) => {
  if (!code) return null;
  return reasonCopy[code] || null;
};

const mapErrorMessage = (code?: string | null) => {
  const normalized = String(code || "").toLowerCase();
  if (normalized === "stripe_not_configured") {
    return "Payments are temporarily unavailable. Please contact support.";
  }
  if (normalized === "unauthorized") {
    return "Please log in to continue.";
  }
  if (normalized === "not_found") {
    return "Application not found.";
  }
  if (normalized === "not_eligible") {
    return "This application isn't ready for screening yet.";
  }
  if (normalized === "screening_already_paid") {
    return "This application’s screening has already been paid. You can view the status in the application.";
  }
  if (normalized === "screening_checkout_already_exists") {
    return "A screening checkout already exists for this application. Return to the application to review the current payment state.";
  }
  if (normalized === "screening_order_already_created") {
    return "A screening order already exists for this application. Return to the application to review its status.";
  }
  if (normalized === "screening_quote_expired") {
    return "This screening quote expired. Return to the application to refresh pricing and start checkout again.";
  }
  if (normalized === "screening_provider_unavailable") {
    return "Screening is temporarily unavailable. Please try again shortly.";
  }
  if (normalized === "forbidden") {
    return "You don’t have access to start screening for this application.";
  }
  if (normalized === "invalid_redirect_origin") {
    return "The redirect destination is not allowed. Please try again from the dashboard.";
  }
  if (normalized === "invalid_request") {
    return "This application isn't ready for screening yet.";
  }
  if (normalized === "transunion_not_connected") {
    return "Connect your TransUnion membership before starting screening.";
  }
  return "Unable to start screening checkout. Please try again.";
};

const mapErrorTitle = (code?: string | null) => {
  const normalized = String(code || "").toLowerCase();
  if (normalized === "screening_already_paid") {
    return "Screening already paid";
  }
  if (normalized === "screening_checkout_already_exists") {
    return "Checkout already created";
  }
  if (normalized === "screening_order_already_created") {
    return "Screening already in progress";
  }
  if (normalized === "screening_quote_expired") {
    return "Quote expired";
  }
  if (normalized === "screening_provider_unavailable") {
    return "Screening unavailable";
  }
  if (normalized === "transunion_not_connected") {
    return "Connect TransUnion to start screening";
  }
  return "Unable to start screening checkout";
};

const ScreeningStartPage: React.FC = () => {
  const { user } = useAuth();
  const billingStatus = useBillingStatus();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNudge, setShowNudge] = useState(false);
  const startedRef = useRef(false);

  const applicationId =
    searchParams.get("applicationId") || searchParams.get("rentalApplicationId") || "";
  const rawReturnTo = searchParams.get("returnTo") || "/dashboard";
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/dashboard";
  const successPath = searchParams.get("successPath") || "/screening/success";
  const cancelPath = searchParams.get("cancelPath") || "/screening/cancel";
  const configureMode = searchParams.get("configure") === "1";
  const requestedPackage =
    searchParams.get("package") === "standard" || searchParams.get("package") === "premium"
      ? (searchParams.get("package") as "standard" | "premium")
      : "basic";
  const requestedAddons = (searchParams.get("addons") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const requestedPaymentResponsibility =
    searchParams.get("payer") === "tenant" || searchParams.get("paymentResponsibility") === "tenant"
      ? "tenant"
      : "landlord";
  const [screeningPackage, setScreeningPackage] = useState<"basic" | "standard" | "premium">(requestedPackage);
  const [addons, setAddons] = useState<string[]>(requestedAddons);
  const [paymentResponsibility, setPaymentResponsibility] = useState<"landlord" | "tenant">(
    requestedPaymentResponsibility
  );
  const packageOption = getScreeningPackageOption(screeningPackage);
  const totalPriceCents = calculateScreeningDisplayPrice({
    packageKey: screeningPackage,
    addons: addons as Array<"income_verification" | "fraud_detection" | "enhanced_background">,
  });

  useEffect(() => {
    if (startedRef.current) return;
    if (configureMode) {
      setLoading(false);
      return;
    }
    startedRef.current = true;

    if (!applicationId) {
      setError("Application ID is required to start screening.");
      setLoading(false);
      return;
    }

    const startCheckout = async () => {
      setLoading(true);
      setError(null);
      setDetail(null);
      setReason(null);
      setErrorCode(null);
      try {
        const res = await apiFetch<CheckoutResponse>(
          `/rental-applications/${encodeURIComponent(applicationId)}/screening/checkout`,
          {
            method: "POST",
            body: {
              successPath,
              cancelPath,
              returnTo,
              screeningTier: packageOption.legacyTier,
              screeningPackage: packageOption.key,
              addons,
              paymentResponsibility,
            },
            allowStatuses: [400, 401, 403, 404, 409, 500],
          }
        );

        if (res?.ok && res.checkoutUrl) {
          window.location.assign(res.checkoutUrl);
          return;
        }

        const normalizedError = String(
          res?.errorCode || res?.screeningMonetizationSummary?.blockingReason || res?.error || ""
        ).toLowerCase();
        setErrorCode(normalizedError);
        setError(mapErrorMessage(res?.errorCode || res?.error || res?.screeningMonetizationSummary?.blockingReason));
        if (normalizedError === "not_eligible") {
          setReason(mapReasonCopy(res?.reasonCode) || "Eligibility requirements aren't complete yet.");
        }
        if (import.meta.env.DEV && res?.detail) {
          setDetail(String(res.detail));
        }
      } catch (err: any) {
        setError("Unable to start screening checkout. Please try again.");
        if (import.meta.env.DEV && err?.message) {
          setDetail(String(err.message));
        }
      } finally {
        setLoading(false);
      }
    };

    void startCheckout();
  }, [applicationId, cancelPath, configureMode, returnTo, successPath, packageOption.key, packageOption.legacyTier, addons, paymentResponsibility]);

  const startCheckout = async () => {
    setLoading(true);
    setError(null);
    setDetail(null);
    setReason(null);
    setErrorCode(null);
    try {
      const res = await apiFetch<CheckoutResponse>(
        `/rental-applications/${encodeURIComponent(applicationId)}/screening/checkout`,
        {
          method: "POST",
          body: {
            successPath,
            cancelPath,
            returnTo,
            screeningTier: packageOption.legacyTier,
            screeningPackage: packageOption.key,
            addons,
            paymentResponsibility,
          },
          allowStatuses: [400, 401, 403, 404, 409, 500],
        }
      );

      if (res?.ok && res.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
        return;
      }

      const normalizedError = String(
        res?.errorCode || res?.screeningMonetizationSummary?.blockingReason || res?.error || ""
      ).toLowerCase();
      setErrorCode(normalizedError);
      setError(mapErrorMessage(res?.errorCode || res?.error || res?.screeningMonetizationSummary?.blockingReason));
      if (normalizedError === "not_eligible") {
        setReason(mapReasonCopy(res?.reasonCode) || "Eligibility requirements aren't complete yet.");
      }
      if (import.meta.env.DEV && res?.detail) {
        setDetail(String(res.detail));
      }
    } catch (err: any) {
      setError("Unable to start screening checkout. Please try again.");
      if (import.meta.env.DEV && err?.message) {
        setDetail(String(err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const roleLower = String(user?.actorRole || user?.role || "").toLowerCase();
    const isAdmin = roleLower === "admin";
    const isStarter = billingStatus.tier === "starter";
    const userId = String(user?.id || "");
    if (!userId || isAdmin || !isStarter) return;
    if (!hasMeaningfulAction(userId)) return;
    if (!canShowNudge(userId, "FEATURE_SCREENING_AUTOMATION")) return;
    markNudgeShown(userId, "FEATURE_SCREENING_AUTOMATION");
    setShowNudge(true);
    void logTelemetryEvent("nudge_impression", {
      type: "FEATURE_SCREENING_AUTOMATION",
      page: "/screening/start",
      plan: billingStatus.tier,
    });
  }, [billingStatus.tier, user?.actorRole, user?.id, user?.role]);

  return (
    <Section style={{ maxWidth: 680, margin: "0 auto" }}>
      {showNudge ? (
        <div style={{ marginBottom: spacing.sm }}>
          <UpgradeNudgeInlineCard
            type="FEATURE_SCREENING_AUTOMATION"
            title={NUDGE_COPY.FEATURE_SCREENING_AUTOMATION.title}
            body={NUDGE_COPY.FEATURE_SCREENING_AUTOMATION.body}
            primaryCtaLabel={NUDGE_COPY.FEATURE_SCREENING_AUTOMATION.primaryCtaLabel}
            secondaryCtaLabel={NUDGE_COPY.FEATURE_SCREENING_AUTOMATION.secondaryCtaLabel}
            onUpgrade={() => {
              void logTelemetryEvent("nudge_click_upgrade", { type: "FEATURE_SCREENING_AUTOMATION" });
              void openUpgradeFlow({ navigate });
            }}
            onDismiss={() => {
              if (user?.id) markNudgeDismissed(String(user.id), "FEATURE_SCREENING_AUTOMATION");
              void logTelemetryEvent("nudge_dismiss", { type: "FEATURE_SCREENING_AUTOMATION" });
              setShowNudge(false);
            }}
          />
        </div>
      ) : null}
      <Card elevated>
        {loading ? (
          <div style={{ display: "grid", gap: spacing.sm }}>
            <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>
              Starting checkout…
            </h1>
            <div style={{ color: text.muted, fontSize: "0.95rem" }}>
              We’re redirecting you to Stripe Checkout to complete payment.
            </div>
          </div>
      ) : (
          <div style={{ display: "grid", gap: spacing.sm }}>
            {configureMode && !error ? (
              <div style={{ display: "grid", gap: spacing.sm }}>
                <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>Choose a screening package</h1>
                <div style={{ color: text.muted, fontSize: "0.95rem" }}>
                  Select the package, optional add-ons, and who pays before starting checkout.
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {SCREENING_PACKAGE_OPTIONS.map((option) => (
                    <label
                      key={option.key}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: 12,
                        borderRadius: 12,
                        border: `1px solid ${
                          screeningPackage === option.key ? "rgba(37,99,235,0.6)" : "rgba(15,23,42,0.12)"
                        }`,
                        background: screeningPackage === option.key ? "rgba(37,99,235,0.06)" : "#fff",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          type="radio"
                          checked={screeningPackage === option.key}
                          onChange={() => setScreeningPackage(option.key)}
                        />
                        <div style={{ display: "grid", gap: 4 }}>
                          <strong>{option.label}</strong>
                          <span style={{ color: text.muted, fontSize: "0.9rem" }}>{option.description}</span>
                        </div>
                      </div>
                      <strong>{formatPriceCents(option.priceCents)}</strong>
                    </label>
                  ))}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {SCREENING_ADDON_OPTIONS.map((option) => {
                    const checked = addons.includes(option.key);
                    return (
                      <label
                        key={option.key}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 8,
                          padding: 12,
                          borderRadius: 12,
                          border: `1px solid ${checked ? "rgba(37,99,235,0.45)" : "rgba(15,23,42,0.12)"}`,
                        }}
                      >
                        <div style={{ display: "flex", gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setAddons((current) =>
                                checked ? current.filter((item) => item !== option.key) : [...current, option.key]
                              )
                            }
                          />
                          <div style={{ display: "grid", gap: 4 }}>
                            <strong>{option.label}</strong>
                            <span style={{ color: text.muted, fontSize: "0.9rem" }}>{option.description}</span>
                          </div>
                        </div>
                        <strong>{formatPriceCents(option.priceCents)}</strong>
                      </label>
                    );
                  })}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {[
                    { key: "landlord", label: "Landlord pays" },
                    { key: "tenant", label: "Tenant pays" },
                  ].map((option) => (
                    <label
                      key={option.key}
                      style={{
                        display: "flex",
                        gap: 8,
                        padding: 12,
                        borderRadius: 12,
                        border: `1px solid ${
                          paymentResponsibility === option.key ? "rgba(37,99,235,0.45)" : "rgba(15,23,42,0.12)"
                        }`,
                      }}
                    >
                      <input
                        type="radio"
                        checked={paymentResponsibility === option.key}
                        onChange={() => setPaymentResponsibility(option.key as "landlord" | "tenant")}
                      />
                      <strong>{option.label}</strong>
                    </label>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 12,
                    background: "rgba(15,23,42,0.04)",
                  }}
                >
                  <span>Total</span>
                  <strong>{formatPriceCents(totalPriceCents)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button onClick={() => void startCheckout()} disabled={loading}>
                    {loading ? "Starting checkout…" : "Continue to checkout"}
                  </Button>
                </div>
              </div>
            ) : null}
            {!configureMode || error ? (
            <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>
              {mapErrorTitle(errorCode)}
            </h1>
            ) : null}
            {!configureMode || error ? (
            <div style={{ color: text.muted, fontSize: "0.95rem" }}>
              {error || "Something went wrong. Please try again."}
            </div>
            ) : null}
            {errorCode === "transunion_not_connected" ? (
              <div
                style={{
                  border: `1px solid rgba(15,23,42,0.12)`,
                  borderRadius: 16,
                  padding: spacing.md,
                  background: "rgba(15,23,42,0.02)",
                  display: "grid",
                  gap: spacing.sm,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                  Connect TransUnion to start screening
                </div>
                <div style={{ color: text.muted, fontSize: "0.95rem" }}>
                  Before you can screen a tenant in RentChain, connect your TransUnion membership
                  credentials.
                </div>
                <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
                  <Button
                    type="button"
                    onClick={() => navigate("/applications?openTransUnionConnect=1")}
                  >
                    Connect TransUnion
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => navigate("/applications?openTransUnionAccess=1")}
                  >
                    Get Access
                  </Button>
                </div>
              </div>
            ) : null}
            {reason ? (
              <div style={{ color: text.subtle, fontSize: "0.9rem" }}>Reason: {reason}</div>
            ) : null}
            {detail ? (
              <div style={{ color: text.subtle, fontSize: "0.85rem" }}>{detail}</div>
            ) : null}
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
              {errorCode === "screening_already_paid" ? (
                <>
                  {applicationId ? (
                    <Button
                      type="button"
                      onClick={() => navigate(`/applications?applicationId=${encodeURIComponent(applicationId)}`)}
                    >
                      Back to application
                    </Button>
                  ) : null}
                  <Button type="button" variant="secondary" onClick={() => navigate("/applications")}>
                    Go to applications
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" onClick={() => navigate(returnTo)}>
                    Back
                  </Button>
                  {applicationId ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => navigate(`/applications?applicationId=${encodeURIComponent(applicationId)}`)}
                    >
                      Back to application
                    </Button>
                  ) : (
                    <Button type="button" variant="secondary" onClick={() => navigate("/applications")}>
                      Go to applications
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </Card>
    </Section>
  );
};

export default ScreeningStartPage;
