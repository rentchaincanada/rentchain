// rentchain-frontend/src/pages/PaymentsPage.tsx
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { formatOperationalReference } from "@/lib/identityReferences";
import { PaymentCsvImportPreviewCard } from "@/components/ledger/PaymentCsvImportPreviewCard";

type PaymentsDashboardContext = "outstanding" | "collected" | "needs_review" | "current_month";

const DASHBOARD_CONTEXTS = new Set<PaymentsDashboardContext>([
  "outstanding",
  "collected",
  "needs_review",
  "current_month",
]);

function currentMonthKey() {
  return new Date().toISOString().slice(0, 7);
}

function normalizeDashboardContext(value: string | null): PaymentsDashboardContext | null {
  const context = String(value || "").trim().toLowerCase();
  return DASHBOARD_CONTEXTS.has(context as PaymentsDashboardContext) ? (context as PaymentsDashboardContext) : null;
}

function normalizePeriodMonth(value: string | null) {
  const period = String(value || "").trim();
  return /^\d{4}-\d{2}$/.test(period) ? period : currentMonthKey();
}

function paymentMonth(payment: PaymentRecord) {
  const raw = String(payment.paidAt || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 7);
  return /^\d{4}-\d{2}/.test(raw) ? raw.slice(0, 7) : "";
}

function paymentNeedsReview(payment: PaymentRecord) {
  const status = String(payment.status || "").trim().toLowerCase();
  const method = String(payment.method || "").trim().toLowerCase();
  const notes = String(payment.notes || "").trim().toLowerCase();
  return (
    status.includes("review") ||
    status.includes("failed") ||
    status.includes("unmatched") ||
    method.includes("review") ||
    notes.includes("review")
  );
}

export function filterPaymentsByDashboardContext(
  payments: PaymentRecord[],
  context: PaymentsDashboardContext | null,
  periodMonth: string
) {
  if (!context) return payments;
  if (context === "current_month") {
    return payments.filter((payment) => paymentMonth(payment) === periodMonth);
  }
  if (context === "collected") {
    return payments.filter((payment) => {
      const status = String(payment.status || "").trim().toLowerCase();
      return status === "recorded" || status === "paid" || status === "collected" || Boolean(payment.paidAt);
    });
  }
  if (context === "needs_review") {
    return payments.filter(paymentNeedsReview);
  }
  return [];
}

function normalizeFilterValue(value: string) {
  return value.trim().toLowerCase();
}

