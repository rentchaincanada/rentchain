// @ts-nocheck
// rentchain-frontend/src/components/tenants/TenantDetailPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenantDetail } from "../../hooks/useTenantDetail";
import type {
  TenantDetailBundle,
  TenantPayment,
  TenantLedgerEntry,
} from "../../api/tenantDetail";
import { recordPayment, deletePayment } from "@/api/paymentsApi";
import { createRentCharge, recordRentChargePayment } from "@/api/rentChargesApi";
import { fetchCreditHistory, downloadCreditHistory } from "@/api/creditHistoryApi";
import {
  inviteTenantForReporting,
  queueReporting,
  getReportingStatus,
} from "@/api/reportingConsentApi";
import { downloadTenantReport, impersonateTenant } from "@/api/tenantsApi";
import { PaymentEditModal } from "../payments/PaymentEditModal";
import { useToast } from "../ui/ToastProvider";
import { TenantActivityPanel } from "./TenantActivityPanel";
import { useSubscription } from "../../context/SubscriptionContext";
import { colors, radius, spacing, text, shadows } from "../../styles/tokens";
import {
  fetchTenantLedgerSummary,
  LedgerSummary,
} from "../../api/ledgerApi";
import { fetchTenantReputationTimeline } from "../../api/reputationApi";
import type { ReputationTimelineEvent } from "../../types/models";
import { arr, num, str } from "../../utils/safe";
import type { TenantView } from "@/types/tenantView";
import { toTenantView } from "@/adapters/tenantViewAdapter";

interface TenantDetailPanelProps {
  tenantId: string | null;
}

export const TenantDetailPanel: React.FC<TenantDetailPanelProps> = ({
  tenantId,
}) => {
  const { bundle, loading, error } = useTenantDetail(tenantId ?? null);
  const vm: TenantView | null = bundle ? toTenantView(bundle) : null;

  if (!tenantId || !vm) {
    return (
      <div style={{ opacity: 0.7, fontSize: "0.9rem", color: text.muted }}>
        Select a tenant from the list to view details.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ opacity: 0.8, fontSize: "0.9rem", color: text.muted }}>
        Loading tenant details...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          fontSize: "0.85rem",
          padding: "0.75rem 1rem",
          borderRadius: radius.md,
          backgroundColor: "rgba(239,68,68,0.12)",
          border: "1px solid rgba(239,68,68,0.4)",
          color: text.primary,
        }}
      >
        Failed to load tenant details: {error}
      </div>
    );
  }

  if (!bundle || !bundle.tenant) {
    return (
      <div style={{ opacity: 0.7, fontSize: "0.9rem", color: text.muted }}>
        No detail data found for this tenant.
      </div>
    );
  }

  return <TenantDetailLayout bundle={vm} tenantId={tenantId} />;
};

// --- Presentational layout below ---

interface LayoutProps {
  bundle: TenantView;
  tenantId: string;
}

const riskColorMap: Record<string, string> = {
  Low: "rgba(34,197,94,0.12)",
  Medium: "rgba(234,179,8,0.14)",
  High: "rgba(239,68,68,0.14)",
};

const riskBorderMap: Record<string, string> = {
  Low: "1px solid rgba(34,197,94,0.5)",
  Medium: "1px solid rgba(234,179,8,0.55)",
  High: "1px solid rgba(239,68,68,0.55)",
};

