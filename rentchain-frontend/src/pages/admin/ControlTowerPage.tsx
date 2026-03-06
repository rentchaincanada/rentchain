import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MacShell } from "../../components/layout/MacShell";
import { Button, Card, Section } from "../../components/ui/Ui";
import { colors, radius, spacing, text } from "../../styles/tokens";
import ControlTowerKpiCard from "../../components/admin/ControlTowerKpiCard";
import { fetchControlTowerMetrics, type ControlTowerResponse } from "../../api/controlTowerApi";

type RangeKey = "today" | "last_7" | "month";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatPercent(value: number) {
  return `${(Number(value || 0) * 100).toFixed(1)}%`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function statusTone(status: string) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "operational") return "#16a34a";
  if (s === "degraded") return "#f59e0b";
  if (s === "partial_outage" || s === "major_outage") return "#dc2626";
  return "#64748b";
}

const empty: ControlTowerResponse = {
  ok: true,
  today: {
    applicationsSubmitted: 0,
    screeningsInitiated: 0,
    leasesGenerated: 0,
    depositsRecorded: 0,
  },
  funnelMonthToDate: {
    applicationsReceived: 0,
    creditReportsRun: 0,
    applicationsApproved: 0,
    leasesGenerated: 0,
    screeningRate: 0,
    approvalRate: 0,
    leaseConversionRate: 0,
  },
  utilization: {
    activeLandlords: 0,
    activeProperties: 0,
    activeUnits: 0,
    applicationsPerUnit: 0,
  },
  screening: {
    referralClicks: 0,
    completedScreenings: 0,
    screeningsPerLandlord: 0,
    conversionRate: 0,
  },
  financial: {
    depositsCollectedToday: 0,
    depositsCollectedMonth: 0,
    averageDepositAmount: 0,
  },
  statusSummary: {
    website: "operational",
    api: "operational",
    screening: "operational",
    payments: "operational",
  },
  updatedAtMs: 0,
};

