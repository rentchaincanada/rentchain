import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, Section, Button } from "../../components/ui/Ui";
import { apiFetch } from "../../api/apiFetch";
import { spacing, text } from "../../styles/tokens";

type CheckoutResponse = {
  ok: boolean;
  checkoutUrl?: string;
  error?: string;
  detail?: string;
  reasonCode?: string;
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
  if (normalized === "forbidden") {
    return "You don’t have access to start screening for this application.";
  }
  if (normalized === "invalid_redirect_origin") {
    return "The redirect destination is not allowed. Please try again from the dashboard.";
  }
  if (normalized === "invalid_request") {
    return "This application isn't ready for screening yet.";
  }
  return "Unable to start screening checkout. Please try again.";
};

const ScreeningStartPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const startedRef = useRef(false);

  const applicationId =
    searchParams.get("applicationId") || searchParams.get("rentalApplicationId") || "";
  const rawReturnTo = searchParams.get("returnTo") || "/dashboard";
  const returnTo = rawReturnTo.startsWith("/") ? rawReturnTo : "/dashboard";
  const successPath = searchParams.get("successPath") || "/screening/success";
  const cancelPath = searchParams.get("cancelPath") || "/screening/cancel";

  useEffect(() => {
    if (startedRef.current) return;
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
      try {
        const res = await apiFetch<CheckoutResponse>(
          `/rental-applications/${encodeURIComponent(applicationId)}/screening/checkout`,
          {
            method: "POST",
            body: { successPath, cancelPath, returnTo },
            allowStatuses: [400, 401, 403, 404, 500],
          }
        );

        if (res?.ok && res.checkoutUrl) {
          window.location.assign(res.checkoutUrl);
          return;
        }

        const normalizedError = String(res?.error || "").toLowerCase();
        setError(mapErrorMessage(res?.error));
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
  }, [applicationId, cancelPath, returnTo, successPath]);

  return (
    <Section style={{ maxWidth: 680, margin: "0 auto" }}>
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
            <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>
              Unable to start screening checkout
            </h1>
            <div style={{ color: text.muted, fontSize: "0.95rem" }}>
              {error || "Something went wrong. Please try again."}
            </div>
            {reason ? (
              <div style={{ color: text.subtle, fontSize: "0.9rem" }}>Reason: {reason}</div>
            ) : null}
            {detail ? (
              <div style={{ color: text.subtle, fontSize: "0.85rem" }}>{detail}</div>
            ) : null}
            <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
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
            </div>
          </div>
        )}
      </Card>
    </Section>
  );
};

export default ScreeningStartPage;
