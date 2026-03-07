import React from "react";
import {
  createExpense,
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
  type ExpenseSource,
} from "../../api/expensesApi";
import { useUnitsForProperty } from "../../hooks/useUnitsForProperty";
import { useToast } from "../ui/ToastProvider";

type PropertyOption = { id: string; name: string };
type ExpensePayload = {
  propertyId: string;
  unitId: string | null;
  category: ExpenseCategory;
  vendorName: string;
  amountCents: number;
  incurredAtMs: number;
  notes: string;
};

type Props = {
  open: boolean;
  properties: PropertyOption[];
  defaultPropertyId?: string | null;
  defaultSource?: ExpenseSource;
  onClose: () => void;
  onSaved?: () => void;
};

function centsFromAmountInput(raw: string): number {
  const normalized = String(raw || "").trim();
  if (!normalized) return 0;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100);
}

function toDateInputValue(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateInputToMs(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return 0;
  const parsed = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

export function AddExpenseModal({
  open,
  properties,
  defaultPropertyId,
  defaultSource,
  onClose,
  onSaved,
}: Props) {
  const { showToast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [propertyId, setPropertyId] = React.useState<string>("");
  const [unitId, setUnitId] = React.useState<string>("");
  const [source, setSource] = React.useState<ExpenseSource>("manual");
  const [category, setCategory] = React.useState<ExpenseCategory | "">("");
  const [vendorName, setVendorName] = React.useState("");
  const [amountInput, setAmountInput] = React.useState("");
  const [dateInput, setDateInput] = React.useState(toDateInputValue(Date.now()));
  const [notes, setNotes] = React.useState("");

  const { units, loading: unitsLoading, error: unitsError, refetch: refetchUnits } = useUnitsForProperty(
    propertyId,
    open && Boolean(propertyId)
  );

  React.useEffect(() => {
    if (!open) return;
    const initialProperty = defaultPropertyId || properties[0]?.id || "";
    const initialSource: ExpenseSource = defaultSource || "manual";
    setPropertyId(initialProperty);
    setUnitId("");
    setSource(initialSource);
    setCategory(initialSource === "work_order" ? "Repairs" : "");
    setVendorName("");
    setAmountInput("");
    setDateInput(toDateInputValue(Date.now()));
    setNotes("");
    setSaving(false);
    setError(null);
  }, [open, defaultPropertyId, defaultSource, properties]);

  if (!open) return null;

  const handleSave = async () => {
    const amountCents = centsFromAmountInput(amountInput);
    const incurredAtMs = dateInputToMs(dateInput);
    if (!propertyId) {
      setError("Property is required.");
      return;
    }
    if (!category) {
      setError("Category is required.");
      return;
    }
    if (amountCents <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }
    if (!incurredAtMs) {
      setError("Date is required.");
      return;
    }

    const payload: ExpensePayload = {
      propertyId,
      unitId: unitId || null,
      category,
      vendorName: vendorName.trim(),
      amountCents,
      incurredAtMs,
      notes: notes.trim(),
      source,
    };

    setSaving(true);
    setError(null);
    try {
      await createExpense(payload);
      showToast({ message: "Expense recorded", variant: "success" });
      onSaved?.();
      onClose();
    } catch (err: any) {
      const message = String(err?.message || "Unable to record expense.");
      setError(message);
      showToast({ message: "Failed to record expense", description: message, variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 1300,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: "min(560px, 100%)",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          boxShadow: "0 22px 60px rgba(15,23,42,0.28)",
          padding: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>Add Expense</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close add expense"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: 16,
              color: "#475569",
            }}
          >
            x
          </button>
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#0f172a" }}>
          Property
          <select
            value={propertyId}
            onChange={(e) => {
              setPropertyId(e.target.value);
              setUnitId("");
            }}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontSize: "0.9rem",
            }}
          >
            <option value="">Select property</option>
            {properties.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#0f172a" }}>
          Unit (optional)
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              fontSize: "0.9rem",
            }}
            disabled={!propertyId || unitsLoading}
          >
            <option value="">{unitsLoading ? "Loading units..." : "Whole property / unspecified"}</option>
            {units.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {unitsError ? (
            <span style={{ fontSize: "0.8rem", color: "#b91c1c", display: "flex", gap: 8 }}>
              {unitsError}
              <button
                type="button"
                onClick={refetchUnits}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#2563eb",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 600,
                }}
              >
                Retry
              </button>
            </span>
          ) : null}
        </label>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#0f172a" }}>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                background: "#fff",
                fontSize: "0.9rem",
              }}
            >
              <option value="">Select category</option>
              {EXPENSE_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#0f172a" }}>
            Amount
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0.00"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
              }}
            />
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#0f172a" }}>
            Vendor / Payee
            <input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Vendor name"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#0f172a" }}>
            Date
            <input
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
              }}
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: 6, fontSize: "0.9rem", color: "#0f172a" }}>
          Notes
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes..."
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              fontSize: "0.9rem",
              resize: "vertical",
              minHeight: 80,
            }}
          />
        </label>

        {error ? (
          <div
            style={{
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              borderRadius: 8,
              padding: "8px 10px",
              fontSize: "0.88rem",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#fff",
              cursor: saving ? "default" : "pointer",
            }}
          >
            {saving ? "Saving..." : "Save expense"}
          </button>
        </div>
      </div>
    </div>
  );
}
