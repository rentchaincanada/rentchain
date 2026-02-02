// @ts-nocheck
import React, { useEffect, useState } from "react";
import { Card, Section, Button } from "../components/ui/Ui";
import { createBillingPortalSession, fetchBillingHistory, type BillingRecord } from "../api/billingApi";
import { spacing, text, colors, radius } from "../styles/tokens";
import { SUPPORT_EMAIL } from "../config/support";
import { asArray } from "../lib/asArray";
import { useCapabilities } from "@/hooks/useCapabilities";

const formatAmount = (amountCents: number, currency: string) => {
  const amount = (amountCents || 0) / 100;
  const label = currency ? currency.toUpperCase() : "CAD";
  return `${amount.toFixed(2)} ${label}`;
};

const formatTierLabel = (tier?: string | null) => {
  switch (String(tier || "").toLowerCase()) {
    case "basic":
      return "Basic";
    case "verify":
      return "Verify";
    case "verify_ai":
      return "Verify + AI";
    default:
      return tier || "—";
  }
};

const formatAddonsLabel = (addons?: string[] | null) => {
  if (!addons?.length) return "None";
  const labels = addons.map((addon) => {
    switch (addon) {
      case "credit_score":
        return "Credit score";
      case "expedited":
        return "Expedited processing";
      default:
        return addon;
    }
  });
  return labels.join(", ");
};

const BillingPage: React.FC = () => {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { caps } = useCapabilities();
  const currentPlan = String(caps?.plan || "screening").toLowerCase();

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [history] = await Promise.all([fetchBillingHistory()]);
      setRecords(asArray(history));
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (msg.includes("404")) {
        setError("Billing coming soon");
      } else {
        setError(err?.message || "Failed to load billing history.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handlePortal = async () => {
    try {
      setPortalLoading(true);
      const res = await createBillingPortalSession();
      if (!res?.url) {
        throw new Error("Missing portal URL");
      }
      window.location.assign(res.url);
    } catch (err: any) {
      setError(err?.message || "Unable to open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <Section style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 900, margin: "0 auto" }}>
      <Card elevated>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>Billing & Receipts</h1>
            <div style={{ color: text.muted, fontSize: "0.95rem" }}>Screening charges and receipts.</div>
          </div>
          <div style={{ display: "flex", gap: spacing.xs }}>
            <Button type="button" variant="secondary" onClick={load} disabled={loading}>
              Refresh
            </Button>
            <Button type="button" variant="primary" onClick={handlePortal} disabled={portalLoading}>
              {portalLoading ? "Opening..." : "Manage subscription"}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ fontWeight: 700, fontSize: "1.05rem", marginBottom: 12 }}>
          Plans
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {[
            { id: "screening", label: "Screening (Free)", desc: "Run screenings only.", highlight: currentPlan === "screening" },
            { id: "starter", label: "Starter", desc: "Rental management + maintenance.", highlight: currentPlan === "starter" },
            { id: "pro", label: "Pro", desc: "Messaging, ledger, exports.", highlight: currentPlan === "pro" },
            { id: "elite", label: "Elite (Coming Soon)", desc: "Institutional-grade operations.", highlight: currentPlan === "elite" },
          ].map((plan) => (
            <div
              key={plan.id}
              style={{
                borderRadius: radius.lg,
                border: plan.highlight
                  ? "1px solid rgba(59,130,246,0.45)"
                  : "1px solid rgba(148,163,184,0.25)",
                background: plan.highlight ? "rgba(59,130,246,0.08)" : "rgba(148,163,184,0.06)",
                padding: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{plan.label}</div>
                <div style={{ fontSize: 12, color: text.muted }}>{plan.desc}</div>
              </div>
              {plan.highlight ? (
                <span style={{ fontSize: 12, fontWeight: 700, color: colors.accent }}>Current</span>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        {loading ? (
          <div style={{ color: text.muted }}>Loading...</div>
        ) : error ? (
          <div style={{ color: colors.danger }}>{error}</div>
        ) : records.length === 0 ? (
          <div style={{ color: text.muted }}>
            No billing records yet. Run a screening from the applications page to see receipts.
          </div>
        ) : (
          <div style={{ width: "100%", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                  <th style={{ padding: "8px" }}>Date</th>
                  <th style={{ padding: "8px" }}>Amount</th>
                  <th style={{ padding: "8px" }}>Currency</th>
                  <th style={{ padding: "8px" }}>Description</th>
                  <th style={{ padding: "8px" }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: "8px" }}>
                      {record.createdAt ? new Date(record.createdAt).toLocaleString() : "Unknown"}
                    </td>
                    <td style={{ padding: "8px" }}>{formatAmount(record.amountCents, record.currency)}</td>
                    <td style={{ padding: "8px" }}>{record.currency?.toUpperCase?.() || "CAD"}</td>
                    <td style={{ padding: "8px" }}>
                      <div>{record.description || "Charge"}</div>
                      {record.screeningTier || record.addons?.length ? (
                        <div style={{ fontSize: 12, color: text.muted }}>
                          Tier: {formatTierLabel(record.screeningTier)}
                          {" · "}
                          Add-ons: {formatAddonsLabel(record.addons)}
                          {" · "}
                          Total:{" "}
                          {formatAmount(
                            record.totalAmountCents ?? record.amountCents,
                            record.currency
                          )}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: "8px" }}>
                      {record.receiptUrl ? (
                        <a href={record.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ color: colors.accent }}>
                          View
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: text.secondary }}>
            Need a receipt or have billing questions? Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: colors.accent }}>
              {SUPPORT_EMAIL}
            </a>
            .
          </div>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Reload
          </Button>
        </div>
      </Card>
    </Section>
  );
};

export default BillingPage;