function readableFilterLabel(value: string) {
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function uniqueSortedFilterOptions(values: string[]) {
  const options = new Map<string, string>();
  for (const value of values) {
    const normalized = normalizeFilterValue(value);
    if (!normalized || options.has(normalized)) continue;
    options.set(normalized, readableFilterLabel(value));
  }
  return Array.from(options.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function paidDateKey(payment: PaymentRecord) {
  const raw = String(payment.paidAt || "").trim();
  if (!raw) return "";
  const parsed = new Date(raw);
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : "";
}

function applyPaymentsWorkspaceFilters(
  payments: PaymentRecord[],
  searchTerm: string,
  statusFilter: string,
  methodFilter: string,
  fromDate: string,
  toDate: string,
  getTenantLabel: (payment: PaymentRecord) => string,
  getPropertyLabel: (payment: PaymentRecord) => string
) {
  const normalizedSearch = normalizeFilterValue(searchTerm);
  const normalizedStatus = normalizeFilterValue(statusFilter);
  const normalizedMethod = normalizeFilterValue(methodFilter);
  const normalizedFromDate = /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? fromDate : "";
  const normalizedToDate = /^\d{4}-\d{2}-\d{2}$/.test(toDate) ? toDate : "";

  return payments.filter((payment) => {
    const status = normalizeFilterValue(String(payment.status || ""));
    const method = normalizeFilterValue(String(payment.method || ""));
    if (normalizedStatus && status !== normalizedStatus) return false;
    if (normalizedMethod && method !== normalizedMethod) return false;
    const paidDate = paidDateKey(payment);
    if (normalizedFromDate && (!paidDate || paidDate < normalizedFromDate)) return false;
    if (normalizedToDate && (!paidDate || paidDate > normalizedToDate)) return false;
    if (!normalizedSearch) return true;

    const searchable = [
      getTenantLabel(payment),
      getPropertyLabel(payment),
      payment.amount != null ? String(payment.amount) : "",
      payment.paidAt || "",
      payment.method || "",
      payment.notes || "",
      payment.status || "",
    ]
      .join(" ")
      .toLowerCase();
    return searchable.includes(normalizedSearch);
  });
}

function dashboardContextLabel(context: PaymentsDashboardContext | null, periodMonth: string) {
  if (context === "current_month") return `Current month payments (${periodMonth})`;
  if (context === "collected") return "Collected payments";
  if (context === "needs_review") return "Payments needing review";
  if (context === "outstanding") return "Outstanding rent context";
  return "";
}

function dashboardContextDescription(context: PaymentsDashboardContext | null) {
  if (context === "current_month") return "Opened from Dashboard Financial Snapshot. Showing payments recorded for this month.";
  if (context === "collected") return "Showing recorded payments that appear collected or paid.";
  if (context === "needs_review") return "Showing payment rows with review, failed, or unmatched signals.";
  if (context === "outstanding") return "Outstanding balances are not recorded payment rows yet. Use lease ledger views for charges and unmatched balances.";
  return "";
}

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
  const { payments, loading, error, refresh } = usePayments();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<PaymentRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");
  const [isCsvImportOpen, setIsCsvImportOpen] = useState(false);
  const [exporting, setExporting] = useState<null | "csv" | "xls">(null);
  const [labelMap, setLabelMap] = useState<{ tenants: Map<string, string>; properties: Map<string, string> }>({
    tenants: new Map(),
    properties: new Map(),
  });

  useEffect(() => {
    setRows(payments);
  }, [payments]);

  const dashboardContext = normalizeDashboardContext(searchParams.get("context"));
  const contextPeriodMonth = normalizePeriodMonth(searchParams.get("period"));
  const isDashboardContextActive = Boolean(dashboardContext);
  const contextLabel = dashboardContextLabel(dashboardContext, contextPeriodMonth);
  const contextDescription = dashboardContextDescription(dashboardContext);

  const clearDashboardContext = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("context");
    next.delete("period");
    next.delete("source");
    setSearchParams(next, { replace: true });
  };

  const getTenantLabel = (payment: PaymentRecord) => {
    const record = payment as any;
    return (
      tenantLabelFromValue(record.tenant) ||
      tenantLabelFromValue(record.tenantProfile) ||
      String(record.tenantName || record.tenantDisplayName || record.applicantName || "").trim() ||
      labelMap.tenants.get(String(payment.tenantId || "").trim()) ||
      (payment.tenantId ? formatOperationalReference("tenant", payment.tenantId) : "Tenant")
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
    if (propertyId && unitId) return `${formatOperationalReference("property", propertyId)} / ${formatOperationalReference("unit", unitId)}`;
    if (propertyId) return formatOperationalReference("property", propertyId);
    if (unitId) return formatOperationalReference("unit", unitId);
    return "Property";
  };

  const contextRows = filterPaymentsByDashboardContext(rows, dashboardContext, contextPeriodMonth);
  const visibleRows = applyPaymentsWorkspaceFilters(
    contextRows,
    searchTerm,
    statusFilter,
    methodFilter,
    fromDateFilter,
    toDateFilter,
    getTenantLabel,
    getPropertyLabel
  );
  const statusOptions = uniqueSortedFilterOptions(rows.map((payment) => String(payment.status || "")));
  const methodOptions = uniqueSortedFilterOptions(rows.map((payment) => String(payment.method || "")));
  const isWorkspaceFilterActive = Boolean(searchTerm.trim() || statusFilter || methodFilter || fromDateFilter || toDateFilter);

  const clearWorkspaceFilters = () => {
    setSearchTerm("");
    setStatusFilter("");
    setMethodFilter("");
    setFromDateFilter("");
    setToDateFilter("");
  };

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

  const triggerExport = async (format: "csv" | "xls") => {
    try {
      setExporting(format);
      const blob = buildCsvBlob(
        ["tenant", "property_unit", "amount", "paid_date", "method", "notes"],
        visibleRows.map((payment) => [
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
            <Button variant="secondary" onClick={() => void printSummaryDocument("summary")}>Print / Save PDF</Button>
          </div>
        </div>
      </Card>

      <Card>
        <div style={{ display: "grid", gap: isCsvImportOpen ? spacing.md : 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: text.primary }}>AI-assisted payment CSV import</div>
              <div style={{ fontSize: "0.9rem", color: text.muted }}>Upload payment rows when you need assisted matching.</div>
            </div>
            {isCsvImportOpen ? (
              <Button variant="secondary" onClick={() => setIsCsvImportOpen(false)}>
                Hide
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setIsCsvImportOpen(true)}>
                Upload CSV
              </Button>
            )}
          </div>
          {isCsvImportOpen ? <PaymentCsvImportPreviewCard onImportComplete={refresh} /> : null}
        </div>
      </Card>

      {isDashboardContextActive ? (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.md, flexWrap: "wrap" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <div style={{ fontWeight: 800, color: text.primary }}>{contextLabel}</div>
              <div style={{ color: text.muted, fontSize: "0.92rem" }}>{contextDescription}</div>
            </div>
            <Button variant="secondary" onClick={clearDashboardContext}>
              Clear filter
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        <div style={{ display: "grid", gap: spacing.sm }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: text.primary }}>Payment Filters</div>
              <div style={{ fontSize: "0.9rem", color: text.muted }}>Search and narrow recorded payment rows.</div>
            </div>
            {isWorkspaceFilterActive ? (
              <Button variant="secondary" onClick={clearWorkspaceFilters}>
                Clear workspace filters
              </Button>
            ) : null}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: spacing.sm }}>
            <label style={{ display: "grid", gap: 6, color: text.muted, fontSize: "0.84rem", fontWeight: 700 }}>
              Search
              <input
                aria-label="Search payments"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tenant, property, notes..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  padding: "0.65rem 0.75rem",
                  color: text.primary,
                  fontSize: "0.95rem",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6, color: text.muted, fontSize: "0.84rem", fontWeight: 700 }}>
              Status
              <select
                aria-label="Filter payments by status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  padding: "0.65rem 0.75rem",
                  color: text.primary,
                  fontSize: "0.95rem",
                  background: "#fff",
                }}
              >
                <option value="">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, color: text.muted, fontSize: "0.84rem", fontWeight: 700 }}>
              Method
              <select
                aria-label="Filter payments by method"
                value={methodFilter}
                onChange={(event) => setMethodFilter(event.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  padding: "0.65rem 0.75rem",
                  color: text.primary,
                  fontSize: "0.95rem",
                  background: "#fff",
                }}
              >
                <option value="">All methods</option>
                {methodOptions.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 6, color: text.muted, fontSize: "0.84rem", fontWeight: 700 }}>
              From date
              <input
                aria-label="Filter payments from date"
                type="date"
                value={fromDateFilter}
                onChange={(event) => setFromDateFilter(event.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  padding: "0.65rem 0.75rem",
                  color: text.primary,
                  fontSize: "0.95rem",
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6, color: text.muted, fontSize: "0.84rem", fontWeight: 700 }}>
              To date
              <input
                aria-label="Filter payments to date"
                type="date"
                value={toDateFilter}
                onChange={(event) => setToDateFilter(event.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  padding: "0.65rem 0.75rem",
                  color: text.primary,
                  fontSize: "0.95rem",
                }}
              />
            </label>
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
        {!loading && !error && visibleRows.length === 0 && (
          <div style={{ fontSize: "0.95rem", color: text.muted }}>
            {isWorkspaceFilterActive
              ? "No payments match these workspace filters. Clear workspace filters to return to the available payment rows."
              : isDashboardContextActive
              ? `No payments match ${contextLabel.toLowerCase()}. Clear the filter to return to all recorded payments.`
              : "No payments recorded yet."}
          </div>
        )}

        {!loading && !error && visibleRows.length > 0 && (
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
                  <th style={{ padding: "0.5rem 0.4rem" }}>Property / Unit</th>
                  <th style={{ padding: "0.5rem 0.4rem", textAlign: "right" }}>Amount</th>
                  <th style={{ padding: "0.5rem 0.4rem" }}>Paid Date</th>
                  <th style={{ padding: "0.5rem 0.4rem", textAlign: "right" }}>Method</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((p) => (
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
            <div>Rows: {visibleRows.length}</div>
          </div>
        </div>
        <div className="printH3">Recorded payments</div>
        <table className="printTable">
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Property / Unit</th>
              <th>Amount</th>
              <th>Paid date</th>
              <th>Method</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((payment) => (
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
