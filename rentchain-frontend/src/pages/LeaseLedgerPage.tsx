import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  addLeaseCharge,
  addLeasePayment,
  fetchLeaseLedger,
  leaseLedgerExportUrl,
  type LeaseLedgerEntry,
} from "../api/leaseLedgerApi";
import { getAuthToken } from "../lib/authToken";
import { getFirebaseIdToken } from "../lib/firebaseAuthToken";

type ChargeType = "rent" | "fee" | "adjustment";
type PaymentMethod = "cash" | "etransfer" | "cheque" | "bank" | "card" | "other";

function centsFromInput(input: string): number | null {
  const parsed = Number(input);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function dollars(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const modalBackdrop: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 80,
};

const modalCard: React.CSSProperties = {
  width: "min(560px, 96vw)",
  borderRadius: 16,
  border: "1px solid #e2e8f0",
  background: "#fff",
  boxShadow: "0 20px 50px rgba(15,23,42,0.2)",
  padding: 18,
};

export default function LeaseLedgerPage() {
  const { leaseId = "" } = useParams();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<LeaseLedgerEntry[]>([]);
  const [totals, setTotals] = useState({ chargesCents: 0, paymentsCents: 0, balanceCents: 0 });
  const [monthlyTotals, setMonthlyTotals] = useState<Record<string, { chargesCents: number; paymentsCents: number; netCents: number }>>({});
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [chargeDate, setChargeDate] = useState(todayIso());
  const [chargeType, setChargeType] = useState<ChargeType>("rent");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeNotes, setChargeNotes] = useState("");

  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("etransfer");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const monthlyRows = useMemo(() => {
    return Object.entries(monthlyTotals).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [monthlyTotals]);

  const loadLedger = async () => {
    if (!leaseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLeaseLedger(leaseId, from || undefined, to || undefined);
      setEntries(Array.isArray(res.entries) ? res.entries : []);
      setTotals(res.totals || { chargesCents: 0, paymentsCents: 0, balanceCents: 0 });
      setMonthlyTotals(res.monthlyTotals || {});
    } catch (err: any) {
      setError(err?.message || "Failed to load lease ledger");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaseId]);

  async function submitCharge() {
    const amountCents = centsFromInput(chargeAmount);
    if (!amountCents) {
      setError("Charge amount must be greater than 0.");
      return;
    }
    if (!chargeDate) {
      setError("Charge date is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addLeaseCharge(leaseId, {
        amountCents,
        date: chargeDate,
        type: chargeType,
        notes: chargeNotes.trim() || undefined,
      });
      setShowChargeModal(false);
      setChargeAmount("");
      setChargeNotes("");
      await loadLedger();
    } catch (err: any) {
      setError(err?.message || "Failed to add charge");
    } finally {
      setSaving(false);
    }
  }

  async function submitPayment() {
    const amountCents = centsFromInput(paymentAmount);
    if (!amountCents) {
      setError("Payment amount must be greater than 0.");
      return;
    }
    if (!paymentDate) {
      setError("Payment date is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addLeasePayment(leaseId, {
        amountCents,
        date: paymentDate,
        method: paymentMethod,
        reference: paymentReference.trim() || undefined,
        notes: paymentNotes.trim() || undefined,
      });
      setShowPaymentModal(false);
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");
      await loadLedger();
    } catch (err: any) {
      setError(err?.message || "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  async function exportCsv() {
    try {
      const token = (await getFirebaseIdToken()) || getAuthToken();
      const authHeader = token ? { Authorization: `Bearer ${token}` } : {};
      const url = leaseLedgerExportUrl(leaseId, from || undefined, to || undefined);
      const res = await fetch(url, {
        method: "GET",
        headers: {
          ...authHeader,
          "x-api-client": "web",
          "x-rc-auth": token ? "bearer" : "missing",
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `lease-ledger-${leaseId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      setError(err?.message || "Failed to export CSV");
    }
  }

  return (
    <div style={{ padding: 16, display: "grid", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.2rem" }}>Lease Ledger</h1>
          <div style={{ color: "#475569", marginTop: 4 }}>Lease ID: {leaseId}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => setShowChargeModal(true)}>Add charge</button>
          <button onClick={() => setShowPaymentModal(true)}>Record payment</button>
          <button onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "#334155" }}>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, color: "#334155" }}>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button onClick={loadLedger}>Apply</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>Charges</div>
          <strong>{dollars(totals.chargesCents)}</strong>
        </div>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>Payments</div>
          <strong>{dollars(totals.paymentsCents)}</strong>
        </div>
        <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>Balance</div>
          <strong>{dollars(totals.balanceCents)}</strong>
        </div>
      </div>

      {error ? <div style={{ color: "#b91c1c" }}>{error}</div> : null}

      {loading ? (
        <div>Loading ledger…</div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["Date", "Type", "Category", "Amount", "Method/Ref", "Notes", "Balance"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 12, color: "#64748b" }}>
                    No ledger entries for this range.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{entry.effectiveDate}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", textTransform: "capitalize" }}>{entry.entryType}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", textTransform: "capitalize" }}>{entry.category}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9", color: entry.entryType === "payment" ? "#047857" : "#0f172a" }}>
                      {entry.entryType === "payment" ? "-" : "+"}
                      {dollars(Math.abs(entry.amountCents))}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>
                      {[entry.method, entry.reference].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{entry.notes || "—"}</td>
                    <td style={{ padding: 10, borderBottom: "1px solid #f1f5f9" }}>{dollars(entry.balanceCents)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {monthlyRows.length ? (
        <div style={{ display: "grid", gap: 8 }}>
          <h2 style={{ margin: 0, fontSize: "1rem" }}>Monthly totals</h2>
          {monthlyRows.map(([month, row]) => (
            <div
              key={month}
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                border: "1px solid #e2e8f0",
                borderRadius: 10,
                padding: 10,
              }}
            >
              <strong style={{ minWidth: 90 }}>{month}</strong>
              <span>Charges: {dollars(row.chargesCents)}</span>
              <span>Payments: {dollars(row.paymentsCents)}</span>
              <span>Net: {dollars(row.netCents)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {showChargeModal ? (
        <div style={modalBackdrop} onClick={() => !saving && setShowChargeModal(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add charge</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <label>
                Date
                <input type="date" value={chargeDate} onChange={(e) => setChargeDate(e.target.value)} />
              </label>
              <label>
                Type
                <select value={chargeType} onChange={(e) => setChargeType(e.target.value as ChargeType)}>
                  <option value="rent">Rent</option>
                  <option value="fee">Fee</option>
                  <option value="adjustment">Adjustment</option>
                </select>
              </label>
              <label>
                Amount (CAD)
                <input type="number" min="0" step="0.01" value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} />
              </label>
              <label>
                Notes (optional)
                <textarea value={chargeNotes} onChange={(e) => setChargeNotes(e.target.value)} rows={3} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button disabled={saving} onClick={() => setShowChargeModal(false)}>Cancel</button>
              <button disabled={saving} onClick={submitCharge}>{saving ? "Saving…" : "Save charge"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showPaymentModal ? (
        <div style={modalBackdrop} onClick={() => !saving && setShowPaymentModal(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Record payment</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <label>
                Date
                <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
              </label>
              <label>
                Method
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                  <option value="cash">Cash</option>
                  <option value="etransfer">eTransfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="bank">Bank</option>
                  <option value="card">Card</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                Amount (CAD)
                <input type="number" min="0" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
              </label>
              <label>
                Reference (optional)
                <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} />
              </label>
              <label>
                Notes (optional)
                <textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} rows={3} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button disabled={saving} onClick={() => setShowPaymentModal(false)}>Cancel</button>
              <button disabled={saving} onClick={submitPayment}>{saving ? "Saving…" : "Record payment"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
