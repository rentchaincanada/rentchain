// @ts-nocheck
import React, { useEffect, useState } from "react";
import { Card, Section, Button } from "../components/ui/Ui";
import { fetchBillingHistory, type BillingRecord } from "../api/billingApi";
import { spacing, text, colors, radius } from "../styles/tokens";
import { SUPPORT_EMAIL } from "../config/support";
import { BillingPreviewCard } from "../components/billing/BillingPreviewCard";
import { fetchBillingUsage } from "../api/billingPreviewApi";
import { asArray } from "../lib/asArray";

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

  return (
    <Section style={{ display: "flex", flexDirection: "column", gap: spacing.md, maxWidth: 900, margin: "0 auto" }}>
      <Card elevated>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700 }}>Billing & Receipts</h1>
            <div style={{ color: text.muted, fontSize: "0.95rem" }}>Screening charges and receipts.</div>
          </div>
          <Button type="button" variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </div>
      </Card>

      <BillingPreviewCard usage={usage} />

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
                    <td style={{ padding: "8px" }}>{record.description || "Charge"}</td>
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
