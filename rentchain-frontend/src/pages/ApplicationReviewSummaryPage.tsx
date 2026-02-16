import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, Button } from "../components/ui/Ui";
import { colors, text } from "../styles/tokens";
import {
  fetchReviewSummary,
  fetchReviewSummaryPdfSignedUrl,
  type ApplicationReviewSummary,
  ReviewSummaryApiError,
} from "../api/reviewSummaryApi";
import { useToast } from "../components/ui/ToastProvider";

function money(cents: number | null): string {
  if (cents == null || !Number.isFinite(cents)) return "Not provided";
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function dateOr(value: string | null | undefined): string {
  if (!value) return "Not provided";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not provided" : parsed.toLocaleString();
}

function ratio(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "Not provided";
  return `${value.toFixed(2)}x`;
}

function kv(label: string, value: string) {
  return (
    <div
      key={label}
      style={{
        display: "grid",
        gap: 4,
        padding: 10,
        border: `1px solid ${colors.border}`,
        borderRadius: 10,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: text.subtle }}>{label}</div>
      <div style={{ fontWeight: 600, color: text.main }}>{value || "Not provided"}</div>
    </div>
  );
}

type SummaryLoadError = {
  message: string;
  status?: number;
  backendError?: string;
  detail?: string;
};

class ReviewSummaryErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || "Review summary failed to render." };
  }

  componentDidCatch(error: Error) {
    console.error("[review-summary] render crash", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card style={{ color: colors.danger }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Review summary failed to render.</div>
          <div style={{ marginBottom: 10 }}>{this.state.message}</div>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Card>
      );
    }
    return this.props.children;
  }
}

function ApplicationReviewSummaryPageBody() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SummaryLoadError | null>(null);
  const [summary, setSummary] = useState<ApplicationReviewSummary | null>(null);

  const loadSummary = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchReviewSummary(id);
      setSummary(data);
    } catch (err: any) {
      console.error("[review-summary] load failed", err);
      const parsed: SummaryLoadError = {
        message: err?.message || "Failed to load review summary",
      };
      if (err instanceof ReviewSummaryApiError) {
        parsed.status = err.status;
        parsed.backendError = err.backendError;
        parsed.detail = err.detail;
      } else if (typeof err?.status === "number") {
        parsed.status = err.status;
      }
      setSummary(null);
      setError(parsed);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/applications/${id}/review-summary`;
  }, [id]);

  const downloadPdf = async () => {
    try {
      const url = await fetchReviewSummaryPdfSignedUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      showToast({
        message: "Unable to open PDF",
        description: err?.message || "Failed to load review summary PDF.",
        variant: "error",
      });
    }
  };

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showToast({ message: successMessage, variant: "success" });
    } catch {
      showToast({ message: "Copy failed", variant: "error" });
    }
  };

  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem" }}>Application Review Summary</h1>
          <div style={{ fontSize: 12, color: text.subtle }}>Application ID: {id}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
          <Button variant="secondary" onClick={() => void downloadPdf()}>Download PDF</Button>
          <Button variant="secondary" onClick={() => void copyText(shareUrl, "Share link copied")}>Copy link</Button>
          {summary?.screening?.referenceId ? (
            <Button
              variant="secondary"
              onClick={() => void copyText(summary.screening.referenceId || "", "Reference ID copied")}
            >
              Copy reference ID
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? <Card>Loading summary…</Card> : null}
      {error ? (
        <Card style={{ color: colors.danger, display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 700 }}>Unable to load review summary</div>
          <div>{error.message}</div>
          <div style={{ fontSize: 13, color: text.subtle }}>
            Status: {error.status ?? "unknown"}
          </div>
          {error.backendError ? (
            <div style={{ fontSize: 13, color: text.subtle }}>Error: {error.backendError}</div>
          ) : null}
          {error.detail ? (
            <div style={{ fontSize: 13, color: text.subtle }}>Detail: {error.detail}</div>
          ) : null}
          <div>
            <Button variant="secondary" onClick={() => void loadSummary()}>
              Retry
            </Button>
          </div>
        </Card>
      ) : null}

      {!loading && !error && summary ? (
        <>
          <Card style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Applicant Overview</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
              {kv("Name", summary.applicant.name || "Not provided")}
              {kv("Email", summary.applicant.email || "Not provided")}
              {kv(
                "Address",
                [
                  summary.applicant.currentAddressLine,
                  summary.applicant.city,
                  summary.applicant.provinceState,
                  summary.applicant.postalCode,
                  summary.applicant.country,
                ]
                  .filter(Boolean)
                  .join(", ") || "Not provided"
              )}
              {kv(
                "Time at current address",
                summary.applicant.timeAtCurrentAddressMonths != null
                  ? `${summary.applicant.timeAtCurrentAddressMonths} months`
                  : "Not provided"
              )}
              {kv("Current rent", money(summary.applicant.currentRentAmountCents))}
            </div>
          </Card>

          <Card style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Employment & Income</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
              {kv("Employer", summary.employment.employerName || "Not provided")}
              {kv("Job title", summary.employment.jobTitle || "Not provided")}
              {kv("Income", money(summary.employment.incomeAmountCents))}
              {kv("Income frequency", summary.employment.incomeFrequency || "Not provided")}
              {kv("Income monthly (derived)", money(summary.employment.incomeMonthlyCents))}
              {kv(
                "Months at current job",
                summary.employment.monthsAtJob != null ? String(summary.employment.monthsAtJob) : "Not provided"
              )}
              {kv("Work reference name", summary.reference.name || "Not provided")}
              {kv("Work reference phone", summary.reference.phone || "Not provided")}
            </div>
          </Card>

          <Card style={{ display: "grid", gap: 8 }}>
            <div style={{ fontWeight: 700 }}>Screening & Compliance</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 8 }}>
              {kv("Screening status", summary.screening.status || "not_run")}
              {kv("Screening provider", summary.screening.provider || "Not provided")}
              {kv("Reference ID", summary.screening.referenceId || "Not provided")}
              {kv(
                "Completeness",
                `${summary.derived.completeness.label} (${Math.round(summary.derived.completeness.score * 100)}%)`
              )}
              {kv("Income-to-rent ratio", ratio(summary.derived.incomeToRentRatio))}
              {kv("Consent version", summary.compliance.applicationConsentVersion || "Not provided")}
              {kv("Consent accepted at", dateOr(summary.compliance.applicationConsentAcceptedAt))}
              {kv("Signature type", summary.compliance.signatureType || "Not provided")}
              {kv("Signed at", dateOr(summary.compliance.signedAt))}
            </div>
            {summary.derived.flags.length ? (
              <div style={{ fontSize: 13, color: text.subtle }}>
                Flags: {summary.derived.flags.join(", ")}
              </div>
            ) : (
              <div style={{ fontSize: 13, color: text.subtle }}>Flags: none</div>
            )}
          </Card>

          <Card style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 700 }}>Insights</div>
            {summary.insights.length ? (
              <ul style={{ margin: 0, paddingLeft: 20, color: text.main }}>
                {summary.insights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <div style={{ color: text.subtle }}>No insights available.</div>
            )}
            <div style={{ fontSize: 12, color: text.subtle }}>
              This summary is descriptive and does not provide approval/denial recommendations.
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

export default function ApplicationReviewSummaryPage() {
  return (
    <ReviewSummaryErrorBoundary>
      <ApplicationReviewSummaryPageBody />
    </ReviewSummaryErrorBoundary>
  );
}
