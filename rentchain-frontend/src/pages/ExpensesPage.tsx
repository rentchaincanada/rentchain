import React from "react";
import { Card, Button } from "../components/ui/Ui";
import { spacing, text, colors } from "../styles/tokens";
import { listExpenses, type ExpenseRecord } from "../api/expensesApi";
import { fetchProperties } from "../api/propertiesApi";
import { AddExpenseModal } from "../components/expenses/AddExpenseModal";

function formatCents(cents: number): string {
  const amount = Number(cents || 0) / 100;
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

function formatDate(ms: number): string {
  if (!ms) return "-";
  try {
    return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "short", day: "numeric" }).format(
      new Date(ms)
    );
  } catch {
    return "-";
  }
}

const ExpensesPage: React.FC = () => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<ExpenseRecord[]>([]);
  const [properties, setProperties] = React.useState<Array<{ id: string; name: string }>>([]);
  const [showAdd, setShowAdd] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expenseRows, propertyRes] = await Promise.all([listExpenses({ limit: 300 }), fetchProperties()]);
      const propertyItems = Array.isArray((propertyRes as any)?.items)
        ? (propertyRes as any).items
        : Array.isArray((propertyRes as any)?.properties)
        ? (propertyRes as any).properties
        : Array.isArray(propertyRes)
        ? propertyRes
        : [];

      setItems(expenseRows);
      setProperties(
        propertyItems
          .map((p: any) => ({
            id: String(p?.id || p?.propertyId || ""),
            name: String(p?.name || p?.addressLine1 || p?.address || "Property"),
          }))
          .filter((p: any) => p.id)
      );
    } catch (err: any) {
      setError(String(err?.message || "Failed to load expenses."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const propertyById = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const p of properties) map.set(p.id, p.name);
    return map;
  }, [properties]);

  return (
    <div style={{ display: "grid", gap: spacing.md }}>
      <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: spacing.md }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>Expenses</div>
          <div style={{ color: text.muted, fontSize: "0.9rem", marginTop: 4 }}>
            Track operating expenses across your properties.
          </div>
        </div>
        <Button onClick={() => setShowAdd(true)}>Add Expense</Button>
      </Card>

      {error ? (
        <Card style={{ border: `1px solid ${colors.danger}` }}>
          <div style={{ fontWeight: 700, color: colors.danger, marginBottom: 8 }}>Could not load expenses</div>
          <div style={{ marginBottom: 12 }}>{error}</div>
          <Button variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </Card>
      ) : null}

      <Card style={{ overflowX: "auto" }}>
        {loading ? (
          <div style={{ color: text.muted }}>Loading expenses...</div>
        ) : items.length === 0 ? (
          <div style={{ color: text.muted }}>No expenses recorded yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: `1px solid ${colors.border}` }}>
                <th style={{ padding: "8px 6px" }}>Date</th>
                <th style={{ padding: "8px 6px" }}>Property</th>
                <th style={{ padding: "8px 6px" }}>Category</th>
                <th style={{ padding: "8px 6px" }}>Vendor</th>
                <th style={{ padding: "8px 6px" }}>Amount</th>
                <th style={{ padding: "8px 6px" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <td style={{ padding: "9px 6px" }}>{formatDate(item.incurredAtMs)}</td>
                  <td style={{ padding: "9px 6px" }}>{propertyById.get(item.propertyId) || item.propertyId}</td>
                  <td style={{ padding: "9px 6px" }}>{item.category}</td>
                  <td style={{ padding: "9px 6px" }}>{item.vendorName || "-"}</td>
                  <td style={{ padding: "9px 6px", fontWeight: 600 }}>{formatCents(item.amountCents)}</td>
                  <td style={{ padding: "9px 6px", color: text.muted }}>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <AddExpenseModal
        open={showAdd}
        properties={properties}
        onClose={() => setShowAdd(false)}
        onSaved={() => {
          void load();
        }}
      />
    </div>
  );
};

export default ExpensesPage;

