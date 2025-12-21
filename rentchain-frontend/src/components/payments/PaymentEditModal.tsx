import React, { useEffect, useState } from "react";
import {
  updatePayment,
  type PaymentRecord,
  type UpdatePaymentPayload,
} from "@/api/paymentsApi";
import type { TenantPayment } from "../../api/tenantDetail";

interface PaymentEditModalProps {
  open: boolean;
  tenantId: string;
  payment: TenantPayment | null;
  onClose: () => void;
  onUpdated: (payment: TenantPayment) => void;
}

function normalizeToTenantPayment(
  record: PaymentRecord,
  fallback: TenantPayment
): TenantPayment {
  return {
    id: record.id ?? fallback.id,
    tenantId: record.tenantId ?? fallback.tenantId,
    amount: record.amount ?? fallback.amount,
    paidAt: record.paidAt ?? fallback.paidAt,
    method: record.method ?? fallback.method,
    notes: record.notes ?? fallback.notes,
    status: fallback.status,
  };
}

export const PaymentEditModal: React.FC<PaymentEditModalProps> = ({
  open,
  tenantId: _tenantId, // reserved for future context
  payment,
  onClose,
  onUpdated,
}) => {
  const [amount, setAmount] = useState<string>("");
  const [paidAt, setPaidAt] = useState<string>("");
  const [method, setMethod] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!payment) return;
    setAmount(payment.amount != null ? String(payment.amount) : "");
    setPaidAt(payment.paidAt ? payment.paidAt.slice(0, 10) : "");
    setMethod(payment.method ?? "");
    setNotes(payment.notes ?? "");
    setError(null);
  }, [payment]);

  if (!open || !payment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: UpdatePaymentPayload = {};

    if (amount.trim() !== "") {
      const numericAmount = Number(amount);
      if (Number.isNaN(numericAmount)) {
        setError("Amount must be a valid number.");
        return;
      }
      payload.amount = numericAmount;
    }

    if (paidAt.trim() !== "") {
      payload.paidAt = paidAt.trim();
    }

    if (method.trim() !== "") {
      payload.method = method.trim();
    }

    payload.notes = notes.trim();

    try {
      setSaving(true);
      setError(null);
      const updated = await updatePayment(payment.id, payload);
      onUpdated(normalizeToTenantPayment(updated, payment));
      onClose();
    } catch (err: unknown) {
      console.error("[PaymentEditModal] Failed to update payment", err);
      const message =
        err instanceof Error ? err.message : "Failed to save changes.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "rgba(15,23,42,0.95)",
          border: "1px solid rgba(148,163,184,0.4)",
          borderRadius: "0.75rem",
          padding: "1rem",
          width: "100%",
          maxWidth: "420px",
          color: "white",
          boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.6rem",
          }}
        >
          <div>
            <div style={{ fontWeight: 700 }}>Edit Payment</div>
            <div style={{ opacity: 0.75, fontSize: "0.82rem" }}>
              {payment.paidAt
                ? new Date(payment.paidAt).toLocaleDateString()
                : "Unknown date"}{" "}
              •{" "}
              {payment.amount
                ? `$${Number(payment.amount).toLocaleString()}`
                : "$0"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              border: "none",
              background: "transparent",
              color: "#cbd5e1",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: "1.2rem",
            }}
            aria-label="Close edit modal"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}
        >
          <label
            style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}
          >
            <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>Amount</span>
            <input
              name="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                padding: "0.5rem 0.6rem",
                borderRadius: "0.4rem",
                border: "1px solid rgba(148,163,184,0.5)",
                background: "rgba(15,23,42,0.8)",
                color: "white",
              }}
            />
          </label>

          <label
            style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}
          >
            <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>Paid Date</span>
            <input
              name="paidAt"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
              style={{
                padding: "0.5rem 0.6rem",
                borderRadius: "0.4rem",
                border: "1px solid rgba(148,163,184,0.5)",
                background: "rgba(15,23,42,0.8)",
                color: "white",
              }}
            />
          </label>

          <label
            style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}
          >
            <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>Method</span>
            <input
              name="method"
              type="text"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              style={{
                padding: "0.5rem 0.6rem",
                borderRadius: "0.4rem",
                border: "1px solid rgba(148,163,184,0.5)",
                background: "rgba(15,23,42,0.8)",
                color: "white",
              }}
              placeholder="e.g. e-transfer, cash"
            />
          </label>

          <label
            style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}
          >
            <span style={{ fontSize: "0.85rem", opacity: 0.9 }}>Notes</span>
            <textarea
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{
                padding: "0.5rem 0.6rem",
                borderRadius: "0.4rem",
                border: "1px solid rgba(148,163,184,0.5)",
                background: "rgba(15,23,42,0.8)",
                color: "white",
                resize: "vertical",
              }}
              placeholder="Optional notes"
            />
          </label>

          {error && (
            <div
              style={{
                fontSize: "0.82rem",
                color: "#fca5a5",
                backgroundColor: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.45)",
                borderRadius: "0.4rem",
                padding: "0.4rem 0.6rem",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
              marginTop: "0.4rem",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                border: "1px solid rgba(148,163,184,0.6)",
                background: "transparent",
                color: "white",
                padding: "0.35rem 0.8rem",
                borderRadius: "0.4rem",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "0.85rem",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                border: "1px solid rgba(56,189,248,0.9)",
                background:
                  "radial-gradient(circle at top left, rgba(56,189,248,0.2), rgba(15,23,42,0.95))",
                color: "white",
                padding: "0.35rem 0.9rem",
                borderRadius: "0.4rem",
                cursor: saving ? "not-allowed" : "pointer",
                fontSize: "0.85rem",
              }}
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
