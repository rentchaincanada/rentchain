import { useEffect, useState } from "react";
import { getTuReferralChart, type TuReferralChartResponse } from "../../api/adminMetricsApi";
import { Button, Card, Input, Section } from "../ui/Ui";
import { colors, radius, spacing, text } from "../../styles/tokens";
import TuReferralMetricsChartTest from "./TuReferralMetricsChartTest";

function currentMonthInputValue() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-CA", { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatPercent(value: number) {
  return `${(Number(value || 0) * 100).toFixed(2)}%`;
}

function toCsv(data: TuReferralChartResponse | null) {
  if (!data) return "";
  const rows = ["day,initiated,completed"];
  for (const point of data.series || []) {
    rows.push(`${point.day},${point.initiated || 0},${point.completed || 0}`);
  }
  return rows.join("\n");
}

function downloadFile(filename: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function TuReferralMetricsWidget() {
  const [month, setMonth] = useState(currentMonthInputValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TuReferralChartResponse | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const next = await getTuReferralChart(month);
        if (cancelled) return;
        setData(next);
        setLastUpdated(Date.now());
      } catch (err: any) {
        if (cancelled) return;
        setError(String(err?.message || "Failed to load TU referral metrics"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [month]);

  const totals = data?.totals || {
    referralClicks: 0,
    completedScreenings: 0,
    activeLandlords: 0,
    screeningsPerLandlord: 0,
    conversionRate: 0,
  };
  return (
    <Card elevated>
      <Section style={{ display: "grid", gap: spacing.sm }}>
        <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: spacing.sm, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.15rem" }}>TransUnion Referral Metrics</h2>
            <div style={{ fontSize: 12, color: text.muted, marginTop: 4 }}>
              Shows referral clicks and completed screenings originating from RentChain.
            </div>
          </div>
          <div style={{ minWidth: 180 }}>
            <label style={{ display: "block", fontSize: 12, color: text.muted, marginBottom: 4 }}>Month</label>
            <Input type="month" value={month} onChange={(e) => setMonth(String(e.target.value || currentMonthInputValue()))} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: spacing.sm }}>
          <Card style={{ padding: spacing.md }}>
            <div style={{ fontSize: "2rem", lineHeight: 1.1, fontWeight: 700 }}>{formatNumber(totals.referralClicks)}</div>
            <div style={{ fontSize: 12, color: text.muted }}>Referral Clicks</div>
          </Card>
          <Card style={{ padding: spacing.md }}>
            <div style={{ fontSize: "2rem", lineHeight: 1.1, fontWeight: 700 }}>{formatNumber(totals.completedScreenings)}</div>
            <div style={{ fontSize: 12, color: text.muted }}>Completed Screenings</div>
          </Card>
          <Card style={{ padding: spacing.md }}>
            <div style={{ fontSize: "2rem", lineHeight: 1.1, fontWeight: 700 }}>{formatNumber(totals.activeLandlords)}</div>
            <div style={{ fontSize: 12, color: text.muted }}>Active Landlords</div>
          </Card>
          <Card style={{ padding: spacing.md }}>
            <div style={{ fontSize: "2rem", lineHeight: 1.1, fontWeight: 700 }}>{formatNumber(totals.screeningsPerLandlord)}</div>
            <div style={{ fontSize: 12, color: text.muted }}>Screenings / Landlord</div>
          </Card>
          <Card style={{ padding: spacing.md }}>
            <div style={{ fontSize: "2rem", lineHeight: 1.1, fontWeight: 700 }}>{formatPercent(totals.conversionRate)}</div>
            <div style={{ fontSize: 12, color: text.muted }}>Conversion Rate</div>
          </Card>
        </div>

        <Card style={{ padding: spacing.md }}>
          <div style={{ fontWeight: 700, marginBottom: spacing.sm }}>Daily Trend</div>
          <div style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: spacing.sm }}>
            <TuReferralMetricsChartTest />
          </div>
          {loading ? <div style={{ color: text.muted }}>Loading KPI data...</div> : null}
          {error ? <div style={{ color: colors.danger }}>KPI data error: {error}</div> : null}
        </Card>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, color: text.muted }}>
            Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "Not loaded"}
          </div>
          <div style={{ display: "flex", gap: spacing.xs }}>
            <Button
              type="button"
              variant="secondary"
              disabled={!data}
              onClick={() => downloadFile(`tu-referrals-${month}.csv`, toCsv(data), "text/csv;charset=utf-8")}
            >
              Download CSV
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!data}
              onClick={() => downloadFile(`tu-referrals-${month}.json`, JSON.stringify(data, null, 2), "application/json")}
              style={{ borderRadius: radius.md }}
            >
              View raw JSON
            </Button>
          </div>
        </div>
      </Section>
    </Card>
  );
}

export default TuReferralMetricsWidget;