const TenantDetailLayout: React.FC<LayoutProps> = ({ bundle, tenantId }) => {
  const navigate = useNavigate();
  const {
    lease,
    payments: bundlePayments = [],
    balance,
    ledgerSummary,
  } = bundle;
  const tenant = bundle as any;
  const insights: any[] = [];
  const { features } = useSubscription();
  const canUseTenantAi = features.hasTenantAI;

  if (!tenant) return null;

  // 🟦 Local state for payments so edits & manual adds update immediately
  const [payments, setPayments] = useState<TenantPayment[]>(arr(bundlePayments) as TenantPayment[]);
  const [editingPayment, setEditingPayment] = useState<TenantPayment | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [ledgerEntries, setLedgerEntries] =
    useState<TenantLedgerEntry[]>([]);
  const [ledgerSummaryState, setLedgerSummaryState] = useState<LedgerSummary | null>(
    ledgerSummary
      ? {
          tenantId: tenantId,
          balance: ledgerSummary.lastPaymentAmount ?? 0,
          lastPaymentAt: ledgerSummary.lastPaymentDate ?? null,
          ledgerEventCount: ledgerSummary.ledgerEventCount ?? 0,
        }
      : null
  );
  const [pendingDelete, setPendingDelete] = useState<{
    payment: TenantPayment;
    ledgerIds: string[];
    timeoutId: number;
  } | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<ReputationTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const { showToast } = useToast();
  const [creditHistory, setCreditHistory] = useState<any | null>(null);
  const [creditError, setCreditError] = useState<string | null>(null);
  const [reportingStatus, setReportingStatus] = useState<any | null>(null);

  useEffect(() => {
    setPayments(arr(bundlePayments));
  }, [bundlePayments]);

  useEffect(() => {
    let cancelled = false;
    if (!tenantId) return;
    setTimelineLoading(true);
    setTimelineError(null);
    fetchTenantReputationTimeline(tenantId)
      .then((events) => {
        if (!cancelled) {
          setTimelineEvents(arr(events));
        }
      })
      .catch((err) => {
        if (!cancelled) {
        setTimelineError(
          err instanceof Error ? err.message : "Failed to load timeline"
        );
          setTimelineEvents([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTimelineLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  useEffect(() => {
    let cancelled = false;
    if (!tenantId) return;
    fetchTenantLedgerSummary(tenantId)
      .then((summary) => {
        if (!cancelled) {
          setLedgerSummary(summary);
        }
      })
      .catch(() => {
        // keep existing summary
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const refreshTenantLedger = async (id: string) => {
    const API_BASE_URL =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
    const res = await fetch(
      `${API_BASE_URL}/api/tenants/${encodeURIComponent(id)}/ledger`
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(
        `Failed to refresh ledger: ${text || res.status.toString()}`
      );
    }
    const data = (await res.json()) as TenantLedgerEntry[];
    setLedgerEntries(Array.isArray(data) ? data : []);
  };

  const displayName =
    tenant.fullName || tenant.name || tenant.legalName || "Tenant";

  const safeLedgerEntries = Array.isArray(ledgerEntries) ? ledgerEntries : [];

  const ledgerWithBalance = useMemo(() => {
    if (!safeLedgerEntries || safeLedgerEntries.length === 0) return [];
    if (safeLedgerEntries.every((e) => typeof e.runningBalance === "number")) {
      return safeLedgerEntries;
    }

    const sortedAsc = [...safeLedgerEntries].sort((a, b) =>
      a.date > b.date ? 1 : a.date < b.date ? -1 : 0
    );

    let balance = 0;

    const withBal = sortedAsc.map((entry) => {
      const delta =
        entry.direction === "debit" ? -entry.amount : entry.amount;

      balance += delta;

      return {
        ...entry,
        runningBalance: balance,
      };
    });

    return withBal.reverse();
  }, [safeLedgerEntries]);

  const ledgerSummaryComputed = useMemo(() => {
    const base = ledgerSummaryState ?? {
      tenantId,
      balance: balance?.current ?? 0,
      lastPaymentAt: ledgerSummary?.lastPaymentDate ?? null,
      ledgerEventCount: ledgerSummary?.ledgerEventCount ?? 0,
    };

    if (!safeLedgerEntries || safeLedgerEntries.length === 0) {
      return base;
    }

    const currentBalance =
      ledgerWithBalance.length > 0 ? ledgerWithBalance[0].runningBalance : base.balance ?? 0;

    const lastPayment = ledgerWithBalance.find((e) => e.type === "payment");

    return {
      ...base,
      balance: currentBalance,
      lastPaymentAt: lastPayment ? lastPayment.date : base.lastPaymentAt,
      ledgerEventCount: safeLedgerEntries.length,
    };
  }, [safeLedgerEntries, ledgerWithBalance, ledgerSummary, ledgerSummaryState, tenantId, balance]);

  const riskLevel = tenant.riskLevel || "Unknown";
  const riskBg = riskColorMap[riskLevel] || "rgba(148,163,184,0.18)";
  const riskBorder =
    riskBorderMap[riskLevel] || "1px solid rgba(148,163,184,0.6)";

  const monthlyRent = tenant.monthlyRent || lease?.monthlyRent || undefined;

  const handleViewInLedger = () => {
    navigate(`/ledger?tenantId=${encodeURIComponent(tenantId)}`);
  };

  const handleMarkCollected = async () => {
    if (!monthlyRent) {
      showToast({
        title: "Monthly rent missing",
        description: "Add a monthly rent amount before recording a payment.",
        variant: "warning",
      });
      return;
    }

    try {
      const payment = await recordPayment({
        tenantId,
        amount: monthlyRent,
        paidAt: new Date().toISOString(),
        method: "manual",
        notes: "Quick collected",
      });
      setPayments((prev) => [payment as any, ...prev]);
      await refreshTenantLedger(tenantId);
      showToast({
        title: "Payment recorded",
        description: `Marked $${monthlyRent.toLocaleString()} as collected.`,
        variant: "success",
      });
    } catch (err: any) {
      showToast({
        title: "Failed to record payment",
        description: err?.message || "Could not mark as collected.",
        variant: "error",
      });
    }
  };

  const handleDownloadReport = async () => {
    if (!tenant?.id) return;
    try {
      await downloadTenantReport(tenant.id);
      showToast({
        title: "Report downloaded",
        description: "Tenant payment history report has been saved as a PDF.",
        variant: "success",
      });
    } catch (err) {
      console.error("[TenantDetailPanel] Failed to download report", err);
      showToast({
        title: "Failed to download report",
        description:
          "An error occurred while generating the tenant report. Please try again.",
        variant: "error",
      });
    }
  };

  type TenantInsightSeverity = "good" | "medium" | "risk";
  type TenantInsight = {
    id: string;
    title: string;
    detail?: string;
    severity: TenantInsightSeverity;
  };

  const tenantInsights = useMemo<TenantInsight[]>(() => {
    const insights: TenantInsight[] = [];

    if (!payments || payments.length === 0) {
      insights.push({
        id: "no-payments",
        title: "No payment history yet",
        detail:
          "There are no recorded payments for this tenant. Risk can’t be evaluated from behavior alone.",
        severity: "medium",
      });
      return insights;
    }

    const parseDate = (value: string | Date | undefined | null): Date | null => {
      if (!value) return null;
      if (value instanceof Date) return value;
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    };

    type PaymentForStats = {
      dueDate: Date | null;
      paidAt: Date | null;
      amount: number;
    };

    const paymentsForStats: PaymentForStats[] = payments.map((p) => ({
      dueDate: parseDate((p as any).dueDate),
      paidAt: parseDate((p as any).paidAt ?? (p as any).date),
      amount: typeof (p as any).amount === "number" ? (p as any).amount : 0,
    }));

    const withDueAndPaid = paymentsForStats.filter((p) => p.dueDate && p.paidAt);

    let onTimeCount = 0;
    let lateCount = 0;
    let totalLateDays = 0;

    const now = new Date();
    const ninetyDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 90
    );

    let paymentsLast90 = 0;
    let latestPaidAt: Date | null = null;

    withDueAndPaid.forEach((p) => {
      if (!p.dueDate || !p.paidAt) return;

      const diffMs = p.paidAt.getTime() - p.dueDate.getTime();
      const daysLate = Math.round(diffMs / (1000 * 60 * 60 * 24));

      if (daysLate <= 0) {
        onTimeCount += 1;
      } else {
        lateCount += 1;
        totalLateDays += daysLate;
      }

      if (p.paidAt >= ninetyDaysAgo) {
        paymentsLast90 += 1;
      }

      if (!latestPaidAt || p.paidAt > latestPaidAt) {
        latestPaidAt = p.paidAt;
      }
    });

    const totalCount = onTimeCount + lateCount;
    const onTimeRate = totalCount > 0 ? onTimeCount / totalCount : null;
    const avgLateDays = lateCount > 0 ? totalLateDays / lateCount : null;

    if (onTimeRate == null) {
      insights.push({
        id: "behavior-unknown",
        title: "Payment behavior unknown",
        detail:
          "Payments don’t have enough due/paid date data to calculate on-time performance.",
        severity: "medium",
      });
    } else if (onTimeRate >= 0.9) {
      insights.push({
        id: "behavior-strong",
        title: "Consistently on-time payer",
        detail: `About ${(onTimeRate * 100).toFixed(
          0
        )}% of tracked payments are on time or early.`,
        severity: "good",
      });
    } else if (onTimeRate >= 0.7) {
      insights.push({
        id: "behavior-mixed",
        title: "Mixed payment behavior",
        detail: `On-time rate is around ${(onTimeRate * 100).toFixed(
          0
        )}%. There are some late payments worth watching.`,
        severity: "medium",
      });
    } else {
      insights.push({
        id: "behavior-concerning",
        title: "Concerning payment behavior",
        detail: `On-time rate is below ${(onTimeRate * 100).toFixed(
          0
        )}%. Consider closer monitoring or tighter follow-up.`,
        severity: "risk",
      });
    }

    if (avgLateDays != null) {
      if (avgLateDays <= 2) {
        insights.push({
          id: "lateness-minor",
          title: "Lateness is usually minor",
          detail: `When late, payments average about ${avgLateDays.toFixed(
            1
          )} days past due.`,
          severity: "medium",
        });
      } else {
        insights.push({
          id: "lateness-significant",
          title: "Lateness tends to be significant",
          detail: `Late payments average around ${avgLateDays.toFixed(
            1
          )} days past due. This may indicate cash-flow challenges.`,
          severity: "risk",
        });
      }
    }

    if (paymentsLast90 === 0) {
      insights.push({
        id: "recent-activity-none",
        title: "No recent payments on record",
        detail:
          "There are no recorded payments in the last 90 days. Confirm if the tenancy is current or if data is incomplete.",
        severity: "risk",
      });
    } else {
      insights.push({
        id: "recent-activity",
        title: "Recent payments recorded",
        detail: `There ${
          paymentsLast90 === 1 ? "is" : "are"
        } ${paymentsLast90} recorded payment${
          paymentsLast90 === 1 ? "" : "s"
        } in the last 90 days.`,
        severity: paymentsLast90 >= 3 ? "good" : "medium",
      });
    }

    let hasLateFee = false;
    let hasNsf = false;

    if (ledgerEntries && ledgerEntries.length > 0) {
      for (const entry of ledgerEntries) {
        const type = (entry as any).type || "";
        const label = ((entry as any).label || "").toString().toLowerCase();

        if (
          type === "fee" ||
          label.includes("late fee") ||
          label.includes("late charge")
        ) {
          hasLateFee = true;
        }

        if (
          label.includes("nsf") ||
          label.includes("non-sufficient") ||
          label.includes("returned payment")
        ) {
          hasNsf = true;
        }
      }
    }

    if (hasLateFee) {
      insights.push({
        id: "ledger-late-fees",
        title: "Late fees on record",
        detail:
          "Ledger entries show one or more late fees. This suggests repeated late or missed payments.",
        severity: "risk",
      });
    }

    if (hasNsf) {
      insights.push({
        id: "ledger-nsf",
        title: "Returned/NSF payments on record",
        detail:
          "The ledger suggests one or more returned or NSF payments. This can indicate higher risk and may warrant closer monitoring.",
        severity: "risk",
      });
    }

    if (withDueAndPaid.length > 0) {
      const latest = latestPaidAt;
      if (latest) {
        const diffDays = Math.round(
          (new Date().getTime() - latest.getTime()) / (1000 * 60 * 60 * 24)
        );

        const label =
          diffDays === 0
            ? "today"
            : diffDays === 1
            ? "yesterday"
            : `${diffDays} days ago`;

        insights.push({
          id: "latest-payment",
          title: "Most recent payment",
          detail: `The most recent payment was recorded ${label}.`,
          severity: diffDays <= 35 ? "good" : "medium",
        });
      }
    }

    return insights;
  }, [payments, ledgerEntries]);

  // 🟦 Record a brand new manual payment
  const handleRecordManualPayment = async () => {
    try {
      const defaultAmount =
        monthlyRent != null ? String(monthlyRent) : "";

      const amountStr = window.prompt(
        "Enter payment amount:",
        defaultAmount
      );
      if (amountStr === null) return;

      const amountNum = Number(amountStr);
      if (Number.isNaN(amountNum) || amountNum <= 0) {
        showToast({
          message: "Invalid amount",
          description: "Please enter a valid positive number.",
          variant: "warning",
        });
        return;
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      const paidAtStr = window.prompt(
        "Enter paid date (YYYY-MM-DD):",
        todayStr
      );
      if (paidAtStr === null) return;

      const methodStr = window.prompt(
        "Enter method (e.g. e-transfer, cash):",
        "e-transfer"
      );
      if (methodStr === null) return;

      const notesStr = window.prompt(
        "Enter notes (optional):",
        ""
      );
      if (notesStr === null) return;

      const payload = {
        tenantId: tenant.id || tenantId,
        propertyId: tenant.propertyId ?? lease?.propertyId ?? undefined,
        monthlyRent: monthlyRent,
        amount: amountNum,
        dueDate: paidAtStr,
        paidAt: paidAtStr,
        method: methodStr.trim() || "unspecified",
        notes: notesStr.trim() || undefined,
      };

      const created: any = await recordPayment(payload);

      const createdPayment: TenantPayment = {
        id: created.id,
        tenantId: created.tenantId ?? tenant.id ?? tenantId,
        amount: created.amount,
        paidAt: created.paidAt,
        method: created.method,
        notes: created.notes,
      };

      setPayments((prev) => [createdPayment, ...prev]);
      showToast({
        message: "Payment recorded",
        description: "Manual payment added to this tenant.",
        variant: "success",
      });
    } catch (err) {
      console.error("[TenantDetailPanel] Failed to record payment:", err);
      showToast({
        message: "Failed to record payment",
        description:
          err instanceof Error ? err.message : "Please try again shortly.",
        variant: "error",
      });
    }
  };

  const handleImpersonateTenant = async () => {
    if (!tenantId) return;
    try {
      const resp = await impersonateTenant(tenantId);
      const url = `/tenant/dashboard?impersonationToken=${encodeURIComponent(resp.token)}`;
      window.open(url, "_blank", "noopener");
      showToast({
        title: "Impersonation token issued",
        description: "Opened tenant portal in a new tab.",
        variant: "success",
      });
    } catch (err: any) {
      showToast({
        title: "Failed to impersonate tenant",
        description: err?.message || "Could not open tenant portal as this tenant.",
        variant: "error",
      });
    }
  };

  const handleIssueRentCharge = async () => {
    if (!tenantId) return;
    const defaultAmount = monthlyRent != null ? String(monthlyRent) : "";
    const amountStr = window.prompt("Charge amount", defaultAmount);
    if (amountStr === null) return;
    const amountNum = Number(amountStr);
    if (!amountNum || Number.isNaN(amountNum) || amountNum <= 0) {
      showToast({ message: "Invalid amount", description: "Enter a positive number.", variant: "warning" });
      return;
    }
    const due = window.prompt("Due date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (due === null) return;
    const period = window.prompt("Period (e.g., 2026-01)", due?.slice(0, 7));
    const confirm = window.confirm(
      "Issue this rent charge? This will appear in the tenant portal."
    );
    if (!confirm) return;
    try {
      await createRentCharge({
        tenantId,
        leaseId: lease?.leaseId || lease?.tenantId || tenantId,
        amount: amountNum,
        dueDate: due,
        period: period || undefined,
        propertyId: lease?.propertyId as any,
        unitId: (lease as any)?.unitId,
      });
      showToast({
        message: "Rent charge issued",
        description: "Charge visible in tenant portal.",
        variant: "success",
      });
    } catch (err: any) {
      showToast({
        message: "Failed to issue charge",
        description: err?.message || "Please try again.",
        variant: "error",
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!tenantId) return;
    fetchCreditHistory(tenantId)
      .then((data) => {
        if (!cancelled) setCreditHistory(data);
      })
      .catch((err) => {
        if (!cancelled) setCreditError(err?.message || "Failed to load credit history");
      });
    getReportingStatus(tenantId)
      .then((data) => {
        if (!cancelled) setReportingStatus(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const handleRecordChargePayment = async () => {
    if (!tenantId) return;
    const chargeId = window.prompt("Rent charge ID to credit");
    if (!chargeId) return;
    const amountStr = window.prompt("Payment amount", monthlyRent ? String(monthlyRent) : "0");
    if (amountStr === null) return;
    const amountNum = Number(amountStr);
    if (!amountNum || Number.isNaN(amountNum) || amountNum <= 0) {
      showToast({ message: "Invalid amount", description: "Enter a positive number.", variant: "warning" });
      return;
    }
    const paidDate = window.prompt("Paid date (YYYY-MM-DD)", new Date().toISOString().slice(0, 10));
    if (paidDate === null) return;
    const method = window.prompt("Method (cash, etransfer, cheque, other)", "etransfer") || "other";
    const confirm = window.confirm("Record this payment against the rent charge?");
    if (!confirm) return;
    try {
      await recordRentChargePayment(chargeId, { amount: amountNum, paidAt: paidDate, method });
      showToast({
        message: "Payment recorded",
        description: "Charge updated and ledger recorded.",
        variant: "success",
      });
    } catch (err: any) {
      showToast({
        message: "Failed to record payment",
        description: err?.message || "Please try again.",
        variant: "error",
      });
    }
  };

  const handleRequestDeletePayment = (payment: TenantPayment) => {
    if (!tenant) return;

    const relatedLedgerIds =
      ledgerEntries
        ?.filter((e) => e.id === `payment-${payment.id}`)
        .map((e) => e.id) ?? [];

    // Optimistically remove payment + ledger entries
    setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    setLedgerEntries((prev) =>
      prev.filter((e) => !relatedLedgerIds.includes(e.id))
    );

    // Clear any previous pending delete timer
    if (pendingDelete?.timeoutId) {
      window.clearTimeout(pendingDelete.timeoutId);
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        await deletePayment(tenant.id, payment.id);
        await refreshTenantLedger(tenant.id);
      } catch (err) {
        console.error("[TenantDetailPanel] Failed to delete payment", err);
        showToast({
          message: "Failed to delete payment",
          description:
            "The payment could not be deleted. Please try again or check the connection.",
          variant: "error",
        });
      } finally {
        setPendingDelete(null);
      }
    }, 5000);

    setPendingDelete({
      payment,
      ledgerIds: relatedLedgerIds,
      timeoutId,
    });

    showToast({
      message: "Payment deleted",
      description: "This payment was removed. You can undo for a moment.",
      variant: "warning",
      actionLabel: "Undo",
      onAction: () => handleUndoDelete(),
    });
  };

  const handleUndoDelete = () => {
    if (!pendingDelete || !tenant) return;

    window.clearTimeout(pendingDelete.timeoutId);

    const restoredPayment = pendingDelete.payment;
    setPendingDelete(null);

    setPayments((prev) => {
      const exists = prev.some((p) => p.id === restoredPayment.id);
      return exists ? prev : [...prev, restoredPayment];
    });

    refreshTenantLedger(tenant.id).catch((err) => {
      console.error(
        "[TenantDetailPanel] Failed to refresh ledger after undo",
        err
      );
    });

    showToast({
      message: "Payment restored",
      description: "The deleted payment has been reinstated.",
      variant: "success",
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing.md,
        background: colors.card,
        borderRadius: radius.lg,
        padding: spacing.lg,
        border: `1px solid ${colors.border}`,
        boxShadow: shadows.soft,
        color: text.primary,
      }}
    >
      {/* Top: Name + risk chip */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "0.75rem",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              marginBottom: spacing.xs,
              color: text.primary,
            }}
          >
            {displayName}
          </h2>
          <div
            style={{
              fontSize: "0.9rem",
              color: text.muted,
            }}
          >
            {tenant.propertyName} &middot; Unit {tenant.unit}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: spacing.xs,
          }}
        >
          <div
            style={{
              padding: "0.25rem 0.6rem",
              borderRadius: "999px",
              fontSize: "0.75rem",
              fontWeight: 600,
              backgroundColor: riskBg,
              border: riskBorder,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Risk: {riskLevel}
          </div>
          <button
            type="button"
            onClick={handleDownloadReport}
            style={{
              borderRadius: radius.pill,
              border: `1px solid ${colors.border}`,
              padding: "6px 10px",
              background: colors.panel,
              color: text.primary,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              boxShadow: shadows.sm,
            }}
          >
            <span>📄</span>
            <span>Download report (PDF)</span>
          </button>
        </div>
      </div>

      {/* Contact + basics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: `${spacing.xs} ${spacing.lg}`,
          fontSize: "0.85rem",
        }}
      >
        <DetailField label="Email" value={tenant.email ?? "—"} />
        <DetailField label="Phone" value={tenant.phone ?? "—"} />
        <DetailField
          label="Lease Start"
          value={tenant.leaseStart ?? lease?.leaseStart ?? "—"}
        />
        <DetailField
          label="Lease End"
          value={tenant.leaseEnd ?? lease?.leaseEnd ?? "—"}
        />
        <DetailField
          label="Monthly Rent"
          value={
            monthlyRent
              ? `$${Number(monthlyRent).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`
              : "—"
          }
        />
        <DetailField
          label="Current Balance"
          value={
            tenant.balance
              ? `$${Number(tenant.balance).toLocaleString()}`
              : "$0"
          }
        />
        <DetailField label="Status" value={tenant.status ?? "—"} />
      </div>

      {/* Tenant balance summary strip */}
      <div
        style={{
          marginBottom: spacing.md,
          padding: "12px 14px",
          borderRadius: radius.md,
          background: colors.panel,
          border: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 0.08,
              color: text.muted,
            }}
          >
            Current Balance
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color:
                ledgerSummaryComputed.balance > 0
                  ? "#f97316"
                  : ledgerSummaryComputed.balance < 0
                  ? "#22c55e"
                  : text.primary,
            }}
          >
            {ledgerSummaryComputed.balance >= 0 ? "$" : "-$"}
            {Math.abs(ledgerSummaryComputed.balance).toLocaleString(
              undefined,
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 11, color: text.muted }}>Last payment</div>
          <div style={{ fontSize: 13, color: text.primary }}>
            {ledgerSummaryComputed.lastPaymentAt ? (
              <>
                {new Date(ledgerSummaryComputed.lastPaymentAt).toLocaleDateString()}
              </>
            ) : (
              <span style={{ color: text.subtle }}>No payments yet</span>
            )}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: text.muted }}>Next rent due</div>
          <div style={{ fontSize: 13, color: text.primary }}>
            {(() => {
              const now = new Date();
              const year =
                now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
              const month = (now.getMonth() + 1) % 12;
              const d = new Date(year, month, 1);
              return d.toLocaleDateString();
            })()}
          </div>
        </div>
      </div>

      {/* Lease block if present */}
      {lease && (
        <div
          style={{
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.panel,
            border: `1px solid ${colors.border}`,
            fontSize: "0.85rem",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              fontSize: "0.85rem",
              marginBottom: spacing.xs,
              color: text.primary,
            }}
          >
            Lease Summary
          </div>
          <div style={{ color: text.primary }}>
            <div style={{ marginBottom: 4 }}>
              Property: <strong>{lease.propertyName}</strong>
            </div>
            <div style={{ marginBottom: 4 }}>Unit: {lease.unit}</div>
            <div style={{ marginBottom: 4 }}>
              Term: {lease.leaseStart} → {lease.leaseEnd}
            </div>
            <div>
              Monthly Rent:{" "}
              <strong>
                $
                {Number(lease.monthlyRent).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Recent payments with Edit + Record Manual */}
      <div
        style={{
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: colors.panel,
          border: `1px solid ${colors.border}`,
          fontSize: "0.85rem",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: "0.85rem",
            marginBottom: spacing.xs,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span>Recent Payments</span>
          <button
            type="button"
            onClick={handleRecordManualPayment}
            style={{
              fontSize: "0.75rem",
              padding: "0.25rem 0.7rem",
              borderRadius: radius.pill,
              border: `1px solid ${colors.border}`,
              background: colors.card,
              color: text.primary,
              cursor: "pointer",
              whiteSpace: "nowrap",
              boxShadow: shadows.sm,
            }}
          >
            + Record manual payment
          </button>
        </div>

        <div
            style={{
              fontSize: "0.75rem",
              opacity: 0.8,
              marginBottom: spacing.xs,
            }}
          >
            {payments.length === 0
              ? "No payments recorded yet for this tenant. Use the button above to add the first payment."
              : "Click ✏️ to modify an existing payment."}
        </div>

        {payments.length === 0 ? (
          <div
            style={{
              fontSize: "0.8rem",
              opacity: 0.8,
              fontStyle: "italic",
              color: text.subtle,
            }}
          >
            Once you record a payment, it will appear here with amount, date,
            method, and notes.
          </div>
        ) : (
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              maxHeight: "140px",
              overflowY: "auto",
            }}
          >
            {payments.slice(0, 6).map((p: TenantPayment, idx) => (
              <li
                key={p.id ?? idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto auto",
                  gap: "0.5rem",
                  padding: "0.25rem 0",
                  borderBottom:
                    idx === Math.min(payments.length, 6) - 1
                      ? "none"
                      : `1px solid ${colors.border}`,
                }}
              >
                <span>
                  {p.paidAt
                    ? new Date(p.paidAt).toLocaleDateString()
                    : "Unknown date"}
                  {p.notes ? ` – ${p.notes}` : ""}
                </span>
                <span style={{ textAlign: "right" }}>
                  {p.amount
                    ? `$${Number(p.amount).toLocaleString()}`
                    : "$0"}
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    opacity: 0.75,
                    textAlign: "right",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "0.4rem",
                  }}
                >
                  <span>{p.method}</span>
                  {p.id && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPayment(p);
                          setIsEditModalOpen(true);
                        }}
                        style={{
                          fontSize: 12,
                          padding: "4px 8px",
                          borderRadius: radius.pill,
                          border: `1px solid ${colors.border}`,
                          backgroundColor: colors.card,
                          color: text.primary,
                          cursor: "pointer",
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRequestDeletePayment(p)}
                        style={{
                          fontSize: 12,
                          padding: "4px 8px",
                          borderRadius: radius.pill,
                          border: `1px solid ${colors.danger}`,
                          backgroundColor: "transparent",
                          color: colors.danger,
                          cursor: "pointer",
                          marginLeft: 6,
                        }}
                      >
                        🗑 Delete
                      </button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editingPayment && (
        <PaymentEditModal
          open={isEditModalOpen}
          tenantId={tenant.id}
          payment={editingPayment}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingPayment(null);
          }}
          onUpdated={async (updated) => {
            setPayments((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p))
            );

            if (tenant.id) {
              try {
                await refreshTenantLedger(tenant.id);
              } catch (err) {
                console.error(
                  "[TenantDetailPanel] Failed to refresh ledger after payment update",
                  err
                );
                showToast({
                  message: "Ledger refresh failed",
                  description: "Updated payment saved, but ledger refresh failed.",
                  variant: "warning",
                });
              }
            }

            showToast({
              message: "Payment updated",
              description: "The tenant payment and ledger were refreshed.",
              variant: "success",
            });

            setIsEditModalOpen(false);
            setEditingPayment(null);
          }}
        />
      )}

      {/* Ledger timeline */}
      <div
        style={{
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: colors.panel,
          border: `1px solid ${colors.border}`,
          fontSize: "0.85rem",
        }}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: "0.85rem",
            marginBottom: spacing.xs,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Ledger Timeline</span>
          <span
            style={{
              fontSize: "0.75rem",
              opacity: 0.7,
            }}
          >
            Showing latest {ledgerSummaryComputed.ledgerEventCount} event
            {ledgerSummaryComputed.ledgerEventCount === 1 ? "" : "s"}
          </span>
        </div>

        <div style={{ marginTop: 8 }}>
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 0.08,
              color: text.muted,
              marginBottom: 6,
            }}
          >
            Ledger activity
            {ledgerSummaryComputed.ledgerEventCount > 0 && (
              <span style={{ marginLeft: 6, color: text.subtle }}>
                · {ledgerSummaryComputed.ledgerEventCount} entries
              </span>
            )}
          </div>

          {ledgerWithBalance.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: text.subtle,
                padding: "8px 0",
              }}
            >
              No ledger activity yet for this tenant.
            </div>
          ) : (
            <div
              style={{
                position: "relative",
                paddingLeft: 18,
                borderLeft: `1px solid ${colors.border}`,
                marginLeft: 4,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {ledgerWithBalance.map((entry, idx) => {
                const key =
                  entry.id || `${entry.type || "entry"}-${entry.date || idx}-${idx}`;
                return (
                <div
                  key={key}
                  style={{
                    position: "relative",
                    paddingLeft: 10,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: -9,
                      top: 6,
                      width: 10,
                      height: 10,
                      borderRadius: "999px",
                      backgroundColor:
                        entry.type === "payment" ? "#22c55e" : colors.accent2,
                      boxShadow:
                        entry.type === "payment"
                          ? "0 0 0 3px rgba(34,197,94,0.25)"
                          : "0 0 0 3px rgba(34,197,94,0.15)",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "flex-start",
                      padding: "6px 10px",
                      borderRadius: radius.md,
                      backgroundColor: colors.card,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: text.muted,
                          marginBottom: 2,
                        }}
                      >
                        {entry.date}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: text.primary,
                        }}
                      >
                        {entry.label ||
                          (entry.type === "payment"
                            ? "Rent payment received"
                            : entry.type)}
                      </div>
                      {entry.notes && (
                        <div
                          style={{
                            fontSize: 12,
                            color: text.subtle,
                            marginTop: 2,
                          }}
                        >
                          {entry.notes}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", minWidth: 110 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color:
                            entry.direction === "debit" ? "#f97316" : "#22c55e",
                        }}
                      >
                        {entry.direction === "debit" ? "-" : "+"}$
                        {entry.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 11,
                          color: text.muted,
                        }}
                      >
                        Balance: $
                        {entry.runningBalance?.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );})}
            </div>
          )}
        </div>
      </div>

      {/* Tenant AI insights */}
      {canUseTenantAi ? (
        <div
          style={{
            marginTop: 12,
            borderRadius: radius.lg,
            padding: spacing.md,
            background: colors.panel,
            border: `1px solid ${colors.border}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: 0.08,
              color: text.muted,
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Tenant AI insights</span>
            <span
              style={{
                fontSize: 11,
                color: text.subtle,
              }}
            >
              Draft behavioral signals – verify before acting
            </span>
          </div>

          {tenantInsights.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: text.subtle,
              }}
            >
              Not enough information yet to generate insights.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {tenantInsights.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    fontSize: 13,
                    color: text.primary,
                  }}
                >
                  <span
                    style={{
                      marginTop: 3,
                      width: 8,
                      height: 8,
                      borderRadius: "999px",
                      display: "inline-block",
                      backgroundColor:
                        item.severity === "good"
                          ? "#22c55e"
                          : item.severity === "medium"
                          ? "#eab308"
                          : "#ef4444",
                      boxShadow:
                        item.severity === "good"
                          ? "0 0 0 3px rgba(34,197,94,0.25)"
                          : item.severity === "medium"
                          ? "0 0 0 3px rgba(234,179,8,0.25)"
                          : "0 0 0 3px rgba(239,68,68,0.25)",
                    }}
                  />
                  <div>
                      <div
                        style={{
                          fontWeight: 500,
                          color: text.primary,
                        }}
                      >
                        {item.title}
                      </div>
                      {item.detail && (
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 12,
                            color: text.subtle,
                          }}
                        >
                          {item.detail}
                        </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            borderRadius: 16,
            border: `1px solid ${colors.border}`,
            padding: spacing.md,
            backgroundColor: colors.panel,
            marginTop: 8,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: text.primary,
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            Tenant AI insights are part of Pro
          </div>
          <div
            style={{
              fontSize: 12,
              color: text.subtle,
            }}
          >
            Upgrade to <span style={{ fontWeight: 500 }}>Pro</span> or{" "}
            <span style={{ fontWeight: 500 }}>Elite</span> to see behavior-based risk
            signals, payment habit summaries, and recent red flags for this tenant.
          </div>
        </div>
      )}

      {/* Reputation timeline */}
      <div
        style={{
          borderRadius: radius.md,
          border: `1px solid ${colors.border}`,
          padding: spacing.md,
          backgroundColor: colors.panel,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.sm,
          }}
        >
          <div style={{ fontWeight: 700, color: text.primary }}>
            Reputation Timeline
          </div>
          {timelineError ? (
            <button
              type="button"
              onClick={() => {
                if (!tenantId) return;
                setTimelineLoading(true);
                setTimelineError(null);
                fetchTenantReputationTimeline(tenantId)
                  .then((events) =>
                    setTimelineEvents(Array.isArray(events) ? events : [])
                  )
                  .catch((err) =>
                    setTimelineError(
                      err instanceof Error
                        ? err.message
                        : "Failed to load timeline"
                    )
                  )
                  .finally(() => setTimelineLoading(false));
              }}
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: radius.pill,
                background: colors.card,
                color: text.primary,
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: 12,
              }}
              disabled={timelineLoading}
            >
              Retry
            </button>
          ) : null}
        </div>

        {timelineLoading ? (
          <div style={{ color: text.muted, fontSize: "0.9rem" }}>
            Loading timeline...
          </div>
        ) : timelineError ? (
          <div style={{ color: colors.danger, fontSize: "0.9rem" }}>
            {timelineError}
          </div>
        ) : timelineEvents && timelineEvents.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.sm }}>
            {timelineEvents.map((event) => {
              const badgeColors: Record<string, string> = {
                payment: colors.accentSoft,
                charge: "#ffe4e6",
                screening: "#e0f2fe",
                maintenance_reported: "#fef9c3",
                action_acknowledged: "#e2f3ec",
                action_resolved: "#ecfdf3",
              };

              const badge = (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "4px 8px",
                    borderRadius: radius.pill,
                    fontSize: 11,
                    fontWeight: 600,
                    background: badgeColors[event.type] || colors.border,
                    border: `1px solid ${colors.border}`,
                    color: text.primary,
                    textTransform: "capitalize",
                    minWidth: 0,
                  }}
                >
                  {event.type.replace("_", " ")}
                </span>
              );

              const occurred =
                event.occurredAt && !Number.isNaN(Date.parse(event.occurredAt))
                  ? new Date(event.occurredAt).toLocaleString()
                  : "—";

              return (
                <div
                  key={event.id}
                  style={{
                    display: "flex",
                    gap: spacing.sm,
                    padding: "10px 12px",
                    borderRadius: radius.md,
                    border: `1px solid ${colors.border}`,
                    background: colors.card,
                  }}
                >
                  <div style={{ minWidth: 110, color: text.subtle, fontSize: 12 }}>
                    {occurred}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: spacing.sm,
                        marginBottom: 4,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ fontWeight: 600, color: text.primary }}>
                        {event.title}
                      </div>
                      {badge}
                    </div>
                    {event.detail ? (
                      <div style={{ fontSize: 12, color: text.subtle }}>
                        {event.detail}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: text.muted, fontSize: "0.9rem" }}>
            No reputation events yet.
          </div>
        )}
      </div>

      {/* Tenant activity (audit feed) */}
      <TenantActivityPanel tenantId={tenant?.id} />

      {/* Credit Reporting Readiness */}
      <div
        style={{
          marginTop: 12,
          padding: spacing.md,
          borderRadius: radius.md,
          border: `1px solid ${colors.border}`,
          background: colors.panel,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
          <div>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.08, color: text.muted }}>
              Credit Reporting Readiness
            </div>
            <div style={{ fontWeight: 700, color: text.primary }}>Rental history export</div>
            <div style={{ fontSize: 12, color: text.subtle, marginTop: 4 }}>
              This rental history is prepared for reporting compatibility. It has not been submitted to any credit bureau.
            </div>
          </div>
          <div>
            {(() => {
              const periods = creditHistory?.periods || [];
              const noDataCount = periods.filter((p: any) => p.status === "no_data").length;
              const status =
                periods.length >= 6 && noDataCount === 0
                  ? { label: "Reportable", bg: "rgba(34,197,94,0.14)", color: "#bbf7d0" }
                  : periods.length < 3
                  ? { label: "Insufficient history", bg: "rgba(148,163,184,0.16)", color: "#cbd5e1" }
                  : { label: "Incomplete data", bg: "rgba(234,179,8,0.16)", color: "#fef08a" };
              return (
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 700,
                    background: status.bg,
                    color: status.color,
                  }}
                >
                  {status.label}
                </span>
              );
            })()}
          </div>
        </div>
        {creditError ? (
          <div style={{ color: colors.danger }}>{creditError}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            <div>
              <div style={{ color: text.muted, fontSize: 12 }}>On-time months</div>
              <div style={{ fontWeight: 700, color: text.primary }}>
                {creditHistory?.periods?.filter((p: any) => p.status === "on_time").length ?? 0}
              </div>
            </div>
            <div>
              <div style={{ color: text.muted, fontSize: 12 }}>Late (1-29 / 30-59 / 60+)</div>
              <div style={{ fontWeight: 700, color: text.primary }}>
                {(creditHistory?.periods || []).filter((p: any) => p.status === "late_1_29").length}/
                {(creditHistory?.periods || []).filter((p: any) => p.status === "late_30_59").length}/
                {(creditHistory?.periods || []).filter((p: any) => p.status === "late_60_plus").length}
              </div>
            </div>
            <div>
              <div style={{ color: text.muted, fontSize: 12 }}>Missed (unpaid)</div>
              <div style={{ fontWeight: 700, color: text.primary }}>
                {(creditHistory?.periods || []).filter((p: any) => p.status === "unpaid").length}
              </div>
            </div>
          </div>
        )}
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => tenantId && downloadCreditHistory(tenantId, "csv").catch((e) => setCreditError(e.message))}
            style={{
              padding: "8px 12px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.card,
              color: text.primary,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Download credit history (CSV)
          </button>
          <button
            type="button"
            onClick={() => tenantId && downloadCreditHistory(tenantId, "json").catch((e) => setCreditError(e.message))}
            style={{
              padding: "8px 12px",
              borderRadius: radius.md,
              border: `1px solid ${colors.border}`,
              background: colors.card,
              color: text.primary,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Download credit history (JSON)
          </button>
        </div>
      </div>

      {/* View in ledger link */}
      <div
        style={{
          marginTop: "0.5rem",
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={handleMarkCollected}
          style={{
            fontSize: "0.85rem",
            padding: "0.45rem 0.95rem",
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.card,
            color: text.primary,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: shadows.sm,
          }}
        >
          Mark as collected
        </button>
        <button
          type="button"
          onClick={handleIssueRentCharge}
          style={{
            fontSize: "0.85rem",
            padding: "0.45rem 0.95rem",
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.card,
            color: text.primary,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: shadows.sm,
          }}
        >
          Issue rent charge
        </button>
        <button
          type="button"
          onClick={handleRecordChargePayment}
          style={{
            fontSize: "0.85rem",
            padding: "0.45rem 0.95rem",
            borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: colors.card,
            color: text.primary,
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: shadows.sm,
          }}
        >
          Record charge payment
        </button>
        <button
          type="button"
          onClick={handleViewInLedger}
          style={{
            fontSize: "0.8rem",
            padding: "0.4rem 0.85rem",
            borderRadius: radius.pill,
            border: `1px solid ${colors.border}`,
            background: colors.panel,
            color: text.primary,
            cursor: "pointer",
            boxShadow: shadows.sm,
          }}
        >
          View all ledger events →
        </button>
        <button
          type="button"
          onClick={handleImpersonateTenant}
          style={{
            fontSize: "0.8rem",
            padding: "0.4rem 0.85rem",
            borderRadius: radius.pill,
            border: `1px solid ${colors.border}`,
            background: colors.card,
            color: text.primary,
            cursor: "pointer",
            boxShadow: shadows.sm,
          }}
        >
          View as tenant
        </button>
      </div>

      {/* If no extra data at all */}
      {!lease && payments.length === 0 && ledgerEntries.length === 0 && (
        <div
          style={{
            marginTop: "0.5rem",
            fontSize: "0.8rem",
            opacity: 0.7,
          }}
        >
          No lease, payment, or ledger detail available yet for this tenant.
        </div>
      )}
    </div>
  );
};

const DetailField: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div>
    <div style={{ color: text.muted, marginBottom: "0.1rem" }}>{label}</div>
    <div style={{ color: text.primary }}>{value}</div>
  </div>
);

// --- Smart Insights card retained for reference (unused in main flow) ---
