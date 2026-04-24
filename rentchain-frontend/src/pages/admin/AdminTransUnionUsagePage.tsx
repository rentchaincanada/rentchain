import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Pill, Section } from "../../components/ui/Ui";
import { MacShell } from "../../components/layout/MacShell";
import { useToast } from "../../components/ui/ToastProvider";
import {
  downloadAdminTransUnionUsagePdf,
  fetchAdminTransUnionUsage,
  type TransUnionUsageReport,
} from "../../api/adminScreeningUsageApi";

const EMPTY_REPORT: TransUnionUsageReport = {
  ok: true,
  providerKey: "transunion",
  period: {
    label: "last_30_days",
    startDate: new Date(0).toISOString(),
    endDate: new Date(0).toISOString(),
  },
  funnel: {
    optionViewed: 0,
    getAccessClicks: 0,
    haveCredentialsClicks: 0,
    credentialSubmissions: 0,
    connectionSuccesses: 0,
    connectionFailures: 0,
    firstScreeningInitiated: 0,
    repeatScreeningUsers: 0,
  },
  usage: {
    activeConnectedLandlords: 0,
    totalScreeningRequests: 0,
    completedScreenings: 0,
    inProgressScreenings: 0,
    blockedScreenings: 0,
    manualReviewScreenings: 0,
    averageScreeningsPerConnectedLandlord: 0,
    repeatUsageRate: 0,
  },
  compliance: {
    tenantConsentCapturedRate: 0,
    permissiblePurposeConfirmedRate: 0,
    auditCoverageRate: 0,
    requestsBlockedForMissingConsent: 0,
    requestsBlockedForMissingProviderConnection: 0,
  },
  quality: {
    completionRate: 0,
    manualReviewRate: 0,
    failedOrBlockedRate: 0,
    credentialConnectionFailureRate: 0,
    averageTimeFromApplicationToScreeningRequestMinutes: null,
  },
  report: {
    executiveSummary: {
      headline: "",
      confidentialityNote: "",
      keyMetrics: {},
    },
    workflowDescription: { steps: [] },
    landlordAdoptionInsights: {
      landlordCounts: {
        viewers: 0,
        connected: 0,
        repeatUsers: 0,
      },
      mostCommonBlockedReason: null,
    },
    partnershipReadiness: { notes: [] },
    appendix: {
      eventDefinitions: [],
      dataExclusions: [],
    },
  },
};

function pct(value: number) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

