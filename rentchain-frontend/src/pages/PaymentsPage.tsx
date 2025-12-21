// rentchain-frontend/src/pages/PaymentsPage.tsx
import React, { useEffect, useState } from "react";
import { MacShell } from "../components/layout/MacShell";
import { usePayments } from "../hooks/usePayments";
import { updatePayment, type PaymentRecord } from "@/api/paymentsApi";
import { Card, Button } from "../components/ui/Ui";
import { spacing, text, colors } from "../styles/tokens";

const PaymentsPage: React.FC = () => {
  const { payments, loading, error } = usePayments();
  const [rows, setRows] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    setRows(payments);
  }, [payments]);

  const handleEditPayment = async (p: PaymentRecord) => {
    if (!p.id) return;

    try {
      const currentAmount = p.amount != null ? String(p.amount) : "";
      const currentNotes = p.notes ?? "";
      const currentMethod = p.method ?? "";
      const currentPaidAt = p.paidAt
        ? p.paidAt.slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      const amountStr = window.prompt(
        "Enter new amount (leave blank to keep current):",
        currentAmount
      );
      if (amountStr === null) return;

      const paidAtStr = window.prompt(
        "Enter paid date (YYYY-MM-DD, blank = keep):",
        currentPaidAt
      );
      if (paidAtStr === null) return;

      const methodStr = window.prompt(
        "Enter method (e.g. e-transfer, cash):",
        currentMethod || "e-transfer"
      );
      if (methodStr === null) return;

      const notesStr = window.prompt(
        "Enter notes (blank = keep current):",
        currentNotes
      );
      if (notesStr === null) return;

      const payload: {
        amount?: number;
        paidAt?: string;
        method?: string;
        notes?: string;
      } = {};

      if (amountStr.trim() !== "") {
        const num = Number(amountStr);
        if (!Number.isNaN(num)) {
          payload.amount = num;
        }
      }

      if (paidAtStr.trim() !== "" && paidAtStr.trim() !== currentPaidAt) {
        payload.paidAt = paidAtStr.trim();
      }

      if (methodStr.trim() !== currentMethod.trim()) {
        payload.method = methodStr.trim();
      }

      if (notesStr.trim() !== currentNotes.trim()) {
        payload.notes = notesStr.trim();
      }

      if (Object.keys(payload).length === 0) {
        return; // nothing to update
      }

      const updated: any = await updatePayment(p.id, payload);

      setRows((prev) =>
        prev.map((row) =>
          row.id === p.id ? { ...row, ...updated } : row
        )
      );
    } catch (err) {
      console.error("[PaymentsPage] Failed to update payment:", err);
      window.alert(
        err instanceof Error
          ? `Failed to update payment: ${err.message}`
          : "Failed to update payment."
      );
    }
  };

  return (
    <MacShell title="RentChain · Payments">
      <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
        <Card elevated>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md }}>
            <div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0, color: text.primary }}>Payments</h1>
              <div
                style={{
                  marginTop: "0.1rem",
                  fontSize: "0.95rem",
                  color: text.muted,
                }}
              >
                All recorded payments across tenants and properties.
              </div>
            </div>
          </div>
        </Card>

        <Card>
          {loading && (
            <div style={{ fontSize: "0.95rem", color: text.muted }}>Loading payments…</div>
          )}
          {error && (
            <div style={{ color: colors.danger, fontSize: "0.95rem" }}>
              Failed to load payments: {error}
            </div>
          )}
          {!loading && !error && rows.length === 0 && (
            <div style={{ fontSize: "0.95rem", color: text.muted }}>
              No payments recorded yet.
            </div>
          )}

          {!loading && !error && rows.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.92rem",
                  color: text.primary,
                }}
              >
                <thead>
                  <tr
                    style={{
                      textAlign: "left",
                      fontSize: "0.8rem",
                      color: text.muted,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    <th style={{ padding: "0.5rem 0.4rem" }}>Tenant</th>
                    <th style={{ padding: "0.5rem 0.4rem" }}>Property</th>
                    <th style={{ padding: "0.5rem 0.4rem", textAlign: "right" }}>
                      Amount
                    </th>
                    <th style={{ padding: "0.5rem 0.4rem" }}>Paid Date</th>
                    <th style={{ padding: "0.5rem 0.4rem", textAlign: "right" }}>
                      Method
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      <td style={{ padding: "0.5rem 0.4rem" }}>
                        {p.tenantId ?? "—"}
                      </td>
                      <td style={{ padding: "0.5rem 0.4rem" }}>
                        {p.propertyId ?? "—"}
                      </td>
                      <td
                        style={{
                          padding: "0.5rem 0.4rem",
                          textAlign: "right",
                          fontWeight: 600,
                        }}
                      >
                        {p.amount
                          ? `$${Number(p.amount).toLocaleString()}`
                          : "$0"}
                      </td>
                      <td style={{ padding: "0.5rem 0.4rem" }}>
                        {p.paidAt
                          ? new Date(p.paidAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td
                        style={{
                          padding: "0.5rem 0.4rem",
                          textAlign: "right",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.45rem",
                            fontSize: "0.9rem",
                            color: text.primary,
                          }}
                        >
                          <span>{p.method || "—"}</span>
                          {p.id && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => handleEditPayment(p)}
                              style={{
                                padding: "4px 8px",
                                fontSize: "0.8rem",
                                borderRadius: 12,
                              }}
                              title="Modify payment"
                            >
                              ✏️ Edit
                            </Button>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </MacShell>
  );
};

export default PaymentsPage;
