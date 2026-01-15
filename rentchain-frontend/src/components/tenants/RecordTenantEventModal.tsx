import React, { useMemo, useState } from "react";
import { colors, radius, text, shadows, spacing } from "../../styles/tokens";
import { useToast } from "../ui/ToastProvider";
import {
  createTenantEvent,
  TenantEventType,
} from "../../api/tenantEventsWriteApi";

type Props = {
  open: boolean;
  tenantId: string;
  tenantName?: string;
  onClose: () => void;
  onCreated?: () => void;
};

const TYPES: { type: TenantEventType; label: string; hint: string }[] = [
  { type: "PAYMENT_RECORDED", label: "Payment recorded", hint: "Payment received" },
  { type: "CHARGE_ADDED", label: "Charge added", hint: "Rent or fee added" },
  { type: "ADJUSTMENT_RECORDED", label: "Adjustment recorded", hint: "Credit or adjustment" },
  { type: "NOTICE_SERVED", label: "Notice served", hint: "Formal notice delivered" },
  { type: "LEASE_STARTED", label: "Lease started", hint: "Start of tenancy" },
];

const isoToday = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const RecordTenantEventModal: React.FC<Props> = ({
  open,
  tenantId,
  tenantName,
  onClose,
  onCreated,
}) => {
  const { showToast } = useToast();
  const [type, setType] = useState<TenantEventType>("PAYMENT_RECORDED");
  const [dateStr, setDateStr] = useState(isoToday());
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("CAD");
  const [daysLate, setDaysLate] = useState("");
  const [noticeType, setNoticeType] = useState("");
  const [purpose, setPurpose] = useState("RENT");
  const [purposeLabel, setPurposeLabel] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const typeMeta = useMemo(() => TYPES.find((t) => t.type === type), [type]);

  if (!open) return null;

  React.useEffect(() => {
    if (open) {
      setCreatedId(null);
      setConfirm(false);
    }
  }, [open, tenantId]);

  const financeTypes: TenantEventType[] = ["PAYMENT_RECORDED", "CHARGE_ADDED", "ADJUSTMENT_RECORDED"];
  const showAmount = financeTypes.includes(type);
  const showDaysLate = false;
  const showNotice = type === "NOTICE_SERVED";

  const parseAmountCents = () => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.round(n * 100);
  };

  const parseDaysLate = () => {
    const n = Number(daysLate);
    if (!Number.isFinite(n) || n < 0) return undefined;
    return Math.max(0, Math.min(Math.trunc(n), 365));
  };

  const occurredAtISO = () => {
    const d = new Date(`${dateStr}T12:00:00`);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  };

  const submit = async () => {
    if (!tenantId) {
      showToast({
        message: "Select a tenant first.",
        description: "Choose a tenant before recording an event.",
        variant: "error",
      });
      return;
    }
    if (!confirm) {
      showToast({
        message: "Confirm required",
        description: "Please confirm this event is permanent before saving.",
        variant: "warning",
      });
      return;
    }

    if (!type) {
      showToast({
        message: "Event type required",
        description: "Select an event type before saving.",
        variant: "error",
      });
      return;
    }

    if (financeTypes.includes(type)) {
      if (!purpose) {
        showToast({
          message: "Purpose required",
          description: "Select a purpose for this finance event.",
          variant: "error",
        });
        return;
      }
      if (!parseAmountCents()) {
        showToast({
          message: "Amount required",
          description: "Enter an amount for this finance event.",
          variant: "error",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const title =
        type === "PAYMENT_RECORDED"
          ? "Payment recorded"
          : type === "CHARGE_ADDED"
          ? "Charge added"
          : type === "ADJUSTMENT_RECORDED"
          ? "Adjustment recorded"
          : typeMeta?.label || "Tenant event";
      const payload: any = {
        tenantId,
        type,
        title,
        occurredAt: occurredAtISO(),
          description: description.trim() ? description.trim() : undefined,
        purpose,
        purposeLabel: purposeLabel.trim() ? purposeLabel.trim() : undefined,
      };

      if (showAmount) {
        payload.amountCents = parseAmountCents();
        payload.currency = currency?.trim() ? currency.trim().toUpperCase() : "CAD";
        payload.purpose = purpose;
        payload.purposeLabel = purposeLabel.trim() ? purposeLabel.trim() : undefined;
      }
      if (showDaysLate) payload.daysLate = parseDaysLate();
      if (showNotice) payload.noticeType = noticeType.trim() ? noticeType.trim() : undefined;

      const res: any = await createTenantEvent(payload);
      const eventId = res?.eventId || res?.id || null;
      setCreatedId(eventId);

      showToast({
        message: "Event recorded",
        description: tenantName
          ? `Added to ${tenantName}'s timeline.`
          : "Added to tenant timeline.",
        variant: "success",
      });

      onCreated?.();
    } catch (err: any) {
      const msg = String(err?.message || "");
      showToast({
        message: "Failed to record event",
        description: msg.includes("403")
          ? "You don't have permission to do that."
          : "Please try again.",
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.lg,
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 96vw)",
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          boxShadow: shadows.lg,
          padding: spacing.lg,
          color: text.primary,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Record tenant event</div>
            <div style={{ fontSize: 12, color: text.muted }}>
              This becomes part of the tenant's permanent rental history.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: radius.pill,
              border: `1px solid ${colors.border}`,
              background: colors.panel,
              color: text.primary,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <div style={{ marginTop: spacing.md, display: "grid", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: text.muted }}>Event type</div>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value as TenantEventType);
                setConfirm(false);
              }}
              style={{
                padding: "8px 10px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
              }}
            >
              {TYPES.map((t) => (
                <option key={t.type} value={t.type}>
                  {t.label}
                </option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: text.muted }}>{typeMeta?.hint}</div>
        </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: text.muted }}>Purpose</div>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
              }}
            >
              <option value="RENT">Rent</option>
              <option value="PARKING">Parking</option>
              <option value="SECURITY_DEPOSIT">Security deposit</option>
              <option value="DAMAGE">Damage</option>
              <option value="LATE_FEE">Late fee</option>
              <option value="UTILITIES">Utilities</option>
              <option value="OTHER">Other</option>
            </select>
            <input
              placeholder="Purpose details (e.g., Jan 2026, Spot #12)"
              value={purposeLabel}
              onChange={(e) => setPurposeLabel(e.target.value)}
              style={{
                marginTop: 6,
                padding: "8px 10px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
              }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: text.muted }}>Date</div>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => {
                setDateStr(e.target.value);
                setConfirm(false);
              }}
              style={{
                padding: "8px 10px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
              }}
            />
          </label>

          {showAmount ? (
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: text.muted }}>Amount</div>
                <input
                  inputMode="decimal"
                  placeholder="e.g. 1800"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setConfirm(false);
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    background: colors.panel,
                    color: text.primary,
                  }}
                />
              </label>
              <label style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 12, color: text.muted }}>Currency</div>
                <input
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value);
                    setConfirm(false);
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    background: colors.panel,
                    color: text.primary,
                  }}
                />
              </label>
            </div>
          ) : null}

          {showDaysLate ? (
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: text.muted }}>Days late</div>
              <input
                inputMode="numeric"
                placeholder="e.g. 5"
                value={daysLate}
                onChange={(e) => {
                  setDaysLate(e.target.value);
                  setConfirm(false);
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.panel,
                  color: text.primary,
                }}
              />
            </label>
          ) : null}

          {showNotice ? (
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, color: text.muted }}>Notice type (optional)</div>
              <input
                placeholder="e.g. Late rent notice"
                value={noticeType}
                onChange={(e) => {
                  setNoticeType(e.target.value);
                  setConfirm(false);
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: radius.md,
                  border: `1px solid ${colors.border}`,
                  background: colors.panel,
                  color: text.primary,
                }}
              />
            </label>
          ) : null}

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: text.muted }}>Notes (optional)</div>
            <textarea
              placeholder="Add context (optional)"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setConfirm(false);
              }}
              rows={4}
              style={{
                padding: "10px",
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                color: text.primary,
                resize: "vertical",
              }}
            />
          </label>

          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: 12,
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.panel,
            }}
          >
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>I understand this is permanent</div>
              <div style={{ fontSize: 12, color: text.muted }}>
                This event will appear in the tenant's rental history and cannot be edited or deleted.
              </div>
            </div>
          </label>

          {createdId ? (
            <div
              style={{
                padding: spacing.sm,
                borderRadius: radius.md,
                border: `1px solid ${colors.border}`,
                background: colors.panel,
                display: "flex",
                alignItems: "center",
                gap: spacing.sm,
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "grid", gap: 4 }}>
                <div style={{ fontWeight: 700 }}>Event created</div>
                <div style={{ fontSize: 12, color: text.muted }}>Event ID: {createdId}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (navigator?.clipboard?.writeText) {
                    void navigator.clipboard.writeText(createdId);
                    showToast({ message: "Copied event ID", variant: "success" });
                  }
                }}
                style={{
                  borderRadius: radius.pill,
                  border: `1px solid ${colors.border}`,
                  background: colors.card,
                  color: text.primary,
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Copy ID
              </button>
            </div>
          ) : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                borderRadius: radius.pill,
                border: `1px solid ${colors.border}`,
                background: colors.card,
                color: text.primary,
                padding: "8px 12px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              style={{
                borderRadius: radius.pill,
                border: `1px solid ${colors.border}`,
                background: colors.accent,
                color: "white",
                padding: "8px 14px",
                cursor: "pointer",
                boxShadow: shadows.sm,
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Saving…" : "Record event"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
