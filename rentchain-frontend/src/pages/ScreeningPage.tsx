// src/pages/ScreeningPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section, Button, Input } from "../components/ui/Ui";
import {
  checkoutScreening,
  getScreening,
  downloadScreeningPdf,
  runScreeningWithCredits,
} from "../api/screeningApi";
import type { ScreeningRequest } from "../api/screeningApi";
import { buildScreeningPayload, fetchApplication } from "@/api/applicationsApi";
import type { CreditReportPayload } from "@/api/applicationsApi";
import type { Application } from "../types/applications";
import { deriveScreeningReadiness } from "../api/applicationsScreeningApi";
import { spacing, text } from "../styles/tokens";
import { SUPPORT_EMAIL } from "../config/support";
import { useToast } from "../components/ui/ToastProvider";
import { useAuth } from "../context/useAuth";

type Step = "review" | "applicant" | "payment" | "result";

export const ScreeningPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { showToast } = useToast();
  const initialPayload =
    (location.state as any)?.screeningPayload as CreditReportPayload | undefined;
  const initialApplication =
    (location.state as any)?.application as Application | undefined;
  const applicationId = searchParams.get("applicationId");
  const { user, updateUser } = useAuth();
  const [screeningPayload, setScreeningPayload] = useState<CreditReportPayload | null>(
    initialPayload ?? null
  );
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [application, setApplication] = useState<Application | null>(
    initialApplication ?? null
  );
  const [screeningRequestId, setScreeningRequestId] = useState<string | null>(null);
  const [screening, setScreening] = useState<ScreeningRequest | null>(null);
  const [step, setStep] = useState<Step>(initialPayload ? "review" : "applicant");
  const [loading, setLoading] = useState(false);
  const [loadingPayload, setLoadingPayload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingRequirements, setMissingRequirements] = useState<string[]>([]);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const screeningReadiness = useMemo(
    () => deriveScreeningReadiness(application),
    [application]
  );

  useEffect(() => {
    if (!screeningReadiness.canRun) {
      setMissingRequirements(screeningReadiness.missing);
    } else {
      setMissingRequirements([]);
    }
  }, [screeningReadiness.canRun, screeningReadiness.missing.join("|")]);

  useEffect(() => {
    if (!applicationId || application) return;
    fetchApplication(applicationId)
      .then((app) => setApplication(app))
      .catch(() => {
        // keep existing application state when fetch fails
      });
  }, [applicationId, application]);

  useEffect(() => {
    if (!applicationId || screeningPayload) return;

    setLoadingPayload(true);
    setError(null);
    setMissingFields([]);

    buildScreeningPayload(applicationId)
      .then((payload) => {
        setScreeningPayload(payload);
        const combinedName = [
          payload.applicant.firstName,
          payload.applicant.middleName,
          payload.applicant.lastName,
        ]
          .filter(Boolean)
          .join(" ");
        setFullName(combinedName);
        if (payload.applicant.email) {
          setEmail(payload.applicant.email);
        }
        if (payload.applicant.phone) {
          setPhone(payload.applicant.phone);
        }
        setConsent(payload.consent.creditCheck);
        setStep("review");
      })
      .catch((err: any) => {
        const missing = Array.isArray(err?.missing) ? err.missing : [];
        if (err?.code === "missing_fields" || missing.length) {
          setMissingFields(missing);
          setError("Add the missing required fields before running credit.");
        } else {
          setError(err?.message || "Unable to load screening details.");
        }
      })
      .finally(() => setLoadingPayload(false));
  }, [applicationId, screeningPayload]);

  useEffect(() => {
    if (!screeningPayload) return;
    const combinedName = [
      screeningPayload.applicant.firstName,
      screeningPayload.applicant.middleName,
      screeningPayload.applicant.lastName,
    ]
      .filter(Boolean)
      .join(" ");
    setFullName(combinedName);
    setConsent(screeningPayload.consent.creditCheck);
    if (screeningPayload.applicant.email) {
      setEmail(screeningPayload.applicant.email);
    }
    if (screeningPayload.applicant.phone) {
      setPhone(screeningPayload.applicant.phone);
    }
    setMissingFields([]);
  }, [screeningPayload]);

  useEffect(() => {
    if (!applicationId || screeningRequestId) return;
    if (!screeningReadiness.canRun) {
      setMissingRequirements(screeningReadiness.missing);
      return;
    }
    setError(null);
    setMissingRequirements([]);
    setLoading(true);
    runScreeningWithCredits(applicationId)
      .then(({ screeningRequest, screeningCredits }) => {
        setScreeningRequestId(screeningRequest.id);
        setScreening(screeningRequest);
        updateUser({ screeningCredits });
        setStep("result");
      })
      .catch((err: any) => {
        const message = err?.message || "Unable to start screening.";
        if (err?.code === "insufficient_credits") {
          setShowCreditsModal(true);
          setError(message);
          updateUser({
            screeningCredits:
              err?.screeningCredits !== undefined
                ? err.screeningCredits
                : user?.screeningCredits,
          });
          return;
        }
        if (message.toLowerCase().includes("not ready for screening")) {
          const missing = screeningReadiness.missing;
          setMissingRequirements(missing);
          setError(
            missing.length > 0
              ? `Application is not ready for screening. Missing: ${missing.join(", ")}`
              : "Application is not ready for screening."
          );
          return;
        }
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [
    applicationId,
    screeningRequestId,
    screeningReadiness.canRun,
    screeningReadiness.missing.join("|"),
    updateUser,
    user?.screeningCredits,
  ]);

  useEffect(() => {
    if (!screeningRequestId) return;
    getScreening(screeningRequestId)
      .then(({ screeningRequest }) => setScreening(screeningRequest))
      .catch(() => {
        // Keep existing state if fetch fails
      });
  }, [screeningRequestId]);

  const handleContinueToPayment = () => {
    if (!applicationId) {
      setError("Application ID is required to start screening.");
      return;
    }
    if (!screeningReadiness.canRun) {
      setMissingRequirements(screeningReadiness.missing);
      setError(
        screeningReadiness.missing.length > 0
          ? `Complete before running credit: ${screeningReadiness.missing.join(", ")}`
          : "Application is not ready for screening."
      );
      return;
    }
    if (!screeningRequestId || !screening) {
      setError("Screening request not ready. Please try again.");
      return;
    }
    if (screening.status === "completed") {
      setStep("result");
      return;
    }
    setStep("payment");
  };

  const handlePay = async () => {
    if (!screeningRequestId) {
      setError("Screening request not ready. Please try again.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const url = await checkoutScreening(screeningRequestId);
      if (url) {
        window.location.href = url;
      }
    } catch (err: any) {
      setError(err?.message || "Unable to process payment.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!screeningRequestId) return;
    try {
      const blob = await downloadScreeningPdf(screeningRequestId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `screening_${screeningRequestId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast({
        message: "Download started",
        variant: "success",
      });
    } catch (err: any) {
      showToast({
        message: "Download failed",
        description: err?.message || "Unable to download screening PDF.",
        variant: "error",
      });
    }
  };

  return (
    <MacShell title="RentChain · Applicant screening">
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg, maxWidth: 820, margin: "0 auto" }}>
        <Card elevated>
          <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.md }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 700 }}>
                Applicant screening
              </h1>
              <div style={{ marginTop: 4, color: text.muted, fontSize: "0.95rem" }}>
                Capture consent, simulate payment, and view a stubbed credit report.
              </div>
            </div>
            <div
              style={{
                alignSelf: "center",
                padding: "6px 10px",
                borderRadius: 12,
                border: "1px solid rgba(59,130,246,0.3)",
                background: "rgba(59,130,246,0.08)",
                color: "#0f172a",
                fontSize: "0.9rem",
                minWidth: 180,
                textAlign: "center",
              }}
            >
              Screening credits: {user?.screeningCredits ?? 0}
            </div>
          </div>
        </Card>

        <Section style={{ display: "flex", flexDirection: "column", gap: spacing.md }}>
          {error && (
            <div
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.4)",
                color: "#b91c1c",
                borderRadius: 10,
                padding: "8px 10px",
                fontSize: "0.95rem",
              }}
            >
              {error}
            </div>
          )}

          {loadingPayload && (
            <div style={{ fontSize: "0.95rem", color: text.muted }}>
              Validating application details…
            </div>
          )}

          {step === "review" && screeningPayload && (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Review details</h3>
              <div style={{ color: text.muted, fontSize: "0.95rem" }}>
                {screeningPayload.building.propertyName} · Unit {screeningPayload.building.unitApplied}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, minmax(0,1fr))",
                  gap: spacing.xs,
                  fontSize: "0.95rem",
                }}
              >
                <div>
                  <div style={{ color: text.subtle }}>Lease start</div>
                  <div>{screeningPayload.building.leaseStartDate}</div>
                </div>
                <div>
                  <div style={{ color: text.subtle }}>Property address</div>
                  <div>
                    {screeningPayload.building.propertyAddressLine1}
                    <div style={{ color: text.subtle }}>
                      {[screeningPayload.building.city, screeningPayload.building.province]
                        .filter(Boolean)
                        .join(", ")}{" "}
                      {screeningPayload.building.postalCode}
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ color: text.subtle }}>Applicant</div>
                  <div>
                    {[
                      screeningPayload.applicant.firstName,
                      screeningPayload.applicant.middleName,
                      screeningPayload.applicant.lastName,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </div>
                  <div style={{ color: text.subtle }}>
                    DOB: {screeningPayload.applicant.dateOfBirth}
                  </div>
                </div>
                <div>
                  <div style={{ color: text.subtle }}>Address</div>
                  <div>
                    {screeningPayload.address.streetNumber} {screeningPayload.address.streetName}
                    <div style={{ color: text.subtle }}>
                      {[screeningPayload.address.city, screeningPayload.address.province]
                        .filter(Boolean)
                        .join(", ")}{" "}
                      {screeningPayload.address.postalCode}
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ color: text.subtle }}>Consent</div>
                  <div>{consent ? "Credit check consented" : "Consent missing"}</div>
                </div>
              </div>
              {missingFields.length > 0 && (
                <div
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.4)",
                    color: "#b91c1c",
                    borderRadius: 10,
                    padding: "8px 10px",
                    fontSize: "0.9rem",
                  }}
                >
                  Missing fields: {missingFields.join(", ")}
                </div>
              )}
              <div>
                <Button
                  type="button"
                  onClick={handleContinueToPayment}
                  disabled={
                    loading ||
                    loadingPayload ||
                    missingFields.length > 0 ||
                    !screeningRequestId ||
                    !screeningReadiness.canRun
                  }
                >
                  {loading ? "Starting..." : "Run credit report"}
                </Button>
                {missingRequirements.length > 0 && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: "0.9rem",
                      color: "#b91c1c",
                    }}
                  >
                    Missing: {missingRequirements.join(", ")}
                  </div>
                )}
              </div>
            </div>
          )}
          {screening?.status === "failed" && (
            <Card elevated>
              <div
                style={{
                  background: "rgba(251,191,36,0.12)",
                  border: "1px solid rgba(251,191,36,0.4)",
                  color: "#92400e",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  Screening could not be completed.
                </div>
                <div style={{ color: "#92400e", fontSize: "0.95rem" }}>
                  {screening.failureReason &&
                  screening.failureReason.toLowerCase().includes("provider_not_configured")
                    ? "Screening provider is not configured yet."
                    : screening.failureReason &&
                      screening.failureReason.toLowerCase().includes("missing required applicant")
                    ? "Missing required applicant details. Please complete application fields and retry."
                    : screening.failureReason || "Please verify details and try again."}
                </div>
                <div style={{ marginTop: 4, color: "#92400e", fontSize: "0.9rem" }}>
                  Confirm consent, phone verification, and references then retry.
                </div>
              </div>
            </Card>
          )}

          {step === "applicant" && (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Applicant details</h3>
              <Input
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                placeholder="Phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <label style={{ display: "flex", alignItems: "center", gap: spacing.xs, color: text.primary }}>
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                Applicant consent to pull credit
              </label>
              <div>
                <Button
                  type="button"
                  onClick={handleContinueToPayment}
                  disabled={
                    loading || loadingPayload || !screeningRequestId || !screeningReadiness.canRun
                  }
                  style={{ opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? "Starting..." : "Run credit report"}
                </Button>
                {missingRequirements.length > 0 && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: "0.9rem",
                      color: "#b91c1c",
                    }}
                  >
                    Missing: {missingRequirements.join(", ")}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "payment" && screening && (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Confirm & pay</h3>
              <div style={{ color: text.muted }}>
                Screening fee: $
                {(screening.priceCents ? screening.priceCents / 100 : 0).toFixed(2)}{" "}
                — payment is completed via Stripe Checkout.
              </div>
              <Button type="button" onClick={handlePay} disabled={loading}>
                {loading ? "Processing..." : "Confirm & pay"}
              </Button>
            </div>
          )}

          {step === "result" && screening && (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Result</h3>
              <div style={{ color: text.muted }}>
                Status: {screening.status}{" "}
                {screening.completedAt
                  ? `(${new Date(screening.completedAt).toLocaleString()})`
                  : ""}
                {screening.reportSummary?.providerName && (
                  <>
                    {" · "}Provider: {screening.reportSummary.providerName}
                  </>
                )}
              </div>
              {screening.reportSummary ? (
                <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
                  <div style={{ fontWeight: 600 }}>{screening.reportSummary.headline}</div>
                  <div style={{ color: text.muted }}>{screening.reportSummary.createdAt}</div>
                  <ul style={{ margin: 0, paddingLeft: "1rem", color: text.muted }}>
                    {screening.reportSummary.highlights.map((rec) => (
                      <li key={rec}>{rec}</li>
                    ))}
                  </ul>
                </div>
              ) : screening.creditReport ? (
                <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs }}>
                  {screening.creditReport.score !== undefined && (
                    <div style={{ fontWeight: 600 }}>Score: {screening.creditReport.score}</div>
                  )}
                  {screening.creditReport.summary && (
                    <div style={{ color: text.muted }}>{screening.creditReport.summary}</div>
                  )}
                  {screening.creditReport.recommendations?.length ? (
                    <ul style={{ margin: 0, paddingLeft: "1rem", color: text.muted }}>
                      {screening.creditReport.recommendations.map((rec) => (
                        <li key={rec}>{rec}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <div style={{ color: text.muted }}>Report not available yet.</div>
              )}
              <div>
                <Button type="button" variant="secondary" onClick={handleDownloadPdf}>
                  Download PDF
                </Button>
              </div>
            </div>
          )}
        </Section>
        <div style={{ color: text.muted, fontSize: "0.85rem", textAlign: "center" }}>
          Sensitive credit data is encrypted and automatically deleted after 30 days. Need help?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </div>
      </div>

      {showCreditsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#0b1220",
              border: "1px solid rgba(59,130,246,0.4)",
              borderRadius: 14,
              padding: spacing.lg,
              width: "min(480px, 90vw)",
              boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
              color: text.primary,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8, fontSize: "1.2rem" }}>
              Add screening credits
            </h3>
            <div style={{ color: text.muted, marginBottom: spacing.sm, lineHeight: 1.5 }}>
              You need screening credits to run this report. Purchase credits from Billing or contact support for a launch pack.
            </div>
            <div style={{ display: "flex", gap: spacing.sm, marginTop: spacing.sm }}>
              <Button type="button" onClick={() => setShowCreditsModal(false)} variant="secondary">
                Close
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowCreditsModal(false);
                  window.location.href = "/billing";
                }}
              >
                Go to Billing
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setShowCreditsModal(false);
                  window.location.href = "/billing";
                }}
                variant="ghost"
              >
                View pricing
              </Button>
            </div>
          </div>
        </div>
      )}
    </MacShell>
  );
};

export default ScreeningPage;

