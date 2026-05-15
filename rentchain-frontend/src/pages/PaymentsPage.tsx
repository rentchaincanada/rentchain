// rentchain-frontend/src/pages/PaymentsPage.tsx
import React, { useEffect, useState } from "react";
import { usePayments } from "../hooks/usePayments";
import {
  getCanonicalPaymentEditId,
  isEditablePaymentRecord,
  updatePayment,
  type PaymentRecord,
} from "@/api/paymentsApi";
import { Card, Button } from "../components/ui/Ui";
import { spacing, text, colors } from "../styles/tokens";
import { fetchProperties } from "../api/propertiesApi";
import { fetchTenants } from "../api/tenantsApi";
import { printSummaryDocument } from "../utils/printSummary";
import { triggerBlobDownload } from "../utils/downloadBlob";
import { buildCsvBlob } from "../utils/csvExport";

function tenantLabelFromValue(value: any): string {
  return (
    String(value?.fullName || value?.name || value?.displayName || "").trim() ||
    [String(value?.firstName || "").trim(), String(value?.lastName || "").trim()].filter(Boolean).join(" ") ||
    String(value?.email || "").trim() ||
    ""
  );
}

function propertyLabelFromValue(value: any): string {
  return (
    String(value?.name || value?.addressLine1 || value?.address || value?.displayName || value?.propertyName || "").trim() ||
    ""
  );
}