export default function AdminTransUnionUsagePage() {
  const { showToast } = useToast();
  const [period, setPeriod] = useState<"last_30_days" | "last_60_days" | "last_90_days">(
    "last_30_days"
  );
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<TransUnionUsageReport>(EMPTY_REPORT);

  const load = async (nextPeriod: typeof period = period) => {
    try {
      setLoading(true);
      setError(null);
      setReport(await fetchAdminTransUnionUsage({ period: nextPeriod }));
    } catch (err: any) {
      setError(err?.message || "Failed to load TransUnion usage");
      showToast({
        message: "Failed to load TransUnion usage",
        description: err?.message || "",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(period);
  }, [period]);

  const jsonSummary = useMemo(() => JSON.stringify(report, null, 2), [report]);

  const downloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      const result = await downloadAdminTransUnionUsagePdf({ period });
      const url = window.URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast({
        message: "Failed to download PDF report",
        description: err?.message || "",
        variant: "error",
      });
    } finally {
      setDownloadingPdf(false);
    }
  };
  return (
    <MacShell title="Admin · TransUnion Usage">
      <div style={{ display: "grid", gap: 16 }}>
        <Section>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ margin: 0, fontSize: "1.5rem" }}>TransUnion Usage Summary</h1>
                <Pill tone="accent">Admin</Pill>
              </div>
              <div style={{ color: "#475569", maxWidth: 860 }}>
                RentChain workflow layer view of landlord-by-landlord TransUnion onboarding,
                screening usage, consent coverage, and audit completeness. No raw screening
                report data is shown here.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {(["last_30_days", "last_60_days", "last_90_days"] as const).map((option) => (
                <Button
                  key={option}
                  variant={option === period ? "primary" : "secondary"}
                  onClick={() => setPeriod(option)}
                  disabled={loading}
                >
                  {option.replaceAll("_", " ")}
                </Button>
              ))}
              <Button variant="ghost" onClick={() => void navigator.clipboard?.writeText(jsonSummary)}>
                Copy Report Summary
              </Button>
              <Button variant="secondary" onClick={() => void downloadPdf()} disabled={loading || downloadingPdf}>
                {downloadingPdf ? "Downloading PDF..." : "Download PDF report"}
              </Button>
            </div>
          </div>
        </Section>

        {loading ? <Card>Loading TransUnion usage…</Card> : null}
        {!loading && error ? <Card style={{ color: "#b91c1c" }}>{error}</Card> : null}

        {!loading && !error ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
              {[
                ["Connected landlords", report.usage.activeConnectedLandlords],
                ["Screening requests", report.usage.totalScreeningRequests],
                ["Completed screenings", report.usage.completedScreenings],
                ["Consent captured", pct(report.compliance.tenantConsentCapturedRate)],
                ["Permissible purpose", pct(report.compliance.permissiblePurposeConfirmedRate)],
                ["Audit coverage", pct(report.compliance.auditCoverageRate)],
              ].map(([label, value]) => (
                <Card key={String(label)}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700 }}>{String(value)}</div>
                </Card>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              <Card style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 700 }}>Executive Summary</div>
                <div style={{ color: "#475569", lineHeight: 1.6 }}>{report.report.executiveSummary.headline}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>
                  {report.report.executiveSummary.confidentialityNote}
                </div>
              </Card>
              <Card style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 700 }}>Onboarding Funnel</div>
                <div style={{ display: "grid", gap: 8, color: "#475569" }}>
                  <div>Viewed TransUnion option: {report.funnel.optionViewed}</div>
                  <div>Clicked Get Access: {report.funnel.getAccessClicks}</div>
                  <div>Clicked Connect Existing Membership: {report.funnel.haveCredentialsClicks}</div>
                  <div>Credential submissions: {report.funnel.credentialSubmissions}</div>
                  <div>Successful connections: {report.funnel.connectionSuccesses}</div>
                </div>
              </Card>
              <Card style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 700 }}>Operational Quality</div>
                <div style={{ display: "grid", gap: 8, color: "#475569" }}>
                  <div>Completion rate: {pct(report.quality.completionRate)}</div>
                  <div>Manual review rate: {pct(report.quality.manualReviewRate)}</div>
                  <div>Failed or blocked rate: {pct(report.quality.failedOrBlockedRate)}</div>
                  <div>
                    Avg time to request:{" "}
                    {report.quality.averageTimeFromApplicationToScreeningRequestMinutes == null
                      ? "Not available"
                      : `${report.quality.averageTimeFromApplicationToScreeningRequestMinutes} min`}
                  </div>
                </div>
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
              <Card style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 700 }}>Compliance Controls</div>
                <div style={{ display: "grid", gap: 8, color: "#475569" }}>
                  <div>Tenant consent captured before screening: {pct(report.compliance.tenantConsentCapturedRate)}</div>
                  <div>Permissible purpose confirmed: {pct(report.compliance.permissiblePurposeConfirmedRate)}</div>
                  <div>Audit trail recorded: {pct(report.compliance.auditCoverageRate)}</div>
                  <div>Blocked for missing consent: {report.compliance.requestsBlockedForMissingConsent}</div>
                  <div>
                    Blocked for missing provider connection:{" "}
                    {report.compliance.requestsBlockedForMissingProviderConnection}
                  </div>
                </div>
              </Card>

              <Card style={{ display: "grid", gap: 12 }}>
                <div style={{ fontWeight: 700 }}>Partnership Readiness Notes</div>
                <div style={{ display: "grid", gap: 8, color: "#475569" }}>
                  {report.report.partnershipReadiness.notes.map((note) => (
                    <div key={note}>{note}</div>
                  ))}
                </div>
              </Card>
            </div>

            <Card style={{ display: "grid", gap: 12 }}>
              <div style={{ fontWeight: 700 }}>Appendix</div>
              <div style={{ color: "#475569" }}>
                Event definitions: {report.report.appendix.eventDefinitions.join(", ")}
              </div>
              <div style={{ color: "#475569" }}>
                Data exclusions: {report.report.appendix.dataExclusions.join(", ")}
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </MacShell>
  );
}
