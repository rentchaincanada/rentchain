import { useEffect, useMemo, useState } from "react";
import { fetchBillingHistory, fetchSubscriptionStatus } from "@/api/billingApi";

type AccountSummary = {
  status: string | null;
  nextRenewalAt: string | null;
  lastInvoiceAt: string | null;
  lastInvoiceAmountCents: number | null;
  receiptsCount: number | null;
};

const toIsoOrNull = (value: unknown): string | null => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
};

export function useAccountSummary() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AccountSummary>({
    status: null,
    nextRenewalAt: null,
    lastInvoiceAt: null,
    lastInvoiceAmountCents: null,
    receiptsCount: null,
  });

  useEffect(() => {
    let active = true;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [subscription, history] = await Promise.all([
          fetchSubscriptionStatus().catch(() => null),
          fetchBillingHistory().catch(() => []),
        ]);

        if (!active) return;

        const records = Array.isArray(history) ? history : [];
        const sortedRecords = [...records].sort((a, b) => {
          const aMs = new Date(String(a?.createdAt || 0)).getTime();
          const bMs = new Date(String(b?.createdAt || 0)).getTime();
          return bMs - aMs;
        });
        const latest = sortedRecords[0];
        const renewal = toIsoOrNull(
          (subscription as any)?.renewalDate ||
            (subscription as any)?.currentPeriodEnd ||
            (subscription as any)?.nextBillingAt ||
            null
        );

        setSummary({
          status: String((subscription as any)?.status || "").trim() || null,
          nextRenewalAt: renewal,
          lastInvoiceAt: toIsoOrNull(latest?.createdAt),
          lastInvoiceAmountCents: typeof latest?.amountCents === "number" ? latest.amountCents : null,
          receiptsCount: sortedRecords.length,
        });
      } catch {
        if (!active) return;
        setError("Account summary is temporarily unavailable.");
        setSummary((prev) => ({ ...prev }));
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  return useMemo(
    () => ({
      loading,
      error,
      summary,
    }),
    [loading, error, summary]
  );
}