const PaymentsPage: React.FC = () => {
  const { payments, loading, error } = usePayments();
  const [rows, setRows] = useState<PaymentRecord[]>([]);
  const [exporting, setExporting] = useState<null | "csv" | "xls">(null);
  const [labelMap, setLabelMap] = useState<{ tenants: Map<string, string>; properties: Map<string, string> }>({
    tenants: new Map(),
    properties: new Map(),
  });

  useEffect(() => {
    setRows(payments);
  }, [payments]);

  useEffect(() => {
    let cancelled = false;

    async function loadLabels() {
      try {
        const [tenantList, propertyRes] = await Promise.all([fetchTenants(), fetchProperties({ includeArchived: true })]);
        if (cancelled) return;
        const propertyItems = Array.isArray((propertyRes as any)?.items)
          ? (propertyRes as any).items
          : Array.isArray((propertyRes as any)?.properties)
          ? (propertyRes as any).properties
          : Array.isArray(propertyRes)
          ? propertyRes
          : [];
        setLabelMap({
          tenants: new Map(
            tenantList.map((tenant) => [
              String(tenant.id || ""),
              tenantLabelFromValue(tenant),
            ])
          ),
          properties: new Map(
            propertyItems.map((property: any) => [
              String(property?.id || ""),
              propertyLabelFromValue(property),
            ])
          ),
        });
      } catch {
        if (!cancelled) {
          setLabelMap({ tenants: new Map(), properties: new Map() });
        }
      }
    }

    void loadLabels();
    return () => {
      cancelled = true;
    };
  }, []);

  const getTenantLabel = (payment: PaymentRecord) => {
    const record = payment as any;
    return (
      tenantLabelFromValue(record.tenant) ||
      tenantLabelFromValue(record.tenantProfile) ||
      String(record.tenantName || record.tenantDisplayName || record.applicantName || "").trim() ||
      labelMap.tenants.get(String(payment.tenantId || "").trim()) ||
      (payment.tenantId ? `Tenant ${payment.tenantId}` : "Tenant")
    );
  };
  const getPropertyLabel = (payment: PaymentRecord) => {
    const record = payment as any;
    const propertyLabel =
      propertyLabelFromValue(record.property) ||
      String(record.propertyName || record.propertyDisplayName || record.propertyDisplayLabel || "").trim() ||
      labelMap.properties.get(String(payment.propertyId || "").trim()) ||
      "";
    const unitLabel = String(record.unitName || record.unitNumber || record.unitLabel || record.unitDisplayLabel || "").trim();
    const formattedUnit = unitLabel ? (/^unit\b/i.test(unitLabel) ? unitLabel : `Unit ${unitLabel}`) : "";
    if (propertyLabel && formattedUnit) return `${propertyLabel} / ${formattedUnit}`;
    const propertyId = String(payment.propertyId || "").trim();
    const unitId = String(record.unitId || "").trim();
    if (propertyLabel || formattedUnit) return propertyLabel || formattedUnit;
    if (propertyId && unitId) return `Property ${propertyId} / Unit ${unitId}`;
    if (propertyId) return `Property ${propertyId}`;
    if (unitId) return `Unit ${unitId}`;
    return "Property";
  };

  const triggerExport = async (format: "csv" | "xls") => {
    try {
      setExporting(format);
      const blob = buildCsvBlob(
        ["tenant", "property", "amount", "paid_date", "method", "notes"],
        rows.map((payment) => [
          getTenantLabel(payment),
          getPropertyLabel(payment),
          Number(payment.amount || 0),
          payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : "",
          payment.method || "",
          String(payment.notes || "").trim(),
        ])
      );
      triggerBlobDownload(blob, `rentchain-payments-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch (err) {
      console.error("[PaymentsPage] Failed to export payments:", err);
      window.alert(err instanceof Error ? `Failed to export payments: ${err.message}` : "Failed to export payments.");
    } finally {
      setExporting(null);
    }
  };

  const handleEditPayment = async (p: PaymentRecord) => {
    const paymentEditId = getCanonicalPaymentEditId(p);
    if (!paymentEditId) return;

    try {
      const currentAmount = p.amount != null ? String(p.amount) : "";
      const currentNotes = p.notes ?? "";
      const currentMethod = p.method ?? "";
      const currentPaidAt = p.paidAt ? p.paidAt.slice(0, 10) : new Date().toISOString().slice(0, 10);

      const amountStr = window.prompt("Enter new amount (leave blank to keep current):", currentAmount);
      if (amountStr === null) return;

      const paidAtStr = window.prompt("Enter paid date (YYYY-MM-DD, blank = keep):", currentPaidAt);
      if (paidAtStr === null) return;

      const methodStr = window.prompt("Enter method (e.g. e-transfer, cash):", currentMethod || "e-transfer");
      if (methodStr === null) return;

      const notesStr = window.prompt("Enter notes (blank = keep current):", currentNotes);
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

      const updated: any = await updatePayment(paymentEditId, payload);

      setRows((prev) => prev.map((row) => (row.id === p.id ? { ...row, ...updated } : row)));
    } catch (err) {
      console.error("[PaymentsPage] Failed to update payment:", err);
      window.alert(err instanceof Error ? `Failed to update payment: ${err.message}` : "Failed to update payment.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: spacing.lg }}>
      <Card elevated>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0, color: text.primary }}>Payments (recorded)</h1>
            <div
              style={{
                marginTop: "0.1rem",
                fontSize: "0.95rem",
                color: text.muted,
              }}
            >
              This page shows recorded rent payments only. Lease charges, credits, and unmatched ledger entries appear in tenant Financial activity and lease ledger views.
            </div>
          </div>
          <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Button variant="secondary" onClick={() => void triggerExport("csv")} disabled={exporting !== null}>
              {exporting === "csv" ? "Exporting..." : "Export CSV"}
            </Button>
            <Button variant="secondary" onClick={() => void triggerExport("xls")} disabled={exporting !== null}>
              {exporting === "xls" ? "Exporting..." : "Export Spreadsheet (.xls)"}
            </Button>
            <Button variant="secondary" onClick={() => void printSummaryDocument("summary")}>Export PDF</Button>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid", gap: spacing.xs }}>
          <div style={{ fontSize: "1rem", fontWeight: 700, color: text.primary }}>Financial Activity</div>
          <div style={{ fontSize: "0.92rem", color: text.primary }}>
            Recorded payments track money entered in the payments system.
          </div>
          <div style={{ fontSize: "0.92rem", color: text.primary }}>
            Lease ledger activity tracks charges, credits, and unmatched ledger entries separately.
          </div>
          <div style={{ fontSize: "0.92rem", color: text.muted }}>
            These views are intentionally separate to avoid double counting and preserve audit integrity.
          </div>
        </div>
      </Card>

      <Card>
        {loading && <div style={{ fontSize: "0.95rem", color: text.muted }}>Loading payments...</div>}
        {error && <div style={{ color: colors.danger, fontSize: "0.95rem" }}>Failed to load payments: {error}</div>}
        {!loading && !error && rows.length === 0 && (
          <div style={{ fontSize: "0.95rem", color: text.muted }}>No payments recorded yet.</div>
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
                  <th style={{ padding: "0.5rem 0.4rem", textAlign: "right" }}>Amount</th>
                  <th style={{ padding: "0.5rem 0.4rem" }}>Paid Date</th>
                  <th style={{ padding: "0.5rem 0.4rem", textAlign: "right" }}>Method</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: "0.5rem 0.4rem" }}>{getTenantLabel(p)}</td>
                    <td style={{ padding: "0.5rem 0.4rem" }}>{getPropertyLabel(p)}</td>
                    <td
                      style={{
                        padding: "0.5rem 0.4rem",
                        textAlign: "right",
                        fontWeight: 600,
                      }}
                    >
                      {p.amount ? `$${Number(p.amount).toLocaleString()}` : "$0"}
                    </td>
                    <td style={{ padding: "0.5rem 0.4rem" }}>
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "—"}
                    </td>
                    <td
                      style={{
                        padding: "0.5rem 0.4rem",
                        textAlign: "right",
                        display: "grid",
                        gap: 6,
                        justifyItems: "end",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.45rem",
                          fontSize: "0.9rem",
                        }}
                      >
                        {p.method || "Unspecified"}
                      </span>
                      {isEditablePaymentRecord(p) ? (
                        <Button
                          variant="secondary"
                          onClick={() => void handleEditPayment(p)}
                          style={{ padding: "0.35rem 0.6rem", fontSize: "0.85rem" }}
                        >
                          Edit
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="print-only print-only-summary">
        <div className="printHeader">
          <div className="printTitle">Payments summary</div>
          <div className="printMeta">
            <div>Generated: {new Date().toLocaleString()}</div>
            <div>Rows: {rows.length}</div>
          </div>
        </div>
        <div className="printH3">Recorded payments</div>
        <table className="printTable">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Property</th>
              <th>Amount</th>
              <th>Paid date</th>
              <th>Method</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((payment) => (
              <tr key={payment.id}>
                <td>{getTenantLabel(payment)}</td>
                <td>{getPropertyLabel(payment)}</td>
                <td>{payment.amount ? `$${Number(payment.amount).toLocaleString()}` : "$0"}</td>
                <td>{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString() : "-"}</td>
                <td>{payment.method || "-"}</td>
                <td>{String(payment.notes || "").trim() || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PaymentsPage;