const ControlTowerPage: React.FC = () => {
  const [range, setRange] = useState<RangeKey>("today");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ControlTowerResponse>(empty);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const payload = await fetchControlTowerMetrics();
        if (!cancelled) setData(payload);
      } catch (err: any) {
        if (!cancelled) setError(String(err?.message || "Failed to load control tower"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const rangeButtons = useMemo(
    () =>
      [
        { key: "today" as const, label: "Today" },
        { key: "last_7" as const, label: "Last 7 days" },
        { key: "month" as const, label: "This month" },
      ].map((item) => {
        const active = item.key === range;
        return (
          <Button
            key={item.key}
            type="button"
            variant={active ? "primary" : "secondary"}
            onClick={() => setRange(item.key)}
          >
            {item.label}
          </Button>
        );
      }),
    [range]
  );

  return (
    <MacShell title="Admin · Control Tower">
      <Section style={{ display: "grid", gap: spacing.md }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: spacing.sm, alignItems: "start", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.55rem" }}>RentChain Control Tower</h1>
            <div style={{ marginTop: 4, color: text.muted, fontSize: 13 }}>
              Daily platform activity, leasing funnel, screening volume, and financial movement.
            </div>
            <div style={{ marginTop: 6, color: text.muted, fontSize: 12 }}>
              {data.updatedAtMs ? `Updated ${new Date(data.updatedAtMs).toLocaleString()}` : "Not loaded"}
            </div>
          </div>
          <Button type="button" variant="secondary" onClick={() => window.location.assign("/admin")}>
            Back to Admin
          </Button>
        </div>

        <Card elevated>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: spacing.xs, flexWrap: "wrap" }}>{rangeButtons}</div>
            <div style={{ fontSize: 12, color: text.muted }}>Today KPIs + month-to-date funnel and volume</div>
          </div>
        </Card>

        <Section style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ fontWeight: 700 }}>Platform Activity Today</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: spacing.sm }}>
            <ControlTowerKpiCard large label="Applications Today" value={formatNumber(data.today.applicationsSubmitted)} sublabel="vs yesterday" />
            <ControlTowerKpiCard large label="Screenings Today" value={formatNumber(data.today.screeningsInitiated)} sublabel="vs yesterday" />
            <ControlTowerKpiCard large label="Leases Generated Today" value={formatNumber(data.today.leasesGenerated)} sublabel="vs yesterday" />
            <ControlTowerKpiCard large label="Deposits Recorded Today" value={formatNumber(data.today.depositsRecorded)} sublabel="vs yesterday" />
          </div>
        </Section>

        <Section style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ fontWeight: 700 }}>Leasing Funnel (Month-to-date)</div>
          <Card style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: spacing.sm }}>
              <ControlTowerKpiCard label="Applications Received" value={formatNumber(data.funnelMonthToDate.applicationsReceived)} sublabel="New applications this month" />
              <ControlTowerKpiCard label="Credit Reports Run" value={formatNumber(data.funnelMonthToDate.creditReportsRun)} sublabel="Completed screening runs" />
              <ControlTowerKpiCard label="Applications Approved" value={formatNumber(data.funnelMonthToDate.applicationsApproved)} sublabel="Approved and conditional approvals" />
              <ControlTowerKpiCard label="Leases Generated" value={formatNumber(data.funnelMonthToDate.leasesGenerated)} sublabel="Leases created this month" />
            </div>
            <div style={{ color: text.muted, fontSize: 13 }}>
              Applications → Screenings → Approvals → Leases
            </div>
            <div style={{ display: "flex", gap: spacing.md, color: text.muted, fontSize: 12, flexWrap: "wrap" }}>
              <span>Screening rate: {formatPercent(data.funnelMonthToDate.screeningRate)}</span>
              <span>Approval rate: {formatPercent(data.funnelMonthToDate.approvalRate)}</span>
              <span>Lease conversion rate: {formatPercent(data.funnelMonthToDate.leaseConversionRate)}</span>
            </div>
          </Card>
        </Section>

        <Section style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ fontWeight: 700 }}>Platform Utilization</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: spacing.sm }}>
            <ControlTowerKpiCard label="Active Landlords" value={formatNumber(data.utilization.activeLandlords)} />
            <ControlTowerKpiCard label="Active Properties" value={formatNumber(data.utilization.activeProperties)} />
            <ControlTowerKpiCard label="Active Units" value={formatNumber(data.utilization.activeUnits)} />
            <ControlTowerKpiCard label="Applications per Unit" value={formatNumber(data.utilization.applicationsPerUnit)} />
          </div>
        </Section>

        <Section style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ fontWeight: 700 }}>TransUnion / Screening Metrics</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: spacing.sm }}>
            <ControlTowerKpiCard label="Referral Clicks (month)" value={formatNumber(data.screening.referralClicks)} />
            <ControlTowerKpiCard label="Completed Screenings (month)" value={formatNumber(data.screening.completedScreenings)} />
            <ControlTowerKpiCard label="Screenings per Landlord" value={formatNumber(data.screening.screeningsPerLandlord)} />
            <ControlTowerKpiCard label="Conversion Rate" value={formatPercent(data.screening.conversionRate)} />
          </div>
        </Section>

        <Section style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ fontWeight: 700 }}>Financial Activity</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: spacing.sm }}>
            <ControlTowerKpiCard label="Deposits Collected Today" value={formatCurrency(data.financial.depositsCollectedToday)} />
            <ControlTowerKpiCard label="Deposits Collected This Month" value={formatCurrency(data.financial.depositsCollectedMonth)} />
            <ControlTowerKpiCard label="Average Deposit Amount" value={formatCurrency(data.financial.averageDepositAmount)} />
          </div>
        </Section>

        <Section style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ fontWeight: 700 }}>Operational Notes</div>
          <Card style={{ display: "grid", gap: spacing.sm }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: spacing.sm }}>
              {[
                { label: "Website Status", value: data.statusSummary.website },
                { label: "API Status", value: data.statusSummary.api },
                { label: "Screening Status", value: data.statusSummary.screening },
                { label: "Payments Status", value: data.statusSummary.payments },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    padding: spacing.sm,
                    display: "grid",
                    gap: 6,
                    background: colors.panel,
                  }}
                >
                  <div style={{ fontSize: 12, color: text.muted }}>{item.label}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 999, background: statusTone(item.value) }} />
                    <span style={{ fontSize: 14, fontWeight: 700, textTransform: "capitalize" }}>
                      {String(item.value || "unknown").replace("_", " ")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: text.muted }}>
              Source: internal status components. <Link to="/status">Open public status page</Link>
            </div>
          </Card>
        </Section>

        {loading ? <div style={{ color: text.muted, fontSize: 13 }}>Loading control tower...</div> : null}
        {error ? <div style={{ color: colors.danger, fontSize: 13 }}>{error}</div> : null}
      </Section>
    </MacShell>
  );
};

export default ControlTowerPage;
