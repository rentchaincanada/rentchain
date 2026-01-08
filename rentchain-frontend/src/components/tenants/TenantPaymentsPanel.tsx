import React, { useEffect, useMemo, useState } from "react";
import {
  fetchPayments,
  getTenantMonthlyPayments,
  updatePayment,
  type Payment,
  type PaymentRecord,
  type UpdatePaymentPayload,
} from "@/api/paymentsApi";

type Props = {
  tenantId?: string | null;
};

function formatDate(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "--";
  const d = new Date(value as any);
  const t = d.getTime();
  if (Number.isNaN(t)) return String(value);
  return d.toLocaleDateString();
}

function formatMoney(n?: number | null) {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return v.toLocaleString(undefined, { style: "currency", currency: "CAD" });
}

// Named export (for legacy imports)
function TenantPaymentsPanel({ tenantId }: Props) {
  const safeTenantId = tenantId ?? undefined;

  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [monthly, setMonthly] = useState<{ payments: Payment[]; total: number } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("");

  const lastPayment = useMemo(() => {
    if (!payments?.length) return null;
    return payments
      .slice()
      .sort((a: any, b: any) => {
        const tb = b?.paidAt ? new Date(b.paidAt as any).getTime() : 0;
        const ta = a?.paidAt ? new Date(a.paidAt as any).getTime() : 0;
        return tb - ta;
      })[0] as PaymentRecord;
  }, [payments]);

  async function load() {
    if (!safeTenantId) {
      setPayments([]);
      setMonthly(null);
      setErr(null);
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const [all, m] = await Promise.all([
        fetchPayments(safeTenantId),
        getTenantMonthlyPayments(safeTenantId, year, month),
      ]);

      setPayments(Array.isArray(all) ? all : []);
      setMonthly(m ?? { payments: [], total: 0 });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load payments.");
      setPayments([]);
      setMonthly(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeTenantId, year, month]);

  function beginEdit(p: any) {
    setEditingId(String(p?.id ?? ""));
    setEditAmount(p?.amount != null ? String(p.amount) : "");
    setEditStatus(p?.status != null ? String(p.status) : "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditAmount("");
    setEditStatus("");
  }

  async function saveEdit() {
    if (!editingId) return;
    setBusy(true);
    setErr(null);
    try {
      const payload: UpdatePaymentPayload = {};
      const amountNum = Number(editAmount);
      if (editAmount !== "" && Number.isFinite(amountNum)) (payload as any).amount = amountNum;
      if (editStatus !== "") (payload as any).status = editStatus;

      await updatePayment(editingId, payload);
      cancelEdit();
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to update payment.");
    } finally {
      setBusy(false);
    }
  }

  if (!safeTenantId) {
    return (
      <div style={{ padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Payments</div>
        <div style={{ opacity: 0.8 }}>Select a tenant to view payments.</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontWeight: 600 }}>Payments</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Last payment: {lastPayment ? formatDate((lastPayment as any).paidAt) : "--"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 12, opacity: 0.8 }}>Year</label>
          <input
            value={year}
            onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())}
            type="number"
            style={{ width: 90 }}
          />
          <label style={{ fontSize: 12, opacity: 0.8 }}>Month</label>
          <input
            value={month}
            onChange={(e) => {
              const v = Number(e.target.value) || now.getMonth() + 1;
              setMonth(Math.max(1, Math.min(12, v)));
            }}
            type="number"
            style={{ width: 70 }}
          />
          <button onClick={() => void load()} disabled={busy} style={{ padding: "6px 10px" }}>
            Refresh
          </button>
        </div>
      </div>

      {err ? (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #f0c0c0" }}>
          <div style={{ fontWeight: 600 }}>Could not load payments</div>
          <div style={{ opacity: 0.85 }}>{err}</div>
        </div>
      ) : null}

      <div style={{ marginTop: 12, padding: 10, border: "1px solid #e6e6e6" }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Monthly summary</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13 }}>
          <div>Total: {formatMoney(monthly?.total ?? 0)}</div>
          <div>Count: {monthly?.payments?.length ?? 0}</div>
        </div>
      </div>

      {editingId ? (
        <div style={{ marginTop: 12, padding: 10, border: "1px solid #e6e6e6" }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Edit payment</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ fontSize: 12, opacity: 0.8 }}>Amount</label>
            <input
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              placeholder="e.g. 1500"
              style={{ width: 140 }}
            />
            <label style={{ fontSize: 12, opacity: 0.8 }}>Status</label>
            <input
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
              placeholder="e.g. paid"
              style={{ width: 160 }}
            />
            <button onClick={() => void saveEdit()} disabled={busy} style={{ padding: "6px 10px" }}>
              Save
            </button>
            <button onClick={cancelEdit} disabled={busy} style={{ padding: "6px 10px" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>All payments</div>

        {busy && !payments.length ? (
          <div style={{ opacity: 0.8 }}>Loading...</div>
        ) : payments.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, opacity: 0.75 }}>
                  <th style={{ padding: "8px 6px", borderBottom: "1px solid #eee" }}>Date</th>
                  <th style={{ padding: "8px 6px", borderBottom: "1px solid #eee" }}>Amount</th>
                  <th style={{ padding: "8px 6px", borderBottom: "1px solid #eee" }}>Status</th>
                  <th style={{ padding: "8px 6px", borderBottom: "1px solid #eee" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={String(p.id ?? p.paymentId ?? Math.random())} style={{ fontSize: 13 }}>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f3f3" }}>
                      {formatDate(p.paidAt ?? p.date ?? null)}
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f3f3" }}>
                      {formatMoney(p.amount ?? p.total ?? 0)}
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f3f3" }}>
                      {String(p.status ?? "--")}
                    </td>
                    <td style={{ padding: "8px 6px", borderBottom: "1px solid #f3f3f3" }}>
                      <button onClick={() => beginEdit(p)} disabled={busy} style={{ padding: "4px 8px" }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ opacity: 0.8 }}>No payments yet.</div>
        )}
      </div>
    </div>
  );
}

// Default export (preferred import style)
export { TenantPaymentsPanel };
export default TenantPaymentsPanel;
