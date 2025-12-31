// @ts-nocheck
import React, { useEffect, useState } from "react";
import { MacShell } from "../components/layout/MacShell";
import { Card, Section, Button } from "../components/ui/Ui";
import { fetchBillingHistory, type BillingRecord } from "../api/billingApi";
import { spacing, text, colors, radius } from "../styles/tokens";
import { SUPPORT_EMAIL } from "../config/support";
import { BillingPreviewCard } from "../components/billing/BillingPreviewCard";
import { fetchBillingUsage } from "../api/billingPreviewApi";
import { asArray } from "../utils/asArray";

const formatAmount = (amountCents: number, currency: string) => {
  const amount = (amountCents || 0) / 100;
  const label = currency ? currency.toUpperCase() : "CAD";
  return `${amount.toFixed(2)} ${label}`;
};

const BillingPage: React.FC = () => {
  const [records, setRecords] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<any | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [history, usageResp] = await Promise.all([fetchBillingHistory(), fetchBillingUsage()]);
      setRecords(asArray(history));
      setUsage(usageResp);
    } catch (err: any) {
      setError(err?.message || "Failed to load billing history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <MacShell title="RentChain · Billing">
      <Section style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 900, margin: "0 auto" }}>
        <Card elevated>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>Billing & Receipts</h1>
              <div style={{ color: text.muted, fontSize: "0.95rem" }}>
                Screening charges and receipts.
              </div>
            </div>
            <Button type="button" variant="secondary" onClick={load} disabled={loading}>
              Refresh
            </Button>
          </div>
        </Card>

        <BillingPreviewCard usage={usage} />

        <Card>
          {loading ? (
            <div style={{ color: text.muted }}>Loading…</div>
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
                    <th style={{ padding: "8px" }}>Description</th>
                    <th style={{ padding: "8px" }}>Amount</th>
                    <th style={{ padding: "8px" }}>Status</th>
                    <th style={{ padding: "8px" }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: "8px", color: text.primary }}>
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                      </td>
                      <td style={{ padding: "8px", color: text.primary }}>{r.description || "Screening charge"}</td>
                      <td style={{ padding: "8px", color: text.primary }}>{formatAmount(r.amountCents, r.currency)}</td>
                      <td style={{ padding: "8px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 8px",
                            borderRadius: radius.sm,
                            background:
                              r.status === "paid"
                                ? "rgba(34,197,94,0.12)"
                                : "rgba(239,68,68,0.12)",
                            color: r.status === "paid" ? "#15803d" : colors.danger,
                            border: r.status === "paid" ? "1px solid rgba(34,197,94,0.4)" : `1px solid ${colors.danger}`,
                          }}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: "8px" }}>
                        {r.receiptUrl ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(r.receiptUrl || "#", "_blank")}
                          >
                            View
                          </Button>
                        ) : (
                          <span style={{ color: text.muted }}>N/A</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div style={{ fontSize: "0.9rem", color: text.muted }}>
          Need help? <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        </div>
      </Section>
    </MacShell>
  );
};

export default BillingPage;
